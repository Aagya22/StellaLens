// @ts-nocheck
import * as THREE from "three";

import { OneEuroVec3, OneEuroQuat } from "./smoothing";
import { dampHeadPoseQuaternion, poseMatrixToThree } from "./headPose";
import {
  CANONICAL_LOBE,
  LOBE_TAP_LIMIT_CM,
  measureFaceShape,
  loadUserLobes,
  saveUserLobes,
  clearUserLobes,
  SHAPE_MAX_YAW_DEG,
  SHAPE_MAX_PITCH_DEG,
  SHAPE_TAU,
} from "./lobeModel";

// How a piece hangs FROM the lobe. Where the lobe is lives in lobeModel.ts.
export const EAR_ANCHOR = {
  userRight: { lateral: 0, down: 0, back: 0 },
  userLeft:  { lateral: 0, down: 0, back: 0 },
};

const fadeStartDeg = 8;
const fadeEndDeg   = 15;
const HIDE_ALL_DEG = 57;

const TRACKING_ZONE_W = 0.7;
const TRACKING_ZONE_H = 0.7;
const ZONE_FADE_MARGIN = 0.1;

const TELEPORT_SPEED = 5000;

const DANGLE_FORCE_OSCILLATION = false;
const DANGLE_DEBUG_PIVOT = false;
const DANGLE_DEBUG_ACCEL = false;

const POSITION_DEBUG = false;

export const DANGLE_DEFAULTS = {
  stiffness: 120,
  damping: 18,
  maxSwingDeg: 5,
  response: 0.003,
  pivotDrop: 0.3,
  yawFollow: 0.15,

  accelDeadZone: 80,
};

const EARRING_MIN_CUTOFF = 0.6;
const EARRING_BETA = 0.05;

const EARRING_METRIC_SIZE = 3;

const REFERENCE_INTEROCULAR = 0.075;
const WIDTH_SCALE_MIN = 0.8;
const WIDTH_SCALE_MAX = 1.25;

const _poseM = new THREE.Matrix4();
const _earCam = new THREE.Vector3();
const _invPose = new THREE.Matrix4();
const _occBack = new THREE.Vector3();
const _mountShift = new THREE.Vector3();
const _tapPoint = new THREE.Vector3();
const _tapRay = new THREE.Vector3();

const LOBE_OCC_RADIUS_CM = 1.5;
const LOBE_OCC_BACK_CM = 0.8;

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

let _shadowTex = null;
function contactShadowTexture() {
  if (_shadowTex) return _shadowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(0,0,0,0.55)");
  g.addColorStop(0.5, "rgba(0,0,0,0.22)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  _shadowTex = new THREE.CanvasTexture(c);
  _shadowTex.colorSpace = THREE.SRGBColorSpace;
  return _shadowTex;
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

    this._lobeBaseL = new THREE.Vector3(CANONICAL_LOBE.screenLeft.x, CANONICAL_LOBE.screenLeft.y, CANONICAL_LOBE.screenLeft.z);
    this._lobeBaseR = new THREE.Vector3(CANONICAL_LOBE.screenRight.x, CANONICAL_LOBE.screenRight.y, CANONICAL_LOBE.screenRight.z);
    this._lobeScreenL = this._lobeBaseL.clone();
    this._lobeScreenR = this._lobeBaseR.clone();
    this._shapeW = 1;
    this._shapeH = 1;
    this._userLobes = loadUserLobes();
    this._applyShape();
    this._poseWorld = new THREE.Matrix4();
    this._havePose = false;
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

    if (POSITION_DEBUG) {
      const dot = (color) => {
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(0.4, 12, 8),
          new THREE.MeshBasicMaterial({ color, depthTest: false })
        );
        m.renderOrder = 1000;
        this.group.add(m);
        return m;
      };
      this._dbgRed = dot(0xff0000);
      this._dbgBlue = dot(0x0000ff);
    }

    this._leftPos = new OneEuroVec3({ minCutoff: EARRING_MIN_CUTOFF, beta: EARRING_BETA });
    this._rightPos = new OneEuroVec3({ minCutoff: EARRING_MIN_CUTOFF, beta: EARRING_BETA });
    this._leftRot = new OneEuroQuat({ minCutoff: EARRING_MIN_CUTOFF, beta: EARRING_BETA });
    this._rightRot = new OneEuroQuat({ minCutoff: EARRING_MIN_CUTOFF, beta: EARRING_BETA });
    this._presence = 1;
    this._loggedInteroc = false;
    this._shadowScale = 0.35;
    this._type = "dangle";
    this._fixedNodes = null;
    this._leftShadow = null;
    this._rightShadow = null;
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

  getAnchor() {
    return this._anchor;
  }

  getLobes() {
    return {
      screenLeft: { x: this._lobeScreenL.x, y: this._lobeScreenL.y, z: this._lobeScreenL.z },
      screenRight: { x: this._lobeScreenR.x, y: this._lobeScreenR.y, z: this._lobeScreenR.z },
    };
  }

  hasUserCalibration() {
    return this._userLobes !== null;
  }

  setUserLobes(lobes) {
    if (!lobes?.screenLeft || !lobes?.screenRight) {
      this.resetLobes();
      return;
    }
    this._userLobes = {
      screenLeft: { ...lobes.screenLeft },
      screenRight: { ...lobes.screenRight },
    };
    saveUserLobes(this._userLobes);
    this._applyShape();
    this._leftPos.reset();
    this._rightPos.reset();
  }

  resetLobes() {
    this._userLobes = null;
    clearUserLobes();
    this._applyShape();
    this._leftPos.reset();
    this._rightPos.reset();
  }

  _applyShape() {
    if (this._userLobes) {
      const u = this._userLobes;
      this._lobeScreenL.set(u.screenLeft.x, u.screenLeft.y, u.screenLeft.z);
      this._lobeScreenR.set(u.screenRight.x, u.screenRight.y, u.screenRight.z);
      return;
    }
    const w = this._shapeW, h = this._shapeH;
    this._lobeScreenL.set(this._lobeBaseL.x * w, this._lobeBaseL.y * h, this._lobeBaseL.z * w);
    this._lobeScreenR.set(this._lobeBaseR.x * w, this._lobeBaseR.y * h, this._lobeBaseR.z * w);
  }

  calibrateLobeFromTap({ side, ndcX, ndcY, camera }) {
    if (!this._havePose || !camera) return null;

    if (!this._userLobes) this._userLobes = this.getLobes();
    const lobe = side === "screenLeft" ? this._lobeScreenL : this._lobeScreenR;
    const here = _tapPoint.copy(lobe).applyMatrix4(this._poseWorld);

    const ray = _tapRay.set(ndcX, ndcY, 0.5).unproject(camera).sub(camera.position);
    if (Math.abs(ray.z) < 1e-6) return null;
    ray.multiplyScalar((here.z - camera.position.z) / ray.z).add(camera.position);
    _invPose.copy(this._poseWorld).invert();
    ray.applyMatrix4(_invPose);

    const base = CANONICAL_LOBE[side];
    const lim = LOBE_TAP_LIMIT_CM;
    this._userLobes[side] = {
      x: THREE.MathUtils.clamp(ray.x, base.x - lim, base.x + lim),
      y: THREE.MathUtils.clamp(ray.y, base.y - lim, base.y + lim),
      z: lobe.z,
    };
    this._applyShape();
    this._leftPos.reset();
    this._rightPos.reset();
    saveUserLobes(this._userLobes);
    return this.getLobes();
  }

  isSideOccluded() {
    return this._occludedLeft === true || this._occludedRight === true;
  }

  async loadModel(modelPath, { singleEarring = false, preserveMaterials = false, anchor = null, dangle = null, fit = null, materials = null, skinPenetration = 0, contactShadow = null, type = "dangle", fixedNodes = null, pairMirror = "flipX" }: {
    singleEarring?: boolean;
    preserveMaterials?: boolean;
    anchor?: { userRight: { lateral: number; down: number; back: number }; userLeft: { lateral: number; down: number; back: number } } | null;
    dangle?: { stiffness?: number; damping?: number; maxSwingDeg?: number; response?: number; pivotDrop?: number; yawFollow?: number } | null;
    fit?: { rotationDeg?: [number, number, number]; scale?: number } | null;
    materials?: Array<{ match: string; hide?: boolean; color?: string; metalness?: number; roughness?: number; clearcoat?: number; clearcoatRoughness?: number; envMapIntensity?: number }> | null;
    skinPenetration?: number;
    contactShadow?: number;
    type?: "dangle" | "hoop" | "stud";
    fixedNodes?: string[] | null;
    pairMirror?: "flipX" | "rotateY";
  } = {}) {
    this.clear();

    const src = anchor ?? EAR_ANCHOR;
    this._anchor = {
      userRight: { ...src.userRight },
      userLeft: { ...src.userLeft },
    };
    this._dangle = { ...DANGLE_DEFAULTS, ...(dangle ?? {}) };
    this._fitScale = fit?.scale ?? 1;
    this._matOverrides = materials ?? null;
    this._skin = skinPenetration;
    if (contactShadow != null) this._shadowScale = contactShadow;
    this._type = type;
    this._fixedNodes = fixedNodes;
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
        if (pairMirror === "rotateY") {
          rightModel.rotation.y += Math.PI;
        } else {
          rightModel.scale.x *= -1;
        }
      }
      if (!rotDeg) {
        leftModel.rotation.x = Math.PI / 2;
        rightModel.rotation.x = Math.PI / 2;
      }
      this._mountModels(leftModel, rightModel);
      if (type === "stud") {
        const occGeo = new THREE.SphereGeometry(1, 16, 12);
        const occMat = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: true });
        this._lobeOccL = new THREE.Mesh(occGeo, occMat);
        this._lobeOccR = new THREE.Mesh(occGeo, occMat);
        for (const o of [this._lobeOccL, this._lobeOccR]) {
          o.renderOrder = -1;
          o.frustumCulled = false;
          o.scale.setScalar(LOBE_OCC_RADIUS_CM);
          this.group.add(o);
        }
      }

      if (!preserveMaterials) this.setGemColors(this._topGemColor, this._bottomGemColor);
      this.onStatus("");
    } catch (err) {
      console.error("[AR] earring model failed to load:", modelPath, err);
      this.onStatus("Couldn't load this piece's 3D model.");
    }
  }

  _mountModels(leftModel, rightModel) {
    const mount = (container, model, matsOut) => {
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

      if (this._type === "dangle" && this._fixedNodes && this._fixedNodes.length) {
        const fixedNames = new Set(this._fixedNodes);
        const fixedObjs = [];
        model.traverse((o) => { if (o.name && fixedNames.has(o.name)) fixedObjs.push(o); });

        model.updateMatrixWorld(true);
        const hookSet = new Set();
        for (const o of fixedObjs) o.traverse((c) => hookSet.add(c));
        const dropBox = new THREE.Box3();
        model.traverse((c) => { if (c.isMesh && !hookSet.has(c)) dropBox.expandByObject(c); });
        const pivotY = isFinite(dropBox.max.y) ? dropBox.max.y : 0;
        if (!fixedObjs.length) console.warn("[AR] fixedNodes not found in GLB:", this._fixedNodes);

        const fixedGroup = new THREE.Group();
        container.add(fixedGroup);
        const swing = new THREE.Group();
        swing.position.y = pivotY;
        fixedGroup.add(swing);

        model.position.y -= pivotY;
        swing.add(model);

        container.updateMatrixWorld(true);
        for (const o of fixedObjs) fixedGroup.attach(o);
        return swing;
      }

      model.updateMatrixWorld(true);
      const swing = new THREE.Group();
      const box = new THREE.Box3().setFromObject(model);
      const height = Math.max(1e-6, box.max.y - box.min.y);
      const pivotY = box.max.y - (this._dangle.pivotDrop ?? 0) * height;
      swing.position.y = pivotY;
      model.position.y -= pivotY;
      swing.add(model);
      container.add(swing);
      return swing;
    };
    this._leftMats = [];
    this._rightMats = [];
    this._leftSwingGroup = mount(this.left, leftModel, this._leftMats);
    this._rightSwingGroup = mount(this.right, rightModel, this._rightMats);

    const alignMount = (container) => {
      container.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(container);
      if (!Number.isFinite(box.max.y) || box.isEmpty()) return;
      const cx = (box.min.x + box.max.x) / 2;
      const cz = (box.min.z + box.max.z) / 2;

      const my = this._type === "stud" ? (box.min.y + box.max.y) / 2 : box.max.y;
      for (const child of container.children) child.position.sub(_mountShift.set(cx, my, cz));
    };
    alignMount(this.left);
    alignMount(this.right);

    if (DANGLE_DEBUG_PIVOT) {
      const marker = () => {
        const m = new THREE.Mesh(
          new THREE.SphereGeometry(0.09, 10, 8),
          new THREE.MeshBasicMaterial({ color: 0x00ff00, wireframe: true, depthTest: false })
        );
        m.renderOrder = 999;
        return m;
      };
      this._leftSwingGroup?.add(marker());
      this._rightSwingGroup?.add(marker());

      const lines = [];
      const walk = (o, d) => {
        const kids = o.children.length;
        lines.push(`${"  ".repeat(d)}${o.type} "${o.name || "(unnamed)"}"${o.isMesh ? " [mesh]" : ""} children=${kids}`);
        for (const c of o.children) walk(c, d + 1);
      };
      walk(this.left, 0);
      console.log("[dangle] LEFT scene graph after mount:\n" + lines.join("\n"));
      console.log("[dangle] leftSwingGroup children:", this._leftSwingGroup?.children.length,
        "| type:", this._type, "| fixedNodes:", this._fixedNodes);
    }

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

    const makeShadow = () => {
      const mat = new THREE.SpriteMaterial({
        map: contactShadowTexture(),
        color: 0x000000,
        transparent: true,
        opacity: 0.3,
        depthTest: false,
        depthWrite: false,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.setScalar(this._shadowScale);
      sprite.renderOrder = 0.5;
      return sprite;
    };
    this._leftShadow = makeShadow();
    this._rightShadow = makeShadow();
    this.left.add(this._leftShadow);
    this.right.add(this._rightShadow);
  }

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

  _applyOpacity() {
    const lo = this._leftFade * this._presence;
    const ro = this._rightFade * this._presence;
    this._setSideOpacity(this._leftMats, lo);
    this._setSideOpacity(this._rightMats, ro);
    this.left.visible = lo > 0.02;
    this.right.visible = ro > 0.02;
  }

  applyPresence(tracked, dtSeconds, lostMs) {
    const dt = THREE.MathUtils.clamp(dtSeconds, 0, 0.05);
    if (!tracked && lostMs > 2000) {
      this._presence = 0;
    } else {
      const dur = tracked ? 0.3 : 0.2;
      const step = dt / dur;
      const target = tracked ? 1 : 0;
      this._presence = this._presence < target
        ? Math.min(target, this._presence + step)
        : Math.max(target, this._presence - step);
    }
    this._applyOpacity();
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
    if (this._lobeOccL) {
      this._lobeOccL.geometry.dispose();
      this._lobeOccL.material.dispose();
      this.group.remove(this._lobeOccL);
      this.group.remove(this._lobeOccR);
      this._lobeOccL = null;
      this._lobeOccR = null;
    }
    for (const container of [this.left, this.right]) {
      while (container.children.length) {
        const child = container.children[0];
        container.remove(child);
        disposeObject3D(child);
      }
    }
    this._leftShadow?.material?.dispose();
    this._rightShadow?.material?.dispose();
    this._leftShadow = null;
    this._rightShadow = null;
    this._leftPos.reset();
    this._rightPos.reset();
    this._leftRot.reset();
    this._rightRot.reset();
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

    const rotL = this._leftRot.filter(dampedPose, dtSeconds);
    const rotR = this._rightRot.filter(dampedPose, dtSeconds);

    let yawDeg;
    if (poseMatrix && poseMatrix.length === 16) {
      poseMatrixToThree(poseMatrix, _poseM);
      _poseM.decompose(_yawPos, _yawQuat, _yawScl);
      _yawEuler.setFromQuaternion(_yawQuat, "YXZ");
      yawDeg = THREE.MathUtils.radToDeg(_yawEuler.y);
    } else {
      yawDeg = THREE.MathUtils.radToDeg(headPose?.yaw ?? 0);
    }

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

        const JAW_LIMIT = 0.30;
        const CHEEK_LIMIT = 0.30;
        this._occludedLeft = false;
        this._occludedRight = false;
        if (ratioJaw < (1 - JAW_LIMIT) || ratioCheek < (1 - CHEEK_LIMIT)) {
          leftFadeTarget = 0;
          this._occludedLeft = true;
        }
        if (ratioJaw > (1 + JAW_LIMIT) || ratioCheek > (1 + CHEEK_LIMIT)) {
          rightFadeTarget = 0;
          this._occludedRight = true;
        }
      }
    }

    if (landmarks && landmarks.length >= 468) {
      const eL = landmarks[33], eR = landmarks[263];
      if (eL && eR) {
        const dx = Math.abs((eL.x + eR.x) * 0.5 - 0.5);
        const dy = Math.abs((eL.y + eR.y) * 0.5 - 0.5);
        const ox = 1 - THREE.MathUtils.clamp((dx - TRACKING_ZONE_W / 2) / ZONE_FADE_MARGIN, 0, 1);
        const oy = 1 - THREE.MathUtils.clamp((dy - TRACKING_ZONE_H / 2) / ZONE_FADE_MARGIN, 0, 1);
        const zoneOpac = Math.min(ox, oy);
        leftFadeTarget = Math.min(leftFadeTarget, zoneOpac);
        rightFadeTarget = Math.min(rightFadeTarget, zoneOpac);
      }
    }

    this._leftFade = leftFadeTarget;
    this._rightFade = rightFadeTarget;
    this._applyOpacity();

    if (landmarks && Math.abs(yawDeg) < SHAPE_MAX_YAW_DEG &&
        Math.abs(THREE.MathUtils.radToDeg(headPose?.pitch ?? 0)) < SHAPE_MAX_PITCH_DEG) {
      const shape = measureFaceShape(landmarks, view?.videoW, view?.videoH);
      if (shape) {
        const alpha = 1 - Math.exp(-Math.min(0.05, dtSeconds || 0.016) / SHAPE_TAU);
        this._shapeW += (shape.width - this._shapeW) * alpha;
        this._shapeH += (shape.height - this._shapeH) * alpha;
        this._shapeRaw = shape;
      }
    }
    this._applyShape();

    let leftTarget, rightTarget;
    if (poseMatrix && poseMatrix.length === 16) {
      poseMatrixToThree(poseMatrix, _poseM);

      this._poseWorld.copy(_poseM);
      this._havePose = true;

      const oR = this._anchor.userRight;
      const oL = this._anchor.userLeft;
      const skin = this._skin;
      const lobeL = this._lobeScreenL, lobeR = this._lobeScreenR;
      leftTarget  = new THREE.Vector3(lobeL.x - oR.lateral, lobeL.y - oR.down, lobeL.z - (oR.back + skin)).applyMatrix4(_poseM);
      rightTarget = new THREE.Vector3(lobeR.x + oL.lateral, lobeR.y - oL.down, lobeR.z - (oL.back + skin)).applyMatrix4(_poseM);
    }
    if (!leftTarget || !rightTarget) {
      leftTarget = this._leftPos.value.clone();
      rightTarget = this._rightPos.value.clone();
    }
    const leftPos = this._leftPos.filter(leftTarget, dtSeconds);
    const rightPos = this._rightPos.filter(rightTarget, dtSeconds);
    this.left.position.copy(leftPos);
    this.right.position.copy(rightPos);
    if (this._lobeOccL && this._lobeOccR) {
      _occBack.set(0, 0.2, -LOBE_OCC_BACK_CM).applyQuaternion(_yawQuat);
      this._lobeOccL.position.copy(leftPos).add(_occBack);
      this._lobeOccR.position.copy(rightPos).add(_occBack);
    }
    if (POSITION_DEBUG && this._dbgRed) {
      this._dbgRed.position.copy(leftTarget);
      this._dbgBlue.position.copy(leftPos);
    }
    if (this._type !== "dangle") {
      const eL = new THREE.Euler().setFromQuaternion(rotL, "YXZ");
      const eR = new THREE.Euler().setFromQuaternion(rotR, "YXZ");
      this.left.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), eL.y);
      this.right.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), eR.y);
    } else {
    const dt = Math.min(0.03, Math.max(0.001, dtSeconds));

    if (this._prevLeftTarget.lengthSq() < 1e-6) this._prevLeftTarget.copy(leftTarget);
    if (this._prevRightTarget.lengthSq() < 1e-6) this._prevRightTarget.copy(rightTarget);
    const leftVelX = (leftTarget.x - this._prevLeftTarget.x) / dt;
    const leftVelY = (leftTarget.y - this._prevLeftTarget.y) / dt;
    this._prevLeftTarget.copy(leftTarget);
    let leftAccelX = (leftVelX - this._prevLeftVelX) / dt;
    let leftAccelY = (leftVelY - this._prevLeftVelY) / dt;
    if (Math.hypot(leftVelX, leftVelY) > TELEPORT_SPEED) {
      leftAccelX = 0; leftAccelY = 0; this._prevLeftVelX = 0; this._prevLeftVelY = 0;
    } else {
      this._prevLeftVelX = leftVelX; this._prevLeftVelY = leftVelY;
    }
    const rightVelX = (rightTarget.x - this._prevRightTarget.x) / dt;
    const rightVelY = (rightTarget.y - this._prevRightTarget.y) / dt;
    this._prevRightTarget.copy(rightTarget);
    let rightAccelX = (rightVelX - this._prevRightVelX) / dt;
    let rightAccelY = (rightVelY - this._prevRightVelY) / dt;
    if (Math.hypot(rightVelX, rightVelY) > TELEPORT_SPEED) {
      rightAccelX = 0; rightAccelY = 0; this._prevRightVelX = 0; this._prevRightVelY = 0;
    } else {
      this._prevRightVelX = rightVelX; this._prevRightVelY = rightVelY;
    }
    if (DANGLE_DEBUG_ACCEL && (this._dbgFrame = (this._dbgFrame | 0) + 1) % 60 === 0)
      console.log(`[dangle] |accel|=${Math.hypot(leftAccelX, leftAccelY).toFixed(0)} swingX=${(this._leftSwingX * 57.3).toFixed(1)}°`);
    const K = this._dangle.stiffness;
    const C = this._dangle.damping;
    const inertiaScale = this._dangle.response;

    const deadZone = this._dangle.accelDeadZone ?? 0;
    if (Math.hypot(leftAccelX, leftAccelY) < deadZone) { leftAccelX = 0; leftAccelY = 0; }
    if (Math.hypot(rightAccelX, rightAccelY) < deadZone) { rightAccelX = 0; rightAccelY = 0; }
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

    const yawFollow = this._dangle.yawFollow;
    const eulerL = new THREE.Euler().setFromQuaternion(rotL, "YXZ");
    const eulerR = new THREE.Euler().setFromQuaternion(rotR, "YXZ");
    this.left.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), eulerL.y * yawFollow);
    this.right.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), eulerR.y * yawFollow);
      if (DANGLE_FORCE_OSCILLATION) {
        const f = Math.sin(Date.now() * 0.005) * THREE.MathUtils.degToRad(20);
        this._leftSwingX = f; this._leftSwingY = 0;
        this._rightSwingX = f; this._rightSwingY = 0;
      }
      if (this._leftSwingGroup) this._leftSwingGroup.rotation.set(this._leftSwingY, 0, this._leftSwingX, "YXZ");
      if (this._rightSwingGroup) this._rightSwingGroup.rotation.set(this._rightSwingY, 0, this._rightSwingX, "YXZ");
    }

    const metricScale = EARRING_METRIC_SIZE * this._fitScale;
    this.left.scale.setScalar(metricScale);
    this.right.scale.setScalar(metricScale);
  }

  dispose() {
    this.clear();
    this.scene.remove(this.group);
  }
}
