// @ts-nocheck
import * as THREE from "three";

const _m = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scl = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, "YXZ");

function rad2deg(r) {
  return (r * 180) / Math.PI;
}

/**
 * Estimate head pose from MediaPipe facialTransformationMatrix.
 * Returns position, yaw/pitch/roll in radians + degrees, and a quaternion.
 */
export function estimateHeadPose(poseMatrixArray) {
  if (!poseMatrixArray || poseMatrixArray.length !== 16) {
    return {
      position: new THREE.Vector3(),
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      yaw: 0,
      pitch: 0,
      roll: 0,
      yawDeg: 0,
      pitchDeg: 0,
      rollDeg: 0,
      quaternion: new THREE.Quaternion(),
      scale: 1.0,
    };
  }

  _m.fromArray(poseMatrixArray);
  _m.decompose(_pos, _quat, _scl);

  _euler.setFromQuaternion(_quat, "YXZ");

  const pitch = _euler.x;
  const yaw = _euler.y;
  const roll = _euler.z;

  const scale = (_scl.x + _scl.y + _scl.z) / 3;

  return {
    position: _pos.clone(),
    positionX: _pos.x,
    positionY: _pos.y,
    positionZ: _pos.z,
    yaw,
    pitch,
    roll,
    yawDeg: rad2deg(yaw),
    pitchDeg: rad2deg(pitch),
    rollDeg: rad2deg(roll),
    quaternion: _quat.clone(),
    scale,
  };
}

/**
 * Damp pose to reduce over-rotation for jewellery.
 */
export function dampHeadPoseQuaternion(headPoseQuat, { yaw = 0.7, pitch = 0.25, roll = 0.85 } = {}) {
  const e = new THREE.Euler().setFromQuaternion(headPoseQuat, "YXZ");
  e.x *= pitch;
  e.y *= yaw;
  e.z *= roll;
  return new THREE.Quaternion().setFromEuler(e);
}
