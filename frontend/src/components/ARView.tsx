'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

import { FaceTracker } from '@/lib/ar/faceTracking';
import { HandTracker } from '@/lib/ar/handTracking';
import { BodyFitSession } from '@/lib/ar/bodyFit';
import { EarringsSystem } from '@/lib/ar/earrings';
import { NecklaceSystem } from '@/lib/ar/necklaces';
import { RingSystem } from '@/lib/ar/rings';
import { BraceletSystem } from '@/lib/ar/bracelets';
import { estimateHeadPose } from '@/lib/ar/headPose';
import { EarAnchor } from '@/lib/ar/earAnchor';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Product, PRODUCTS } from '@/data/products';

interface ARViewProps {
  product: Product;
  onClose: () => void;
  onOpenOrderModal: (customizations: any) => void;
}

const EARRING_FIT = {
  offsetX: 0,
  offsetY: 0,
  offsetZ: 0,
  scaleMultiplier: 1.0,
  smoothingFactor: 0.55,
};

const WEBCAM_VFOV_DEG = 63;

const CAMERA_ZOOM = 1.1;

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
  const [guideMsg,      setGuideMsg]      = useState('');
  const [metalTone,     setMetalTone]     = useState<'gold' | 'silver'>('gold');
  const [topGemColor,   setTopGemColor]   = useState(GEM_MAP.ruby);
  const [bottomGemColor,setBottomGemColor]= useState(GEM_MAP.tanzanite);

  const gemsTouched = useRef(false);

  const [activeProduct, setActiveProduct] = useState(product);
  useEffect(() => { setActiveProduct(product); }, [product]);
  useEffect(() => { setMetalTone('gold'); }, [activeProduct]);

  const [calibEar, setCalibEar] = useState<'userRight' | 'userLeft'>('userRight');
  const [, setCalibTick] = useState(0);
  const [, setBodyFitInfo] = useState<
    { status: string; cm: number | null; scale: number; samples: number; needed: number; baseline: number } | null
  >(null);

  const calibStepRef = useRef(0);
  const [calibStep, setCalibStep] = useState(0);
  const [calibHint, setCalibHint] = useState('');

  const { user, loading: authLoading, saveCalibration, clearCalibration } = useAuth();
  const { toast } = useToast();
  const lobesTuned = !!user?.earCalibration;

  const calibrationRef = useRef(user?.earCalibration ?? null);
  const saveCalibrationRef = useRef(saveCalibration);
  const toastRef = useRef(toast);
  useEffect(() => { calibrationRef.current = user?.earCalibration ?? null; }, [user]);
  useEffect(() => { saveCalibrationRef.current = saveCalibration; }, [saveCalibration]);
  useEffect(() => { toastRef.current = toast; }, [toast]);

  useEffect(() => {
    earringsRef.current?.setUserLobes(user?.earCalibration ?? null);
  }, [user?.earCalibration]);

  const startLobeCalibration = () => {
    calibStepRef.current = 1;
    setCalibStep(1);
    setCalibHint('');
  };
  const cancelLobeCalibration = () => {
    calibStepRef.current = 0;
    setCalibStep(0);
    setCalibHint('');
  };
  const resetLobeCalibration = () => {
    earringsRef.current?.resetLobes();
    cancelLobeCalibration();
    clearCalibration()
      .then(() => toast({ kind: 'info', title: 'Ear fitting cleared', message: 'Tap each earlobe once to set it up again.' }))
      .catch(() => toast({ kind: 'error', title: 'Could not clear the fitting', message: 'Please try again in a moment.' }));
  };

  const autoPromptedRef = useRef(false);
  useEffect(() => {
    if (activeProduct.category !== 'earrings') return;
    if (loadingMsg || authLoading) return;
    if (!user || user.earCalibration) return;
    if (autoPromptedRef.current) return;
    autoPromptedRef.current = true;
    startLobeCalibration();
  }, [activeProduct, loadingMsg, authLoading, user]);

  useEffect(() => {
    if (activeProduct.category === 'earrings') {
      const onKey = (e: KeyboardEvent) => {
        const anchor = earringsRef.current?.getAnchor();
        if (!anchor) return;
        const step = 0.1 * (e.shiftKey ? 4 : 1);
        const o = anchor[calibEar];
        let handled = true;
        switch (e.key.toLowerCase()) {
          case 'a': o.lateral -= step; break;
          case 'd': o.lateral += step; break;
          case 'w': o.down    -= step; break;
          case 's': o.down    += step; break;
          case 'r': o.back    -= step; break;
          case 'f': o.back    += step; break;
          case 't': setCalibEar(prev => (prev === 'userRight' ? 'userLeft' : 'userRight')); break;
          default: handled = false;
        }
        if (handled) {
          e.preventDefault();
          setCalibTick(t => t + 1);
          console.info(
            `[AR] ${activeProduct.name} earAnchor.${calibEar} —` +
            ` lateral ${o.lateral.toFixed(1)} · down ${o.down.toFixed(1)} · back ${o.back.toFixed(1)}`
          );
        }
      };
      window.addEventListener('keydown', onKey);
      return () => window.removeEventListener('keydown', onKey);
    }
  }, [activeProduct, calibEar]);

  const requestRef  = useRef<number | null>(null);
  const trackerRef  = useRef<FaceTracker | HandTracker | null>(null);
  const earringsRef = useRef<EarringsSystem | null>(null);
  const necklacesRef= useRef<NecklaceSystem | null>(null);
  const ringsRef    = useRef<RingSystem | null>(null);
  const braceletsRef= useRef<BraceletSystem | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const ambientRef  = useRef<THREE.AmbientLight | null>(null);
  const keyRef      = useRef<THREE.DirectionalLight | null>(null);
  const fillRef     = useRef<THREE.DirectionalLight | null>(null);

  useEffect(() => {
    let active = true;
    let renderer: THREE.WebGLRenderer | null = null;
    let dracoLoader: DRACOLoader | null = null;
    let scene: THREE.Scene | null = null;
    let camera: THREE.PerspectiveCamera | null = null;
    let vfovDeg = WEBCAM_VFOV_DEG;

    const onFovKey = (e: KeyboardEvent) => {
      if (!camera) return;
      if (e.key === '[') vfovDeg = Math.max(20, vfovDeg - 1);
      else if (e.key === ']') vfovDeg = Math.min(90, vfovDeg + 1);
      else return;
      camera.fov = vfovDeg;
      camera.updateProjectionMatrix();
      console.log('[AR] WEBCAM_VFOV_DEG =', vfovDeg);
    };

    const view = { stageW: 1, stageH: 1, videoW: 1, videoH: 1, cover: { scale: 1, offsetX: 0, offsetY: 0 } };

    const onStagePointer = (e: PointerEvent) => {
      const step = calibStepRef.current;
      if (!step || !camera || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      if (px < 0 || py < 0 || px > rect.width || py > rect.height) return;

      const lx = -(px - rect.width / 2) / CAMERA_ZOOM + rect.width / 2;
      const ly = (py - rect.height / 2) / CAMERA_ZOOM + rect.height / 2;

      const bx = (lx - view.cover.offsetX) / view.cover.scale;
      const by = (ly - view.cover.offsetY) / view.cover.scale;
      const ndcX = (bx / view.videoW) * 2 - 1;
      const ndcY = -((by / view.videoH) * 2 - 1);

      const side = step === 1 ? 'screenRight' : 'screenLeft';
      const saved = earringsRef.current?.calibrateLobeFromTap({ side, ndcX, ndcY, camera });
      if (!saved) {
        setCalibHint('Hold still — I need to see your face.');
        return;
      }
      setCalibHint('');
      if (step === 1) {
        calibStepRef.current = 2;
        setCalibStep(2);
        return;
      }
      calibStepRef.current = 0;
      setCalibStep(0);
      saveCalibrationRef.current({
        screenLeft: saved.screenLeft,
        screenRight: saved.screenRight,
      }).then(() => {
        toastRef.current({
          kind: 'success',
          title: 'Ear fitting saved',
          message: 'Earrings will sit here for you from now on, on any device.',
        });
      }).catch(() => {
        setCalibHint("Saved on this device, but we couldn't sync it to your account.");
        toastRef.current({
          kind: 'error',
          title: 'Fitting not synced',
          message: 'It works for this session, but we could not save it to your account.',
        });
      });
    };

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
      const needed = view.cover.scale * (window.devicePixelRatio || 1) * CAMERA_ZOOM;
      renderer.setPixelRatio(THREE.MathUtils.clamp(needed, 0.75, 2));
      renderer.setSize(view.videoW, view.videoH, false);
      camera.aspect = view.videoW / view.videoH;
      camera.fov = vfovDeg;
      camera.updateProjectionMatrix();
    };

    const initAR = async () => {
      try {
        setLoadingMsg('Initializing webcam...');
        if (!navigator.mediaDevices?.getUserMedia) {
          setLoadingMsg('Camera not supported in this browser. Try Safari (iOS) or Chrome (Android).');
          return;
        }

        let stream: MediaStream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'user' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        } catch (camErr: any) {
          const name = camErr?.name;
          if (name === 'NotAllowedError' || name === 'SecurityError') {
            setLoadingMsg('Camera permission denied. Enable camera access in your browser settings, then reload.');
          } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
            setLoadingMsg('No camera found on this device.');
          } else {
            setLoadingMsg('Could not start the camera. Check that no other app is using it, then reload.');
          }
          return;
        }
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
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true });
        renderer.localClippingEnabled = true;

        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setClearColor(0x000000, 0);
        renderer.outputColorSpace = THREE.SRGBColorSpace;

        renderer.toneMapping = THREE.NeutralToneMapping;
        renderer.toneMappingExposure = 1.0;
        scene = new THREE.Scene();
        const pmrem = new THREE.PMREMGenerator(renderer);
        scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

        scene.environmentIntensity = 1.15;

        const ambient = new THREE.AmbientLight(0xffffff, 0.25); scene.add(ambient); ambientRef.current = ambient;
        const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(200, 400, 600); scene.add(key); keyRef.current = key;
        const fill = new THREE.DirectionalLight(0xffffff, 0.8); fill.position.set(-300, 200, 200); scene.add(fill); fillRef.current = fill;

        camera = new THREE.PerspectiveCamera(vfovDeg, view.videoW / view.videoH, 4, 200);
        camera.position.set(0, 0, 0);
        camera.lookAt(0, 0, -1);
        resizeRenderer();
        window.addEventListener('resize', resizeRenderer);
        window.addEventListener('orientationchange', resizeRenderer);
        window.addEventListener('keydown', onFovKey);
        window.addEventListener('pointerdown', onStagePointer);

        const isRing = activeProduct.category === 'rings';
        const isBracelet = activeProduct.category === 'bracelets';
        const isHand = isRing || isBracelet;
        setLoadingMsg(isHand ? 'Loading Hand AI Models...' : 'Loading Face AI Models...');
        const tracker: any = isHand ? new HandTracker() : new FaceTracker();
        await tracker.init();

        if (!active) { tracker.dispose(); return; }
        trackerRef.current = tracker;

        // Models are Draco-compressed; the decoder is vendored in /public/draco.
        dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('/draco/');
        const gltfLoader = new GLTFLoader();
        gltfLoader.setDRACOLoader(dracoLoader);
        earringsRef.current  = new EarringsSystem({ scene, gltfLoader, onStatus: (msg: string) => { if (active && msg) setLoadingMsg(msg); } });
        earringsRef.current.setUserLobes(calibrationRef.current);
        necklacesRef.current = new NecklaceSystem({ scene, gltfLoader, onStatus: (msg: string) => { if (active && msg) setLoadingMsg(msg); } });
        ringsRef.current     = new RingSystem({ scene, gltfLoader, onStatus: (msg: string) => { if (active && msg) setLoadingMsg(msg); } });
        braceletsRef.current = new BraceletSystem({ scene, gltfLoader, onStatus: (msg: string) => { if (active && msg) setLoadingMsg(msg); } });

        setLoadingMsg('Loading 3D Product...');
        earringsRef.current.setVisible(activeProduct.category === 'earrings');
        necklacesRef.current.setVisible(activeProduct.category === 'necklaces');
        ringsRef.current.setVisible(false);
        braceletsRef.current.setVisible(false);
        if (activeProduct.category === 'earrings') await earringsRef.current.loadModel(activeProduct.modelPath, { singleEarring: activeProduct.pair === true, preserveMaterials: activeProduct.preserveMaterials === true, anchor: activeProduct.earAnchor, dangle: activeProduct.dangle, fit: activeProduct.arFit, materials: activeProduct.arMaterials, skinPenetration: activeProduct.skinPenetration, contactShadow: activeProduct.contactShadow, type: activeProduct.arType, fixedNodes: activeProduct.fixedNodes, pairMirror: activeProduct.pairMirror });
        else if (activeProduct.category === 'necklaces') await necklacesRef.current.loadModel(activeProduct.modelPath, { anchor: activeProduct.necklaceAnchor, scale: activeProduct.arFit?.scale, rotationFix: activeProduct.arFit?.rotationDeg, preserveMaterials: activeProduct.preserveMaterials === true, style: activeProduct.necklaceStyle, stripNodes: activeProduct.necklaceStrip } as any);
        else if (activeProduct.category === 'rings') await ringsRef.current.loadModel(activeProduct.modelPath, { fit: activeProduct.ringFit, scale: activeProduct.arFit?.scale, rotationFix: activeProduct.arFit?.rotationDeg, preserveMaterials: activeProduct.preserveMaterials === true } as any);
        else if (activeProduct.category === 'bracelets') await braceletsRef.current.loadModel(activeProduct.modelPath, { fit: activeProduct.braceletFit, scale: activeProduct.arFit?.scale, rotationFix: activeProduct.arFit?.rotationDeg, stripNodes: activeProduct.necklaceStrip, preserveMaterials: activeProduct.preserveMaterials === true } as any);
        setLoadingMsg('');

        let lastNow = performance.now(), lastVideoTime = -1, lastDetectionMs = 0, lastDet: any = null, frameCount = 0, trackingLostMs = 0;

        let guidePrevX = -1, guidePrevY = -1, guideSpeed = 0, occludedMs = 0, lastGuide = '';

        let bodyFit: any = null; // BodyFitSession (its module is @ts-nocheck)
        let bodyFitStatus = '';
        const publishBodyFit = (s: any) => setBodyFitInfo({
          status: s.status, cm: s.noseShoulderCm, scale: s.scale,
          samples: s.samples, needed: s.samplesNeeded, baseline: s.baselineCm,
        });
        if (activeProduct.category === 'necklaces') {
          bodyFit = new BodyFitSession();
          publishBodyFit(bodyFit);
          bodyFit.init().catch((e: any) => {
            console.warn('[AR] body fit unavailable:', e?.message ?? e);
            setBodyFitInfo({ status: 'unavailable', cm: null, scale: 1, samples: 0, needed: 0, baseline: 0 });
            bodyFit = null;
          });
        }
        const leftEarAnchor = EarAnchor.defaultLeft(), rightEarAnchor = EarAnchor.defaultRight();

        const offscreenCanvas = document.createElement('canvas'); offscreenCanvas.width = 64; offscreenCanvas.height = 64;
        const offscreenCtx = offscreenCanvas.getContext('2d', { willReadFrequently: true });
        const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768;
        const SAMPLE_EVERY = isMobile ? 6 : 3;
        const BASE_ENV = 1.15;
        const REF_SKIN_LUM = 0.6;
        let lightBiasSmooth = 0;
        let warmthSmooth = 1.35;
        let envMulSmooth = 1;

        const loop = (now: number) => {
          if (!active) { bodyFit?.dispose(); bodyFit = null; return; }
          requestRef.current = requestAnimationFrame(loop);
          const dtSeconds = Math.min(0.05, (now - lastNow) / 1000); lastNow = now;
          const video = videoRef.current;
          if (video && video.readyState >= 2 && video.videoWidth > 0 && tracker.ready) {
            frameCount++;
            if (bodyFit && bodyFit.done === false) {
              bodyFit.sample(video, now);

              const tag = `${bodyFit.status}:${bodyFit.samples}`;
              if (tag !== bodyFitStatus) { bodyFitStatus = tag; publishBodyFit(bodyFit); }
              if (bodyFit.done) {
                necklacesRef.current?.setBodyScale(bodyFit.scale);
                publishBodyFit(bodyFit);
                bodyFit = null;
              }
            }
            if (frameCount % SAMPLE_EVERY === 0 && offscreenCtx) {
              try {
                offscreenCtx.drawImage(video, 0, 0, 64, 64);
                const data = offscreenCtx.getImageData(0, 0, 64, 64).data;

                let sumL = 0;
                for (let i = 0; i < data.length; i += 4) sumL += (0.2126 * data[i] + 0.7152 * data[i+1] + 0.0722 * data[i+2]) / 255;
                const avg = sumL / (64 * 64);
                if (ambientRef.current) ambientRef.current.intensity = THREE.MathUtils.lerp(ambientRef.current.intensity, THREE.MathUtils.lerp(0.12, 0.50, avg), 0.08);
                if (keyRef.current)     keyRef.current.intensity     = THREE.MathUtils.lerp(keyRef.current.intensity,     THREE.MathUtils.lerp(0.70, 2.00, avg), 0.08);
                if (fillRef.current)    fillRef.current.intensity    = THREE.MathUtils.lerp(fillRef.current.intensity,    THREE.MathUtils.lerp(0.30, 1.10, avg), 0.08);

                const lm = lastDet?.landmarks;
                if (lm && lm.length >= 468) {
                  const rgbAt = (idx: number) => {
                    const p = lm[idx];
                    if (!p) return null;
                    const x = Math.min(63, Math.max(0, Math.round(p.x * 64)));
                    const y = Math.min(63, Math.max(0, Math.round(p.y * 64)));
                    const o = (y * 64 + x) * 4;
                    return [data[o], data[o + 1], data[o + 2]] as const;
                  };

                  const lc = rgbAt(234), rc = rgbAt(454);
                  if (lc && rc) {
                    const lb = 0.2126 * lc[0] + 0.7152 * lc[1] + 0.0722 * lc[2];
                    const rb = 0.2126 * rc[0] + 0.7152 * rc[1] + 0.0722 * rc[2];
                    const bias = (rb - lb) / (rb + lb + 1e-3);
                    lightBiasSmooth += (bias - lightBiasSmooth) / 30;
                    if (keyRef.current) keyRef.current.position.x = 200 + lightBiasSmooth * 350;
                  }

                  const skin = [rgbAt(10), rgbAt(234), rgbAt(454), rgbAt(152)].filter(Boolean) as (readonly number[])[];
                  if (skin.length) {
                    let r = 0, g = 0, b = 0;
                    for (const c of skin) { r += c[0]; g += c[1]; b += c[2]; }
                    r /= skin.length; g /= skin.length; b /= skin.length;

                    warmthSmooth += (r / (b + 1e-3) - warmthSmooth) / 90;
                    const warmT = THREE.MathUtils.clamp((warmthSmooth - 1.1) / 0.6, 0, 1);
                    if (ambientRef.current) ambientRef.current.color.setRGB(
                      THREE.MathUtils.lerp(0.90, 1.00, warmT),
                      THREE.MathUtils.lerp(0.94, 0.95, warmT),
                      THREE.MathUtils.lerp(1.00, 0.88, warmT)
                    );

                    const skinLum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
                    envMulSmooth += (THREE.MathUtils.clamp(skinLum / REF_SKIN_LUM, 0.15, 1.0) - envMulSmooth) / 90;
                    if (scene) scene.environmentIntensity = BASE_ENV * envMulSmooth;
                  }
                }
              } catch {}
            }
            let det = lastDet;
            const isNewFrame = video.currentTime !== lastVideoTime, isStale = (now - lastDetectionMs) > 150;
            if (isNewFrame || isStale) {
              try { det = tracker.detect(video, now); lastVideoTime = video.currentTime; lastDetectionMs = now; lastDet = det; }
              catch (e) { console.error(e); det = null; }
            }
            if (det) {
              trackingLostMs = 0;
              if (isRing) {
                ringsRef.current?.setVisible(true);
                ringsRef.current?.update({ hand: det, view, dtSeconds });
              } else if (isBracelet) {
                braceletsRef.current?.setVisible(true);
                braceletsRef.current?.update({ hand: det, view, dtSeconds, video });
              }

              let guide = '';
              if (isBracelet && braceletsRef.current?.isPosed() === false) guide = 'Open your hand and show your wrist';
              if (activeProduct.category === 'earrings') {
                const eL = det.landmarks[33], eR = det.landmarks[263];
                if (eL && eR) {
                  const cx = (eL.x + eR.x) / 2, cy = (eL.y + eR.y) / 2;
                  if (Math.abs(cx - 0.5) > 0.16 || Math.abs(cy - 0.5) > 0.30) guide = 'Center your face in the oval';
                  if (guidePrevX >= 0 && dtSeconds > 0) {
                    const v = Math.hypot(cx - guidePrevX, cy - guidePrevY) / dtSeconds;
                    guideSpeed += (v - guideSpeed) * 0.25;
                    if (!guide && guideSpeed > 0.45) guide = 'Hold still for a moment';
                  }
                  guidePrevX = cx; guidePrevY = cy;
                }
                if (!guide && earringsRef.current?.isSideOccluded?.()) {
                  occludedMs += dtSeconds * 1000;
                  if (occludedMs > 350) guide = 'Keep your hair away from your ears';
                } else if (!earringsRef.current?.isSideOccluded?.()) {
                  occludedMs = 0;
                }
              }
              if (guide !== lastGuide) { lastGuide = guide; setGuideMsg(guide); }

              earringsRef.current?.setVisible(activeProduct.category === 'earrings' && !guide);
              necklacesRef.current?.setVisible(activeProduct.category === 'necklaces');
              const headPose = estimateHeadPose(det.poseMatrix), poseQuat = headPose.quaternion;
              const leftEar = leftEarAnchor.compute(det.landmarks), rightEar = rightEarAnchor.compute(det.landmarks);
              let anchorsVal = { left: leftEar, right: rightEar };
              if (leftEar.x > rightEar.x) anchorsVal = { left: rightEar, right: leftEar };
              const faceWidthPx = Math.abs(anchorsVal.right.x - anchorsVal.left.x) * view.videoW * view.cover.scale;
              if (activeProduct.category === 'earrings' && earringsRef.current) {
                earringsRef.current.update({ anchors: anchorsVal, landmarks: det.landmarks, view, faceWidthPx, poseQuat, poseMatrix: det.poseMatrix, headPose, settings: EARRING_FIT, dtSeconds });
              } else if (activeProduct.category === 'necklaces' && necklacesRef.current) {
                necklacesRef.current.update({ landmarks: det.landmarks, headPose, dtSeconds });
              }

              earringsRef.current?.applyPresence(true, dtSeconds, 0);
            } else {
              trackingLostMs += dtSeconds * 1000;
              earringsRef.current?.applyPresence(false, dtSeconds, trackingLostMs);
              necklacesRef.current?.setVisible(false);
              if (isHand) {
                ringsRef.current?.setVisible(false);
                braceletsRef.current?.setVisible(false);
                const handGuide = isBracelet ? 'Open your hand and show your wrist' : 'Show your hand to the camera';
                if (trackingLostMs > 800 && lastGuide !== handGuide) { lastGuide = handGuide; setGuideMsg(handGuide); }
              } else if (lastGuide) { lastGuide = ''; setGuideMsg(''); }
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
      window.removeEventListener('orientationchange', resizeRenderer);
      window.removeEventListener('keydown', onFovKey);
      window.removeEventListener('pointerdown', onStagePointer);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
      trackerRef.current?.dispose();
      earringsRef.current?.dispose();
      necklacesRef.current?.dispose();
      ringsRef.current?.dispose();
      braceletsRef.current?.dispose();
      if (renderer) renderer.dispose();
      dracoLoader?.dispose();
    };
  }, [activeProduct]);

  useEffect(() => {
    if (!gemsTouched.current) return;
    if (activeProduct.category === 'earrings' && earringsRef.current) {
      earringsRef.current.setGemColors(topGemColor, bottomGemColor);
    }
  }, [topGemColor, bottomGemColor, activeProduct]);

  const takeSnapshot = () => {
    const video = videoRef.current, canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    const w = video.videoWidth, h = video.videoHeight;
    const out = document.createElement('canvas');
    out.width = w; out.height = h;
    const ctx = out.getContext('2d');
    if (!ctx) return;
    ctx.translate(w, 0); ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, w, h);
    ctx.drawImage(canvas, 0, 0, w, h);
    const a = document.createElement('a');
    a.download = `stellalens-${activeProduct.id}.png`;
    a.href = out.toDataURL('image/png');
    a.click();
  };

  const railProducts = PRODUCTS.filter(p => p.arEnabled);
  const categoryGlyph = (cat: string) => {
    switch (cat) {
      case 'earrings': return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
          <path d="M12 3l6 7-6 11L6 10z" strokeLinejoin="round" />
        </svg>
      );
      case 'necklaces': return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
          <path d="M4 4c2 6 6 9 8 9s6-3 8-9" /><circle cx="12" cy="16.5" r="3" />
        </svg>
      );
      case 'rings': return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
          <circle cx="12" cy="14" r="6" /><path d="M9 8.5l3-4.5 3 4.5" strokeLinejoin="round" />
        </svg>
      );
      default: return (
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.3">
          <rect x="4.5" y="4.5" width="15" height="15" rx="7.5" />
        </svg>
      );
    }
  };

  const handleOrder = () => {
    onOpenOrderModal({
      productId: activeProduct.id,
      productName: activeProduct.name,
      price: activeProduct.price,
      customizations: activeProduct.customizeColors ? {
        topGem:    Object.keys(GEM_MAP).find(k => GEM_MAP[k as keyof typeof GEM_MAP] === topGemColor)    || 'ruby',
        bottomGem: Object.keys(GEM_MAP).find(k => GEM_MAP[k as keyof typeof GEM_MAP] === bottomGemColor) || 'tanzanite',
      } : {},
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col md:flex-row overflow-hidden"
      style={{ background: 'var(--cream, #ffffff)' }}
    >
      <div
        className="hidden md:flex flex-col items-center gap-3 px-4 py-6"
        style={{ borderRight: '1px solid var(--cream-border)' }}
      >
        <span
          style={{
            fontSize: '9px', letterSpacing: '0.25em', textTransform: 'uppercase',
            color: 'var(--gold)', fontFamily: 'var(--font-jost), sans-serif',
            marginBottom: '4px',
          }}
        >
          Try on
        </span>
        {railProducts.map(p => {
          const active = p.id === activeProduct.id;
          return (
            <button
              key={p.id}
              title={p.name}
              onClick={() => setActiveProduct(p)}
              className="cursor-pointer flex items-center justify-center"
              style={{
                width: '44px', height: '44px', borderRadius: '12px',
                border: active ? '1.5px solid var(--gold)' : '1px solid var(--cream-border)',
                color: active ? 'var(--gold-bright)' : 'var(--cream-muted)',
                background: active ? 'rgba(179,146,94,0.08)' : 'transparent',
                transition: 'all 0.2s',
              }}
            >
              {categoryGlyph(p.category)}
            </button>
          );
        })}
      </div>

      <div className="relative flex-1 flex items-center justify-center min-h-0 p-3 md:p-5">
        <div
          ref={containerRef}
          className="relative overflow-hidden"
          style={{
            height: '100%', aspectRatio: '3 / 4', maxWidth: '100%',
            borderRadius: '20px', background: '#101010',
            boxShadow: '0 18px 50px rgba(60,50,35,0.18)',
          }}
        >
        <video
          ref={videoRef}
          id="camera"
          playsInline muted autoPlay
          className="absolute inset-0 w-full h-full object-cover pointer-events-none"
          style={{ transform: `scaleX(-1) scale(${CAMERA_ZOOM})`, opacity: 0.92 }}
        />
        <canvas
          ref={canvasRef}
          id="ar-canvas"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: `scaleX(-1) scale(${CAMERA_ZOOM})` }}
        />

        {activeProduct.category === 'earrings' && !loadingMsg && guideMsg.startsWith('Center') && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: '6%', right: '6%', top: '-10%', bottom: '-2%',
              border: '1.5px dashed rgba(255,255,255,0.45)',
              borderRadius: '50%',
            }}
          />
        )}

        {}
        {calibStep > 0 && (
          <div
            className="absolute inset-x-0 bottom-0 z-30 flex flex-col items-center gap-2 pointer-events-none"
            style={{ padding: '18px 16px 22px' }}
          >
            <span
              style={{
                fontFamily: "var(--font-jost), sans-serif",
                fontSize: '13px', letterSpacing: '0.14em', textTransform: 'uppercase',
                color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,0.7)',
              }}
            >
              Tap your {calibStep === 1 ? 'LEFT' : 'RIGHT'} earlobe
            </span>
            <span
              style={{
                fontFamily: "var(--font-jost), sans-serif",
                fontSize: '11px', letterSpacing: '0.1em',
                color: calibHint ? '#ffb4a2' : 'rgba(255,255,255,0.7)',
                textShadow: '0 1px 6px rgba(0,0,0,0.7)',
              }}
            >
              {calibHint || `Step ${calibStep} of 2 — face the camera`}
            </span>
            <button
              onClick={cancelLobeCalibration}
              className="cursor-pointer pointer-events-auto"
              style={{
                marginTop: '4px', background: 'rgba(0,0,0,0.45)', color: '#fff',
                border: '1px solid rgba(255,255,255,0.35)', borderRadius: '999px',
                padding: '7px 18px', fontFamily: "var(--font-jost), sans-serif",
                fontSize: '10px', letterSpacing: '0.18em', textTransform: 'uppercase',
              }}
            >
              Cancel
            </button>
          </div>
        )}

        {}
        {guideMsg && !loadingMsg && (
          <div
            className="absolute left-1/2 -translate-x-1/2 z-20"
            style={{
              top: 'calc(16px + env(safe-area-inset-top))',
              background: 'rgba(10,10,10,0.78)',
              backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '999px',
              color: '#f2e5d4',
              padding: '10px 18px',
              fontFamily: "var(--font-jost), sans-serif",
              fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}
          >
            {guideMsg}
          </div>
        )}

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
          className="absolute z-20 cursor-pointer flex items-center gap-2"
          style={{
            top: 'calc(16px + env(safe-area-inset-top))',
            left: 'calc(16px + env(safe-area-inset-left))',
            background: 'rgba(10,10,10,0.7)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '999px',
            color: 'rgba(255,255,255,0.7)',
            padding: '9px 16px',
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

        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3"
          style={{
            background: 'rgba(10,10,10,0.62)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '999px',
            padding: '9px 13px',
          }}
        >
          {activeProduct.category === 'necklaces' && activeProduct.metalOptions && (
            <>
              {([
                ['gold', 'radial-gradient(circle at 35% 35%, #f7dd8a, #d4a017 60%, #9c7414)'],
                ['silver', 'radial-gradient(circle at 35% 35%, #ffffff, #cfd4d8 60%, #8f979e)'],
              ] as const).map(([tone, bg]) => (
                <button
                  key={tone}
                  title={tone === 'gold' ? '24k gold' : 'Sterling silver'}
                  onClick={() => { setMetalTone(tone); necklacesRef.current?.setMetalTone(tone); }}
                  className="cursor-pointer"
                  style={{
                    width: '16px', height: '16px', borderRadius: '50%', background: bg,
                    border: metalTone === tone ? '2px solid #fff' : '2px solid rgba(255,255,255,0.18)',
                    transform: metalTone === tone ? 'scale(1.2)' : 'scale(1)',
                    transition: 'transform 0.2s, border-color 0.2s',
                  }}
                />
              ))}
              <div style={{ width: '1px', height: '16px', background: 'rgba(255,255,255,0.22)' }} />
            </>
          )}
          <button
            onClick={takeSnapshot}
            title="Save a photo"
            className="cursor-pointer flex items-center justify-center"
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.85)', lineHeight: 0, padding: '2px' }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M4 8h3l2-3h6l2 3h3v11H4z" strokeLinejoin="round" />
              <circle cx="12" cy="13.5" r="3.2" />
            </svg>
          </button>
        </div>
        </div>

      </div>

      <div
        className="w-full md:w-[360px] flex flex-col overflow-y-auto"
        style={{
          background: 'var(--cream, #ffffff)',
          borderLeft: '1px solid var(--cream-border)',
        }}
      >
        <div
          className="flex items-center justify-between px-8 py-5"
          style={{ borderBottom: '1px solid var(--cream-border)' }}
        >
          <span
            style={{
              fontSize: '9px',
              letterSpacing: '0.25em',
              textTransform: 'uppercase',
              color: 'var(--gold)',
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
              color: 'var(--cream-muted)',
              lineHeight: 0, transition: 'color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--cream-text)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--cream-muted)')}
          >
            <CloseX />
          </button>
        </div>

        <div className="px-8 py-7 flex flex-col gap-3" style={{ borderBottom: '1px solid var(--cream-border)' }}>
          <h2
            className="font-editorial"
            style={{
              fontSize: '28px', fontWeight: 400,
              letterSpacing: '0.02em', color: 'var(--cream-text)', lineHeight: 1.2,
              fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif",
            }}
          >
            {activeProduct.name}
          </h2>
          <span
            style={{
              fontSize: '18px', fontWeight: 400,
              color: 'var(--gold-bright)', letterSpacing: '0.05em',
              fontFamily: "var(--font-jost), sans-serif",
            }}
          >
            {activeProduct.price}
          </span>
          <p
            style={{
              fontSize: '12px', fontWeight: 300,
              color: 'var(--cream-muted)', lineHeight: 1.8, marginTop: '4px',
              fontFamily: "var(--font-jost), sans-serif",
            }}
          >
            {activeProduct.description}
          </p>
        </div>

        <div className="flex-1" />

        <div className="px-8 pb-8 flex flex-col gap-3">
          {activeProduct.category === 'earrings' && (
            <button
              onClick={lobesTuned ? resetLobeCalibration : startLobeCalibration}
              disabled={calibStep > 0}
              className="cursor-pointer"
              style={{
                background: 'transparent', color: 'var(--gold-bright)',
                border: '1px solid var(--gold-fade)',
                borderRadius: '999px', padding: '14px 20px',
                fontFamily: "var(--font-jost), sans-serif",
                fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase',
                opacity: calibStep > 0 ? 0.45 : 1,
                transition: 'all 0.2s',
              }}
            >
              {lobesTuned ? 'Reset Ear Fit' : 'Fit To My Ears'}
            </button>
          )}
          <button
            onClick={handleOrder}
            className="cursor-pointer"
            style={{
              background: 'var(--gold)', color: '#ffffff', border: 'none',
              borderRadius: '999px', padding: '15px 20px',
              fontFamily: "var(--font-jost), sans-serif",
              fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase',
              transition: 'background 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--gold-bright)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'var(--gold)')}
          >
            Request Bespoke Order
          </button>
          <button
            onClick={takeSnapshot}
            className="cursor-pointer"
            style={{
              background: 'transparent', color: 'var(--gold-bright)',
              border: '1px solid var(--gold-fade)',
              borderRadius: '999px', padding: '14px 20px',
              fontFamily: "var(--font-jost), sans-serif",
              fontSize: '11px', letterSpacing: '0.22em', textTransform: 'uppercase',
              transition: 'all 0.2s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.background = 'rgba(179,146,94,0.06)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--gold-fade)'; e.currentTarget.style.background = 'transparent'; }}
          >
            Save Look
          </button>
        </div>
      </div>
    </div>
  );
}
