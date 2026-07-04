// @ts-nocheck
import * as THREE from "three";
import { SmoothVec3, SmoothQuat } from "./smoothing";

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

function normToStageXY(p, view) {
  const px = p.x * view.videoW;
  const py = p.y * view.videoH;

  const sx = px * view.cover.scale + view.cover.offsetX;
  const sy = py * view.cover.scale + view.cover.offsetY;

  const x = sx - view.stageW / 2;
  const y = view.stageH / 2 - sy;
  return { x, y };
}

function computeAlpha(dtSeconds, halfLifeSeconds) {
  const k = Math.pow(0.5, dtSeconds / Math.max(1e-4, halfLifeSeconds));
  return 1 - k;
}

function createFallbackNecklaceMesh() {
  const geo = new THREE.TorusGeometry(1.0, 0.05, 16, 96, Math.PI);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    metalness: 1.0,
    roughness: 0.32,
  });
  mat.envMapIntensity = 1.6;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.x = Math.PI / 2;
  mesh.rotation.z = Math.PI;
  return mesh;
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
  const center = new THREE.Vector3();
  box2.getCenter(center);
  root.position.sub(center);
}

function forceGoldMaterial(root) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    const materials = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of materials) {
      if (!m) continue;
      if ("metalness" in m) m.metalness = 1.0;
      if ("roughness" in m) m.roughness = 0.28;
      if (m.color) m.color.setHex(0xffd700);
      if ("envMapIntensity" in m) m.envMapIntensity = 1.8;
      m.needsUpdate = true;
    }
  });
}

export class NecklaceSystem {
  /**
   * @param {{ scene: THREE.Scene, gltfLoader: any, onStatus?: (msg: string) => void }} args
   */
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

    this._pos = new SmoothVec3();
    this._rot = new SmoothQuat();
  }

  setVisible(v) {
    this.group.visible = v;
  }

  async loadModel(modelPath) {
    this.clear();
    this.onStatus("Loading necklace model…");

    try {
      const gltf = await this.loader.loadAsync(modelPath);
      const root = gltf.scene;

      root.traverse((o) => {
        if (o.isMesh) {
          o.frustumCulled = false;
        }
      });

      this._modelRoot = root;
      normalizeModelToUnit(root);
      forceGoldMaterial(root);
      this.modelContainer.add(root);
      this.onStatus("");
    } catch {
      this.onStatus("Failed to load GLB; using fallback geometry.");
      this.modelContainer.add(createFallbackNecklaceMesh());
    }
  }

  clear() {
    if (this._modelRoot) {
      disposeObject3D(this._modelRoot);
      this._modelRoot = null;
    }

    while (this.modelContainer.children.length) {
      const child = this.modelContainer.children.pop();
      if (child) disposeObject3D(child);
    }

    this._pos.initialized = false;
    this._rot.initialized = false;
  }

  /**
   * @param {{
   *  anchors: {
   *    chin: {x:number,y:number,z:number},
   *    jawLeft: {x:number,y:number,z:number},
   *    jawRight: {x:number,y:number,z:number},
   *    neck: {x:number,y:number,z:number}
   *  },
   *  view: { stageW:number, stageH:number, videoW:number, videoH:number, cover:{scale:number, offsetX:number, offsetY:number} },
   *  jawWidthPx: number,
   *  poseQuat: THREE.Quaternion,
   *  dtSeconds: number
   * }} args
   */
  update({ anchors, view, jawWidthPx, poseQuat, dtSeconds }) {
    if (!this.group.visible) return;

    const alpha = computeAlpha(dtSeconds, 0.08);

    const centerX = (anchors.jawLeft.x + anchors.jawRight.x) * 0.5;
    const neckStage = normToStageXY({ x: centerX, y: anchors.neck.y, z: 0 }, view);

    // Position slightly below chin / around the estimated neck.
    const target = new THREE.Vector3(neckStage.x, neckStage.y, 0);

    // Keep necklace below chin: push down based on face size.
    target.y -= Math.max(12, jawWidthPx * 0.10);

    const pos = this._pos.step(target, alpha, dtSeconds);

    // Dampen head rotation: necklace should rotate a bit, but not as much as ears.
    const euler = new THREE.Euler().setFromQuaternion(poseQuat, "YXZ");
    euler.x *= 0.25; // pitch
    euler.y *= 0.35; // yaw
    euler.z *= 0.35; // roll
    const damped = new THREE.Quaternion().setFromEuler(euler);

    const rot = this._rot.step(damped, alpha, dtSeconds);

    this.group.position.copy(pos);
    this.group.quaternion.copy(rot);

    const scale = Math.max(120, jawWidthPx * 0.85);
    this.group.scale.setScalar(scale);
  }

  dispose() {
    this.clear();
    this.scene.remove(this.group);
  }
}
