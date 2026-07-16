// @ts-nocheck
import * as THREE from "three";
import { OneEuroVec3, OneEuroQuat, OneEuro } from "./smoothing";


export const RING_FIT = {
  alongT: 0.5,        // 0 = knuckle, 1 = first joint
  sizeCm: 1.7,        // model max-dimension (cm) on an AVERAGE finger — the
                      // primary size control (calibrate live with Z/X). Robust
                      // "reference sizing": no dependence on the fragile
                      // auto-hole measurement for the overall scale.
  liftCm: 0.0,        // seat depth along the palm normal (± on/off the skin)
  tiltDamp: 0.3,      // 1 = follow the finger's depth tilt fully, 0 = frontal
};

const KNUCKLE_SPAN_CM = 6.5; // canonical index-MCP ↔ pinky-MCP distance
const MP_VERTICAL_FOV_DEG = 63;
const R_FADE_EDGE = 0.06;    // fade near the frame edge (normalized)
const REF_FINGER_W_CM = 1.5; // average adult ring-finger width (sizeCm baseline)
const FINGER_GAIN = 0.6;     // how much ring size follows measured finger size
                             // (0 = fixed, 1 = fully proportional)

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


/* Detect the loop's HOLE AXIS from geometry and rotate it onto +Y, then
   return the hole radius. Principle: about its true hole axis, a band's
   vertices never come near the axis (min radial distance = inner radius);
   about a perpendicular axis they pass right through it (min ≈ 0). Kills
   the per-model axis guessing that caused every "it loads sideways" bug.
   Mid-plane banding (|coord| < 0.12) keeps gems/prongs from faking a hole. */
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
  // DETECT with the UNBANDED minima: a band's material lies ON any
  // perpendicular axis (minRAll ≈ 0) but never near its true hole axis
  // (minRAll = inner radius). The banded values are only for the radius —
  // banding during detection excludes exactly the disproving vertices.
  const det = minRAll.map((m) => (Number.isFinite(m) ? m : 0));
  let axis = 1;
  if (det[0] > det[axis]) axis = 0;
  if (det[2] > det[axis]) axis = 2;
  // Rotate the detected axis onto +Y in the PARENT frame (premultiply), so
  // it composes correctly with any per-model rotationFix already applied.
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
    // Steady when held still, still responsive on deliberate motion.
    this._pos = new OneEuroVec3({ minCutoff: 0.3, beta: 0.08 });
    this._quat = new OneEuroQuat({ minCutoff: 0.3, beta: 0.16 });
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
    // Landmarks near/off the frame edge are extrapolated garbage — hide
    // rather than guess (common when the hand is held very close).
    for (const p of [mcp, pip, idx, pinky]) {
      if (p.x < 0.01 || p.x > 0.99 || p.y < 0.01 || p.y > 0.99) {
        this._applyOpacity(0);
        return;
      }
    }
    const vw = view?.videoW || 640, vh = view?.videoH || 480;

    // Depth from the knuckle span. CRITICAL: the ruler must be the pair's
    // VIEW-PERPENDICULAR extent from the world landmarks (x/y only, same
    // image-aligned axes as the pixels) — a fixed 6.5 cm constant makes an
    // angled hand read as "far away" (foreshortened pixels ÷ full-length
    // ruler), shrinking the ring on back-of-hand poses.
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
    // Floor 8 cm, not 15: a hand held close used to pin at the wrong depth,
    // breaking the ring-size-to-finger match exactly at inspection range.
    const d = THREE.MathUtils.clamp((spanCm * focalPx) / spanPx, 8, 120);

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

    // Reduce the ring's tilt INTO the screen (the depth component of the
    // finger axis) so it reads less slanted, while still following the
    // finger's in-plane angle. tiltDamp 1 = true finger tilt, 0 = frontal.
    const tiltDamp = this._fit.tiltDamp ?? 0.5;
    _dir.z *= tiltDamp;
    if (_dir.lengthSq() < 1e-6) _dir.set(0, 1, 0);
    _dir.normalize();

    // Proper RIGHT-HANDED basis for BOTH hands — no axis flip. Flipping an
    // axis (the old chirality hack) makes a left-handed basis that garbles
    // the quaternion on one hand → that hand's ring looked broken/absent.
    _normal.copy(_side).cross(_dir).normalize();
    _side.copy(_dir).cross(_normal).normalize();
    _basis.makeBasis(_side, _dir, _normal);
    _quatRaw.setFromRotationMatrix(_basis);
    // Keep the GEM on the camera-facing (back-of-hand) side. Roll 180° ABOUT
    // THE FINGER AXIS when needed — a proper rotation (det +1), geometric, so
    // no reliance on MediaPipe's unreliable left/right labels. gemFlip covers
    // models whose gem sits on -normal (Rosanna): XOR so the pavé lands on
    // the back for both.
    const gemFlip = this._fit.gemFlip === true;
    if ((_normal.z < 0) !== gemFlip) _quatRaw.multiply(_qFlipY);

    const f = this._fit;
    _pos.copy(_mcp).lerp(_pip, f.alongT).addScaledVector(_normal, f.liftCm);

    const pos = this._pos.filter(_pos, dtSeconds);
    const quat = this._quat.filter(_quatRaw, dtSeconds);
    this.group.position.copy(pos);
    this.group.quaternion.copy(quat);

    // SIZE locked to the ON-SCREEN finger scale — NOT a metric round-trip.
    // The ring's PROJECTED size = sizeK × the pixel spacing between the ring
    // and middle knuckles (a proxy for finger width that tracks BOTH distance
    // and pose). We then solve the metric scale that yields that projected
    // size at the placement depth: apparent = s·focal/d = targetPx exactly,
    // so ANY depth-estimate error cancels and the ring can no longer breathe
    // when the hand shifts or tilts. (This was the bug: size used a fixed cm
    // at an unstable estimated depth.)
    const knuckPx = Math.hypot((lm[13].x - lm[9].x) * vw, (lm[13].y - lm[9].y) * vh);
    const knuckPxSmooth = this._fingerW.filter(knuckPx, dtSeconds);
    const targetPx = (f.sizeCm ?? 1.35) * knuckPxSmooth;
    const holeRN = this._holeR ?? 0.35; // normalized units (occluder only)
    const s = (targetPx * d / focalPx) * this._fitScale;
    this.group.scale.setScalar(Math.max(0.001, s));

    // WRAP by occlusion, not clipping: the real finger fills the ring's hole,
    // so a solid depth-only cylinder CONCENTRIC with the band (radius = the
    // scaled hole) hides the rear of the band while the front + sides render
    // and curve around it. Only the band's thickness sticks out past the
    // finger silhouette — exactly how a real ring looks. Sized just inside
    // the hole (×0.98) so it never eats the visible front of the band.
    const segLen = _mcp.distanceTo(_pip) + 1.2;
    const occR = holeRN * s * 0.98;
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
