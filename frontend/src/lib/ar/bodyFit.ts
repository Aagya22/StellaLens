// @ts-nocheck
import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";
const WASM_BASE_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";


const BASELINE_NOSE_TO_SHOULDER_CM = 23; // ← replace with the calibrating user's own console value
const CANONICAL_INTEROCULAR_CM = 9.0;
const SAMPLES_NEEDED = 24;
const MAX_MS = 6000; // give up politely if shoulders never come into view
const MIN_VISIBILITY = 0.7;

export class BodyFitSession {
  constructor() {
    this._landmarker = null;
    this._samples = [];
    this._done = false;
    this._startedMs = 0;
    this._lastTs = 0;
    this.scale = 1; // result: multiplier for dropCm / occluder dims
  }

  get done() {
    return this._done;
  }

  async init() {
    const fileset = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
    try {
      this._landmarker = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numPoses: 1,
      });
    } catch {
      this._landmarker = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
        runningMode: "VIDEO",
        numPoses: 1,
      });
    }
  }

  /** Feed a video frame. Returns true while more samples are wanted. */
  sample(video, nowMs) {
    if (this._done) return false;
    if (!this._landmarker) return true; // still initializing
    if (!video || video.videoWidth === 0) return true;
    if (!this._startedMs) this._startedMs = nowMs;
    if (nowMs - this._startedMs > MAX_MS) {
      this._finish("timeout");
      return false;
    }
    const ts = Math.max(nowMs, this._lastTs + 1);
    this._lastTs = ts;
    let res;
    try {
      res = this._landmarker.detectForVideo(video, ts);
    } catch {
      return true;
    }
    const lm = res?.landmarks?.[0];
    if (!lm) return true;
    const nose = lm[0], eyeL = lm[3], eyeR = lm[6], shL = lm[11], shR = lm[12];
    if (!nose || !eyeL || !eyeR || !shL || !shR) return true;
    const vis = Math.min(shL.visibility ?? 1, shR.visibility ?? 1);
    if (vis < MIN_VISIBILITY) return true;
    const vw = video.videoWidth, vh = video.videoHeight;
    const iodPx = Math.hypot((eyeR.x - eyeL.x) * vw, (eyeR.y - eyeL.y) * vh);
    if (iodPx < 20) return true;
    const cmPerPx = CANONICAL_INTEROCULAR_CM / iodPx;
    const noseShoulderCm = (((shL.y + shR.y) / 2) - nose.y) * vh * cmPerPx;
    if (noseShoulderCm < 12 || noseShoulderCm > 45) return true; // junk frame
    this._samples.push(noseShoulderCm);
    if (this._samples.length >= SAMPLES_NEEDED) {
      this._finish("ok");
      return false;
    }
    return true;
  }

  _finish(reason) {
    this._done = true;
    if (this._samples.length >= 8) {
      // Median — robust to the odd junk frame.
      const s = [...this._samples].sort((a, b) => a - b);
      const med = s[Math.floor(s.length / 2)];
      this.scale = Math.min(1.3, Math.max(0.75, med / BASELINE_NOSE_TO_SHOULDER_CM));
      console.info(
        `[AR] body fit: nose→shoulder ${med.toFixed(1)} cm → necklace fit ×${this.scale.toFixed(2)} (baseline ${BASELINE_NOSE_TO_SHOULDER_CM} cm)`
      );
    } else {
      console.info(`[AR] body fit: shoulders not visible enough (${reason}) — default fit`);
    }
    this.dispose();
  }

  dispose() {
    try {
      this._landmarker?.close();
    } catch {}
    this._landmarker = null;
  }
}
