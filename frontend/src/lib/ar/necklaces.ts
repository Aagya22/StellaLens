// @ts-nocheck
import * as THREE from "three";
import { OneEuroVec3, OneEuroQuat } from "./smoothing";
import { dampHeadPoseQuaternion } from "./headPose";

// Pivot follows the head fully at the spine; the drape to the chest is damped,
// so head pitch never moves the chain and calibrations repeat.
export const NECKLACE_ANCHOR = {
  pivotOffset: { x: 0, y: -8, z: -6 },
  dropCm: 5.6,
  forwardCm: 5.2,
  widthCm: 12,
  lengthCm: 0,
  pendantCm: 4,

  occRxCm: 4.0,
  occRzCm: 4.4,
  occHCm: 10.3,
  yawFollow: 0.12,
  pitchFollow: 0.25,
  rollFollow: 0.3,
};

function sanitizeAnchor(a) {
  a.pivotOffset.x = THREE.MathUtils.clamp(a.pivotOffset.x, -4, 4);
  a.pivotOffset.y = THREE.MathUtils.clamp(a.pivotOffset.y, -14, -4);

  a.pivotOffset.z = THREE.MathUtils.clamp(a.pivotOffset.z, -10, -4);

  a.forwardCm = THREE.MathUtils.clamp(a.forwardCm, 0, 14);
  a.dropCm = THREE.MathUtils.clamp(a.dropCm, 0, 22);
  a.widthCm = THREE.MathUtils.clamp(a.widthCm, 6, 30);
  if (a.lengthCm) a.lengthCm = THREE.MathUtils.clamp(a.lengthCm, 6, 35);
  a.pendantCm = THREE.MathUtils.clamp(a.pendantCm ?? 4, 1, 10);
  a.occRxCm = THREE.MathUtils.clamp(a.occRxCm ?? 5.0, 3, 12);
  a.occRzCm = THREE.MathUtils.clamp(a.occRzCm ?? 5.5, 3, 12);
  a.occHCm = THREE.MathUtils.clamp(a.occHCm ?? 13, 8, 22);
  return a;
}

const N_FADE_START_DEG = 45;
const N_FADE_END_DEG   = 55;
const N_TRACKING_ZONE_W = 0.7;
const N_TRACKING_ZONE_H = 0.7;
const N_ZONE_FADE_MARGIN = 0.1;

const NECK_OCCLUDER_DEBUG = false;

const NECK_CM = { radiusX: 5.0, radiusZ: 5.5, height: 13 };

const _offset = new THREE.Vector3();
const _target = new THREE.Vector3();
const _drape = new THREE.Vector3();

function disposeObject3D(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) m?.dispose?.();
    }
  });
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

    this._pos = new OneEuroVec3({ minCutoff: 0.5, beta: 0.3 });
    this._quat = new OneEuroQuat({ minCutoff: 0.6, beta: 0.25 });
    this._fade = 1;
    this._anchor = structuredClone(NECKLACE_ANCHOR);
    this._fitScale = 1;
    this._rotationFix = [0, 0, 0];

    this._style = "full";
    this._pendantTopY = 0.5;
    this._chainMesh = null;
    this._chainKey = "";
    this._chainMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37, metalness: 1.0, roughness: 0.3, envMapIntensity: 1.6,
    });
    this._chainMat.userData._baseOpacity = 1;
    this._chainMat.userData._baseTransparent = false;

    this._neckOccluder = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, 32, 1),
      NECK_OCCLUDER_DEBUG
        ? new THREE.MeshBasicMaterial({
            color: 0xff0000, transparent: true, opacity: 0.15,
            depthWrite: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
          })
        : new THREE.MeshBasicMaterial({
            colorWrite: false, depthWrite: true,
            polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
          })
    );
    this._neckOccluder.renderOrder = 0;
    this._neckOccluder.frustumCulled = false;
    this._neckOccluder.visible = false;
    this.scene.add(this._neckOccluder);
    this._occluderDebug = NECK_OCCLUDER_DEBUG;
  }

  toggleOccluderDebug() {
    this._occluderDebug = !this._occluderDebug;
    const m = this._neckOccluder.material;
    m.colorWrite = this._occluderDebug;
    m.transparent = this._occluderDebug;
    m.opacity = this._occluderDebug ? 0.15 : 1;
    m.color.setHex(0xff0000);
    m.needsUpdate = true;
    return this._occluderDebug;
  }

  setVisible(v) {
    this.group.visible = v;
    if (!v) this._neckOccluder.visible = false;
  }

  getAnchor() { return this._anchor; }

  setBodyScale(s) {
    this._bodyScale = THREE.MathUtils.clamp(s || 1, 0.75, 1.3);
  }

  setMetalTone(tone) {
    this._tone = tone === "silver" ? "silver" : "gold";
    const hex = this._tone === "silver" ? 0xe6e8ea : 0xffd700;
    const rough = this._tone === "silver" ? 0.22 : 0.28;
    for (const m of [...this._mats, this._chainMat]) {
      if (m && "metalness" in m && m.color) {
        m.color.setHex(hex);
        if ("roughness" in m) m.roughness = rough;
      }
    }
  }

  async loadModel(modelPath, { anchor = null, scale = 1, rotationFix = null, preserveMaterials = false, style = "full", stripNodes = null } = {}) {
    this.clear();
    this._style = style === "pendant" ? "pendant" : "full";
    this._anchor = { ...structuredClone(NECKLACE_ANCHOR), ...(anchor ?? {}) };
    if (anchor?.pivotOffset) this._anchor.pivotOffset = { ...NECKLACE_ANCHOR.pivotOffset, ...anchor.pivotOffset };
    sanitizeAnchor(this._anchor);
    this._fitScale = scale;
    this._rotationFix = rotationFix ?? [0, 0, 0];
    this.onStatus("Loading necklace model…");
    try {
      const gltf = await this.loader.loadAsync(modelPath);
      const root = gltf.scene;

      if (Array.isArray(stripNodes) && stripNodes.length) {
        const pats = stripNodes.map((s) => String(s).toLowerCase());
        const doomed = [];
        root.traverse((o) => {
          const n = (o.name || "").toLowerCase();
          if (pats.some((p) => n.includes(p))) doomed.push(o);
        });
        for (const d of doomed) {
          d.parent?.remove(d);
          disposeObject3D(d);
        }
      }
      root.traverse((o) => {
        if (!o.isMesh) return;
        o.frustumCulled = false;
        o.renderOrder = 1;
      });
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

      this._pendantTopY = new THREE.Box3().setFromObject(root).max.y;

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
          this._mats.push(c);
          return c;
        };
        o.material = Array.isArray(o.material) ? o.material.map(clone) : clone(o.material);
      });

      this.modelContainer.add(root);

      if (!preserveMaterials) this.setMetalTone("gold");
      this.onStatus("");
    } catch (err) {
      console.error("[AR] necklace model failed to load:", modelPath, err);
      this.onStatus("Couldn't load this piece's 3D model.");
    }
  }

  _rebuildChain(rx, drop, fwd) {
    const key = `${rx.toFixed(2)}|${drop.toFixed(2)}|${fwd.toFixed(2)}`;
    if (key === this._chainKey && this._chainMesh) return;
    this._chainKey = key;
    if (this._chainMesh) {
      this.group.remove(this._chainMesh);
      this._chainMesh.geometry.dispose();
      this._chainMesh = null;
    }
    const yTop = -3.5;
    const rz = NECK_CM.radiusZ + 0.4;
    const yMid = yTop + (-drop - yTop) * 0.55;
    const curve = new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(0, yTop - 0.5, -rz),
        new THREE.Vector3(-rx, yTop, 0),
        new THREE.Vector3(-rx * 0.55, yMid, fwd * 0.75),
        new THREE.Vector3(0, -drop, fwd),
        new THREE.Vector3(rx * 0.55, yMid, fwd * 0.75),
        new THREE.Vector3(rx, yTop, 0),
      ],
      true, "catmullrom", 0.5
    );
    const geo = new THREE.TubeGeometry(curve, 160, 0.14, 8, true);
    this._chainMesh = new THREE.Mesh(geo, this._chainMat);
    this._chainMesh.renderOrder = 1;
    this._chainMesh.frustumCulled = false;
    this.group.add(this._chainMesh);
  }

  clear() {
    if (this._modelRoot) { disposeObject3D(this._modelRoot); this._modelRoot = null; }
    if (this._chainMesh) {
      this.group.remove(this._chainMesh);
      this._chainMesh.geometry.dispose();
      this._chainMesh = null;
      this._chainKey = "";
    }
    while (this.modelContainer.children.length) {
      const c = this.modelContainer.children.pop();
      if (c) disposeObject3D(c);
    }
    this._mats = [];
    this.modelContainer.position.set(0, 0, 0);
    this.modelContainer.scale.setScalar(1);
    this._pos.reset();
    this._quat.reset();
    this._fade = 1;
  }

  _applyOpacity(op) {
    for (const m of [...this._mats, this._chainMat]) {
      const base = m.userData._baseOpacity ?? 1;
      m.opacity = base * op;
      m.transparent = op < 0.999 ? true : m.userData._baseTransparent;
    }
    this.group.visible = op > 0.02;
  }

  update({ landmarks, headPose, dtSeconds }) {
    if (!headPose || !landmarks || landmarks.length < 468) return;

    const a = sanitizeAnchor(this._anchor);

    const damped = dampHeadPoseQuaternion(headPose.quaternion, {
      yaw: a.yawFollow, pitch: a.pitchFollow, roll: a.rollFollow,
    });

    _offset.set(a.pivotOffset.x, a.pivotOffset.y, a.pivotOffset.z).applyQuaternion(headPose.quaternion);
    _target.copy(headPose.position).add(_offset);

    const pivot = this._pos.filter(_target, dtSeconds);
    const quat = this._quat.filter(damped, dtSeconds);

    const bs = this._bodyScale || 1;
    _drape.set(0, -a.dropCm * bs, a.forwardCm * bs).applyQuaternion(quat);
    this.group.position.copy(pivot).add(_drape);
    this.group.quaternion.copy(quat);
    if (this._style === "pendant") {
      this.group.scale.setScalar(1);
      const s = a.pendantCm * this._fitScale;
      this.modelContainer.scale.setScalar(s);

      this.modelContainer.position.set(0, -a.dropCm - this._pendantTopY * s + 0.3, a.forwardCm);
      this._rebuildChain(a.widthCm / 2, a.dropCm, a.forwardCm);
    } else {
      const w = Math.max(0.001, a.widthCm * this._fitScale);
      const l = Math.max(0.001, (a.lengthCm || a.widthCm) * this._fitScale);
      this.group.scale.set(w, l, w);
    }

    this._neckOccluder.position.copy(pivot);
    this._neckOccluder.quaternion.copy(quat);
    this._neckOccluder.scale.set(a.occRxCm * bs, a.occHCm * bs, a.occRzCm * bs);

    const chin = landmarks[152];
    const yawDeg = Math.abs(headPose.yawDeg ?? 0);
    let fade = THREE.MathUtils.clamp((N_FADE_END_DEG - yawDeg) / (N_FADE_END_DEG - N_FADE_START_DEG), 0, 1);
    if (chin) {
      const dx = Math.abs(chin.x - 0.5), dy = Math.abs(chin.y - 0.5);
      const ox = 1 - THREE.MathUtils.clamp((dx - N_TRACKING_ZONE_W / 2) / N_ZONE_FADE_MARGIN, 0, 1);
      const oy = 1 - THREE.MathUtils.clamp((dy - N_TRACKING_ZONE_H / 2) / N_ZONE_FADE_MARGIN, 0, 1);
      fade = Math.min(fade, ox, oy);
    }
    this._fade = fade;
    this._applyOpacity(fade);
    this._neckOccluder.visible = this.group.visible;
  }

  dispose() {
    this.clear();
    this.scene.remove(this.group);
    this.scene.remove(this._neckOccluder);
    this._neckOccluder.geometry.dispose();
    this._neckOccluder.material.dispose();
    this._chainMat.dispose();
  }
}
