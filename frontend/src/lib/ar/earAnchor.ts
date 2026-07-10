// @ts-nocheck
function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function landmarkAt(landmarks, index) {
  const p = landmarks?.[index];
  if (!p) return null;
  if (
    !Number.isFinite(p.x) ||
    !Number.isFinite(p.y) ||
    !Number.isFinite(p.z)
  ) {
    return null;
  }
  return p;
}

export function computeFaceCenter(landmarks) {
  const indices = [1, 168, 33, 263];
  let x = 0;
  let y = 0;
  let z = 0;
  let count = 0;
  for (const idx of indices) {
    const p = landmarkAt(landmarks, idx);
    if (!p) continue;
    x += p.x;
    y += p.y;
    z += p.z;
    count++;
  }
  if (!count) {
    return {
      x: 0.5,
      y: 0.5,
      z: 0,
    };
  }
  return {
    x: x / count,
    y: y / count,
    z: z / count,
  };
}

function averagePoints(landmarks, indices) {
  let x = 0;
  let y = 0;
  let z = 0;
  let count = 0;
  for (const idx of indices) {
    const p = landmarkAt(landmarks, idx);
    if (!p) continue;
    x += p.x;
    y += p.y;
    z += p.z;
    count++;
  }
  if (!count) return null;
  return {
    x: x / count,
    y: y / count,
    z: z / count,
    confidence: clamp01(count / indices.length),
  };
}

export function computeFaceWidth(
  landmarks: any,
  leftAnchor: any = null,
  rightAnchor: any = null
) {
  const left = landmarkAt(landmarks, 234);
  const right = landmarkAt(landmarks, 454);
  if (left && right) {
    return {
      left,
      right,
      width: Math.abs(right.x - left.x),
    };
  }
  const leftEye = landmarkAt(landmarks, 33);
  const rightEye = landmarkAt(landmarks, 263);
  if (leftEye && rightEye) {
    return {
      left: leftEye,
      right: rightEye,
      width: Math.abs(rightEye.x - leftEye.x),
    };
  }
  if (leftAnchor && rightAnchor) {
    return {
      left: leftAnchor,
      right: rightAnchor,
      width: Math.abs(rightAnchor.x - leftAnchor.x),
    };
  }
  return {
    left: { x: 0.3, y: 0.5, z: 0 },
    right: { x: 0.7, y: 0.5, z: 0 },
    width: 0.4,
  };
}

function estimateEarPosition(
  faceCenter,
  sidePoint,
  faceWidth,
  side
) {
  const dx = sidePoint.x - faceCenter.x;
  const dz = sidePoint.z - faceCenter.z;
  const outwardScale = 0.24;
  const outwardX = sidePoint.x + dx * outwardScale;
  const outwardZ = sidePoint.z + dz * outwardScale;
  const lobeDrop = Math.max(faceWidth * 0.035, 0.014);
  return {
    x: outwardX,
    y: sidePoint.y + lobeDrop,
    z: outwardZ,
    confidence: 1,
  };
}

export class EarAnchor {
  constructor({ side, indices }) {
    this.side = side;
    this.indices = indices;
  }

  compute(landmarks) {
    if (!landmarks?.length) {
      return {
        x: this.side === "left" ? 0.22 : 0.78,
        y: 0.55,
        z: 0,
        confidence: 0,
      };
    }
    const sidePoint = averagePoints(landmarks, this.indices);
    if (!sidePoint) {
      return {
        x: this.side === "left" ? 0.22 : 0.78,
        y: 0.55,
        z: 0,
        confidence: 0,
      };
    }
    const faceCenter = computeFaceCenter(landmarks);
    const { width } = computeFaceWidth(landmarks);
    const ear = estimateEarPosition(faceCenter, sidePoint, width, this.side);
    ear.confidence = sidePoint.confidence;
    return ear;
  }

  static defaultLeft() {
    return new EarAnchor({
      side: "left",
      indices: [132, 172, 234],
    });
  }

  static defaultRight() {
    return new EarAnchor({
      side: "right",
      indices: [361, 397, 454],
    });
  }
}
