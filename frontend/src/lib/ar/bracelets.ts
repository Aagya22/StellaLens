// @ts-nocheck
import * as THREE from "three";
import { OneEuroVec3, OneEuroQuat, OneEuro } from "./smoothing";
import { disposeObject3D, autoOrientHole, normalizeModelToUnit } from "./rings";

/* Bracelet engine — the ring engine's principles moved to the wrist.

   ANCHOR: wrist landmark (0), pushed slightly toward the forearm along the
   hand's axis (a bracelet rests below the wrist crease, not on the palm).
   SIZE: the model's measured HOLE = measured wrist width × loose (a real
   bangle hangs a little loose — never skin-tight, never huge).
   WRAP: elliptical depth-only cylinder along the forearm axis — wrists are
   flat, not round. */
export const BRACELET_FIT = {
  loose: 1.15,        // hole = wrist width × this ("a little loose")
  offsetCm: 2.0,      // below the wrist crease, toward the forearm
  wristCm: 5.6,       // fallback wrist width when world landmarks missing
};

const KNUCKLE_SPAN_CM = 6.5; // canonical index-MCP ↔ pinky-MCP distance
const MP_VERTICAL_FOV_DEG = 63;
const B_FADE_EDGE = 0.06;

const _wrist = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _side = new THREE.Vector3();
const _normal = new THREE.Vector3();
const _pos = new THREE.Vector3();
const _basis = new THREE.Matrix4();
const _quatRaw = new THREE.Quaternion();
const _clipN = new THREE.Vector3();
const _clipP = new THREE.Vector3();

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
    // View-aligned cutting plane — only the FRONT portion renders (the
    // production wristwear-AR technique).
    this._clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 1000);
    // Steady when held still, still responsive on deliberate motion.
    this._pos = new OneEuroVec3({ minCutoff: 0.5, beta: 0.15 });
    this._quat = new OneEuroQuat({ minCutoff: 0.5, beta: 0.3 });
    this._wristW = new OneEuro({ minCutoff: 0.3, beta: 0.02 });
    this._fade = 0;

    // Elliptical wrist occluder (depth-only): rx across the wrist, rz thin.
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
    this.group.visible = v;
    if (!v) this._wristOccluder.visible = false;
  }

  getFit() { return this._fit; }

  async loadModel(modelPath, { fit = null, scale = 1, rotationFix = null, stripNodes = null, preserveMaterials = false } = {}) {
    this.clear();
    this._fit = { ...BRACELET_FIT, ...(fit ?? {}) };
    this._fitScale = scale;
    this.onStatus("Loading bracelet model…");
    try {
      const gltf = await this.loader.loadAsync(modelPath);
      const root = gltf.scene;
      // Strip authored display props (pillows, stands) BEFORE normalization.
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
          c.clippingPlanes = [this._clipPlane];
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

  _unproject(n, d, vw, vh, out) {
    const halfH = Math.tan(THREE.MathUtils.degToRad(MP_VERTICAL_FOV_DEG / 2));
    const halfW = halfH * (vw / vh);
    return out.set((n.x * 2 - 1) * halfW * d, (1 - n.y * 2) * halfH * d, -d);
  }

  update({ hand, view, dtSeconds }) {
    const lm = hand?.landmarks;
    if (!lm || lm.length < 21) return;
    const wrist = lm[0], midMcp = lm[9], idx = lm[5], pinky = lm[17];
    if (!wrist || !midMcp || !idx || !pinky) return;
    // A half-out-of-frame hand gives extrapolated garbage landmarks — the
    // bracelet then floats mid-forearm with a wrong axis. Require the key
    // landmarks genuinely in frame or show nothing.
    for (const p of [wrist, midMcp, idx, pinky]) {
      if (p.x < 0.01 || p.x > 0.99 || p.y < 0.01 || p.y > 0.99) {
        this._applyOpacity(0);
        return;
      }
    }
    const vw = view?.videoW || 640, vh = view?.videoH || 480;

    // Depth from the knuckle span, with a VIEW-PERPENDICULAR world ruler so
    // an angled hand doesn't read as "far away" (see rings.ts).
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
    this._unproject(wrist, d, vw, vh, _wrist);

    // AXIS from the hand (wrist → middle knuckle, metric world landmarks —
    // image-aligned axes → negate y/z). ROLL is VIEW-STABILIZED, not
    // hand-relative: a loose bangle doesn't spin when the wrist pronates —
    // it stays put while the arm turns inside it. This is what makes the
    // bracelet feel steady under any hand twist, and it removes left/right
    // chirality from the problem entirely.
    const w = hand.worldLandmarks;
    if (w && w.length >= 21) {
      _dir.set(w[9].x - w[0].x, -(w[9].y - w[0].y), -(w[9].z - w[0].z)).normalize();
    } else {
      _dir.set((midMcp.x - wrist.x) * vw, -(midMcp.y - wrist.y) * vh, 0).normalize();
    }
    // Camera-facing component perpendicular to the axis → stable roll.
    _normal.copy(_wrist).multiplyScalar(-1).normalize();      // toward camera
    _normal.addScaledVector(_dir, -_dir.dot(_normal)).normalize();
    _side.copy(_dir).cross(_normal).normalize();
    _basis.makeBasis(_side, _dir, _normal);
    _quatRaw.setFromRotationMatrix(_basis);

    const f = this._fit;
    _pos.copy(_wrist).addScaledVector(_dir, -f.offsetCm); // toward the forearm

    const pos = this._pos.filter(_pos, dtSeconds);
    const quat = this._quat.filter(_quatRaw, dtSeconds);
    this.group.position.copy(pos);
    this.group.quaternion.copy(quat);

    // Wrist width from the metric knuckle span (wrist ≈ 0.85 × span).
    let wristW = f.wristCm;
    if (w && w.length >= 21) {
      const raw = Math.hypot(w[5].x - w[17].x, w[5].y - w[17].y, w[5].z - w[17].z) * 100 * 0.85;
      wristW = THREE.MathUtils.clamp(raw, 4.2, 7.5);
    }
    wristW = this._wristW.filter(wristW, dtSeconds);
    const s = ((wristW * f.loose) / (2 * Math.max(0.12, this._holeR))) * this._fitScale;
    this.group.scale.setScalar(Math.max(0.001, s));

    // Limb occluder: the bangle physically ENCIRCLES the forearm, so the
    // limb's radius ≈ hole ÷ looseness. Round (the forearm below the wrist
    // crease is round, not flat) and nearly hole-filling — the far side of
    // the band cannot peek over it at oblique angles — yet always capped
    // inside the hole so it never swallows the band itself.
    const limbR = Math.min((this._holeR * s) / (f.loose || 1.15) * 0.98, this._holeR * s - 0.08);
    const r = Math.max(0.3, limbR);
    this._wristOccluder.position.copy(pos);
    this._wristOccluder.quaternion.copy(quat);
    this._wristOccluder.scale.set(r, 10, r);

    // Cutting plane at the equator: exactly the front half renders — the
    // arc ends at the arm's silhouette and reads as encircling it.
    _clipN.copy(pos).multiplyScalar(-1).normalize(); // toward the camera
    this._clipPlane.setFromNormalAndCoplanarPoint(_clipN, pos);

    // Edge fade.
    const edge = Math.min(wrist.x, 1 - wrist.x, wrist.y, 1 - wrist.y);
    const fade = THREE.MathUtils.clamp(edge / B_FADE_EDGE, 0, 1);
    this._fade = fade;
    this._applyOpacity(fade);
  }

  dispose() {
    this.clear();
    this.scene.remove(this.group);
    this.scene.remove(this._wristOccluder);
    this._wristOccluder.geometry.dispose();
    this._wristOccluder.material.dispose();
  }
}
