// @ts-nocheck
import * as THREE from "three";

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

export function smoothingToAlpha(smoothingFactor, dtSeconds) {
  const s = clamp01(smoothingFactor);
  const responsiveness = 1 - s;
  const k = 2 + responsiveness * 28;
  const alpha = 1 - Math.exp(-k * dtSeconds);
  return clamp01(alpha);
}

export class SmoothVec3 {
  constructor() {
    this.value = new THREE.Vector3();
    this.prevTarget = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.initialized = false;
  }

  reset() {
    this.initialized = false;
    this.velocity.set(0, 0, 0);
  }

  step(target, alpha, dt = 0.03) {
    if (!this.initialized) {
      this.value.copy(target);
      this.prevTarget.copy(target);
      this.initialized = true;
      return this.value;
    }
    const safeDt = Math.max(0.001, dt);
    const rawVel = new THREE.Vector3().subVectors(target, this.prevTarget).divideScalar(safeDt);
    this.prevTarget.copy(target);
    this.velocity.lerp(rawVel, 0.2);
    const lookaheadSeconds = 0.085;
    const predictedTarget = new THREE.Vector3().copy(target).addScaledVector(this.velocity, lookaheadSeconds);
    this.value.lerp(predictedTarget, alpha);
    return this.value;
  }
}

export class SmoothQuat {
  constructor() {
    this.value = new THREE.Quaternion();
    this.prevTarget = new THREE.Quaternion();
    this.angularVelocity = new THREE.Quaternion();
    this.initialized = false;
  }

  reset() {
    this.initialized = false;
    this.angularVelocity.identity();
  }

  step(target, alpha, dt = 0.03) {
    if (!this.initialized) {
      this.value.copy(target);
      this.prevTarget.copy(target);
      this.initialized = true;
      return this.value;
    }
    const invPrevTarget = this.prevTarget.clone().invert();
    const rawDelta = new THREE.Quaternion().multiplyQuaternions(target, invPrevTarget);
    const smoothedDelta = new THREE.Quaternion().identity().slerp(rawDelta, 0.2);
    this.angularVelocity.copy(smoothedDelta);
    this.prevTarget.copy(target);
    const lookaheadSeconds = 0.085;
    const safeDt = Math.max(0.001, dt);
    const lookaheadFactor = lookaheadSeconds / safeDt;
    const extrapolatedDelta = new THREE.Quaternion().identity().slerp(this.angularVelocity, lookaheadFactor);
    const predictedTarget = new THREE.Quaternion().multiplyQuaternions(extrapolatedDelta, target);
    this.value.slerp(predictedTarget, alpha);
    return this.value;
  }
}
