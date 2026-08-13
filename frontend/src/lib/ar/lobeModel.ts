
export const CANONICAL_LOBE = {
  screenLeft: { x: -8.5, y: -2.7, z: -3.4 },  // the user's RIGHT ear
  screenRight: { x: 8.5, y: -2.7, z: -3.4 },  // the user's LEFT ear
};


export const REF_WIDTH_RATIO = 1.50;   // face width ÷ eye spacing
export const REF_HEIGHT_RATIO = 0.55;  // eye-line-to-nose-tip ÷ eye spacing
export const SHAPE_LIMIT = 0.15;       // hard cap, so a bad frame can't wreck it
export const SHAPE_MAX_YAW_DEG = 12;
export const SHAPE_MAX_PITCH_DEG = 15;
export const SHAPE_TAU = 0.4;

/* Two taps measure a person's actual lobes, so when present they're used
   directly and the shape adaptation is skipped. */
const STORAGE_KEY = "stellalens.userLobes.v1";

/** How far a tap may move a lobe from canonical. */
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
    // Reject malformed entries rather than feeding NaN into the transform.
    if (!isFiniteXYZ(parsed?.screenLeft) || !isFiniteXYZ(parsed?.screenRight)) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return clone(parsed);
  } catch {
    return null; // private mode, quota, or bad JSON
  }
}

export function saveUserLobes(lobes) {
  if (typeof window === "undefined") return;
  if (!isFiniteXYZ(lobes?.screenLeft) || !isFiniteXYZ(lobes?.screenRight)) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(clone(lobes)));
  } catch {
    /* not worth breaking the try-on over */
  }
}

export function clearUserLobes() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function hasUserLobes() {
  return loadUserLobes() !== null;
}

/** Face proportions as multipliers on the canonical head, or null if the pose
    or landmarks aren't good enough to measure. */
export function measureFaceShape(landmarks, videoW, videoH) {
  if (!landmarks || landmarks.length < 468) return null;
  const eyeL = landmarks[33], eyeR = landmarks[263];
  const cheekL = landmarks[234], cheekR = landmarks[454];
  const nose = landmarks[1];
  if (!eyeL || !eyeR || !cheekL || !cheekR || !nose) return null;

  const vw = videoW || 640;
  const vh = videoH || 480;
  // Undo the frame's aspect, or every ratio inherits the camera's shape.
  const dist = (a, b) => Math.hypot((a.x - b.x) * vw, (a.y - b.y) * vh);

  const iod = dist(eyeL, eyeR);
  if (!(iod > 30)) return null; // face too small or far to measure honestly

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
