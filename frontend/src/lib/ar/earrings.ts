// @ts-nocheck
import * as THREE from "three";

import { SmoothQuat, SmoothVec3, smoothingToAlpha } from "./smoothing";
import { dampHeadPoseQuaternion } from "./headPose";

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

function createFallbackEarringMesh() {
  const geo = new THREE.TorusGeometry(0.5, 0.16, 16, 48);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    metalness: 1.0,
    roughness: 0.25,
  });
  mat.envMapIntensity = 1.6;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = -0.4;
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
  const max = new THREE.Vector3();
  const center = new THREE.Vector3();
  box2.getCenter(center);
  max.copy(box2.max);
  root.position.x -= center.x;
  root.position.y -= max.y;
  root.position.z -= center.z;
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
    this._leftPos = new SmoothVec3();
    this._rightPos = new SmoothVec3();
    this._rot = new SmoothQuat();
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

  async loadModel(modelPath) {
    this.clear();
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
      normalizeModelToUnit(root);
      applyRealisticMaterials(root, modelPath);
      const leftModel = root.clone(true);
      const rightModel = root.clone(true);
      leftModel.rotation.x = Math.PI / 2;
      rightModel.rotation.x = Math.PI / 2;
      rightModel.scale.x *= -1;
      this.left.add(leftModel);
      this.right.add(rightModel);
      this.setGemColors(this._topGemColor, this._bottomGemColor);
      this.onStatus("");
    } catch (err) {
      this.onStatus("Failed to load GLB; using fallback geometry.");
      this.left.add(createFallbackEarringMesh());
      const right = createFallbackEarringMesh();
      right.scale.x *= -1;
      this.right.add(right);
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
  }

  update({ anchors, landmarks, view, faceWidthPx, poseQuat, headPose, settings, dtSeconds }) {
    if (!this.group.visible) return;
    const s = settings ?? {
      offsetX: 0,
      offsetY: 0,
      offsetZ: -35,
      scaleMultiplier: 1.0,
      smoothingFactor: 0.55,
    };
    const posAlpha = smoothingToAlpha(s.smoothingFactor, dtSeconds);
    const rotAlpha = smoothingToAlpha(Math.min(1, s.smoothingFactor + 0.1), dtSeconds);
    const dampedPose = dampHeadPoseQuaternion(poseQuat, {
      yaw: 0.75,
      pitch: 0.25,
      roll: 0.85,
    });
    const rot = this._rot.step(dampedPose, rotAlpha, dtSeconds);
    const yaw = headPose?.yaw ?? 0;
    const YAW_THRESHOLD = 0.42;
    const OUT_OF_BOUNDS_YAW = 0.85;
    let leftVisible = true;
    let rightVisible = true;
    if (Math.abs(yaw) > OUT_OF_BOUNDS_YAW) {
      leftVisible = false;
      rightVisible = false;
    } else if (yaw < -YAW_THRESHOLD) {
      leftVisible = false;
      rightVisible = true;
    } else if (yaw > YAW_THRESHOLD) {
      leftVisible = true;
      rightVisible = false;
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
        const JAW_LIMIT = 0.20;
        const CHEEK_LIMIT = 0.20;
        if (ratioJaw < (1 - JAW_LIMIT) || ratioCheek < (1 - CHEEK_LIMIT)) {
          leftVisible = false;
        }
        if (ratioJaw > (1 + JAW_LIMIT) || ratioCheek > (1 + CHEEK_LIMIT)) {
          rightVisible = false;
        }
      }
    }
    this.left.visible = leftVisible;
    this.right.visible = rightVisible;
    const localX = new THREE.Vector3(1, 0, 0).applyQuaternion(poseQuat);
    const localY = new THREE.Vector3(0, 1, 0).applyQuaternion(poseQuat);
    const localZ = new THREE.Vector3(0, 0, 1).applyQuaternion(poseQuat);
    let leftTarget, rightTarget;
    if (landmarks && landmarks.length >= 468) {
      const avg = (a, b, c, key) => (a[key] + b[key] + c[key]) / 3;
      const lL1 = landmarks[132], lL2 = landmarks[172], lL3 = landmarks[234];
      const lR1 = landmarks[361], lR2 = landmarks[397], lR3 = landmarks[454];
      const lmLeftJaw = { x: avg(lL1, lL2, lL3, 'x'), y: avg(lL1, lL2, lL3, 'y'), z: avg(lL1, lL2, lL3, 'z') };
      const lmRightJaw = { x: avg(lR1, lR2, lR3, 'x'), y: avg(lR1, lR2, lR3, 'y'), z: avg(lR1, lR2, lR3, 'z') };
      const leftJawPos = normToStageVec3(lmLeftJaw, view, zToPx(lmLeftJaw.z, view));
      const rightJawPos = normToStageVec3(lmRightJaw, view, zToPx(lmRightJaw.z, view));
      const faceWidth = leftJawPos.distanceTo(rightJawPos);
      const outwardFactor = 0.24;
      const downwardFactor = 0.12;
      const backwardFactor = 0.22;
      leftTarget = leftJawPos.clone()
        .addScaledVector(localX, -outwardFactor * faceWidth)
        .addScaledVector(localY, -downwardFactor * faceWidth)
        .addScaledVector(localZ, -backwardFactor * faceWidth);
      rightTarget = rightJawPos.clone()
        .addScaledVector(localX, outwardFactor * faceWidth)
        .addScaledVector(localY, -downwardFactor * faceWidth)
        .addScaledVector(localZ, -backwardFactor * faceWidth);
    } else {
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
    const leftPos = this._leftPos.step(leftTarget, posAlpha, dtSeconds);
    const rightPos = this._rightPos.step(rightTarget, posAlpha, dtSeconds);
    this.left.position.copy(leftPos);
    this.right.position.copy(rightPos);
    const dt = Math.min(0.03, Math.max(0.001, dtSeconds));
    if (this._prevLeftTarget.lengthSq() < 1e-6) this._prevLeftTarget.copy(leftPos);
    if (this._prevRightTarget.lengthSq() < 1e-6) this._prevRightTarget.copy(rightPos);
    const leftVelX = (leftPos.x - this._prevLeftTarget.x) / dt;
    const leftVelY = (leftPos.y - this._prevLeftTarget.y) / dt;
    this._prevLeftTarget.copy(leftPos);
    const leftAccelX = (leftVelX - this._prevLeftVelX) / dt;
    const leftAccelY = (leftVelY - this._prevLeftVelY) / dt;
    this._prevLeftVelX = leftVelX;
    this._prevLeftVelY = leftVelY;
    const rightVelX = (rightPos.x - this._prevRightTarget.x) / dt;
    const rightVelY = (rightPos.y - this._prevRightTarget.y) / dt;
    this._prevRightTarget.copy(rightPos);
    const rightAccelX = (rightVelX - this._prevRightVelX) / dt;
    const rightAccelY = (rightVelY - this._prevRightVelY) / dt;
    this._prevRightVelX = rightVelX;
    this._prevRightVelY = rightVelY;
    const K = 120.0;
    const C = 6.0;
    const inertiaScale = 0.0018;
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
    const MAX_SWING = Math.PI / 3;
    this._leftSwingX = Math.max(-MAX_SWING, Math.min(MAX_SWING, this._leftSwingX));
    this._leftSwingY = Math.max(-MAX_SWING, Math.min(MAX_SWING, this._leftSwingY));
    this._rightSwingX = Math.max(-MAX_SWING, Math.min(MAX_SWING, this._rightSwingX));
    this._rightSwingY = Math.max(-MAX_SWING, Math.min(MAX_SWING, this._rightSwingY));
    const headEuler = new THREE.Euler().setFromQuaternion(rot, "YXZ");
    const baseRot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), headEuler.y);
    const leftSwingQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(this._leftSwingY, 0, this._leftSwingX, "YXZ"));
    const leftRot = baseRot.clone().multiply(leftSwingQuat);
    const rightSwingQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(this._rightSwingY, 0, this._rightSwingX, "YXZ"));
    const rightRot = baseRot.clone().multiply(rightSwingQuat);
    this.left.quaternion.copy(leftRot);
    this.right.quaternion.copy(rightRot);
    const leftDepthFactor = 1.0 + (leftPos.z / 1000);
    const rightDepthFactor = 1.0 + (rightPos.z / 1000);
    const baseScale = Math.max(28, faceWidthPx * 0.32) * Math.max(0.1, s.scaleMultiplier);
    this.left.scale.setScalar(baseScale * leftDepthFactor);
    this.right.scale.setScalar(baseScale * rightDepthFactor);
  }

  dispose() {
    this.clear();
    this.scene.remove(this.group);
  }
}
