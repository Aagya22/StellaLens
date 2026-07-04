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

export default function ARView({ product, onClose, onOpenOrderModal }: ARViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Status and UI States
  const [loadingMsg, setLoadingMsg] = useState('Starting camera...');
  const [scale, setScale] = useState(0.65);
  const [topGemColor, setTopGemColor] = useState('#ff1c6b'); // Ruby default (bright)
  const [bottomGemColor, setBottomGemColor] = useState('#5a47ff'); // Tanzanite default (bright)
  const [offsetX, setOffsetX] = useState(-28); // Sideways placement width
  const [offsetY, setOffsetY] = useState(2);   // Vertical height placement

  // Systems refs
  const requestRef = useRef<number | null>(null);
  const trackerRef = useRef<FaceTracker | null>(null);
  const occluderRef = useRef<FaceOccluder | null>(null);
  const earringsRef = useRef<EarringsSystem | null>(null);
  const necklacesRef = useRef<NecklaceSystem | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Dynamic light estimation refs
  const ambientLightRef = useRef<THREE.AmbientLight | null>(null);
  const keyLightRef = useRef<THREE.DirectionalLight | null>(null);
  const fillLightRef = useRef<THREE.DirectionalLight | null>(null);

  // Color mapping
  const colorMap = {
    ruby: "#ff1c6b",
    emerald: "#00ff73",
    sapphire: "#0090ff",
    tanzanite: "#5a47ff",
    diamond: "#ffffff",
    amethyst: "#d03bff",
  };

  useEffect(() => {
    let active = true;
    let renderer: THREE.WebGLRenderer | null = null;
    let scene: THREE.Scene | null = null;
    let camera: THREE.OrthographicCamera | null = null;

    // Dimensions view object
    const view = {
      stageW: 1,
      stageH: 1,
      videoW: 1,
      videoH: 1,
      cover: { scale: 1, offsetX: 0, offsetY: 0 },
    };

    const updateView = () => {
      if (!containerRef.current || !videoRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      view.stageW = rect.width;
      view.stageH = rect.height;
      view.videoW = videoRef.current.videoWidth || 640;
      view.videoH = videoRef.current.videoHeight || 480;

      // Compute cover scaling
      const videoRatio = view.videoW / view.videoH;
      const stageRatio = view.stageW / view.stageH;
      let scale = 1;
      let offsetX = 0;
      let offsetY = 0;

      if (videoRatio > stageRatio) {
        scale = view.stageH / view.videoH;
        offsetX = (view.stageW - view.videoW * scale) / 2;
      } else {
        scale = view.stageW / view.videoW;
        offsetY = (view.stageH - view.videoH * scale) / 2;
      }
      view.cover = { scale, offsetX, offsetY };
    };

    const resizeRenderer = () => {
      if (!renderer || !camera || !containerRef.current) return;
      updateView();

      renderer.setSize(view.stageW, view.stageH);
      const halfW = view.stageW / 2;
      const halfH = view.stageH / 2;
      camera.left = -halfW;
      camera.right = halfW;
      camera.top = halfH;
      camera.bottom = -halfH;
      camera.updateProjectionMatrix();
    };

    const initAR = async () => {
      try {
        // 1. Get WebCam stream
        setLoadingMsg('Initializing webcam...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });

        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await new Promise<void>((resolve) => {
            if (videoRef.current) {
              videoRef.current.oncanplay = () => resolve();
            }
          });
          videoRef.current.play();
        }

        // Update initial dimensions
        updateView();

        // 2. Initialize Three.js
        setLoadingMsg('Initializing 3D renderer...');
        const canvas = canvasRef.current;
        if (!canvas) throw new Error('Canvas not found');

        renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance',
        });
        renderer.setClearColor(0x000000, 0);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.25;

        scene = new THREE.Scene();

        // Set up environment probes
        const pmrem = new THREE.PMREMGenerator(renderer);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

        // Dynamic light system
        const ambient = new THREE.AmbientLight(0xffffff, 0.25);
        scene.add(ambient);
        ambientLightRef.current = ambient;

        const key = new THREE.DirectionalLight(0xffffff, 1.6);
        key.position.set(200, 400, 600);
        scene.add(key);
        keyLightRef.current = key;

        const fill = new THREE.DirectionalLight(0xffffff, 0.8);
        fill.position.set(-300, 200, 200);
        scene.add(fill);
        fillLightRef.current = fill;

        // Orthographic Camera matching screen dimensions
        const halfW = view.stageW / 2;
        const halfH = view.stageH / 2;
        camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 2000);
        camera.position.set(0, 0, 1000);
        camera.lookAt(0, 0, 0);

        resizeRenderer();
        window.addEventListener('resize', resizeRenderer);

        // 3. Initialize Face Tracker
        setLoadingMsg('Loading Face AI Models...');
        const tracker = new FaceTracker();
        await tracker.init();
        trackerRef.current = tracker;

        // 4. Initialize occlusion & systems
        occluderRef.current = new FaceOccluder({ scene });
        const gltfLoader = new GLTFLoader();

        earringsRef.current = new EarringsSystem({
          scene,
          gltfLoader,
          onStatus: (msg: string) => {
            if (active && msg) setLoadingMsg(msg);
          },
        });

        necklacesRef.current = new NecklaceSystem({
          scene,
          gltfLoader,
          onStatus: (msg: string) => {
            if (active && msg) setLoadingMsg(msg);
          },
        });

        // Set active visibility and load product
        setLoadingMsg('Loading 3D Product...');
        earringsRef.current.setVisible(product.category === 'earrings');
        necklacesRef.current.setVisible(product.category === 'necklaces');

        if (product.category === 'earrings') {
          await earringsRef.current.loadModel(product.modelPath);
        } else {
          await necklacesRef.current.loadModel(product.modelPath);
        }

        setLoadingMsg(''); // Ready!

        // 5. Render Loop setup
        let lastNow = performance.now();
        let lastVideoTime = -1;
        let lastDetectionMs = 0;
        let lastDet: any = null;
        let frameCount = 0;

        // Default anchors
        const leftEarAnchor = EarAnchor.defaultLeft();
        const rightEarAnchor = EarAnchor.defaultRight();

        // Tiny canvas for environment light sampling
        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = 16;
        offscreenCanvas.height = 16;
        const offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });

        const loop = (now: number) => {
          if (!active) return;
          requestRef.current = requestAnimationFrame(loop);

          const dtSeconds = Math.min(0.05, (now - lastNow) / 1000);
          lastNow = now;

          const video = videoRef.current;
          if (video && video.readyState >= 2 && tracker.ready) {
            frameCount++;

            // Environmental light estimation
            if (frameCount % 12 === 0 && offscreenCtx) {
              try {
                offscreenCtx.drawImage(video, 0, 0, 16, 16);
                const imgData = offscreenCtx.getImageData(0, 0, 16, 16).data;
                let sumLuminance = 0;
                for (let i = 0; i < imgData.length; i += 4) {
                  sumLuminance += (0.2126 * imgData[i] + 0.7152 * imgData[i + 1] + 0.0722 * imgData[i + 2]) / 255;
                }
                const avgLuminance = sumLuminance / 256;
                const targetAmbient = THREE.MathUtils.lerp(0.12, 0.50, avgLuminance);
                const targetKey = THREE.MathUtils.lerp(0.70, 2.00, avgLuminance);
                const targetFill = THREE.MathUtils.lerp(0.30, 1.10, avgLuminance);

                if (ambientLightRef.current) ambientLightRef.current.intensity = THREE.MathUtils.lerp(ambientLightRef.current.intensity, targetAmbient, 0.08);
                if (keyLightRef.current) keyLightRef.current.intensity = THREE.MathUtils.lerp(keyLightRef.current.intensity, targetKey, 0.08);
                if (fillLightRef.current) fillLightRef.current.intensity = THREE.MathUtils.lerp(fillLightRef.current.intensity, targetFill, 0.08);
              } catch (e) {
                // Ignore
              }
            }

            let det = lastDet;
            const isNewFrame = video.currentTime !== lastVideoTime;
            const isStale = (now - lastDetectionMs) > 150;

            if (isNewFrame || isStale) {
              try {
                det = tracker.detect(video, now);
                lastVideoTime = video.currentTime;
                lastDetectionMs = now;
                lastDet = det;
              } catch (e) {
                console.error(e);
                det = null;
              }
            }

            if (det) {
              // Toggle occluder
              occluderRef.current?.setVisible(true);

              // 1. Calculate face geometry factors
              const headPose = estimateHeadPose(det.poseMatrix);
              const poseQuat = headPose.quaternion;

              const leftEar = leftEarAnchor.compute(det.landmarks);
              const rightEar = rightEarAnchor.compute(det.landmarks);

              // Ensure correct orientation
              let anchorsVal = { left: leftEar, right: rightEar };
              if (leftEar.x > rightEar.x) {
                anchorsVal = { left: rightEar, right: leftEar };
              }

              const faceWidthPx = Math.abs(anchorsVal.right.x - anchorsVal.left.x) * view.videoW * view.cover.scale;

              // 2. Update occlusion geometry
              occluderRef.current?.update({
                landmarks: det.landmarks,
                view,
                faceWidthPx,
                zBias: 25,
              });

              // 3. Update Systems
              if (product.category === 'earrings' && earringsRef.current) {
                // Read scales and offsets from React state
                earringsRef.current.update({
                  anchors: anchorsVal,
                  landmarks: det.landmarks,
                  view,
                  faceWidthPx,
                  poseQuat,
                  headPose,
                  settings: {
                    offsetX: offsetX,
                    offsetY: offsetY,
                    offsetZ: 12,  // Depth
                    scaleMultiplier: scale,
                    smoothingFactor: 0.55,
                  },
                  dtSeconds,
                });
              } else if (product.category === 'necklaces' && necklacesRef.current) {
                necklacesRef.current.update({
                  anchors: {
                    chin: det.chin,
                    jawLeft: det.jawLeft,
                    jawRight: det.jawRight,
                    neck: det.neck,
                  },
                  view,
                  jawWidthPx: faceWidthPx,
                  poseQuat,
                  dtSeconds,
                });
              }
            } else {
              // Hide systems if no face is in frame
              occluderRef.current?.setVisible(false);
              earringsRef.current?.setVisible(false);
              necklacesRef.current?.setVisible(false);
            }
          }

          if (renderer && scene && camera) {
            renderer.render(scene, camera);
          }
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

      // Stop webcam stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }

      // Dispose subsystems
      trackerRef.current?.dispose();
      occluderRef.current?.dispose();
      earringsRef.current?.dispose();
      necklacesRef.current?.dispose();

      if (renderer) renderer.dispose();
    };
  }, [product, scale, offsetX, offsetY]);

  // Sync color changes on earrings
  useEffect(() => {
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
        topGem: Object.keys(colorMap).find(key => colorMap[key as keyof typeof colorMap] === topGemColor) || 'ruby',
        bottomGem: Object.keys(colorMap).find(key => colorMap[key as keyof typeof colorMap] === bottomGemColor) || 'tanzanite',
        scale: scale.toFixed(2),
      } : {
        scale: scale.toFixed(2),
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0b0d12]/95 backdrop-blur-md flex flex-col md:flex-row overflow-hidden">
      
      {/* 1. Camera and AR WebGL Area */}
      <div ref={containerRef} className="relative flex-1 bg-black overflow-hidden flex items-center justify-center">
        <video
          ref={videoRef}
          id="camera"
          playsInline
          muted
          autoPlay
          className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1] pointer-events-none opacity-90"
        />
        <canvas
          ref={canvasRef}
          id="ar-canvas"
          className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
        />

        {/* Loading Overlay */}
        {loadingMsg && (
          <div className="absolute inset-0 bg-[#FCF9F8]/80 backdrop-blur-sm flex flex-col items-center justify-center text-[#1a1a1a] z-10 px-4 text-center animate-fade-in">
            <div className="w-12 h-12 border-2 border-[#5F3041] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm tracking-widest uppercase text-[#5F3041] font-bold">{loadingMsg}</p>
          </div>
        )}

        {/* Back Button */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 p-3 rounded-full bg-[#FCF9F8]/60 hover:bg-[#FCF9F8]/90 border border-black/5 text-[#1a1a1a] transition-all cursor-pointer z-20 backdrop-blur-md shadow-md"
          aria-label="Exit AR mode"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>

        {/* Tips badge and Color Picker overlay */}
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex flex-col items-center gap-3 z-20 backdrop-blur-md bg-black/60 border border-white/10 rounded-2xl p-4 w-[280px] text-white">
          <span className="text-[10px] tracking-wider text-slate-300 font-semibold uppercase">
            Tip: Look straight at the camera
          </span>
          {product.customizeColors && (
            <div className="w-full space-y-3 pt-2 border-t border-white/10">
              {/* Top Gem Color Selectors */}
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Top Gem:</span>
                <div className="flex gap-2">
                  {['ruby', 'emerald', 'sapphire', 'diamond'].map((name) => {
                    const color = colorMap[name as keyof typeof colorMap];
                    const active = topGemColor === color;
                    return (
                      <button
                        key={name}
                        onClick={() => setTopGemColor(color)}
                        style={{ backgroundColor: color }}
                        title={name.toUpperCase()}
                        className={`w-6 h-6 rounded-full border transition-all cursor-pointer ${
                          active ? 'border-amber-400 scale-110 shadow-[0_0_6px_rgba(251,191,36,0.5)]' : 'border-transparent hover:scale-105'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
              {/* Bottom Gem Color Selectors */}
              <div className="flex justify-between items-center">
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Bottom Gem:</span>
                <div className="flex gap-2">
                  {['ruby', 'emerald', 'tanzanite', 'amethyst'].map((name) => {
                    const color = colorMap[name as keyof typeof colorMap];
                    const active = bottomGemColor === color;
                    return (
                      <button
                        key={name}
                        onClick={() => setBottomGemColor(color)}
                        style={{ backgroundColor: color }}
                        title={name.toUpperCase()}
                        className={`w-6 h-6 rounded-full border transition-all cursor-pointer ${
                          active ? 'border-amber-400 scale-110 shadow-[0_0_6px_rgba(251,191,36,0.5)]' : 'border-transparent hover:scale-105'
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 2. Customizer and Action Sidebar */}
      <div className="w-full md:w-[400px] border-t md:border-t-0 md:border-l border-[#5F3041]/10 bg-[#FDFAF7] p-6 md:p-8 flex flex-col justify-between overflow-y-auto text-[#1a1a1a]">
        <div>
          {/* Header */}
          <div className="mb-6">
            <span className="text-[10px] tracking-[0.2em] font-bold text-[#5F3041] uppercase">StellaLens VTO</span>
            <h2 className="text-2xl font-light tracking-wide mt-1 text-[#1a1a1a]">{product.name}</h2>
            <p className="text-xl text-[#5F3041] mt-2 font-semibold">{product.price}</p>
            <p className="text-xs text-slate-500 font-light mt-4 leading-relaxed">{product.description}</p>
          </div>

          <hr className="border-[#5F3041]/10 my-6" />

          {/* Sizing controller */}
          <div className="space-y-4">
            <div className="flex justify-between items-center text-sm">
              <span className="text-xs tracking-wider text-slate-500 font-light uppercase">Size Scale</span>
              <span className="font-mono text-[#5F3041] font-semibold">{scale.toFixed(2)}x</span>
            </div>
            <div className="flex items-center gap-4 bg-[#F5F0EB]/60 border border-[#5F3041]/15 rounded-xl p-2">
              <button
                onClick={() => setScale(prev => Math.max(0.60, prev - 0.01))}
                className="w-10 h-10 flex items-center justify-center bg-white border border-[#5F3041]/10 rounded-lg hover:bg-[#F5F0EB] active:scale-95 transition-all text-lg cursor-pointer text-[#1a1a1a]"
              >
                -
              </button>
              <input
                type="range"
                min="0.60"
                max="0.70"
                step="0.01"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="flex-1 accent-[#5F3041] cursor-pointer h-1 rounded-lg"
              />
              <button
                onClick={() => setScale(prev => Math.min(0.70, prev + 0.01))}
                className="w-10 h-10 flex items-center justify-center bg-white border border-[#5F3041]/10 rounded-lg hover:bg-[#F5F0EB] active:scale-95 transition-all text-lg cursor-pointer text-[#1a1a1a]"
              >
                +
              </button>
            </div>
          </div>

          {/* Sizing & Positioning Controllers */}
          <div className="space-y-6 mt-8">
            <span className="text-xs tracking-wider text-slate-500 font-semibold uppercase block">Position & Height Fitting</span>

            {/* Height (Y Offset) Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-light text-slate-600">
                <span>Height (Up / Down)</span>
                <span className="font-mono text-[#5F3041] font-semibold">{offsetY > 2 ? `+${offsetY - 2}` : offsetY - 2}</span>
              </div>
              <div className="flex items-center gap-3 bg-[#F5F0EB]/60 border border-[#5F3041]/10 rounded-xl p-2.5">
                <input
                  type="range"
                  min="-18"
                  max="22"
                  step="1"
                  value={offsetY}
                  onChange={(e) => setOffsetY(parseInt(e.target.value))}
                  className="w-full accent-[#5F3041] cursor-pointer h-1 rounded-lg"
                />
              </div>
            </div>

            {/* Sideways (X Offset) Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-light text-slate-600">
                <span>Sideways (In / Out)</span>
                <span className="font-mono text-[#5F3041] font-semibold">{offsetX > -28 ? `+${offsetX + 28}` : offsetX + 28}</span>
              </div>
              <div className="flex items-center gap-3 bg-[#F5F0EB]/60 border border-[#5F3041]/10 rounded-xl p-2.5">
                <input
                  type="range"
                  min="-48"
                  max="-8"
                  step="1"
                  value={offsetX}
                  onChange={(e) => setOffsetX(parseInt(e.target.value))}
                  className="w-full accent-[#5F3041] cursor-pointer h-1 rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-8 md:mt-0 pt-6">
          <button
            onClick={handleOrder}
            className="w-full py-4 bg-[#5F3041] hover:bg-[#4A2231] text-white font-bold rounded-xl active:scale-98 transition-all tracking-widest uppercase text-xs shadow-md hover:shadow-lg cursor-pointer"
          >
            Request Bespoke Order
          </button>
        </div>
      </div>
    </div>
  );
}
