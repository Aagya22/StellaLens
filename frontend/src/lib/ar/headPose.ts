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
 * Load MediaPipe's facial transformation matrix into a THREE.Matrix4,
 * detecting the memory layout at runtime instead of trusting docs.
 *
 * The transform is rigid: its true last row is [0,0,0,1] and its
 * translation z is tens of centimeters (face in front of the camera), so:
 *   row-major    → tz sits at data[11]
 *   column-major → tz sits at data[14]
 * three.js stores column-major, so a row-major source needs a transpose.
 * Getting this wrong inverts the rotation (looks fine ONLY at frontal
 * pose) and zeroes the translation.
 */
let _layoutLogged = false;
export function poseMatrixToThree(data, target) {
  const rowMajor = Math.abs(data[11]) > Math.abs(data[14]);
  target.fromArray(data);
  if (rowMajor) target.transpose();
  if (!_layoutLogged) {
    _layoutLogged = true;
    console.info(
      `[AR] pose matrix layout: ${rowMajor ? "row-major" : "column-major"}, ` +
      `t=(${target.elements[12].toFixed(1)}, ${target.elements[13].toFixed(1)}, ${target.elements[14].toFixed(1)}) cm`
    );
  }
  return target;
}


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

  poseMatrixToThree(poseMatrixArray, _m);
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


export function dampHeadPoseQuaternion(headPoseQuat, { yaw = 0.7, pitch = 0.25, roll = 0.85 } = {}) {
  const e = new THREE.Euler().setFromQuaternion(headPoseQuat, "YXZ");
  e.x *= pitch;
  e.y *= yaw;
  e.z *= roll;
  return new THREE.Quaternion().setFromEuler(e);
}
