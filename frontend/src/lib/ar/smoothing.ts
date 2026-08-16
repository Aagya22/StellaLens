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

class LowPass {
  constructor() {
    this.initialized = false;
    this.y = 0;
  }
  filter(x, alpha) {
    if (!this.initialized) {
      this.initialized = true;
      this.y = x;
      return x;
    }
    this.y = alpha * x + (1 - alpha) * this.y;
    return this.y;
  }
  reset() {
    this.initialized = false;
  }
}

function oneEuroAlpha(cutoff, dt) {
  const tau = 1 / (2 * Math.PI * Math.max(1e-6, cutoff));
  return 1 / (1 + tau / Math.max(1e-4, dt));
}

export class OneEuro {
  constructor({ minCutoff = 1.0, beta = 0.007, dCutoff = 1.0 } = {}) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this._x = new LowPass();
    this._dx = new LowPass();
    this._prevRaw = null;
  }

  filter(value, dt) {
    const rawVel = this._prevRaw === null ? 0 : (value - this._prevRaw) / Math.max(1e-4, dt);
    this._prevRaw = value;
    const smoothVel = this._dx.filter(rawVel, oneEuroAlpha(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * Math.abs(smoothVel);
    return this._x.filter(value, oneEuroAlpha(cutoff, dt));
  }

  reset() {
    this._x.reset();
    this._dx.reset();
    this._prevRaw = null;
  }
}

export class OneEuroVec3 {
  constructor(options) {
    this._fx = new OneEuro(options);
    this._fy = new OneEuro(options);
    this._fz = new OneEuro(options);
    this.value = new THREE.Vector3();
  }

  filter(v, dt) {
    this.value.set(
      this._fx.filter(v.x, dt),
      this._fy.filter(v.y, dt),
      this._fz.filter(v.z, dt)
    );
    return this.value;
  }

  reset() {
    this._fx.reset();
    this._fy.reset();
    this._fz.reset();
  }
}

export class OneEuroQuat {
  constructor({ minCutoff = 1.0, beta = 0.5, dCutoff = 1.0 } = {}) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
    this.value = new THREE.Quaternion();
    this._prevTarget = new THREE.Quaternion();
    this._vel = new LowPass();
    this._initialized = false;
  }

  filter(q, dt) {
    if (!this._initialized) {
      this._initialized = true;
      this.value.copy(q);
      this._prevTarget.copy(q);
      return this.value;
    }

    const dot = Math.min(1, Math.abs(q.dot(this._prevTarget)));
    const angVel = (2 * Math.acos(dot)) / Math.max(1e-4, dt);
    this._prevTarget.copy(q);

    const smoothVel = this._vel.filter(angVel, oneEuroAlpha(this.dCutoff, dt));
    const cutoff = this.minCutoff + this.beta * smoothVel;
    this.value.slerp(q, oneEuroAlpha(cutoff, dt));
    return this.value;
  }

  reset() {
    this._initialized = false;
    this._vel.reset();
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
