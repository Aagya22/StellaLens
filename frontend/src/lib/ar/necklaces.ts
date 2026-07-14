// @ts-nocheck
import * as THREE from "three";
import { OneEuroVec3, OneEuro } from "./smoothing";


export const NECKLACE_ANCHOR = {
  dropRatio: 0.6,        // necklace centre below the chin, × jaw width
  widthRatio: 1.2,       // necklace width relative to jaw width
  pitchSensitivity: 0.3, // how much looking up/down shifts the drop
  yawFollow: 0.15,       // fraction of head yaw the necklace turns with
};

/* Necklaces are wider than earrings → fade a touch earlier. */
const N_FADE_START_DEG = 20;
const N_FADE_END_DEG   = 25;
const N_TRACKING_ZONE_W = 0.7;
const N_TRACKING_ZONE_H = 0.7;
const N_ZONE_FADE_MARGIN = 0.1;


const NECKLACE_CLIP_OFFSET = 0.15;

function disposeObject3D(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) m?.dispose?.();
    }
  });
}

function normToStageXY(p, view) {
  const px = p.x * view.videoW;
  const py = p.y * view.videoH;
  const sx = px * view.cover.scale + view.cover.offsetX;
  const sy = py * view.cover.scale + view.cover.offsetY;
  return { x: sx - view.stageW / 2, y: view.stageH / 2 - sy };
}

function normalizeModelToUnit(root) {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(maxDim) || maxDim <= 0) return;
  root.scale.multiplyScalar(1 / maxDim);
  const box2 = new THREE.Box3().setFromObject(root);
  root.position.sub(box2.getCenter(new THREE.Vector3()));
}

const _euler = new THREE.Euler(0, 0, 0, "YXZ");

export class NecklaceSystem {
  constructor({ scene, gltfLoader, onStatus }) {
    this.scene = scene;
    this.loader = gltfLoader;
    this.onStatus = onStatus ?? (() => {});
    this.group = new THREE.Group();
    this.group.visible = false;
    this.scene.add(this.group);
    this.modelContainer = new THREE.Group();
    this.group.add(this.modelContainer);
    this._modelRoot = null;
    this._mats = [];
    this._pos = new OneEuroVec3({ minCutoff: 1.0, beta: 0.02 });
    this._width = new OneEuro({ minCutoff: 1.0, beta: 0.02 });
    this._fade = 1;
    this._anchor = { ...NECKLACE_ANCHOR };
    this._fitScale = 1;
    this._rotationFix = [0, 0, 0];
    // World-space clip plane: keeps fragments below the neckline (normal down).
    this._clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 1e6);
    this._clipPoint = new THREE.Vector3();
    this._clipNormal = new THREE.Vector3(0, -1, 0);
  }

  setVisible(v) { this.group.visible = v; }

  getAnchor() { return this._anchor; }

  async loadModel(modelPath, { anchor = null, scale = 1, rotationFix = null, preserveMaterials = false } = {}) {
    this.clear();
    this._anchor = { ...NECKLACE_ANCHOR, ...(anchor ?? {}) };
    this._fitScale = scale;
    this._rotationFix = rotationFix ?? [0, 0, 0];
    this.onStatus("Loading necklace model…");
    try {
      const gltf = await this.loader.loadAsync(modelPath);
      const root = gltf.scene;
      root.traverse((o) => { if (o.isMesh) o.frustumCulled = false; });
      this._modelRoot = root;

      const [rx, ry, rz] = this._rotationFix;
      if (rx || ry || rz) {
        root.rotation.set(
          THREE.MathUtils.degToRad(rx),
          THREE.MathUtils.degToRad(ry),
          THREE.MathUtils.degToRad(rz)
        );
        root.updateMatrixWorld(true);
      }
      normalizeModelToUnit(root);


      root.traverse((o) => {
        if (!o.isMesh) return;
        const clone = (m) => {
          if (!m) return m;
          const c = m.clone();
          if (!preserveMaterials && "metalness" in c) { c.metalness = 1.0; c.roughness = 0.28; if (c.color) c.color.setHex(0xffd700); }
          const hasMaps = c.map || c.normalMap || c.metalnessMap || c.roughnessMap;
          if (!hasMaps && "envMapIntensity" in c) c.envMapIntensity = Math.max(c.envMapIntensity ?? 1, 1.8);
          c.userData._baseOpacity = c.opacity ?? 1;
          c.userData._baseTransparent = c.transparent === true;
          if ("side" in c) c.side = THREE.DoubleSide;
          c.clippingPlanes = [this._clipPlane];
          this._mats.push(c);
          return c;
        };
        o.material = Array.isArray(o.material) ? o.material.map(clone) : clone(o.material);
      });

      this.modelContainer.add(root);
      this.onStatus("");
    } catch (err) {
      console.error("[AR] necklace model failed to load:", modelPath, err);
      this.onStatus("Couldn't load this piece's 3D model.");
    }
  }

  clear() {
    if (this._modelRoot) { disposeObject3D(this._modelRoot); this._modelRoot = null; }
    while (this.modelContainer.children.length) {
      const c = this.modelContainer.children.pop();
      if (c) disposeObject3D(c);
    }
    this._mats = [];
    this._pos.reset();
    this._width.reset();
    this._fade = 1;
  }

  _applyOpacity(op) {
    for (const m of this._mats) {
      const base = m.userData._baseOpacity ?? 1;
      m.opacity = base * op;
      m.transparent = op < 0.999 ? true : m.userData._baseTransparent;
    }
    this.group.visible = op > 0.02;
  }

  /**
   * @param {{ landmarks, view, headPose, dtSeconds }} args
   * headPose: { yaw, pitch, roll } radians from the facial transform matrix.
   */
  update({ landmarks, view, headPose, dtSeconds }) {
    if (!landmarks || landmarks.length < 468) return;
    const chin = landmarks[152];
    const jawL = landmarks[234];
    const jawR = landmarks[454];
    if (!chin || !jawL || !jawR) return;

    const chinPx = normToStageXY(chin, view);
    const jawLpx = normToStageXY(jawL, view);
    const jawRpx = normToStageXY(jawR, view);
    const jawWidthPx = Math.hypot(jawRpx.x - jawLpx.x, jawRpx.y - jawLpx.y);
    const smoothWidth = this._width.filter(jawWidthPx, dtSeconds);

    const pitch = headPose?.pitch ?? 0;
    const yaw = headPose?.yaw ?? 0;
    const roll = headPose?.roll ?? 0;

    // Drop below the chin, pitch-adjusted (look down → necklace pushed up).
    const drop = this._anchor.dropRatio * (1 + pitch * this._anchor.pitchSensitivity);
    const target = new THREE.Vector3(chinPx.x, chinPx.y - smoothWidth * drop, 0);
    const pos = this._pos.filter(target, dtSeconds);
    this.group.position.copy(pos);

    // Rotation: small pitch, low yaw-follow, full roll (rests on the chest).
    _euler.set(pitch * 0.3, yaw * this._anchor.yawFollow, roll, "YXZ");
    this.group.quaternion.setFromEuler(_euler);

    // Scale by jaw width; yaw compresses the apparent width (foreshortening).
    const yawCompress = Math.max(0.35, Math.cos(yaw));
    const scale = Math.max(60, smoothWidth * this._anchor.widthRatio) * this._fitScale;
    this.group.scale.set(scale * yawCompress, scale, scale);

    // Back-of-neck clip: a world-space plane at the neckline that tilts with
    // roll, so the top V of the chain hides behind the neck as if worn.
    const clipY = pos.y + NECKLACE_CLIP_OFFSET * scale;
    this._clipNormal.set(Math.sin(roll), -Math.cos(roll), 0);
    this._clipPoint.set(pos.x, clipY, pos.z);
    this._clipPlane.setFromNormalAndCoplanarPoint(this._clipNormal, this._clipPoint);

    // Fade: yaw + centre zone (measured at the chin, normalized frame).
    const yawDeg = THREE.MathUtils.radToDeg(Math.abs(yaw));
    let fade = THREE.MathUtils.clamp((N_FADE_END_DEG - yawDeg) / (N_FADE_END_DEG - N_FADE_START_DEG), 0, 1);
    const dx = Math.abs(chin.x - 0.5), dy = Math.abs(chin.y - 0.5);
    const ox = 1 - THREE.MathUtils.clamp((dx - N_TRACKING_ZONE_W / 2) / N_ZONE_FADE_MARGIN, 0, 1);
    const oy = 1 - THREE.MathUtils.clamp((dy - N_TRACKING_ZONE_H / 2) / N_ZONE_FADE_MARGIN, 0, 1);
    fade = Math.min(fade, ox, oy);
    this._fade = fade;
    this._applyOpacity(fade);
  }

  dispose() {
    this.clear();
    this.scene.remove(this.group);
  }
}
