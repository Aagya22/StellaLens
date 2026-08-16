// @ts-nocheck
import * as THREE from "three";
import { OneEuroVec3, OneEuroQuat, OneEuro } from "./smoothing";

export const RING_FIT = {
  alongT: 0.5,
  sizeCm: 1.7,
  liftCm: 0.0,
  // tiltDamp 1 = true finger tilt, 0 = frontal.
  tiltDamp: 0.3,
};

const KNUCKLE_SPAN_CM = 6.5;
const MP_VERTICAL_FOV_DEG = 63;
const R_FADE_EDGE = 0.06;
const REF_FINGER_W_CM = 1.5;
const FINGER_GAIN = 0.6;
const GEM_FLIP_DEADBAND = 0.15;
const FINGER_RADIUS_FRAC = 0.46;

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
const _qFlipY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

export function disposeObject3D(root) {
  root.traverse((o) => {
    if (o.isMesh) {
      o.geometry?.dispose?.();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) m?.dispose?.();
    }
  });
}

// Vertices never come near the true hole axis but cross any perpendicular one.
export function autoOrientHole(root) {
  root.updateMatrixWorld(true);
  const v = new THREE.Vector3();
  const minR = [Infinity, Infinity, Infinity];
  const minRAll = [Infinity, Infinity, Infinity];
  root.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry?.attributes?.position;
    if (!pos || pos.count === 0) return;
    const step = Math.max(1, Math.floor(pos.count / 8000));
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
      const c = [v.x, v.y, v.z];
      const r = [Math.hypot(c[1], c[2]), Math.hypot(c[0], c[2]), Math.hypot(c[0], c[1])];
      for (let a = 0; a < 3; a++) {
        if (r[a] < minRAll[a]) minRAll[a] = r[a];
        if (Math.abs(c[a]) < 0.12 && r[a] < minR[a]) minR[a] = r[a];
      }
    }
  });

  const det = minRAll.map((m) => (Number.isFinite(m) ? m : 0));
  let axis = 1;
  if (det[0] > det[axis]) axis = 0;
  if (det[2] > det[axis]) axis = 2;

  const q = new THREE.Quaternion();
  if (axis === 0) q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
  else if (axis === 2) q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  if (axis !== 1) {
    root.quaternion.premultiply(q);
    root.updateMatrixWorld(true);
  }
  const radius = Number.isFinite(minR[axis]) ? minR[axis] : det[axis];
  return Math.max(0.15, radius);
}

export function normalizeModelToUnit(root) {
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

    // beta 0.3: hands move far faster than heads. Lower values lag.
    this._pos = new OneEuroVec3({ minCutoff: 0.3, beta: 0.3 });
    this._quat = new OneEuroQuat({ minCutoff: 0.3, beta: 0.3 });

    this._fingerW = new OneEuro({ minCutoff: 0.3, beta: 0.02 });
    this._fade = 0;

    this._normalFacing = true;

    this._fingerOccluder = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, 16, 1),
      new THREE.MeshBasicMaterial({
        colorWrite: false, depthWrite: true,
        polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
      })
    );
    this._fingerOccluder.renderOrder = 0;
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
      this._holeR = autoOrientHole(root);
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
    this._normalFacing = true;
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

  _unproject(n, d, vw, vh, out) {
    const halfH = Math.tan(THREE.MathUtils.degToRad(MP_VERTICAL_FOV_DEG / 2));
    const halfW = halfH * (vw / vh);
    return out.set((n.x * 2 - 1) * halfW * d, (1 - n.y * 2) * halfH * d, -d);
  }

  update({ hand, view, dtSeconds }) {
    const lm = hand?.landmarks;
    if (!lm || lm.length < 21) return;
    const mcp = lm[13], pip = lm[14], idx = lm[5], pinky = lm[17];
    if (!mcp || !pip || !idx || !pinky) return;

    for (const p of [mcp, pip, idx, pinky]) {
      if (p.x < 0.01 || p.x > 0.99 || p.y < 0.01 || p.y > 0.99) {
        this._applyOpacity(0);
        return;
      }
    }
    const vw = view?.videoW || 640, vh = view?.videoH || 480;

    const spanPx = Math.hypot((idx.x - pinky.x) * vw, (idx.y - pinky.y) * vh);
    if (spanPx < 15) return;
    const halfH = Math.tan(THREE.MathUtils.degToRad(MP_VERTICAL_FOV_DEG / 2));
    const focalPx = (vh / 2) / halfH;
    const wDepth = hand.worldLandmarks;
    let spanCm = KNUCKLE_SPAN_CM;
    if (wDepth && wDepth.length >= 21) {
      const perp = Math.hypot(wDepth[5].x - wDepth[17].x, wDepth[5].y - wDepth[17].y) * 100;
      if (perp > 1.5) spanCm = perp;
    }

    const d = THREE.MathUtils.clamp((spanCm * focalPx) / spanPx, 8, 120);

    this._unproject(mcp, d, vw, vh, _mcp);
    this._unproject(pip, d, vw, vh, _pip);

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

    const tiltDamp = this._fit.tiltDamp ?? 0.5;
    _dir.z *= tiltDamp;
    if (_dir.lengthSq() < 1e-6) _dir.set(0, 1, 0);
    _dir.normalize();

    _normal.copy(_side).cross(_dir).normalize();
    _side.copy(_dir).cross(_normal).normalize();
    _basis.makeBasis(_side, _dir, _normal);
    _quatRaw.setFromRotationMatrix(_basis);

    if (_normal.z > GEM_FLIP_DEADBAND) this._normalFacing = true;
    else if (_normal.z < -GEM_FLIP_DEADBAND) this._normalFacing = false;
    const gemFlip = this._fit.gemFlip === true;
    if ((!this._normalFacing) !== gemFlip) _quatRaw.multiply(_qFlipY);

    const f = this._fit;
    _pos.copy(_mcp).lerp(_pip, f.alongT).addScaledVector(_normal, f.liftCm);

    const pos = this._pos.filter(_pos, dtSeconds);
    const quat = this._quat.filter(_quatRaw, dtSeconds);
    this.group.position.copy(pos);
    this.group.quaternion.copy(quat);

    const knuckPx = Math.hypot((lm[13].x - lm[9].x) * vw, (lm[13].y - lm[9].y) * vh);
    const knuckPxSmooth = this._fingerW.filter(knuckPx, dtSeconds);
    const targetPx = (f.sizeCm ?? 1.35) * knuckPxSmooth;
    const holeRN = this._holeR ?? 0.35;
    const s = (targetPx * d / focalPx) * this._fitScale;
    this.group.scale.setScalar(Math.max(0.001, s));

    const segLen = _mcp.distanceTo(_pip) + 1.2;

    const fingerR = (knuckPxSmooth * d / focalPx) * FINGER_RADIUS_FRAC;
    const occR = Math.min(fingerR, holeRN * s * 0.98);
    this._fingerOccluder.position.copy(pos);
    this._fingerOccluder.quaternion.copy(quat);
    this._fingerOccluder.scale.set(Math.max(0.2, occR), segLen, Math.max(0.2, occR));

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
