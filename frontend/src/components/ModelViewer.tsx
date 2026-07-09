'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

interface ModelViewerProps {
  modelPath: string;
  /** Shown instead of the canvas if the GLB fails to load */
  fallbackImage?: string;
}

function enhanceMaterials(root: THREE.Object3D, modelPath: string) {
  const goldModel = modelPath.toLowerCase().includes('gold');
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.frustumCulled = false;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      const m = mat as THREE.MeshPhysicalMaterial;
      if (!m) continue;
      const name = (m.name || '').toLowerCase();
      const isGem =
        name.includes('diamond') || name.includes('gem') || name.includes('stone') ||
        name.includes('ruby') || name.includes('tanzanite') || name.includes('crystal') ||
        (m.transmission ?? 0) > 0.1;
      if (isGem) {
        m.envMapIntensity = 3.5;
        if ('clearcoat' in m) {
          m.clearcoat = 1.0;
          m.clearcoatRoughness = 0.0;
        }
        m.roughness = Math.min(m.roughness ?? 0.1, 0.12);
      } else {
        if ('metalness' in m) m.metalness = 1.0;
        if ('roughness' in m) m.roughness = 0.2;
        m.envMapIntensity = 2.6;
        if (m.color && (name.includes('gold') || goldModel)) m.color.setHex(0xffd700);
      }
      m.needsUpdate = true;
    }
  });
}

export default function ModelViewer({ modelPath, fallbackImage }: ModelViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [inView, setInView] = useState(false);

  /* Only run a WebGL context while the viewer is (near) the viewport —
     the catalog mounts many of these at once. */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => setInView(entries[0]?.isIntersecting ?? false),
      { rootMargin: '150px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !inView) return;

    let disposed = false;
    let raf = 0;
    setStatus('loading');

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    const canvas = renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
    canvas.style.touchAction = 'none';
    canvas.style.cursor = 'grab';
    container.appendChild(canvas);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = envTex;

    const key = new THREE.DirectionalLight(0xfff1d6, 1.3);
    key.position.set(2, 3, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xd9e2ff, 0.5);
    fill.position.set(-3, 1, 2);
    scene.add(fill);
    scene.add(new THREE.AmbientLight(0xffffff, 0.3));

    const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 50);
    camera.position.set(0, 0.04, 2.3);
    camera.lookAt(0, 0, 0);

    const pivot = new THREE.Group();
    scene.add(pivot);

    const resize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    /* Drag to rotate; slow auto-spin otherwise */
    let dragging = false;
    let lastX = 0;
    let lastY = 0;
    let tiltTarget = 0;

    const onPointerDown = (e: PointerEvent) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      pivot.rotation.y += dx * 0.008;
      tiltTarget = THREE.MathUtils.clamp(tiltTarget + dy * 0.005, -1.2, 1.2);
    };
    const onPointerUp = (e: PointerEvent) => {
      dragging = false;
      canvas.style.cursor = 'grab';
      try { canvas.releasePointerCapture(e.pointerId); } catch {}
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    new GLTFLoader().loadAsync(modelPath)
      .then((gltf) => {
        if (disposed) return;
        const root = gltf.scene;

        // Jewellery GLBs come in all authoring orientations. Two corrections:
        // 1) lying flat (thin in Y) → tip upright to face the camera
        // 2) long axis pointing sideways (e.g. drop earrings authored along X)
        //    → stand the long axis vertical so pieces hang the way they're worn
        let box = new THREE.Box3().setFromObject(root);
        let size = box.getSize(new THREE.Vector3());
        if (size.y * 1.15 < size.x && size.y * 1.15 < size.z) {
          root.rotateOnWorldAxis(new THREE.Vector3(1, 0, 0), Math.PI / 2);
          root.updateMatrixWorld(true);
          box = new THREE.Box3().setFromObject(root);
          size = box.getSize(new THREE.Vector3());
        }
        if (size.x > size.y * 1.3 && size.x > size.z * 1.3) {
          root.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), -Math.PI / 2);
          root.updateMatrixWorld(true);
          box = new THREE.Box3().setFromObject(root);
          size = box.getSize(new THREE.Vector3());
        }

        const maxDim = Math.max(size.x, size.y, size.z);
        if (Number.isFinite(maxDim) && maxDim > 0) root.scale.multiplyScalar(1 / maxDim);
        const box2 = new THREE.Box3().setFromObject(root);
        root.position.sub(box2.getCenter(new THREE.Vector3()));
        enhanceMaterials(root, modelPath);
        pivot.add(root);
        setStatus('ready');
      })
      .catch(() => {
        if (!disposed) setStatus('failed');
      });

    let last = performance.now();
    const loop = (now: number) => {
      if (disposed) return;
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!dragging) {
        pivot.rotation.y += 0.35 * dt;
        tiltTarget = THREE.MathUtils.lerp(tiltTarget, 0, 0.02);
      }
      pivot.rotation.x = THREE.MathUtils.lerp(pivot.rotation.x, tiltTarget, 0.12);
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      pivot.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry?.dispose();
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((m) => m?.dispose());
        }
      });
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      canvas.remove();
    };
  }, [modelPath, inView]);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {status === 'loading' && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div
            className="w-8 h-8"
            style={{
              border: '1px solid rgba(201,168,112,0.2)',
              borderTop: '1px solid var(--gold)',
              borderRadius: '50%',
              animation: 'mv-spin 1s linear infinite',
            }}
          />
          <style>{`@keyframes mv-spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}
      {status === 'failed' && fallbackImage && (
        <img
          src={fallbackImage}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
    </div>
  );
}
