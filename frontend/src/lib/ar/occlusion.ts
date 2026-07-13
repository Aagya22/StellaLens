// @ts-nocheck
import * as THREE from "three";
import { FaceLandmarker } from "@mediapipe/tasks-vision";

/* Face-oval perimeter  */
const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379,
  378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
  162, 21, 54, 103, 67, 109,
];

const MAX_VERTS = 478; // 468 mesh + 10 iris (blendshapes model)

/* Ear / near-ear landmarks (jawline→temple, both sides). Triangles touching
   any of these are dropped from the occluder so the earring renders freely
   at the attachment point instead of z-fighting the face surface there. The
   cheek, jaw, chin, neck, and central face stay covered. */
const EAR_EXCLUDE = new Set([
  234, 127, 132, 170, 177, 147, 187, // wearer's right side
  454, 356, 361, 395, 401, 376, 411, // wearer's left side
]);

function normToStageXY(p, view) {
  const px = p.x * view.videoW;
  const py = p.y * view.videoH;
  const sx = px * view.cover.scale + view.cover.offsetX;
  const sy = py * view.cover.scale + view.cover.offsetY;
  return {
    x: sx - view.stageW / 2,
    y: view.stageH / 2 - sy,
  };
}

function zToPx(zNorm, view) {
  const S = view.videoW * view.cover.scale;
  return -zNorm * S;
}


function buildTessellationTriangles() {
  const conns = FaceLandmarker?.FACE_LANDMARKS_TESSELATION;
  if (!conns || !conns.length) return null;

  const adj = new Map();
  const addEdge = (a, b) => {
    let s = adj.get(a);
    if (!s) { s = new Set(); adj.set(a, s); }
    s.add(b);
  };
  for (const c of conns) {
    addEdge(c.start, c.end);
    addEdge(c.end, c.start);
  }

  const tris = [];
  const seen = new Set();
  for (const c of conns) {
    const a = c.start, b = c.end;
    if (EAR_EXCLUDE.has(a) || EAR_EXCLUDE.has(b)) continue; // skip ear-zone triangles
    const na = adj.get(a), nb = adj.get(b);
    const [small, big] = na.size <= nb.size ? [na, nb] : [nb, na];
    for (const cc of small) {
      if (cc === a || cc === b) continue;
      if (EAR_EXCLUDE.has(cc)) continue;
      if (!big.has(cc)) continue;
      const key =
        Math.min(a, b, cc) * 1_000_000 +
        (a + b + cc - Math.min(a, b, cc) - Math.max(a, b, cc)) * 1000 +
        Math.max(a, b, cc);
      if (seen.has(key)) continue;
      seen.add(key);
      tris.push(a, b, cc);
    }
  }
  return tris.length ? tris : null;
}

export class FaceOccluder {
  constructor({ scene }) {
    this.scene = scene;
    this.geometry = new THREE.BufferGeometry();

    const tessTris = buildTessellationTriangles();
    if (tessTris) {
      this._mode = "mesh";
      this._vertexCount = MAX_VERTS;
      this._positions = new Float32Array(MAX_VERTS * 3);
      this.geometry.setAttribute("position", new THREE.BufferAttribute(this._positions, 3));
      this.geometry.setIndex(new THREE.BufferAttribute(new Uint16Array(tessTris), 1));
    } else {
      // Fallback: oval fan from a computed centre (previous behaviour).
      this._mode = "fan";
      this._vertexCount = 1 + FACE_OVAL.length;
      this._positions = new Float32Array(this._vertexCount * 3);
      this.geometry.setAttribute("position", new THREE.BufferAttribute(this._positions, 3));
      const indices = new Uint16Array(FACE_OVAL.length * 3);
      let w = 0;
      for (let i = 0; i < FACE_OVAL.length; i++) {
        indices[w++] = 0;
        indices[w++] = 1 + i;
        indices[w++] = 1 + ((i + 1) % FACE_OVAL.length);
      }
      this.geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    }

    
    this.material = new THREE.MeshBasicMaterial({
      colorWrite: false,
      depthWrite: true,
      depthTest: true,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 1,
      polygonOffsetUnits: 1,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 0; // before earrings (renderOrder 1)
    // Static big bounding sphere so three never tries to recompute it.
    this.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.scene.add(this.mesh);

    this.visible = true;
  }

  setVisible(v) {
    this.visible = v;
    this.mesh.visible = v;
  }

  /**
   * @param {{ landmarks, view, faceWidthPx?, zBias?: number }} args
   
   */
  update({ landmarks, view, zBias = 12 }) {
    if (!this.visible) return;
    if (!landmarks || landmarks.length < 468) return;
    const pos = this._positions;

    if (this._mode === "mesh") {
      const n = Math.min(this._vertexCount, landmarks.length);
      for (let i = 0; i < n; i++) {
        const p = landmarks[i];
        const o = i * 3;
        if (!p) { pos[o] = pos[o + 1] = pos[o + 2] = 0; continue; }
        const s = normToStageXY(p, view);
        pos[o + 0] = s.x;
        pos[o + 1] = s.y;
        pos[o + 2] = zToPx(p.z, view) + zBias;
      }
    } else {
      // Fan fallback
      let cx = 0, cy = 0, cz = 0, cnt = 0;
      for (const idx of FACE_OVAL) {
        const p = landmarks[idx];
        if (!p) continue;
        const s = normToStageXY(p, view);
        cx += s.x; cy += s.y; cz += zToPx(p.z, view); cnt++;
      }
      if (!cnt) return;
      pos[0] = cx / cnt; pos[1] = cy / cnt; pos[2] = cz / cnt + zBias;
      for (let i = 0; i < FACE_OVAL.length; i++) {
        const p = landmarks[FACE_OVAL[i]];
        const s = p ? normToStageXY(p, view) : { x: pos[0], y: pos[1] };
        const z = p ? zToPx(p.z, view) + zBias : pos[2];
        const o = (1 + i) * 3;
        pos[o + 0] = s.x; pos[o + 1] = s.y; pos[o + 2] = z;
      }
    }

    this.geometry.attributes.position.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }
}
