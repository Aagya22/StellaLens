// @ts-nocheck
import {
  FaceLandmarker,
  FilesetResolver,
} from "@mediapipe/tasks-vision";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";
const WASM_BASE_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function averagePoint(points) {
  if (!points.length) return { x: 0.5, y: 0.5, z: 0 };
  let x = 0;
  let y = 0;
  let z = 0;
  for (const p of points) {
    x += p.x;
    y += p.y;
    z += p.z;
  }
  const inv = 1 / points.length;
  return { x: x * inv, y: y * inv, z: z * inv };
}

function findExtremes(landmarks, { minY, maxY, minX, maxX }) {
  let left = null;
  let right = null;
  for (const p of landmarks) {
    if (p.y < minY || p.y > maxY) continue;
    if (p.x < minX || p.x > maxX) continue;
    if (!left || p.x < left.x) left = p;
    if (!right || p.x > right.x) right = p;
  }
  return { left, right };
}

function findChin(landmarks) {
  let chin = landmarks[0] ?? { x: 0.5, y: 0.7, z: 0 };
  for (const p of landmarks) {
    if (p.y > chin.y) chin = p;
  }
  return chin;
}

function landmarkAt(landmarks, index) {
  const p = landmarks?.[index];
  if (!p) return null;
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  return p;
}

export class FaceTracker {
  constructor() {
    this._landmarker = null;
    this._ready = false;
    this._lastGoodMatrix = null;
  }

  get ready() {
    return this._ready;
  }

  async init() {
    if (this._ready) return;
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
    try {
      this._landmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: true,
      });
    } catch (err) {
      this._landmarker = await FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: "CPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: true,
      });
    }
    this._ready = true;
  }

  detect(video, nowMs) {
    if (!this._landmarker) return null;
    const mpResult = this._landmarker.detectForVideo(video, nowMs);
    const faceLandmarks = mpResult.faceLandmarks?.[0];
    if (!faceLandmarks || faceLandmarks.length === 0) return null;
    const chin = findChin(faceLandmarks);
    const leftEarIdx = 172;
    const rightEarIdx = 397;
    const jawLeftIdx = 172;
    const jawRightIdx = 397;
    const leftEarFixed = landmarkAt(faceLandmarks, leftEarIdx);
    const rightEarFixed = landmarkAt(faceLandmarks, rightEarIdx);
    const { left: leftEarCandidate, right: rightEarCandidate } = findExtremes(faceLandmarks, {
      minY: 0.25,
      maxY: 0.82,
      minX: 0.02,
      maxX: 0.98,
    });
    const leftEar = leftEarFixed ?? leftEarCandidate ?? { x: 0.2, y: 0.55, z: 0 };
    const rightEar = rightEarFixed ?? rightEarCandidate ?? { x: 0.8, y: 0.55, z: 0 };
    const jawLeftFixed = landmarkAt(faceLandmarks, jawLeftIdx);
    const jawRightFixed = landmarkAt(faceLandmarks, jawRightIdx);
    const { left: jawLeftCandidate, right: jawRightCandidate } = findExtremes(faceLandmarks, {
      minY: 0.58,
      maxY: 0.95,
      minX: 0.02,
      maxX: 0.98,
    });
    const jawLeft = jawLeftFixed ?? jawLeftCandidate;
    const jawRight = jawRightFixed ?? jawRightCandidate;
    const jawMid = averagePoint([
      jawLeft ?? leftEar,
      jawRight ?? rightEar,
      chin,
    ]);
    const neck = {
      x: clamp01(jawMid.x),
      y: clamp01(chin.y + 0.12),
      z: chin.z,
    };
    const facialMatrix = mpResult.facialTransformationMatrixes?.[0]?.data ?? null;
    const resolvedMatrix = facialMatrix ?? this._lastGoodMatrix;
    if (facialMatrix) this._lastGoodMatrix = facialMatrix;
    return {
      landmarks: faceLandmarks,
      poseMatrix: resolvedMatrix,
      leftEar,
      rightEar,
      jawLeft: jawLeft ?? leftEar,
      jawRight: jawRight ?? rightEar,
      chin,
      neck,
    };
  }

  dispose() {
    try {
      this._landmarker?.close();
    } catch {}
    this._landmarker = null;
    this._ready = false;
  }
}
