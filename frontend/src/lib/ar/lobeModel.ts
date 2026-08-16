
// Head-local cm. Tuned on one face so far; needs a second to confirm.
export const CANONICAL_LOBE = {
  screenLeft: { x: -8.5, y: -2.7, z: -3.4 },
  screenRight: { x: 8.5, y: -2.7, z: -3.4 },
};

export const REF_WIDTH_RATIO = 1.50;
export const REF_HEIGHT_RATIO = 0.55;
export const SHAPE_LIMIT = 0.15;
export const SHAPE_MAX_YAW_DEG = 12;
export const SHAPE_MAX_PITCH_DEG = 15;
export const SHAPE_TAU = 0.4;

const STORAGE_KEY = "stellalens.userLobes.v1";

export const LOBE_TAP_LIMIT_CM = 3.5;

function isFiniteXYZ(p) {
  return p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
}

function clone(lobes) {
  return {
    screenLeft: { ...lobes.screenLeft },
    screenRight: { ...lobes.screenRight },
  };
}

export function loadUserLobes() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    if (!isFiniteXYZ(parsed?.screenLeft) || !isFiniteXYZ(parsed?.screenRight)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return clone(parsed);
  } catch {
    return null;
  }
}

export function saveUserLobes(lobes) {
  if (typeof window === "undefined") return;
  if (!isFiniteXYZ(lobes?.screenLeft) || !isFiniteXYZ(lobes?.screenRight)) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clone(lobes)));
  } catch {
  }
}

export function clearUserLobes() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
  }
}

export function hasUserLobes() {
  return loadUserLobes() !== null;
}

export function measureFaceShape(landmarks, videoW, videoH) {
  if (!landmarks || landmarks.length < 468) return null;
  const eyeL = landmarks[33], eyeR = landmarks[263];
  const cheekL = landmarks[234], cheekR = landmarks[454];
  const nose = landmarks[1];
  if (!eyeL || !eyeR || !cheekL || !cheekR || !nose) return null;

  const vw = videoW || 640;
  const vh = videoH || 480;

  const dist = (a, b) => Math.hypot((a.x - b.x) * vw, (a.y - b.y) * vh);

  const iod = dist(eyeL, eyeR);
  if (!(iod > 30)) return null;

  const width = dist(cheekL, cheekR) / iod;
  const midX = (eyeL.x + eyeR.x) / 2;
  const midY = (eyeL.y + eyeR.y) / 2;
  const height = Math.hypot((nose.x - midX) * vw, (nose.y - midY) * vh) / iod;
  if (!Number.isFinite(width) || !Number.isFinite(height)) return null;

  const clamp = (v) => Math.max(1 - SHAPE_LIMIT, Math.min(1 + SHAPE_LIMIT, v));
  return {
    width: clamp(width / REF_WIDTH_RATIO),
    height: clamp(height / REF_HEIGHT_RATIO),
    rawWidth: width,
    rawHeight: height,
  };
}
