// @ts-nocheck
import { HandLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task";
const WASM_BASE_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

export class HandTracker {
  constructor() {
    this._landmarker = null;
    this._ready = false;
    this._lastTs = 0;
  }

  get ready() {
    return this._ready;
  }

  async init() {
    if (this._ready) return;
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
    try {
      this._landmarker = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 1,

        minHandDetectionConfidence: 0.7,
        minHandPresenceConfidence: 0.7,
        minTrackingConfidence: 0.6,
      });
    } catch {
      this._landmarker = await HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.7,
        minHandPresenceConfidence: 0.7,
        minTrackingConfidence: 0.6,
      });
    }
    this._ready = true;
  }

  detect(video, nowMs) {
    if (!this._landmarker || !this._ready) return null;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null;
    const ts = Math.max(nowMs, this._lastTs + 1);
    this._lastTs = ts;
    let res;
    try {
      res = this._landmarker.detectForVideo(video, ts);
    } catch (err) {
      console.warn("HandTracker: skipped frame —", err?.message ?? err);
      return null;
    }
    const landmarks = res?.landmarks?.[0];
    if (!landmarks || landmarks.length < 21) return null;
    return {
      landmarks,

      worldLandmarks: res.worldLandmarks?.[0] ?? null,
      handedness: res.handednesses?.[0]?.[0]?.categoryName ?? "Unknown",
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
