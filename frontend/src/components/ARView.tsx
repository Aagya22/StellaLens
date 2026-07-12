'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import { FaceTracker } from '@/lib/ar/faceTracking';
import { FaceOccluder } from '@/lib/ar/occlusion';
import { EarringsSystem } from '@/lib/ar/earrings';
import { NecklaceSystem } from '@/lib/ar/necklaces';
import { estimateHeadPose } from '@/lib/ar/headPose';
import { EarAnchor } from '@/lib/ar/earAnchor';
import { Product } from '@/data/products';

interface ARViewProps {
  product: Product;
  onClose: () => void;
  onOpenOrderModal: (customizations: any) => void;
}

/* Fixed fit applied to every earring. Screen-space offsets are ZERO on
   purpose: placement is now fully owned by the matrix-transformed
   EAR_ANCHOR (canonical cm) in lib/ar/earrings.ts — post-hoc screen
   nudges would break again under rotation. */
const EARRING_FIT = {
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0,
  scaleMultiplier: 0.65,
  smoothingFactor: 0.55,
};

const GEM_MAP = {
  ruby:     '#ff1c6b',
  emerald:  '#00ff73',
  sapphire: '#0090ff',
  tanzanite:'#5a47ff',
  diamond:  '#ffffff',
  amethyst: '#d03bff',
};

const CloseX = () => (
  <svg width="18" height="18" viewBox="0 0 46.1 46.1" fill="none" stroke="currentColor" strokeWidth="1.5">
    <line x1="0.4" y1="0.4" x2="45.7" y2="45.7" />
    <line x1="0.4" y1="45.7" x2="45.7" y2="0.4" />
  </svg>
);

const BackArrow = () => (
  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
  </svg>
);

export default function ARView({ product, onClose, onOpenOrderModal }: ARViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef     = useRef<HTMLVideoElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);

  const [loadingMsg,    setLoadingMsg]    = useState('Starting camera...');
  const [topGemColor,   setTopGemColor]   = useState(GEM_MAP.ruby);
  const [bottomGemColor,setBottomGemColor]= useState(GEM_MAP.tanzanite);

  /* Gem swatches must not repaint a preserved model until actually clicked */
  const gemsTouched = useRef(false);

  /* ── TEMPORARY: per-product ear-anchor calibration (canonical cm).
     */
  const [calibEar, setCalibEar] = useState<'userRight' | 'userLeft'>('userRight');
  const [, setCalibTick] = useState(0);

  useEffect(() => {
    if (product.category !== 'earrings') return;
    const onKey = (e: KeyboardEvent) => {
      const anchor = earringsRef.current?.getAnchor();
      if (!anchor) return;
      const step = 0.1 * (e.shiftKey ? 4 : 1); // centimeters
      const o = anchor[calibEar];
      let handled = true;
      switch (e.key.toLowerCase()) {
        case 'a': o.lateral -= step; break; // toward face center
        case 'd': o.lateral += step; break; // outward
        case 'w': o.down    -= step; break; // up
        case 's': o.down    += step; break; // down
        case 'r': o.back    -= step; break; // toward camera
        case 'f': o.back    += step; break; // behind face plane
        case 't': setCalibEar(prev => (prev === 'userRight' ? 'userLeft' : 'userRight')); break;
        default: handled = false;
      }
      if (handled) {
        e.preventDefault();
        setCalibTick(t => t + 1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [product, calibEar]);

  const requestRef  = useRef<number | null>(null);
  const trackerRef  = useRef<FaceTracker | null>(null);
  const occluderRef = useRef<FaceOccluder | null>(null);
  const earringsRef = useRef<EarringsSystem | null>(null);
  const necklacesRef= useRef<NecklaceSystem | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const ambientRef  = useRef<THREE.AmbientLight | null>(null);
  const keyRef      = useRef<THREE.DirectionalLight | null>(null);
  const fillRef     = useRef<THREE.DirectionalLight | null>(null);

  useEffect(() => {
    let active = true;
    let renderer: THREE.WebGLRenderer | null = null;
    let scene: THREE.Scene | null = null;
    let camera: THREE.OrthographicCamera | null = null;

    const view = { stageW: 1, stageH: 1, videoW: 1, videoH: 1, cover: { scale: 1, offsetX: 0, offsetY: 0 } };

    const updateView = () => {
      if (!containerRef.current || !videoRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      view.stageW = rect.width;
      view.stageH = rect.height;
      view.videoW = videoRef.current.videoWidth || 640;
      view.videoH = videoRef.current.videoHeight || 480;
      const vr = view.videoW / view.videoH;
      const sr = view.stageW / view.stageH;
      let s = 1, ox = 0, oy = 0;
      if (vr > sr) { s = view.stageH / view.videoH; ox = (view.stageW - view.videoW * s) / 2; }
      else          { s = view.stageW / view.videoW; oy = (view.stageH - view.videoH * s) / 2; }
      view.cover = { scale: s, offsetX: ox, offsetY: oy };
    };

    const resizeRenderer = () => {
      if (!renderer || !camera || !containerRef.current) return;
      updateView();
      renderer.setSize(view.stageW, view.stageH);
      const hw = view.stageW / 2, hh = view.stageH / 2;
      camera.left = -hw; camera.right = hw; camera.top = hh; camera.bottom = -hh;
      camera.updateProjectionMatrix();
    };

    const initAR = async () => {
      try {
        setLoadingMsg('Initializing webcam...');
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await new Promise<void>(resolve => { if (videoRef.current) videoRef.current.oncanplay = () => resolve(); });
          videoRef.current.play();
        }
        updateView();

        setLoadingMsg('Initializing 3D renderer...');
        const canvas = canvasRef.current;
        if (!canvas) throw new Error('Canvas not found');
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance' });
        renderer.setClearColor(0x000000, 0);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        //  Neutral keeps the gold gold.
        renderer.toneMapping = THREE.NeutralToneMapping;
        renderer.toneMappingExposure = 1.0;
        scene = new THREE.Scene();
        const pmrem = new THREE.PMREMGenerator(renderer);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
        // Neutral-ish env level so authored materials render close to how
        // they look in a Blender studio viewport (not blown out).
        scene.environmentIntensity = 1.15;

        const ambient = new THREE.AmbientLight(0xffffff, 0.25); scene.add(ambient); ambientRef.current = ambient;
        const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(200, 400, 600); scene.add(key); keyRef.current = key;
        const fill = new THREE.DirectionalLight(0xffffff, 0.8); fill.position.set(-300, 200, 200); scene.add(fill); fillRef.current = fill;

        const hw = view.stageW / 2, hh = view.stageH / 2;
        camera = new THREE.OrthographicCamera(-hw, hw, hh, -hh, 0.1, 2000);
        camera.position.set(0, 0, 1000); camera.lookAt(0, 0, 0);
        resizeRenderer();
        window.addEventListener('resize', resizeRenderer);

        setLoadingMsg('Loading Face AI Models...');
        const tracker = new FaceTracker();
        await tracker.init();

        if (!active) { tracker.dispose(); return; }
        trackerRef.current = tracker;

        occluderRef.current = new FaceOccluder({ scene });
        const gltfLoader = new GLTFLoader();
        earringsRef.current  = new EarringsSystem({ scene, gltfLoader, onStatus: (msg: string) => { if (active && msg) setLoadingMsg(msg); } });
        necklacesRef.current = new NecklaceSystem({ scene, gltfLoader, onStatus: (msg: string) => { if (active && msg) setLoadingMsg(msg); } });

        setLoadingMsg('Loading 3D Product...');
        earringsRef.current.setVisible(product.category === 'earrings');
        necklacesRef.current.setVisible(product.category === 'necklaces');
        if (product.category === 'earrings') await earringsRef.current.loadModel(product.modelPath, { singleEarring: product.pair === true, preserveMaterials: product.preserveMaterials === true, anchor: product.earAnchor, dangle: product.dangle, fit: product.arFit, materials: product.arMaterials, skinPenetration: product.skinPenetration });
        else await necklacesRef.current.loadModel(product.modelPath);
        setLoadingMsg('');

        let lastNow = performance.now(), lastVideoTime = -1, lastDetectionMs = 0, lastDet: any = null, frameCount = 0;
        const leftEarAnchor = EarAnchor.defaultLeft(), rightEarAnchor = EarAnchor.defaultRight();
        const offscreenCanvas = document.createElement('canvas'); offscreenCanvas.width = 16; offscreenCanvas.height = 16;
        const offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });

        const loop = (now: number) => {
          if (!active) return;
          requestRef.current = requestAnimationFrame(loop);
          const dtSeconds = Math.min(0.05, (now - lastNow) / 1000); lastNow = now;
          const video = videoRef.current;
          if (video && video.readyState >= 2 && video.videoWidth > 0 && tracker.ready) {
            frameCount++;
            if (frameCount % 12 === 0 && offscreenCtx) {
              try {
                offscreenCtx.drawImage(video, 0, 0, 16, 16);
                const imgData = offscreenCtx.getImageData(0, 0, 16, 16).data;
                let sumL = 0;
                for (let i = 0; i < imgData.length; i += 4) sumL += (0.2126 * imgData[i] + 0.7152 * imgData[i+1] + 0.0722 * imgData[i+2]) / 255;
                const avg = sumL / 256;
                if (ambientRef.current) ambientRef.current.intensity = THREE.MathUtils.lerp(ambientRef.current.intensity, THREE.MathUtils.lerp(0.12, 0.50, avg), 0.08);
                if (keyRef.current)     keyRef.current.intensity     = THREE.MathUtils.lerp(keyRef.current.intensity,     THREE.MathUtils.lerp(0.70, 2.00, avg), 0.08);
                if (fillRef.current)    fillRef.current.intensity    = THREE.MathUtils.lerp(fillRef.current.intensity,    THREE.MathUtils.lerp(0.30, 1.10, avg), 0.08);
              } catch {}
            }
            let det = lastDet;
            const isNewFrame = video.currentTime !== lastVideoTime, isStale = (now - lastDetectionMs) > 150;
            if (isNewFrame || isStale) {
              try { det = tracker.detect(video, now); lastVideoTime = video.currentTime; lastDetectionMs = now; lastDet = det; }
              catch (e) { console.error(e); det = null; }
            }
            if (det) {
              // Face re-found: restore visibility (it's cleared on dropout below,
              // and must come back or the jewellery vanishes permanently).
              occluderRef.current?.setVisible(true);
              earringsRef.current?.setVisible(product.category === 'earrings');
              necklacesRef.current?.setVisible(product.category === 'necklaces');
              const headPose = estimateHeadPose(det.poseMatrix), poseQuat = headPose.quaternion;
              const leftEar = leftEarAnchor.compute(det.landmarks), rightEar = rightEarAnchor.compute(det.landmarks);
              let anchorsVal = { left: leftEar, right: rightEar };
              if (leftEar.x > rightEar.x) anchorsVal = { left: rightEar, right: leftEar };
              const faceWidthPx = Math.abs(anchorsVal.right.x - anchorsVal.left.x) * view.videoW * view.cover.scale;
              occluderRef.current?.update({ landmarks: det.landmarks, view, zBias: 12 });
              if (product.category === 'earrings' && earringsRef.current) {
                earringsRef.current.update({ anchors: anchorsVal, landmarks: det.landmarks, view, faceWidthPx, poseQuat, poseMatrix: det.poseMatrix, headPose, settings: EARRING_FIT, dtSeconds });
              } else if (product.category === 'necklaces' && necklacesRef.current) {
                necklacesRef.current.update({ anchors: { chin: det.chin, jawLeft: det.jawLeft, jawRight: det.jawRight, neck: det.neck }, view, jawWidthPx: faceWidthPx, poseQuat, dtSeconds });
              }
            } else {
              occluderRef.current?.setVisible(false);
              earringsRef.current?.setVisible(false);
              necklacesRef.current?.setVisible(false);
            }
          }
          if (renderer && scene && camera) renderer.render(scene, camera);
        };
        requestRef.current = requestAnimationFrame(loop);
      } catch (err: any) {
        console.error(err);
        setLoadingMsg(err?.message || 'Failed to initialize AR. Please check camera permissions.');
      }
    };

    initAR();
    return () => {
      active = false;
      window.removeEventListener('resize', resizeRenderer);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      trackerRef.current?.dispose();
      occluderRef.current?.dispose();
      earringsRef.current?.dispose();
      necklacesRef.current?.dispose();
      if (renderer) renderer.dispose();
    };
  }, [product]);

  useEffect(() => {
    if (!gemsTouched.current) return; // don't repaint authored materials on mount
    if (product.category === 'earrings' && earringsRef.current) {
      earringsRef.current.setGemColors(topGemColor, bottomGemColor);
    }
  }, [topGemColor, bottomGemColor, product]);

  const handleOrder = () => {
    onOpenOrderModal({
      productId: product.id,
      productName: product.name,
      price: product.price,
      customizations: product.customizeColors ? {
        topGem:    Object.keys(GEM_MAP).find(k => GEM_MAP[k as keyof typeof GEM_MAP] === topGemColor)    || 'ruby',
        bottomGem: Object.keys(GEM_MAP).find(k => GEM_MAP[k as keyof typeof GEM_MAP] === bottomGemColor) || 'tanzanite',
      } : {},
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col md:flex-row overflow-hidden"
      style={{ background: '#0a0a0a' }}
    >
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden flex items-center justify-center"
        style={{ background: '#050505' }}
      >
        <video
          ref={videoRef}
          id="camera"
          playsInline muted autoPlay
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ transform: 'scaleX(-1)', opacity: 0.92 }}
        />
        <canvas
          ref={canvasRef}
          id="ar-canvas"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />

        {loadingMsg && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center z-10 px-4 text-center"
            style={{ background: 'rgba(10,10,10,0.85)', backdropFilter: 'blur(8px)' }}
          >
            <div
              className="w-10 h-10 mb-6"
              style={{
                border: '1px solid rgba(255,255,255,0.15)',
                borderTop: '1px solid var(--white)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              }}
            />
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <span
              style={{
                fontSize: '10px', letterSpacing: '0.28em',
                textTransform: 'uppercase', color: '#c5a880',
                fontFamily: "var(--font-jost), sans-serif", fontWeight: 400,
              }}
            >
              {loadingMsg}
            </span>
          </div>
        )}

        <button
          onClick={onClose}
          className="absolute top-5 left-5 z-20 cursor-pointer flex items-center gap-2"
          style={{
            background: 'rgba(10,10,10,0.7)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.7)',
            padding: '10px 16px',
            fontFamily: "var(--font-jost), sans-serif",
            fontSize: '9px', letterSpacing: '0.2em', textTransform: 'uppercase',
            transition: 'all 0.25s',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--gold)'; e.currentTarget.style.borderColor = 'var(--gold)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.7)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
        >
          <BackArrow />
          Back
        </button>

        {/* ── TEMPORARY calibration readout (per product, canonical cm) ── */}
        {product.category === 'earrings' && (() => {
          const anchor = earringsRef.current?.getAnchor();
          const o = anchor?.[calibEar];
          return (
            <div
              className="absolute top-5 right-5 z-20 flex flex-col gap-1.5"
              style={{
                background: 'rgba(0,0,0,0.78)',
                border: '1px solid rgba(255,255,255,0.2)',
                padding: '12px 16px',
                fontFamily: 'monospace',
                fontSize: '11px',
                color: '#fff',
                lineHeight: 1.5,
              }}
            >
              <span style={{ color: '#c5a880', letterSpacing: '0.12em' }}>
                CALIBRATION · {product.name.toUpperCase()}
              </span>
              <span style={{ color: '#c5a880' }}>
                {calibEar === 'userRight' ? 'YOUR RIGHT EAR' : 'YOUR LEFT EAR'}
              </span>
              <span>lateral A/D : {o ? `${o.lateral.toFixed(1)} cm` : '—'}</span>
              <span>down&nbsp;&nbsp;&nbsp; W/S : {o ? `${o.down.toFixed(1)} cm` : '—'}</span>
              <span>back&nbsp;&nbsp;&nbsp; R/F : {o ? `${o.back.toFixed(1)} cm` : '—'}</span>
              <span style={{ opacity: 0.55 }}>T switch ear · Shift ×4 step</span>
            </div>
          );
        })()}


        <div
          className="absolute bottom-5 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4 z-20 w-[300px]"
          style={{
            background: 'rgba(10,10,10,0.75)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.08)',
            padding: '16px 20px',
          }}
        >
          <span
            style={{
              fontSize: '9px', letterSpacing: '0.22em', textTransform: 'uppercase',
              color: '#a8a29e',
              fontFamily: "var(--font-jost), sans-serif",
            }}
          >
            Look straight at the camera
          </span>

          {product.customizeColors && (
            <div className="w-full flex flex-col gap-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '12px' }}>
              <div className="flex items-center justify-between">
                <span style={{ fontSize: '9px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#a8a29e', fontFamily: "var(--font-jost), sans-serif" }}>
                  Top Gem
                </span>
                <div className="flex gap-2">
                  {(['ruby', 'emerald', 'sapphire', 'diamond'] as const).map(name => {
                    const color = GEM_MAP[name];
                    const active = topGemColor === color;
                    return (
                      <button
                        key={name}
                        onClick={() => { gemsTouched.current = true; setTopGemColor(color); }}
                        title={name}
                        className="cursor-pointer"
                        style={{
                          width: '20px', height: '20px',
                          borderRadius: '50%',
                          background: color,
                          border: active ? '2px solid #fff' : '2px solid transparent',
                          transform: active ? 'scale(1.15)' : 'scale(1)',
                          transition: 'transform 0.2s, border-color 0.2s',
                          boxShadow: active ? `0 0 8px ${color}80` : 'none',
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span style={{ fontSize: '9px', letterSpacing: '0.18em', textTransform: 'uppercase', color: '#a8a29e', fontFamily: "var(--font-jost), sans-serif" }}>
                  Bottom Gem
                </span>
                <div className="flex gap-2">
                  {(['ruby', 'emerald', 'tanzanite', 'amethyst'] as const).map(name => {
                    const color = GEM_MAP[name];
                    const active = bottomGemColor === color;
                    return (
                      <button
                        key={name}
                        onClick={() => { gemsTouched.current = true; setBottomGemColor(color); }}
                        title={name}
                        className="cursor-pointer"
                        style={{
                          width: '20px', height: '20px',
                          borderRadius: '50%',
                          background: color,
                          border: active ? '2px solid #fff' : '2px solid transparent',
                          transform: active ? 'scale(1.15)' : 'scale(1)',
                          transition: 'transform 0.2s, border-color 0.2s',
                          boxShadow: active ? `0 0 8px ${color}80` : 'none',
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div
        className="w-full md:w-[380px] flex flex-col overflow-y-auto"
        style={{
          background: '#131210',
          borderLeft: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div
          className="flex items-center justify-between px-8 py-5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
        >
          <span
            style={{
              fontSize: '9px',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              color: '#c5a880',
              fontFamily: 'var(--font-jost), sans-serif',
              fontWeight: 500,
            }}
          >
            — StellaLens VTO
          </span>
          <button
            onClick={onClose}
            className="cursor-pointer"
            style={{
              background: 'none', border: 'none',
              color: 'rgba(255,255,255,0.4)',
              lineHeight: 0, transition: 'color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.4)')}
          >
            <CloseX />
          </button>
        </div>

        <div className="px-8 py-7 flex flex-col gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <h2
            className="font-editorial"
            style={{
              fontSize: '28px', fontWeight: 300,
              letterSpacing: '0.02em', color: '#fff', lineHeight: 1.2,
              fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif",
            }}
          >
            {product.name}
          </h2>
          <span
            style={{
              fontSize: '18px', fontWeight: 400,
              color: '#c5a880', letterSpacing: '0.05em',
              fontFamily: "var(--font-jost), sans-serif",
            }}
          >
            {product.price}
          </span>
          <p
            style={{
              fontSize: '12px', fontWeight: 300,
              color: 'rgba(255,255,255,0.65)', lineHeight: 1.8, marginTop: '4px',
              fontFamily: "var(--font-jost), sans-serif",
            }}
          >
            {product.description}
          </p>
        </div>

        {/* Fitting is fixed by the calibrated ear anchor — no manual sliders */}
        <div className="flex-1" />

        <div className="px-8 pb-8">
          <button
            className="btn-ar"
            onClick={handleOrder}
          >
            Request Bespoke Order
          </button>
        </div>
      </div>
    </div>
  );
}
