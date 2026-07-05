// @ts-nocheck
import * as THREE from "three";


const FACE_OVAL = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379,
  378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127,
  162, 21, 54, 103, 67, 109,
];

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
  // Negative Z is typically closer to camera, so invert.
  const S = view.videoW * view.cover.scale;
  return -zNorm * S;
}

/**
 * FaceOccluder
 * - Creates a depth-only polygon mesh covering the face oval
 * - Renders before jewellery to occlude it naturally during head turns
 */
export class FaceOccluder {
  constructor({ scene }) {
    this.scene = scene;

    this.geometry = new THREE.BufferGeometry();

    // Vertex layout: [center] + FACE_OVAL points
    const vertexCount = 1 + FACE_OVAL.length;
    const positions = new Float32Array(vertexCount * 3);
    this._positions = positions;

    this.geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    // Triangle fan indices.
    const indexCount = FACE_OVAL.length * 3;
    const indices = new Uint16Array(indexCount);
    let w = 0;
    for (let i = 0; i < FACE_OVAL.length; i++) {
      const a = 0;
      const b = 1 + i;
      const c = 1 + ((i + 1) % FACE_OVAL.length);
      indices[w++] = a;
      indices[w++] = b;
      indices[w++] = c;
    }
    this.geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    this.material = new THREE.MeshBasicMaterial({
      color: 0x000000,
      depthTest: true,
      depthWrite: true,
      colorWrite: false,
    });

    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 0;

    this.scene.add(this.mesh);

    this.visible = true;
  }

  setVisible(v) {
    this.visible = v;
    this.mesh.visible = v;
  }

  /**
   * @param {{ landmarks: Array<{x:number,y:number,z:number}>, view: any, faceWidthPx: number, zBias?: number }} args
   */
  update({ landmarks, view, faceWidthPx, zBias = 25 }) {
    if (!this.visible) return;
    if (!landmarks || landmarks.length < 468) return;

    // Compute center as average of oval points.
    let cx = 0;
    let cy = 0;
    let cz = 0;
    let n = 0;
    for (const idx of FACE_OVAL) {
      const p = landmarks[idx];
      if (!p) continue;
      const s = normToStageXY(p, view);
      cx += s.x;
      cy += s.y;
      cz += zToPx(p.z, view);
      n++;
    }
    if (!n) return;

    cx /= n;
    cy /= n;
    cz = cz / n + zBias;

    // Write center.
    this._positions[0] = cx;
    this._positions[1] = cy;
    this._positions[2] = cz;

    // Write perimeter.
    for (let i = 0; i < FACE_OVAL.length; i++) {
      const p = landmarks[FACE_OVAL[i]];
      const s = p ? normToStageXY(p, view) : { x: cx, y: cy };
      const z = p ? zToPx(p.z, view) + zBias : cz;

      const o = (1 + i) * 3;
      this._positions[o + 0] = s.x;
      this._positions[o + 1] = s.y;
      this._positions[o + 2] = z;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.computeBoundingSphere();
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.geometry.dispose();
    this.material.dispose();
  }
}
