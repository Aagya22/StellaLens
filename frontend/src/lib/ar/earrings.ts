// @ts-nocheck
import * as THREE from "three";

import { OneEuroVec3, OneEuroQuat } from "./smoothing";
import { dampHeadPoseQuaternion, poseMatrixToThree } from "./headPose";

/* ─────────────────────────────────────────────────────────────
   Earlobe calibration — rigid-body anchoring.
   MediaPipe has no true ear landmarks; the silhouette points near
   the ears (132/234, 361/454, …) are the jitteriest in the mesh,
   so the earring is NOT anchored to a live landmark. Instead a
   fixed face-local offset — in units of interocular distance
   (outer eye corners, landmarks 33 ↔ 263) — is rotated by the
   head pose every frame from the stable eye-corner midpoint.
   Tune per the calibration plan: validate across head yaw range,
   not just frontal. Left/right kept separate on purpose.
────────────────────────────────────────────────────────────── */
/*
   These offsets are a property of the FACE and are shared by ALL earring
   models. Per-model tweaks (scale, pivot, rotation, materials) belong in
   the product config — never here.

   Keyed anatomically: `userRight` = the wearer's right ear, which appears
   on the RIGHT side of the mirrored camera preview (rendered internally
   by the stage-left group).

   UNITS: canonical-face CENTIMETERS, relative to the canonical face
   origin (MediaPipe's metric face space). The offset is multiplied
   THROUGH the facial transformation matrix in homogeneous coordinates
   every frame — never added after projection.
     lateral = outward from the face centerline
     down    = toward the chin
     back    = behind the face plane (toward the back of the head)

   Calibrated live (2026-07-12) with the corrected matrix math using the
   Astraea Diamond Drops model — these are the DEFAULTS. Other earrings
   get calibrated individually and override via `earAnchor` in their
   product config. Intentionally asymmetric — do not mirror one side
   onto the other. To re-tune, reinstate the calibration overlay in
   ARView (git history has it).
*/
export const EAR_ANCHOR = {
  userRight: { lateral: 7.5, down: 3.8, back: 4.4 },
  userLeft:  { lateral: 9.0, down: 3.8, back: 3.9 },
};
// (down was 3.9 — nudged one calibration step up on request, 2026-07-12)

/* Far-side earring fade, driven by matrix-derived head yaw (degrees).
   NOT landmark presence — occluded landmarks are extrapolated by the
   Face Landmarker and never report as missing.
   Tune these live: the ear vanishes from camera view around 25–30° for most
   faces, so the earring should START fading before that and be gone shortly
   after. Tight window = feels like it disappears WITH the ear. */
const fadeStartDeg = 20; // far ear starts fading
const fadeEndDeg   = 28; // far ear fully hidden (8° window)
const HIDE_ALL_DEG = 57; // beyond this, tracking isn't trustworthy — hide both

/* Dangle physics defaults — override per earring via `dangle` in the
   product config to tune the "weight feel" of each piece. */
/* Anchor speeds above this are physically impossible head motion — they're
   tracking gaps / tab-switches. Never convert them into a swing kick. */
const TELEPORT_SPEED = 5000; // px/s

export const DANGLE_DEFAULTS = {
  stiffness: 120,    // spring pull toward hanging straight down
  damping: 8,        // angular damping — higher settles the swing faster
  maxSwingDeg: 40,   // swing clamp
  response: 0.004,   // how strongly anchor motion drives the swing
  pivotDrop: 0,      // fraction of model height to lower the swing pivot
                     // below the ear-wire contact point (hook stays rigid-ish)
  yawFollow: 0.2,    // 0–1: fraction of head yaw the earring turns with.
                     // Danglers swivel on a thin wire and stay ~front-facing
                     // (0.2); studs are rigid to the lobe (set 1.0 in config).
};

/* MediaPipe face-geometry virtual camera defaults — the projection the
   facial transformation matrix assumes (environment.proto). */
const MP_VERTICAL_FOV_DEG = 63;
/* Canonical outer-eye-corner distance (cm) — converts canonical depth to px */
const CANONICAL_INTEROCULAR_CM = 9.0;

const _poseM = new THREE.Matrix4();
const _earCam = new THREE.Vector3();
// Temps for extracting raw yaw from the pose matrix (visibility check only)
const _yawPos = new THREE.Vector3();
const _yawQuat = new THREE.Quaternion();
const _yawScl = new THREE.Vector3();
const _yawEuler = new THREE.Euler(0, 0, 0, "YXZ");

function disposeObject3D(root) {
  root.traverse((obj) => {
    if (obj.isMesh) {
      obj.geometry?.dispose?.();
      if (Array.isArray(obj.material)) {
        for (const m of obj.material) m?.dispose?.();
      } else {
        obj.material?.dispose?.();
      }
    }
  });
}

function normToStageVec3(p, view, zPx) {
  const px = p.x * view.videoW;
  const py = p.y * view.videoH;
  const sx = px * view.cover.scale + view.cover.offsetX;
  const sy = py * view.cover.scale + view.cover.offsetY;
  const x = sx - view.stageW / 2;
  const y = view.stageH / 2 - sy;
  return new THREE.Vector3(x, y, zPx);
}

function zToPx(zNorm, view) {
  const S = view.videoW * view.cover.scale;
  return -zNorm * S;
}

function normalizeModelToUnit(root) {
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const maxDim = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(maxDim) || maxDim <= 0) return;
  const scale = 1 / maxDim;
  root.scale.multiplyScalar(scale);
  const box2 = new THREE.Box3().setFromObject(root);
  const max = new THREE.Vector3();
  const center = new THREE.Vector3();
  box2.getCenter(center);
  max.copy(box2.max);
  root.position.x -= center.x;
  root.position.y -= max.y;
  root.position.z -= center.z;
}

/**
 * Split a single mesh's geometry at world x = 0, keeping triangles on the
 * requested side. Returns the new geometry, "empty" if nothing survives,
 * or null when this mesh can't be split safely (multi-material groups,
 * interleaved attributes, or everything already on one side).
 */
function splitGeometryByWorldX(mesh, side, gapMin) {
  if (Array.isArray(mesh.material)) return null;
  let geom = mesh.geometry;
  for (const name of Object.keys(geom.attributes)) {
    if (geom.attributes[name].isInterleavedBufferAttribute) return null;
  }
  if (geom.index) geom = geom.toNonIndexed();
  const pos = geom.attributes.position;
  const triCount = Math.floor(pos.count / 3);
  const m = mesh.matrixWorld;
  const v = new THREE.Vector3();
  const kept = [];
  let nearestToPlane = Infinity;
  for (let t = 0; t < triCount; t++) {
    let cx = 0;
    for (let k = 0; k < 3; k++) {
      v.fromBufferAttribute(pos, t * 3 + k).applyMatrix4(m);
      cx += v.x;
    }
    cx /= 3;
    nearestToPlane = Math.min(nearestToPlane, Math.abs(cx));
    if (side < 0 ? cx <= 0 : cx > 0) kept.push(t);
  }
  if (kept.length === 0) return "empty";
  if (kept.length === triCount) return null;
  // Safety: a true pair has an empty GAP at the split plane. Geometry
  // crossing the plane means this is one object — refuse to cut it in half.
  if (nearestToPlane < gapMin) return null;
  const out = new THREE.BufferGeometry();
  for (const name of Object.keys(geom.attributes)) {
    const src = geom.attributes[name];
    const itemSize = src.itemSize;
    const arr = new Float32Array(kept.length * 3 * itemSize);
    let w = 0;
    for (const t of kept) {
      const start = t * 3 * itemSize;
      for (let c = 0; c < 3 * itemSize; c++) arr[w++] = src.array[start + c];
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, itemSize));
  }
  return out;
}

/**
 * Some GLBs contain BOTH earrings side by side. Split such a model at x = 0
 * and return only the requested half (side: -1 = left half, +1 = right half).
 * Multi-mesh pairs split by whole meshes; single-mesh pairs (both earrings
 * in one geometry) split at the triangle level. Returns null when the model
 * cannot be split — caller falls back to clone + mirror.
 */
function extractHalf(root, side) {
  const clone = root.clone(true);
  clone.updateMatrixWorld(true);
  const meshes = [];
  clone.traverse((o) => { if (o.isMesh) meshes.push(o); });
  if (meshes.length === 0) return null;

  if (meshes.length >= 2) {
    const toRemove = meshes.filter((m) => {
      const box = new THREE.Box3().setFromObject(m);
      const cx = (box.min.x + box.max.x) / 2;
      return side < 0 ? cx > 0 : cx < 0;
    });
    if (toRemove.length > 0 && toRemove.length < meshes.length) {
      for (const m of toRemove) m.parent?.remove(m);
      return clone;
    }
  }

  // Whole-mesh partition impossible — try triangle-level splitting.
  const span = new THREE.Box3().setFromObject(clone).getSize(new THREE.Vector3()).x;
  const gapMin = span * 0.015;
  let splitAny = false;
  for (const mesh of meshes) {
    const result = splitGeometryByWorldX(mesh, side, gapMin);
    if (result === "empty") {
      mesh.parent?.remove(mesh);
    } else if (result) {
      mesh.geometry = result;
      splitAny = true;
    } else {
      return null;
    }
  }
  return splitAny ? clone : null;
}

/**
 * Scale BOTH halves by one shared factor — normalizing each half
 * independently gives the left and right earring different sizes when
 * their bounds differ. Then pivot each at its own top edge.
 */
function normalizeHalvesJointly(a, b) {
  const maxDimOf = (obj) => {
    const s = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
    return Math.max(s.x, s.y, s.z);
  };
  const maxDim = Math.max(maxDimOf(a), maxDimOf(b));
  if (!Number.isFinite(maxDim) || maxDim <= 0) return;
  const pivotTop = (obj) => {
    const box = new THREE.Box3().setFromObject(obj);
    const center = box.getCenter(new THREE.Vector3());
    obj.position.x -= center.x;
    obj.position.y -= box.max.y;
    obj.position.z -= center.z;
  };
  a.scale.multiplyScalar(1 / maxDim);
  b.scale.multiplyScalar(1 / maxDim);
  pivotTop(a);
  pivotTop(b);
}

function applyRealisticMaterials(root, modelPath) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const materials = Array.isArray(o.material) ? o.material : [o.material];
    const newMats = materials.map((m) => {
      if (!m) return m;
      const name = (m.name || "").toLowerCase();
      const isGem = name.includes("diamond") ||
        name.includes("gem") ||
        name.includes("stone") ||
        name.includes("glass") ||
        name.includes("crystal") ||
        m.transmission > 0.1 ||
        m.transparent === true;
      if (isGem) {
        return new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          metalness: 0.1,
          roughness: 0.05,
          transmission: 0.45,
          thickness: 0.8,
          ior: 1.7,
          envMapIntensity: 4.5,
          clearcoat: 1.0,
          clearcoatRoughness: 0.0,
          side: THREE.DoubleSide,
          transparent: true,
          depthWrite: true,
          depthTest: true
        });
      }
      const isGold = name.includes("gold") || modelPath.toLowerCase().includes("gold");
      const isSilver = name.includes("silver") || name.includes("chrome") || name.includes("metal") || name.includes("brass");
      if (isGold || isSilver || m.metalness > 0.5) {
        m.metalness = 1.0;
        m.roughness = 0.18;
        if (isGold) {
          m.color.setHex(0xffd700);
        } else if (isSilver) {
          m.color.setHex(0xcccccc);
        }
        m.envMapIntensity = 3.2;
      } else {
        m.envMapIntensity = 2.0;
      }
      if ("side" in m) m.side = THREE.DoubleSide;
      m.needsUpdate = true;
      return m;
    });
    o.material = Array.isArray(o.material) ? newMats : newMats[0];
  });
}

export class EarringsSystem {
  constructor({ scene, gltfLoader, onStatus }) {
    this.scene = scene;
    this.loader = gltfLoader;
    this.onStatus = onStatus ?? (() => { });
    this.group = new THREE.Group();
    this.group.visible = true;
    this.group.renderOrder = 1;
    this.scene.add(this.group);
    this.left = new THREE.Group();
    this.right = new THREE.Group();
    this.left.renderOrder = 1;
    this.right.renderOrder = 1;
    this.group.add(this.left, this.right);
    this._modelRoot = null;
    // One Euro filters on the final transform — steady when the head is
    // still, responsive during fast motion (applied after the rigid-body
    // anchor, per the tracking fix plan).
    this._leftPos = new OneEuroVec3({ minCutoff: 1.2, beta: 0.006 });
    this._rightPos = new OneEuroVec3({ minCutoff: 1.2, beta: 0.006 });
    this._rot = new OneEuroQuat({ minCutoff: 1.0, beta: 0.5 });
    this._anchor = EAR_ANCHOR;
    this._dangle = { ...DANGLE_DEFAULTS };
    this._fitScale = 1;
    this._matOverrides = null;
    this._skin = 0;
    this._leftSwingGroup = null;
    this._rightSwingGroup = null;
    this._leftMats = [];
    this._rightMats = [];
    this._leftFade = 1;
    this._rightFade = 1;
    this._center = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this._leftSwingX = 0;
    this._leftSwingY = 0;
    this._leftSwingVelX = 0;
    this._leftSwingVelY = 0;
    this._rightSwingX = 0;
    this._rightSwingY = 0;
    this._rightSwingVelX = 0;
    this._rightSwingVelY = 0;
    this._prevLeftTarget = new THREE.Vector3();
    this._prevRightTarget = new THREE.Vector3();
    this._prevLeftVelX = 0;
    this._prevLeftVelY = 0;
    this._prevRightVelX = 0;
    this._prevRightVelY = 0;
    this._topGemColor = "#e0115f";
    this._bottomGemColor = "#0f52ba";
  }

  setVisible(v) {
    this.group.visible = v;
  }

  /** Live anchor object for the loaded product — used by the temporary
      calibration overlay in ARView. */
  getAnchor() {
    return this._anchor;
  }

  async loadModel(modelPath, { singleEarring = false, preserveMaterials = false, anchor = null, dangle = null, fit = null, materials = null, skinPenetration = 0 }: {
    singleEarring?: boolean;
    preserveMaterials?: boolean;
    anchor?: { userRight: { lateral: number; down: number; back: number }; userLeft: { lateral: number; down: number; back: number } } | null;
    dangle?: { stiffness?: number; damping?: number; maxSwingDeg?: number; response?: number; pivotDrop?: number; yawFollow?: number } | null;
    fit?: { rotationDeg?: [number, number, number]; scale?: number } | null;
    materials?: Array<{ match: string; hide?: boolean; color?: string; metalness?: number; roughness?: number; clearcoat?: number; clearcoatRoughness?: number; envMapIntensity?: number }> | null;
    skinPenetration?: number;
  } = {}) {
    this.clear();
    // Clone (never alias) so live calibration edits stay with this session's
    // product and can't leak into the shared defaults or other earrings.
    const src = anchor ?? EAR_ANCHOR;
    this._anchor = {
      userRight: { ...src.userRight },
      userLeft: { ...src.userLeft },
    };
    this._dangle = { ...DANGLE_DEFAULTS, ...(dangle ?? {}) };
    this._fitScale = fit?.scale ?? 1;
    this._matOverrides = materials ?? null;
    this._skin = skinPenetration; // cm pushed into the head so the attachment hides in the skin
    this.onStatus("Loading earring model…");
    try {
      const gltf = await this.loader.loadAsync(modelPath);
      const root = gltf.scene;
      root.traverse((o) => {
        if (o.isMesh) {
          o.frustumCulled = false;
          o.renderOrder = 1;
        }
      });
      this._modelRoot = root;
      // Per-model orientation from config, applied BEFORE normalization so
      // the pivot lands at the top of the model AS DISPLAYED. Models without
      // it keep the legacy path (normalize, then blanket +90° X below) —
      // Astraea is calibrated against that path; do not change it.
      const rotDeg = fit?.rotationDeg ?? null;
      if (rotDeg) {
        root.rotation.set(
          THREE.MathUtils.degToRad(rotDeg[0]),
          THREE.MathUtils.degToRad(rotDeg[1]),
          THREE.MathUtils.degToRad(rotDeg[2])
        );
        root.updateMatrixWorld(true);
      }
      normalizeModelToUnit(root);
      if (preserveMaterials) {
        // Render the GLB's authored materials EXACTLY (colors, textures,
        // normal + metal/rough maps) — only force double-sided for the
        // mirrored clone. A textured PBR material is already art-directed;
        // reflection-boosting it washes the normal detail into flat chrome.
        // Only lift envMapIntensity on FLAT, untextured materials, which
        // otherwise read dead-gray with no maps to shade them.
        root.traverse((o) => {
          if (!o.isMesh) return;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          for (const m of mats) {
            if (!m) continue;
            if ("side" in m) m.side = THREE.DoubleSide;
            const hasMaps = m.map || m.normalMap || m.metalnessMap || m.roughnessMap;
            if (!hasMaps && "envMapIntensity" in m) {
              m.envMapIntensity = Math.max(m.envMapIntensity ?? 1, 1.8);
            }
            m.needsUpdate = true;
          }
        });
      } else {
        applyRealisticMaterials(root, modelPath);
      }

      // singleEarring GLB → clone + mirror it onto both ears.
      // Dual-earring GLB → split at x=0 so each ear gets ONE earring
      // (cloning the whole file would put a pair on each ear).
      let leftModel = null;
      let rightModel = null;
      if (!singleEarring) {
        leftModel = extractHalf(root, -1);
        rightModel = extractHalf(root, 1);
        if (leftModel && rightModel) {
          normalizeHalvesJointly(leftModel, rightModel);
        } else {
          leftModel = null;
          rightModel = null;
        }
      }
      if (!leftModel || !rightModel) {
        leftModel = root.clone(true);
        rightModel = root.clone(true);
        rightModel.scale.x *= -1;
      }
      if (!rotDeg) {
        leftModel.rotation.x = Math.PI / 2;
        rightModel.rotation.x = Math.PI / 2;
      }
      this._mountModels(leftModel, rightModel);
      // Preserved models keep their authored gem colors until the user
      // actively picks a swatch (setGemColors still works when called).
      if (!preserveMaterials) this.setGemColors(this._topGemColor, this._bottomGemColor);
      this.onStatus("");
    } catch (err) {
      // No placeholder geometry — showing nothing beats showing a wrong ring.
      console.error("[AR] earring model failed to load:", modelPath, err);
      this.onStatus("Couldn't load this piece's 3D model.");
    }
  }

  /**
   * Wrap each side in a swing-pivot group (dangle physics rotates the
   * group, the container keeps the rigid world-hang rotation) and give
   * each side its own material instances so the far-side fade can change
   * opacity independently (clones otherwise share materials).
   */
  _mountModels(leftModel, rightModel) {
    const mount = (container, model, matsOut) => {
      const swing = new THREE.Group();
      const box = new THREE.Box3().setFromObject(model);
      const height = Math.max(1e-6, box.max.y - box.min.y);
      const drop = (this._dangle.pivotDrop ?? 0) * height;
      swing.position.y = -drop;
      model.position.y += drop;
      swing.add(model);
      container.add(swing);
      model.traverse((o) => {
        if (!o.isMesh) return;
        const cloneMat = (m) => {
          if (!m) return m;
          let c = m.clone();
          c = this._applyMaterialOverride(c);
          c.userData._baseOpacity = c.opacity ?? 1;
          c.userData._baseTransparent = c.transparent === true;
          matsOut.push(c);
          return c;
        };
        o.material = Array.isArray(o.material) ? o.material.map(cloneMat) : cloneMat(o.material);
      });
      return swing;
    };
    this._leftMats = [];
    this._rightMats = [];
    this._leftSwingGroup = mount(this.left, leftModel, this._leftMats);
    this._rightSwingGroup = mount(this.right, rightModel, this._rightMats);

    // Sanity check: if the mounted geometry ends up far from the container
    // origin, the model's internal offset + legacy rotate-after-normalize
    // order has slung it off the anchor (invisible on screen). The fix is
    // per-model config, so warn loudly instead of failing silently.
    const box = new THREE.Box3().setFromObject(this.left);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 1e-6);
    if (center.length() > maxDim * 1.5) {
      console.warn(
        "[AR] earring geometry sits far from its anchor (center",
        center.toArray().map((v) => v.toFixed(2)),
        "vs size", maxDim.toFixed(2),
        ") — set arFit.rotationDeg on this product so the pivot is computed after rotation."
      );
    }
  }

  /** Apply a per-model material override (matched by material name) from
      the product's arMaterials config. Upgrades to MeshPhysicalMaterial
      when clearcoat is requested. */
  _applyMaterialOverride(mat) {
    if (!this._matOverrides) return mat;
    const name = (mat.name || "").toLowerCase();
    const ov = this._matOverrides.find((o) => name.includes(o.match.toLowerCase()));
    if (!ov) return mat;
    let target = mat;
    if (ov.clearcoat !== undefined && !mat.isMeshPhysicalMaterial) {
      target = new THREE.MeshPhysicalMaterial({
        name: mat.name,
        map: mat.map ?? null,
        normalMap: mat.normalMap ?? null,
        side: mat.side,
        transparent: mat.transparent === true,
        opacity: mat.opacity ?? 1,
      });
      if (mat.color) target.color.copy(mat.color);
    }
    if (ov.hide) target.visible = false;
    if (ov.color !== undefined && target.color) target.color.set(ov.color);
    if (ov.metalness !== undefined && "metalness" in target) target.metalness = ov.metalness;
    if (ov.roughness !== undefined && "roughness" in target) target.roughness = ov.roughness;
    if (ov.clearcoat !== undefined && "clearcoat" in target) target.clearcoat = ov.clearcoat;
    if (ov.clearcoatRoughness !== undefined && "clearcoatRoughness" in target) target.clearcoatRoughness = ov.clearcoatRoughness;
    if (ov.envMapIntensity !== undefined && "envMapIntensity" in target) target.envMapIntensity = ov.envMapIntensity;
    target.needsUpdate = true;
    return target;
  }

  _setSideOpacity(mats, opacity) {
    for (const m of mats) {
      const base = m.userData._baseOpacity ?? 1;
      m.opacity = base * opacity;
      m.transparent = opacity < 0.999 ? true : m.userData._baseTransparent;
    }
  }

  setGemColors(topColor, bottomColor) {
    this._topGemColor = topColor;
    this._bottomGemColor = bottomColor;
    const applyToGroup = (group) => {
      if (!group) return;
      group.traverse((o) => {
        if (!o.isMesh) return;
        const materials = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of materials) {
          if (!m) continue;
          const name = (m.name || "").toLowerCase();
          if (name.includes("ruby")) {
            m.color.set(topColor);
            if ('emissive' in m) {
              m.emissive.set(topColor).multiplyScalar(0.3);
            }
            m.needsUpdate = true;
          } else if (name.includes("tanzanite")) {
            m.color.set(bottomColor);
            if ('emissive' in m) {
              m.emissive.set(bottomColor).multiplyScalar(0.3);
            }
            m.needsUpdate = true;
          }
        }
      });
    };
    applyToGroup(this.left);
    applyToGroup(this.right);
  }

  clear() {
    if (this._modelRoot) {
      disposeObject3D(this._modelRoot);
      this._modelRoot = null;
    }
    for (const container of [this.left, this.right]) {
      while (container.children.length) {
        const child = container.children[0];
        container.remove(child);
        disposeObject3D(child);
      }
    }
    this._leftPos.reset();
    this._rightPos.reset();
    this._rot.reset();
    this._leftSwingGroup = null;
    this._rightSwingGroup = null;
    this._leftMats = [];
    this._rightMats = [];
    this._leftFade = 1;
    this._rightFade = 1;
  }

  update({ anchors, landmarks, view, faceWidthPx, poseQuat, poseMatrix, headPose, settings, dtSeconds }) {
    if (!this.group.visible) return;
    const s = settings ?? {
      offsetX: 0,
      offsetY: 0,
      offsetZ: -35,
      scaleMultiplier: 1.0,
      smoothingFactor: 0.55,
    };
    const dampedPose = dampHeadPoseQuaternion(poseQuat, {
      yaw: 0.75,
      pitch: 0.25,
      roll: 0.85,
    });
    const rot = this._rot.filter(dampedPose, dtSeconds);
    // Far-side fade from the matrix-derived yaw — smooth opacity ramp
    // between FADE_START_DEG and FADE_END_DEG instead of a hard toggle.
    // RAW yaw straight from the transform matrix — no smoothing, so the fade
    // reacts with zero latency. Position/rotation still use the One Euro
    // filtered pose; this raw read drives visibility ONLY.
    let yawDeg;
    if (poseMatrix && poseMatrix.length === 16) {
      poseMatrixToThree(poseMatrix, _poseM);
      _poseM.decompose(_yawPos, _yawQuat, _yawScl);
      _yawEuler.setFromQuaternion(_yawQuat, "YXZ");
      yawDeg = THREE.MathUtils.radToDeg(_yawEuler.y);
    } else {
      yawDeg = THREE.MathUtils.radToDeg(headPose?.yaw ?? 0);
    }
    // Direct linear map yaw → opacity (no lerp): 1.0 at fadeStartDeg, 0.0 at
    // fadeEndDeg. Instant, no asymptotic crawl. Mirrored: right ear fades on
    // positive yaw, left on negative.
    const fadeFor = (deg) =>
      THREE.MathUtils.clamp((fadeEndDeg - deg) / (fadeEndDeg - fadeStartDeg), 0, 1);
    let leftFadeTarget = fadeFor(-yawDeg);
    let rightFadeTarget = fadeFor(yawDeg);
    if (Math.abs(yawDeg) > HIDE_ALL_DEG) {
      leftFadeTarget = 0;
      rightFadeTarget = 0;
    }
    if (landmarks && landmarks.length >= 468) {
      const nose = landmarks[1];
      const leftJaw = landmarks[132];
      const rightJaw = landmarks[361];
      const leftCheek = landmarks[234];
      const rightCheek = landmarks[454];
      if (nose && leftJaw && rightJaw && leftCheek && rightCheek) {
        const dxL = leftJaw.x - nose.x;
        const dyL = leftJaw.y - nose.y;
        const dzL = leftJaw.z - nose.z;
        const distL = Math.sqrt(dxL * dxL + dyL * dyL + dzL * dzL);
        const dxR = rightJaw.x - nose.x;
        const dyR = rightJaw.y - nose.y;
        const dzR = rightJaw.z - nose.z;
        const distR = Math.sqrt(dxR * dxR + dyR * dyR + dzR * dzR);
        const ratioJaw = distL / distR;
        const dxCL = leftCheek.x - nose.x;
        const dyCL = leftCheek.y - nose.y;
        const dzCL = leftCheek.z - nose.z;
        const distCL = Math.sqrt(dxCL * dxCL + dyCL * dyCL + dzCL * dzCL);
        const dxCR = rightCheek.x - nose.x;
        const dyCR = rightCheek.y - nose.y;
        const dzCR = rightCheek.z - nose.z;
        const distCR = Math.sqrt(dxCR * dxCR + dyCR * dyCR + dzCR * dzCR);
        const ratioCheek = distCL / distCR;
        // Loose limits — this check exists for hands/phones covering an ear;
        // it must NOT trigger on ordinary head movement.
        const JAW_LIMIT = 0.30;
        const CHEEK_LIMIT = 0.30;
        if (ratioJaw < (1 - JAW_LIMIT) || ratioCheek < (1 - CHEEK_LIMIT)) {
          leftFadeTarget = 0;
        }
        if (ratioJaw > (1 + JAW_LIMIT) || ratioCheek > (1 + CHEEK_LIMIT)) {
          rightFadeTarget = 0;
        }
      }
    }
    // Apply opacity directly from the yaw map — no per-frame easing, no lag.
    // The 8° linear ramp itself softens the edge, so this reads as a quick
    // fade rather than a hard pop.
    this._leftFade = leftFadeTarget;
    this._rightFade = rightFadeTarget;
    this._setSideOpacity(this._leftMats, this._leftFade);
    this._setSideOpacity(this._rightMats, this._rightFade);
    this.left.visible = this._leftFade > 0.02;
    this.right.visible = this._rightFade > 0.02;
    const localX = new THREE.Vector3(1, 0, 0).applyQuaternion(poseQuat);
    const localY = new THREE.Vector3(0, 1, 0).applyQuaternion(poseQuat);
    const localZ = new THREE.Vector3(0, 0, 1).applyQuaternion(poseQuat);
    // Rigid-body anchor, done properly:
    //   worldPos(cam space, cm) = facialTransformMatrix × localOffset (w = 1)
    // then perspective-projected with the camera MediaPipe assumes
    // (63° vertical FOV, face at negative Z), then mapped into the stage.
    // Position and rotation both derive from the SAME matrix, every frame.
    let leftTarget, rightTarget;
    let interocularPx = 0;
    if (landmarks && landmarks.length >= 468 && poseMatrix && poseMatrix.length === 16) {
      const eyeL = landmarks[33];
      const eyeR = landmarks[263];
      const eyeLPos = normToStageVec3(eyeL, view, zToPx(eyeL.z, view));
      const eyeRPos = normToStageVec3(eyeR, view, zToPx(eyeR.z, view));
      interocularPx = eyeLPos.distanceTo(eyeRPos); // 3D px — drives earring size
      const zRef = (eyeLPos.z + eyeRPos.z) * 0.5;  // stage depth reference
      const pxPerCm = interocularPx / CANONICAL_INTEROCULAR_CM;

      // Layout (row- vs column-major) is detected from the data itself.
      poseMatrixToThree(poseMatrix, _poseM);
      const faceOriginCamZ = _poseM.elements[14];

      const aspect = view.videoW / view.videoH;
      const fy = 1 / Math.tan(THREE.MathUtils.degToRad(MP_VERTICAL_FOV_DEG) / 2);
      const fx = fy / aspect;

      const projectEar = (localX_, localY_, localZ_) => {
        // Local offset multiplied THROUGH the matrix, homogeneous w = 1
        _earCam.set(localX_, localY_, localZ_).applyMatrix4(_poseM);
        // Degenerate frame (point at/behind the camera) — refuse rather
        // than project the earring into the void.
        if (_earCam.z > -1) return null;
        const xNdc = (_earCam.x / -_earCam.z) * fx;
        const yNdc = (_earCam.y / -_earCam.z) * fy;
        const u = (1 + xNdc) / 2;
        const v = (1 - yNdc) / 2;
        // Stage z: canonical depth relative to the face origin, in px,
        // around the eye-plane reference (drives occluder + scale only).
        const zPx = zRef + (_earCam.z - faceOriginCamZ) * pxPerCm;
        return normToStageVec3({ x: u, y: v }, view, zPx);
      };

      // Canonical face: +X = wearer's LEFT, +Y = up, +Z = toward the camera.
      // Per-model anchor if the product config provides one, else the default.
      const oR = this._anchor.userRight;
      const oL = this._anchor.userLeft;
      // Wearer's RIGHT ear (canonical -X) lands on image-left = stage-left group.
      // skinPenetration adds to the back offset so the attachment point pushes
      // into the lobe (post/hook hidden) rather than floating in front of it.
      const skin = this._skin;
      leftTarget  = projectEar(-oR.lateral, -oR.down, -(oR.back + skin));
      rightTarget = projectEar(+oL.lateral, -oL.down, -(oL.back + skin));
    }
    if (!leftTarget || !rightTarget) {
      // Matrix missing or degenerate this frame — landmark fallback so the
      // earrings never silently vanish.
      leftTarget = normToStageVec3(anchors.left, view, 0);
      rightTarget = normToStageVec3(anchors.right, view, 0);
      leftTarget.z = zToPx(anchors.left.z, view) + s.offsetZ;
      rightTarget.z = zToPx(anchors.right.z, view) + s.offsetZ;
    }
    leftTarget
      .addScaledVector(localX, -s.offsetX)
      .addScaledVector(localY, s.offsetY)
      .addScaledVector(localZ, s.offsetZ);
    rightTarget
      .addScaledVector(localX, s.offsetX)
      .addScaledVector(localY, s.offsetY)
      .addScaledVector(localZ, s.offsetZ);
    // One Euro smoothing on the final positions (after correctness, not before)
    const leftPos = this._leftPos.filter(leftTarget, dtSeconds);
    const rightPos = this._rightPos.filter(rightTarget, dtSeconds);
    this.left.position.copy(leftPos);
    this.right.position.copy(rightPos);
    const dt = Math.min(0.03, Math.max(0.001, dtSeconds));
    if (this._prevLeftTarget.lengthSq() < 1e-6) this._prevLeftTarget.copy(leftPos);
    if (this._prevRightTarget.lengthSq() < 1e-6) this._prevRightTarget.copy(rightPos);
    const leftVelX = (leftPos.x - this._prevLeftTarget.x) / dt;
    const leftVelY = (leftPos.y - this._prevLeftTarget.y) / dt;
    this._prevLeftTarget.copy(leftPos);
    let leftAccelX = (leftVelX - this._prevLeftVelX) / dt;
    let leftAccelY = (leftVelY - this._prevLeftVelY) / dt;
    if (Math.hypot(leftVelX, leftVelY) > TELEPORT_SPEED) {
      // Teleport (tab-switch / tracking gap): no kick, and don't poison the
      // next frame's acceleration with the bogus velocity either.
      leftAccelX = 0;
      leftAccelY = 0;
      this._prevLeftVelX = 0;
      this._prevLeftVelY = 0;
    } else {
      this._prevLeftVelX = leftVelX;
      this._prevLeftVelY = leftVelY;
    }
    const rightVelX = (rightPos.x - this._prevRightTarget.x) / dt;
    const rightVelY = (rightPos.y - this._prevRightTarget.y) / dt;
    this._prevRightTarget.copy(rightPos);
    let rightAccelX = (rightVelX - this._prevRightVelX) / dt;
    let rightAccelY = (rightVelY - this._prevRightVelY) / dt;
    if (Math.hypot(rightVelX, rightVelY) > TELEPORT_SPEED) {
      rightAccelX = 0;
      rightAccelY = 0;
      this._prevRightVelX = 0;
      this._prevRightVelY = 0;
    } else {
      this._prevRightVelX = rightVelX;
      this._prevRightVelY = rightVelY;
    }
    // Spring-damper pendulum — tunables come from the earring's config
    const K = this._dangle.stiffness;
    const C = this._dangle.damping;
    const inertiaScale = this._dangle.response;
    const leftAngularAccelX = -K * this._leftSwingX - C * this._leftSwingVelX - leftAccelX * inertiaScale;
    const leftAngularAccelY = -K * this._leftSwingY - C * this._leftSwingVelY + leftAccelY * inertiaScale;
    this._leftSwingVelX += leftAngularAccelX * dt;
    this._leftSwingX += this._leftSwingVelX * dt;
    this._leftSwingVelY += leftAngularAccelY * dt;
    this._leftSwingY += this._leftSwingVelY * dt;
    const rightAngularAccelX = -K * this._rightSwingX - C * this._rightSwingVelX - rightAccelX * inertiaScale;
    const rightAngularAccelY = -K * this._rightSwingY - C * this._rightSwingVelY + rightAccelY * inertiaScale;
    this._rightSwingVelX += rightAngularAccelX * dt;
    this._rightSwingX += this._rightSwingVelX * dt;
    this._rightSwingVelY += rightAngularAccelY * dt;
    this._rightSwingY += this._rightSwingVelY * dt;
    const MAX_VEL = 15.0;
    this._leftSwingVelX = Math.max(-MAX_VEL, Math.min(MAX_VEL, this._leftSwingVelX));
    this._leftSwingVelY = Math.max(-MAX_VEL, Math.min(MAX_VEL, this._leftSwingVelY));
    this._rightSwingVelX = Math.max(-MAX_VEL, Math.min(MAX_VEL, this._rightSwingVelX));
    this._rightSwingVelY = Math.max(-MAX_VEL, Math.min(MAX_VEL, this._rightSwingVelY));
    // Clamp swing AND kill outward velocity at the limit — velocity left
    // intact makes the earring stick at the limit and snap back.
    const MAX_SWING = THREE.MathUtils.degToRad(this._dangle.maxSwingDeg);
    const clampSwing = (angle, vel) => {
      if (angle > MAX_SWING) return [MAX_SWING, Math.min(0, vel)];
      if (angle < -MAX_SWING) return [-MAX_SWING, Math.max(0, vel)];
      return [angle, vel];
    };
    [this._leftSwingX, this._leftSwingVelX] = clampSwing(this._leftSwingX, this._leftSwingVelX);
    [this._leftSwingY, this._leftSwingVelY] = clampSwing(this._leftSwingY, this._leftSwingVelY);
    [this._rightSwingX, this._rightSwingVelX] = clampSwing(this._rightSwingX, this._rightSwingVelX);
    [this._rightSwingY, this._rightSwingVelY] = clampSwing(this._rightSwingY, this._rightSwingVelY);
    // Rigid part: hangs toward WORLD down — yaw only, so tilting the head
    // never tilts the earring. yawFollow scales how much of the head's turn
    // the earring shares: danglers swivel freely on their wire and stay
    // mostly front-facing (low yawFollow) instead of exposing their backs.
    const headEuler = new THREE.Euler().setFromQuaternion(rot, "YXZ");
    const baseRot = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0), headEuler.y * this._dangle.yawFollow
    );
    this.left.quaternion.copy(baseRot);
    this.right.quaternion.copy(baseRot);
    if (this._leftSwingGroup) this._leftSwingGroup.rotation.set(this._leftSwingY, 0, this._leftSwingX, "YXZ");
    if (this._rightSwingGroup) this._rightSwingGroup.rotation.set(this._rightSwingY, 0, this._rightSwingX, "YXZ");
    // ONE shared depth factor — per-side factors rendered left and right at
    // visibly different sizes (the calibrated anchors sit at different depths).
    const depthFactor = 1.0 + ((leftPos.z + rightPos.z) * 0.5) / 1000;
    // Size from the stable interocular distance (≈ cheek width × 1/1.5),
    // not from the jittery silhouette-landmark width. _fitScale is the
    // per-model size multiplier from the product's arFit config.
    const widthRef = interocularPx > 0 ? interocularPx * 1.5 : faceWidthPx;
    const baseScale = Math.max(28, widthRef * 0.32) * Math.max(0.1, s.scaleMultiplier) * this._fitScale;
    this.left.scale.setScalar(baseScale * depthFactor);
    this.right.scale.setScalar(baseScale * depthFactor);
  }

  dispose() {
    this.clear();
    this.scene.remove(this.group);
  }
}
