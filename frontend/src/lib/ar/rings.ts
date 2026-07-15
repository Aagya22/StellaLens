// @ts-nocheck
import * as THREE from "three";
import { OneEuroVec3, OneEuroQuat, OneEuro } from "./smoothing";


export const RING_FIT = {
  alongT: 0.5,        // 0 = knuckle, 1 = first joint
  diameterScale: 1.05, // the model's measured HOLE as a multiple of the
                       // MEASURED finger width — auto-fits every hand
  diameterCm: 2.2,    // fallback when world landmarks are unavailable
  liftCm: 0.0,        // offset along the palm normal (± seats the band on the skin)
};

const KNUCKLE_SPAN_CM = 6.5; // canonical index-MCP ↔ pinky-MCP distance
const MP_VERTICAL_FOV_DEG = 63;
const R_FADE_EDGE = 0.06;    // fade near the frame edge (normalized)

const _mcp = new THREE.Vector3();
const _pip = new THREE.Vector3();
const _idx = new THREE.Vector3();
const _pinky = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _side = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _basis = new THREE.Matrix4();
const _quatRaw = new THREE.Quaternion();

function disposeObject3D(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) m?.dispose?.();
    }
  });
}


function measureHoleRadius(root) {
  root.updateMatrixWorld(true);

  let minR = Infinity;
  let minRAll = Infinity;
  const v = new THREE.Vector3();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry?.attributes?.position;
    if (!pos || pos.count === 0) return;
    const step = Math.max(1, Math.floor(pos.count / 8000));
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      const r = Math.hypot(v.x, v.z);
      if (r < minRAll) minRAll = r;
      if (Math.abs(v.y) < 0.12 && r < minR) minR = r;
    }
  });
  const chosen = Number.isFinite(minR) ? minR : minRAll;
  return Number.isFinite(chosen) ? Math.max(0.15, chosen) : 0.35;
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

export class RingSystem {
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
    this._fit = { ...RING_FIT };
    this._fitScale = 1;
    // Hands move fast — higher beta than face jewelry (respond over smooth).
    this._pos = new OneEuroVec3({ minCutoff: 1.0, beta: 0.3 });
    this._quat = new OneEuroQuat({ minCutoff: 1.0, beta: 0.5 });
    // Measured finger width — smoothed hard so the ring size never breathes.
    this._fingerW = new OneEuro({ minCutoff: 0.3, beta: 0.02 });
    this._fade = 0;

    // Depth-only finger capsule: the band's far side clips behind it.
    this._fingerOccluder = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, 16, 1),
      new THREE.MeshBasicMaterial({
        colorWrite: false, depthWrite: true,
        polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
      })
    );
    this._fingerOccluder.renderOrder = 0; // before the ring (renderOrder 1)
    this._fingerOccluder.frustumCulled = false;
    this._fingerOccluder.visible = false;
    this.scene.add(this._fingerOccluder);
  }

  setVisible(v) {
    this.group.visible = v;
    if (!v) this._fingerOccluder.visible = false;
  }

  getFit() { return this._fit; }

  async loadModel(modelPath, { fit = null, scale = 1, rotationFix = null, preserveMaterials = false } = {}) {
    this.clear();
    this._fit = { ...RING_FIT, ...(fit ?? {}) };
    this._fitScale = scale;
    this.onStatus("Loading ring model…");
    try {
      const gltf = await this.loader.loadAsync(modelPath);
      const root = gltf.scene;
      root.traverse((o) => {
        if (!o.isMesh) return;
        o.frustumCulled = false;
        o.renderOrder = 1;
      });
      this._modelRoot = root;
      const [rx, ry, rz] = rotationFix ?? [0, 0, 0];
      if (rx || ry || rz) {
        root.rotation.set(
          THREE.MathUtils.degToRad(rx),
          THREE.MathUtils.degToRad(ry),
          THREE.MathUtils.degToRad(rz)
        );
        root.updateMatrixWorld(true);
      }
      normalizeModelToUnit(root);
      this._holeR = measureHoleRadius(root);
      console.info(`[AR] ring hole radius (normalized): ${this._holeR.toFixed(3)} — ${modelPath}`);
      root.traverse((o) => {
        if (!o.isMesh) return;
        const clone = (m) => {
          if (!m) return m;
          const c = m.clone();
          const hasMaps = c.map || c.normalMap || c.metalnessMap || c.roughnessMap;
          if (!hasMaps && "envMapIntensity" in c) c.envMapIntensity = Math.max(c.envMapIntensity ?? 1, 1.8);
          c.userData._baseOpacity = c.opacity ?? 1;
          c.userData._baseTransparent = c.transparent === true;
          this._mats.push(c);
          return c;
        };
        o.material = Array.isArray(o.material) ? o.material.map(clone) : clone(o.material);
      });
      this.modelContainer.add(root);
      this.onStatus("");
    } catch (err) {
      console.error("[AR] ring model failed to load:", modelPath, err);
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
    this._quat.reset();
    this._fade = 0;
  }

  _applyOpacity(op) {
    for (const m of this._mats) {
      const base = m.userData._baseOpacity ?? 1;
      m.opacity = base * op;
      m.transparent = op < 0.999 ? true : m.userData._baseTransparent;
    }
    this.group.visible = op > 0.02;
    this._fingerOccluder.visible = this.group.visible;
  }

  /** Unproject a normalized landmark to camera space at depth d (cm). */
  _unproject(n, d, vw, vh, out) {
    const halfH = Math.tan(THREE.MathUtils.degToRad(MP_VERTICAL_FOV_DEG / 2));
    const halfW = halfH * (vw / vh);
    return out.set((n.x * 2 - 1) * halfW * d, (1 - n.y * 2) * halfH * d, -d);
  }

  /**
   * @param {{ hand: { landmarks }, view, dtSeconds }} args
   */
  update({ hand, view, dtSeconds }) {
    const lm = hand?.landmarks;
    if (!lm || lm.length < 21) return;
    const mcp = lm[13], pip = lm[14], idx = lm[5], pinky = lm[17];
    if (!mcp || !pip || !idx || !pinky) return;
    const vw = view?.videoW || 640, vh = view?.videoH || 480;

    // Depth from the knuckle span (ratio ruler).
    const spanPx = Math.hypot((idx.x - pinky.x) * vw, (idx.y - pinky.y) * vh);
    if (spanPx < 15) return;
    const halfH = Math.tan(THREE.MathUtils.degToRad(MP_VERTICAL_FOV_DEG / 2));
    const focalPx = (vh / 2) / halfH;
    const d = THREE.MathUtils.clamp((KNUCKLE_SPAN_CM * focalPx) / spanPx, 15, 120);

    // Position anchors from unprojected screen landmarks.
    this._unproject(mcp, d, vw, vh, _mcp);
    this._unproject(pip, d, vw, vh, _pip);

    // Orientation from METRIC world landmarks (reliable 3D, image-aligned
    // axes: x right, y down, z toward camera → negate y and z for ours).
    // The screen-landmark z is too weak for orientation — with it, the ring
    // never visibly tilted with the hand.
    const w = hand.worldLandmarks;
    if (w && w.length >= 21) {
      _dir.set(w[14].x - w[13].x, -(w[14].y - w[13].y), -(w[14].z - w[13].z)).normalize();
      _side.set(w[17].x - w[5].x, -(w[17].y - w[5].y), -(w[17].z - w[5].z)).normalize();
    } else {
      this._unproject(idx, d, vw, vh, _idx);
      this._unproject(pinky, d, vw, vh, _pinky);
      _dir.copy(_pip).sub(_mcp).normalize();
      _side.copy(_pinky).sub(_idx).normalize();
    }

    // Basis: Y along the finger, X across the knuckles, Z = palm normal.
    _normal.copy(_side).cross(_dir).normalize();      // palm normal
    _side.copy(_dir).cross(_normal).normalize();      // re-orthogonalized
    _basis.makeBasis(_side, _dir, _normal);
    _quatRaw.setFromRotationMatrix(_basis);

    const f = this._fit;
    _pos.copy(_mcp).lerp(_pip, f.alongT).addScaledVector(_normal, f.liftCm);

    const pos = this._pos.filter(_pos, dtSeconds);
    const quat = this._quat.filter(_quatRaw, dtSeconds);
    this.group.position.copy(pos);
    this.group.quaternion.copy(quat);

    let fingerW = 1.7;
    if (w && w.length >= 21) {
     
      const raw = Math.hypot(w[13].x - w[9].x, w[13].y - w[9].y, w[13].z - w[9].z) * 100 * 0.75;
      fingerW = THREE.MathUtils.clamp(raw, 1.2, 2.2);
    }
    fingerW = this._fingerW.filter(fingerW, dtSeconds);
    const holeRN = this._holeR ?? 0.35; // normalized units
    const loose = f.diameterScale ?? 1.05; // hole = finger width × loose
    const s = (w
      ? (fingerW * loose) / (2 * holeRN)
      : f.diameterCm) * this._fitScale;
    this.group.scale.setScalar(Math.max(0.001, s));

    // Finger capsule occluder — capped INSIDE the scaled hole, so it can
    // never swallow the band, by construction.
    const segLen = _mcp.distanceTo(_pip) + 0.8;
    const occR = Math.min(fingerW * 0.475, holeRN * s - 0.06);
    this._fingerOccluder.position.copy(pos);
    this._fingerOccluder.quaternion.copy(quat);
    this._fingerOccluder.scale.set(Math.max(0.2, occR), segLen, Math.max(0.2, occR));

    // Fade near frame edges / low confidence.
    const cx = (mcp.x + pip.x) / 2, cy = (mcp.y + pip.y) / 2;
    const edge = Math.min(cx, 1 - cx, cy, 1 - cy);
    const fade = THREE.MathUtils.clamp(edge / R_FADE_EDGE, 0, 1);
    this._fade = fade;
    this._applyOpacity(fade);
  }

  dispose() {
    this.clear();
    this.scene.remove(this.group);
    this.scene.remove(this._fingerOccluder);
    this._fingerOccluder.geometry.dispose();
    this._fingerOccluder.material.dispose();
  }
}
