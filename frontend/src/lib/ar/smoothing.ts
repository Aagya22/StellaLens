// @ts-nocheck
import * as THREE from "three";

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

/**
 * Convert a user smoothing factor (0..1) into a frame-rate independent lerp alpha.
 * - smoothingFactor = 0   => no smoothing (snap)
 * - smoothingFactor = 1   => heavy smoothing (slow)
 */
export function smoothingToAlpha(smoothingFactor, dtSeconds) {
  const s = clamp01(smoothingFactor);

  // Interpret s as "how much to smooth".
  // Convert to responsiveness r, then to alpha.
  const responsiveness = 1 - s; // 1 = snappy

  // Exponential to be frame-rate independent.
  // Map responsiveness to a speed constant (tuned for 30-60fps).
  const k = 2 + responsiveness * 28;
  const alpha = 1 - Math.exp(-k * dtSeconds);

  // If smoothing is 0 => alpha close to 1 (snap)
  // If smoothing is 1 => alpha small (slow)
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

    // Calculate raw velocity
    const safeDt = Math.max(0.001, dt);
    const rawVel = new THREE.Vector3().subVectors(target, this.prevTarget).divideScalar(safeDt);
    this.prevTarget.copy(target);

    // Filter velocity to remove high-frequency tracking noise
    this.velocity.lerp(rawVel, 0.2);

    // Predict future target position to cancel out camera capture + model pipeline latency (~80ms)
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
    this.angularVelocity = new THREE.Quaternion(); // delta rotation
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

    // Calculate raw angular delta: rawDelta = target * invert(prevTarget)
    const invPrevTarget = this.prevTarget.clone().invert();
    const rawDelta = new THREE.Quaternion().multiplyQuaternions(target, invPrevTarget);

    // Smooth the angular delta to prevent rotation jitter
    const smoothedDelta = new THREE.Quaternion().identity().slerp(rawDelta, 0.2);
    this.angularVelocity.copy(smoothedDelta);

    this.prevTarget.copy(target);

    // Predict future orientation
    const lookaheadSeconds = 0.085;
    const safeDt = Math.max(0.001, dt);
    const lookaheadFactor = lookaheadSeconds / safeDt;

    // Extrapolate rotation by scaling the delta rotation
    const extrapolatedDelta = new THREE.Quaternion().identity().slerp(this.angularVelocity, lookaheadFactor);
    const predictedTarget = new THREE.Quaternion().multiplyQuaternions(extrapolatedDelta, target);

    this.value.slerp(predictedTarget, alpha);
    return this.value;
  }
}
