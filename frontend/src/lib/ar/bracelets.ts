// @ts-nocheck
import * as THREE from "three";
import { OneEuroVec3, OneEuroQuat, OneEuro } from "./smoothing";
import { disposeObject3D, autoOrientHole, normalizeModelToUnit } from "./rings";

export const BRACELET_FIT = {
  loose: 1.15,
  offsetCm: 2.0,
  wristCm: 5.6,
  tiltDeg: 0,
};

const MP_VERTICAL_FOV_DEG = 63;
const B_FADE_EDGE = 0.06;
const PALM_LEN_CM = 9.6;
const WRIST_FROM_SPAN = 0.92;
const SKIN_TOL = 0.045;
const NOMINAL_WRIST_CM = 5.2;
const TILT_DAMP = 0.4;

const FACING_MIN = 0.30;
const MIN_SCORE = 0.6;
const LOST_FADE_MS = 120;
const OPEN_ENTER = 0.58;
const OPEN_EXIT = 0.46;
const DEPTH_PAIRS = [[0, 5], [0, 9], [0, 13], [0, 17], [5, 9], [9, 13], [13, 17], [5, 17]];

const _wrist = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _side = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _basis = new THREE.Matrix4();
const _quatRaw = new THREE.Quaternion();
const _qTilt = new THREE.Quaternion();
const _axisZ = new THREE.Vector3(0, 0, 1);
const _palmA = new THREE.Vector3();
const _palmB = new THREE.Vector3();
const _palmN = new THREE.Vector3();

export class BraceletSystem {
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
    this._fit = { ...BRACELET_FIT };
    this._fitScale = 1;
    this._holeR = 0.4;

    this._pos = new OneEuroVec3({ minCutoff: 0.3, beta: 0.4 });
    this._quat = new OneEuroQuat({ minCutoff: 0.25, beta: 0.18 });
    this._depth = new OneEuro({ minCutoff: 0.35, beta: 0.2 });
    this._span = new OneEuro({ minCutoff: 0.3, beta: 0.15 });
    this._dLast = 0;

    this._posed = false;
    this._lostMs = 0;
    this._fade = 0;

    this._cvs = document.createElement("canvas");
    this._cvs.width = 128; this._cvs.height = 128;
    this._ctx = this._cvs.getContext("2d", { willReadFrequently: true });

    this._wristOccluder = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, 20, 1),
      new THREE.MeshBasicMaterial({
        colorWrite: false, depthWrite: true,
        polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
      })
    );
    this._wristOccluder.renderOrder = 0;
    this._wristOccluder.frustumCulled = false;
    this._wristOccluder.visible = false;
    this.scene.add(this._wristOccluder);
  }

  setVisible(v) {
    if (!v) {
      this._posed = false; this._lostMs = 0; this._fade = 0; this._dLast = 0;
      this._pos.reset(); this._quat.reset(); this._depth.reset(); this._span.reset();
      this.group.visible = false;
      this._wristOccluder.visible = false;
      return;
    }
    this.group.visible = this._fade > 0.02;
  }

  getFit() { return this._fit; }

  isPosed() { return this._posed; }

  async loadModel(modelPath, { fit = null, scale = 1, rotationFix = null, stripNodes = null, preserveMaterials = false } = {}) {
    this.clear();
    this._fit = { ...BRACELET_FIT, ...(fit ?? {}) };
    this._fitScale = scale;
    this.onStatus("Loading bracelet model…");
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
      console.info(`[AR] bracelet hole radius (normalized): ${this._holeR.toFixed(3)} — ${modelPath}`);
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
      console.error("[AR] bracelet model failed to load:", modelPath, err);
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
    this._posed = false;
    this._fade = 0;
  }

  _applyOpacity(op) {
    for (const m of this._mats) {
      const base = m.userData._baseOpacity ?? 1;
      m.opacity = base * op;
      m.transparent = op < 0.999 ? true : m.userData._baseTransparent;
    }
    this.group.visible = op > 0.02;
    this._wristOccluder.visible = this.group.visible;
  }

  _miss(dtSeconds) {
    this._lostMs += (dtSeconds || 0) * 1000;
    this._fade = Math.min(this._fade, Math.max(0, 1 - this._lostMs / LOST_FADE_MS));
    this._applyOpacity(this._fade);
  }

  _palmMetrics(w) {
    const len = (a, b) => Math.hypot(w[a].x - w[b].x, w[a].y - w[b].y, w[a].z - w[b].z) * 100;
    const palm = len(0, 9);
    if (!(palm > 6 && palm < 14)) return null;
    for (const mcp of [5, 13, 17]) {
      const r = len(0, mcp) / palm;
      if (r < 0.7 || r > 1.2) return null;
    }
    let ext = 0;
    for (const [tip, mcp] of [[8, 5], [12, 9], [16, 13], [20, 17]]) ext += len(tip, mcp) / palm;

    _palmA.set(w[5].x - w[0].x, -(w[5].y - w[0].y), -(w[5].z - w[0].z));
    _palmB.set(w[17].x - w[0].x, -(w[17].y - w[0].y), -(w[17].z - w[0].z));
    _palmN.copy(_palmA).cross(_palmB);
    const nl = _palmN.length();
    return { palm, openness: ext / 4, facing: nl > 1e-6 ? Math.abs(_palmN.z / nl) : 0 };
  }

  _checkPose(m) {
    if (!m) { this._posed = true; return true; }
    const was = this._posed;
    this._posed = m.facing > FACING_MIN && (was ? m.openness > OPEN_EXIT : m.openness > OPEN_ENTER);
    if (this._posed !== was) {
      console.info(`[AR] bracelet pose ${this._posed ? 'on' : 'off'} — open ${m.openness.toFixed(2)} facing ${m.facing.toFixed(2)}`);
      if (this._posed) { this._pos.reset(); this._quat.reset(); this._depth.reset(); this._span.reset(); this._dLast = 0; }
    }
    return this._posed;
  }

  // Walks outwards from a point known to be on the arm until the colour stops
  // matching it. Keyed to the sampled skin, so tone and lighting don't matter.
  _measureArmPx(video, cxPx, cyPx, perpX, perpY, reachPx, vw, vh) {
    const ctx = this._ctx;
    if (!ctx || !video) return 0;
    const S = 128;
    const side = Math.max(24, reachPx * 2);
    const sx = cxPx - side / 2, sy = cyPx - side / 2;
    if (sx < 0 || sy < 0 || sx + side > vw || sy + side > vh) return 0;
    try { ctx.drawImage(video, sx, sy, side, side, 0, 0, S, S); } catch { return 0; }
    let img;
    try { img = ctx.getImageData(0, 0, S, S).data; } catch { return 0; }

    const at = (x, y) => {
      const xi = Math.round(x), yi = Math.round(y);
      if (xi < 0 || yi < 0 || xi >= S || yi >= S) return null;
      const o = (yi * S + xi) * 4;
      return [img[o], img[o + 1], img[o + 2]];
    };
    const chroma = (c) => { const t = c[0] + c[1] + c[2] + 1e-3; return [c[0] / t, c[1] / t]; };

    let rr = 0, gg = 0, bb = 0, n = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const c = at(S / 2 + dx, S / 2 + dy);
      if (c) { rr += c[0]; gg += c[1]; bb += c[2]; n++; }
    }
    if (!n) return 0;
    const ref = chroma([rr / n, gg / n, bb / n]);

    const k = S / side;
    const steps = Math.floor(reachPx * k);
    const walk = (sgn) => {
      let miss = 0, last = 0;
      for (let i = 1; i <= steps; i++) {
        const c = at(S / 2 + sgn * perpX * i, S / 2 + sgn * perpY * i);
        if (!c) break;
        const ch = chroma(c);
        if (Math.hypot(ch[0] - ref[0], ch[1] - ref[1]) > SKIN_TOL) { if (++miss >= 2) return last; }
        else { miss = 0; last = i; }
      }
      return last;
    };
    const a = walk(1), b = walk(-1);
    if (a < 3 || b < 3 || a >= steps || b >= steps) return 0;
    return (a + b) / k;
  }

  _unproject(n, d, vw, vh, out) {
    const halfH = Math.tan(THREE.MathUtils.degToRad(MP_VERTICAL_FOV_DEG / 2));
    const halfW = halfH * (vw / vh);
    return out.set((n.x * 2 - 1) * halfW * d, (1 - n.y * 2) * halfH * d, -d);
  }

  update({ hand, view, dtSeconds, video }) {
    const lm = hand?.landmarks;
    if (!lm || lm.length < 21 || (hand.score ?? 1) < MIN_SCORE) { this._miss(dtSeconds); return; }
    const wrist = lm[0], idx = lm[5], pinky = lm[17];
    if (!wrist || !idx || !pinky || !lm[9]) { this._miss(dtSeconds); return; }

    for (const p of [wrist, lm[9], idx, pinky]) {
      if (p.x < 0.01 || p.x > 0.99 || p.y < 0.01 || p.y > 0.99) { this._miss(dtSeconds); return; }
    }
    const vw = view?.videoW || 640, vh = view?.videoH || 480;

    const w = hand.worldLandmarks && hand.worldLandmarks.length >= 21 ? hand.worldLandmarks : null;
    const metrics = w ? this._palmMetrics(w) : null;
    if (w && !metrics) { this._miss(dtSeconds); return; }
    if (!this._checkPose(metrics)) { this._miss(dtSeconds); return; }

    const spanPx = Math.hypot((idx.x - pinky.x) * vw, (idx.y - pinky.y) * vh);
    if (spanPx < 15) { this._miss(dtSeconds); return; }
    const halfH = Math.tan(THREE.MathUtils.degToRad(MP_VERTICAL_FOV_DEG / 2));
    const focalPx = (vh / 2) / halfH;

    let sumPx = Math.hypot((lm[9].x - wrist.x) * vw, (lm[9].y - wrist.y) * vh), sumCm = PALM_LEN_CM;
    if (w) {
      sumPx = 0; sumCm = 0;
      for (const [a, b] of DEPTH_PAIRS) {
        sumPx += Math.hypot((lm[a].x - lm[b].x) * vw, (lm[a].y - lm[b].y) * vh);
        sumCm += Math.hypot(w[a].x - w[b].x, w[a].y - w[b].y) * 100;
      }
    }
    let dRaw = THREE.MathUtils.clamp((sumCm * focalPx) / Math.max(1, sumPx), 8, 120);
    if (this._dLast) dRaw = THREE.MathUtils.clamp(dRaw, this._dLast * 0.8, this._dLast * 1.25);
    const d = this._depth.filter(dRaw, dtSeconds);
    this._dLast = d;
    this._unproject(wrist, d, vw, vh, _wrist);

    // In-plane axis comes from pixels so the ring always reads square to the
    // arm on screen; only a damped share of the depth tilt is allowed through.
    let ax = ((idx.x + pinky.x) / 2 - wrist.x) * vw;
    let ay = ((idx.y + pinky.y) / 2 - wrist.y) * vh;
    const al = Math.hypot(ax, ay) || 1;
    ax /= al; ay /= al;
    const dx = ax, dy = -ay;
    let dz = 0;
    if (w) {
      const L = Math.hypot(w[9].x - w[0].x, w[9].y - w[0].y, w[9].z - w[0].z) || 1;
      dz = THREE.MathUtils.clamp((-(w[9].z - w[0].z) / L) * TILT_DAMP, -0.8, 0.8);
    }
    const kx = Math.sqrt(Math.max(0, 1 - dz * dz));
    _dir.set(dx * kx, dy * kx, dz).normalize();

    _normal.copy(_wrist).multiplyScalar(-1).normalize();
    _normal.addScaledVector(_dir, -_dir.dot(_normal)).normalize();
    _side.copy(_dir).cross(_normal).normalize();
    _basis.makeBasis(_side, _dir, _normal);
    _quatRaw.setFromRotationMatrix(_basis);

    const f = this._fit;
    if (f.tiltDeg) _quatRaw.multiply(_qTilt.setFromAxisAngle(_axisZ, THREE.MathUtils.degToRad(f.tiltDeg)));

    const proxyPx = spanPx * WRIST_FROM_SPAN;
    const offPx = (f.offsetCm / NOMINAL_WRIST_CM) * proxyPx;
    const meas = this._measureArmPx(
      video, wrist.x * vw - ax * offPx, wrist.y * vh - ay * offPx,
      -ay, ax, proxyPx * 1.15, vw, vh
    );
    const wristPx = (meas > proxyPx * 0.6 && meas < proxyPx * 1.7) ? meas : proxyPx;

    const wristWorld = (this._span.filter(wristPx, dtSeconds) * d) / focalPx;
    _pos.copy(_wrist).addScaledVector(_dir, -f.offsetCm * (wristWorld / NOMINAL_WRIST_CM));

    const pos = this._pos.filter(_pos, dtSeconds);
    const quat = this._quat.filter(_quatRaw, dtSeconds);
    this.group.position.copy(pos);
    this.group.quaternion.copy(quat);

    const s = ((wristWorld * f.loose) / (2 * Math.max(0.12, this._holeR))) * this._fitScale;
    this.group.scale.setScalar(Math.max(0.001, s));

    const r = Math.max(0.3, Math.min(wristWorld * 0.49, this._holeR * s - 0.08));
    this._wristOccluder.position.copy(pos);
    this._wristOccluder.quaternion.copy(quat);
    this._wristOccluder.scale.set(r, 10, r);

    this._lostMs = 0;
    const edge = Math.min(wrist.x, 1 - wrist.x, wrist.y, 1 - wrist.y);
    this._fade = THREE.MathUtils.clamp(edge / B_FADE_EDGE, 0, 1);
    this._applyOpacity(this._fade);
  }

  dispose() {
    this.clear();
    this.scene.remove(this.group);
    this.scene.remove(this._wristOccluder);
    this._wristOccluder.geometry.dispose();
    this._wristOccluder.material.dispose();
  }
}
