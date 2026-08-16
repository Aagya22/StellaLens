// @ts-nocheck
import { PoseLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task";
const WASM_BASE_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

// One person's measurement, so everyone else scales relative to them.
const BASELINE_NOSE_TO_SHOULDER_CM = 18.3;
const CANONICAL_INTEROCULAR_CM = 9.0;
const SAMPLES_NEEDED = 24;
const MAX_MS = 10000;
const LOAD_MAX_MS = 20000;
const MIN_VISIBILITY = 0.7;

const SAMPLE_INTERVAL_MS = 80;

export class BodyFitSession {
  constructor() {
    this._landmarker = null;
    this._samples = [];
    this._done = false;
    this._startedMs = 0;
    this._measureStartedMs = 0;
    this._lastSampleMs = 0;
    this._lastTs = 0;
    this._result = null;
    this._medianCm = null;
    this.scale = 1;
  }

  get done() {
    return this._done;
  }

  get status() {
    if (this._done) return this._result ?? "unavailable";
    return this._landmarker ? "measuring" : "loading";
  }

  get samples() { return this._samples.length; }
  get samplesNeeded() { return SAMPLES_NEEDED; }
  get noseShoulderCm() { return this._medianCm; }
  get baselineCm() { return BASELINE_NOSE_TO_SHOULDER_CM; }

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

  sample(video, nowMs) {
    if (this._done) return false;

    if (!this._startedMs) this._startedMs = nowMs;
    if (!this._landmarker) {
      if (nowMs - this._startedMs > LOAD_MAX_MS) this._finish("unavailable");
      return true;
    }
    if (!video || video.videoWidth === 0) return true;

    if (!this._measureStartedMs) this._measureStartedMs = nowMs;
    if (nowMs - this._measureStartedMs > MAX_MS) {
      this._finish("timeout");
      return false;
    }
    if (nowMs - this._lastSampleMs < SAMPLE_INTERVAL_MS) return true;
    this._lastSampleMs = nowMs;
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
    if (noseShoulderCm < 12 || noseShoulderCm > 45) return true;
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
      const s = [...this._samples].sort((a, b) => a - b);
      this._medianCm = s[Math.floor(s.length / 2)];
      this.scale = Math.min(1.3, Math.max(0.75, this._medianCm / BASELINE_NOSE_TO_SHOULDER_CM));
      this._result = "ok";
      console.info(
        `[AR] body fit: nose→shoulder ${this._medianCm.toFixed(1)} cm → necklace fit ×${this.scale.toFixed(2)} (baseline ${BASELINE_NOSE_TO_SHOULDER_CM} cm)`
      );
    } else {
      this._result = reason === "unavailable" ? "unavailable" : "no-shoulders";
      console.info(`[AR] body fit: ${this._result} (${reason}) — default fit ×1.00`);
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
