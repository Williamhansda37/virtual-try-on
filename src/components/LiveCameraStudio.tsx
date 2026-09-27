/**
 * @file LiveCameraStudio.tsx
 * AI-Powered Real-Time 3D Virtual Try-On Studio.
 * Features:
 * 1. 478-Point MediaPipe FaceLandmarker for anatomical sunglasses & jewelry fitting.
 * 2. 21-Point MediaPipe HandLandmarker for real wrist tracking on watches.
 * 3. Three.js PBR rendering with GLTF models and dynamic materials.
 * 4. Velocity-adaptive jitter damping for Snapchat-quality stability.
 * 5. Full support for custom AI-generated wearables.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Camera,
  CheckCircle2,
  Eye,
  Box,
  Video,
  VideoOff,
  Glasses,
  Watch,
  Gem,
  Sparkles,
  RefreshCw,
  Download,
  Sliders,
  Maximize2,
  Compass,
  Activity,
  Zap,
  ShieldCheck,
  Layers,
  Crosshair,
  Hand,
} from 'lucide-react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FaceLandmarker, HandLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { GeneratedWearable } from './EcommerceAiGenerator';

// Adaptive Snapchat-grade filter for jitter elimination without latency
class AdaptiveTransformFilter {
  private pos = new THREE.Vector3();
  private rot = new THREE.Euler(0, 0, 0, 'YXZ');
  private initialized = false;

  public filter(targetPos: THREE.Vector3, targetRot: THREE.Euler, baseAlpha: number = 0.35) {
    if (!this.initialized) {
      this.pos.copy(targetPos);
      this.rot.copy(targetRot);
      this.initialized = true;
      return { pos: this.pos.clone(), rot: this.rot.clone() };
    }

    // Velocity-aware positional adaptation:
    const dPos = this.pos.distanceTo(targetPos);
    const alphaPos = Math.min(0.88, Math.max(0.18, baseAlpha * 0.6 + dPos * 3.5));
    this.pos.lerp(targetPos, alphaPos);

    // Velocity-aware rotational adaptation:
    const dPitch = Math.abs(this.rot.x - targetRot.x);
    const dYaw = Math.abs(this.rot.y - targetRot.y);
    const dRoll = Math.abs(this.rot.z - targetRot.z);
    const dRot = dPitch + dYaw + dRoll;
    const alphaRot = Math.min(0.85, Math.max(0.16, baseAlpha * 0.5 + dRot * 1.8));

    this.rot.x += (targetRot.x - this.rot.x) * alphaRot;
    this.rot.y += (targetRot.y - this.rot.y) * alphaRot;
    this.rot.z += (targetRot.z - this.rot.z) * alphaRot;

    return { pos: this.pos.clone(), rot: this.rot.clone() };
  }

  public reset() {
    this.initialized = false;
  }
}

// MediaPipe FaceMesh key landmark indices
const LM = {
  NOSE_BRIDGE: 168,      // Glabella (center between eyes)
  MID_NOSE: 6,           // Mid bridge
  NOSE_TIP: 1,           // Nose apex
  FOREHEAD: 10,          // Top forehead center
  CHIN: 152,             // Bottom chin center
  LEFT_EYE_OUTER: 33,    // Left eye outer corner
  LEFT_EYE_INNER: 133,   // Left eye inner corner
  RIGHT_EYE_OUTER: 263,  // Right eye outer corner
  RIGHT_EYE_INNER: 362,  // Right eye inner corner
  LEFT_CHEEK: 234,       // Left face boundary
  RIGHT_CHEEK: 454,      // Right face boundary
  LEFT_TEMPLE: 127,      // Left temple/ear anchor
  RIGHT_TEMPLE: 356,     // Right temple/ear anchor
  LEFT_PUPIL: 468,       // Iris center
  RIGHT_PUPIL: 473,      // Iris center
};

// MediaPipe HandLandmarker key indices
const HAND_LM = {
  WRIST: 0,
  THUMB_CMC: 1,
  INDEX_MCP: 5,
  MIDDLE_MCP: 9,
  RING_MCP: 13,
  PINKY_MCP: 17,
};

interface LiveCameraStudioProps {
  customWearable?: GeneratedWearable | null;
}

export const LiveCameraStudio: React.FC<LiveCameraStudioProps> = ({ customWearable }) => {
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [category, setCategory] = useState<'eyewear' | 'watch' | 'jewelry'>(
    customWearable?.category || 'eyewear'
  );
  const [eyewearModel, setEyewearModel] = useState<'aviator_glb' | 'wayfarer' | 'round' | 'cateye'>('aviator_glb');
  const [style, setStyle] = useState<'gold' | 'silver' | 'onyx' | 'neon'>('gold');
  const [fps, setFps] = useState<number>(60);
  const [scale, setScale] = useState<number>(1.0);
  const [bridgeOffset, setBridgeOffset] = useState<number>(0.0);
  const [depthOffset, setDepthOffset] = useState<number>(0.05);
  const [smoothingStrength, setSmoothingStrength] = useState<number>(0.35);
  const [statusText, setStatusText] = useState<string>('Ready • Click "Start Camera Try-On" below');
  const [showLandmarks, setShowLandmarks] = useState<boolean>(true);
  const [trackingEngine, setTrackingEngine] = useState<'mediapipe_gpu' | 'mediapipe_cpu' | 'standby'>('standby');
  const [loadedGlb, setLoadedGlb] = useState<boolean>(false);
  const [isWristDetected, setIsWristDetected] = useState<boolean>(false);

  const [telemetry, setTelemetry] = useState({
    metricA: '63.5 mm',
    metricALabel: 'IPD (PUPIL DIST)',
    rollDeg: 0,
    yawDeg: 0,
    pitchDeg: 0,
    landmarkCount: 478,
    trackingMode: 'MediaPipe 6-DoF AI',
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const debugCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Three.js refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraObjRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const modelRootRef = useRef<THREE.Group | null>(null);
  const glbSceneRef = useRef<THREE.Group | null>(null);

  // MediaPipe refs
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const handLandmarkerRef = useRef<HandLandmarker | null>(null);
  const filesetResolverRef = useRef<any>(null);
  const isInitializingRef = useRef<boolean>(false);
  const lastVideoTimeRef = useRef<number>(-1);

  // Transform filter ref
  const transformFilterRef = useRef<AdaptiveTransformFilter>(new AdaptiveTransformFilter());

  // Configuration ref for the 60fps render loop
  const configRef = useRef({
    scale,
    bridgeOffset,
    depthOffset,
    smoothingStrength,
    category,
    eyewearModel,
    style,
    showLandmarks,
    customWearable,
  });

  useEffect(() => {
    configRef.current = {
      scale,
      bridgeOffset,
      depthOffset,
      smoothingStrength,
      category,
      eyewearModel,
      style,
      showLandmarks,
      customWearable,
    };
  }, [scale, bridgeOffset, depthOffset, smoothingStrength, category, eyewearModel, style, showLandmarks, customWearable]);

  // Update category if customWearable changes
  useEffect(() => {
    if (customWearable) {
      setCategory(customWearable.category);
    }
  }, [customWearable]);

  // Load GLB 3D glasses asset once on mount
  useEffect(() => {
    const loader = new GLTFLoader();
    loader.load(
      '/models/glasses.glb',
      (gltf) => {
        glbSceneRef.current = gltf.scene;
        setLoadedGlb(true);
        console.log('[Try-On] 3D Aviator GLB asset loaded');
      },
      undefined,
      (err) => {
        console.warn('[Try-On] GLB load fallback to procedural model:', err);
      }
    );
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  /**
   * Initializes both FaceLandmarker & HandLandmarker for comprehensive coverage
   */
  const initMediaPipe = async () => {
    if (isInitializingRef.current) return;
    isInitializingRef.current = true;

    try {
      setStatusText('Initializing MediaPipe Vision AI engines...');

      if (!filesetResolverRef.current) {
        try {
          filesetResolverRef.current = await FilesetResolver.forVisionTasks('/wasm');
        } catch {
          filesetResolverRef.current = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm'
          );
        }
      }

      const fileset = filesetResolverRef.current;

      // 1. Initialize Face Landmarker (for Eyewear & Jewelry)
      if (!faceLandmarkerRef.current) {
        try {
          faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(fileset, {
            baseOptions: {
              modelAssetPath: '/models/face_landmarker.task',
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numFaces: 1,
            outputFacialTransformationMatrixes: true,
          });
          setTrackingEngine('mediapipe_gpu');
        } catch {
          faceLandmarkerRef.current = await FaceLandmarker.createFromOptions(fileset, {
            baseOptions: {
              modelAssetPath: '/models/face_landmarker.task',
              delegate: 'CPU',
            },
            runningMode: 'VIDEO',
            numFaces: 1,
            outputFacialTransformationMatrixes: true,
          });
          setTrackingEngine('mediapipe_cpu');
        }
      }

      // 2. Initialize Hand Landmarker (for Wristwatch fitting)
      if (!handLandmarkerRef.current) {
        try {
          handLandmarkerRef.current = await HandLandmarker.createFromOptions(fileset, {
            baseOptions: {
              modelAssetPath: '/models/hand_landmarker.task',
              delegate: 'GPU',
            },
            runningMode: 'VIDEO',
            numHands: 1,
          });
          console.log('[Try-On] HandLandmarker initialized for wrist tracking');
        } catch (handErr) {
          try {
            handLandmarkerRef.current = await HandLandmarker.createFromOptions(fileset, {
              baseOptions: {
                modelAssetPath: '/models/hand_landmarker.task',
                delegate: 'CPU',
              },
              runningMode: 'VIDEO',
              numHands: 1,
            });
          } catch (e) {
            console.warn('[Try-On] HandLandmarker fallback mode:', e);
          }
        }
      }
    } catch (err: any) {
      console.error('[Try-On] MediaPipe initialization error:', err);
    } finally {
      isInitializingRef.current = false;
    }
  };

  /**
   * Reconstructs 3D mesh objects with high-precision PBR materials
   */
  const rebuild3DModel = useCallback(() => {
    const root = modelRootRef.current;
    if (!root) return;

    const {
      category: cat,
      eyewearModel: eyeModel,
      style: st,
      scale: currentScale,
      customWearable: custom,
    } = configRef.current;

    // Clear existing model children
    while (root.children.length > 0) {
      const child = root.children[0];
      root.remove(child);
      if ((child as any).geometry) (child as any).geometry.dispose();
    }

    let metalColor = 0xd4af37; // 24k Gold
    let metalness = 0.9;
    let roughness = 0.18;

    if (custom) {
      metalColor = parseInt(custom.materials.frameColorHex.replace('#', '0x'), 16) || metalColor;
      metalness = custom.materials.metalness ?? metalness;
      roughness = custom.materials.roughness ?? roughness;
    } else if (st === 'silver') {
      metalColor = 0xe2e8f0; // Platinum Silver
      metalness = 0.95;
      roughness = 0.12;
    } else if (st === 'onyx') {
      metalColor = 0x18181b; // Obsidian Matte
      metalness = 0.55;
      roughness = 0.38;
    } else if (st === 'neon') {
      metalColor = 0x06b6d4; // Cyber Neon
      metalness = 0.4;
      roughness = 0.2;
    }

    const frameMat = new THREE.MeshStandardMaterial({
      color: metalColor,
      metalness,
      roughness,
    });

    const lensMat = new THREE.MeshPhysicalMaterial({
      color: st === 'neon' ? 0x06b6d4 : 0x0f172a,
      transmission: 0.8,
      transparent: true,
      opacity: 0.86,
      roughness: 0.06,
      reflectivity: 0.92,
      ior: 1.5,
    });

    if (cat === 'eyewear') {
      // Option A: Aviator 3D GLB
      if (eyeModel === 'aviator_glb' && glbSceneRef.current && !custom) {
        const glbClone = glbSceneRef.current.clone();

        glbClone.traverse((obj: any) => {
          if (obj.isMesh) {
            const meshName = (obj.name || '').toLowerCase();
            if (meshName.includes('lens') || meshName.includes('glass')) {
              obj.material = lensMat;
            } else {
              obj.material = frameMat;
            }
          }
        });

        glbClone.scale.setScalar(0.014);
        root.add(glbClone);
      } else {
        const group = new THREE.Group();
        const rimShape = custom?.geometry.rimShape || eyeModel;

        if (rimShape === 'wayfarer') {
          // Wayfarer bold rectangular geometry
          const leftRim = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.68, 0.08), frameMat);
          leftRim.position.set(-0.52, 0, 0);
          group.add(leftRim);

          const leftLens = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.56, 0.04), lensMat);
          leftLens.position.set(-0.52, 0, 0.02);
          group.add(leftLens);

          const rightRim = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.68, 0.08), frameMat);
          rightRim.position.set(0.52, 0, 0);
          group.add(rightRim);

          const rightLens = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.56, 0.04), lensMat);
          rightLens.position.set(0.52, 0, 0.02);
          group.add(rightLens);

          const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.08), frameMat);
          bridge.position.set(0, 0.12, 0);
          group.add(bridge);
        } else if (rimShape === 'round') {
          // Vintage Round Wire Frames
          const lensGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.03, 36);
          lensGeo.rotateX(Math.PI / 2);
          const leftLens = new THREE.Mesh(lensGeo, lensMat);
          leftLens.position.set(-0.54, 0, 0);
          group.add(leftLens);

          const rightLens = new THREE.Mesh(lensGeo, lensMat);
          rightLens.position.set(0.54, 0, 0);
          group.add(rightLens);

          const rimGeo = new THREE.TorusGeometry(0.43, 0.025, 16, 48);
          const leftRim = new THREE.Mesh(rimGeo, frameMat);
          leftRim.position.set(-0.54, 0, 0);
          group.add(leftRim);

          const rightRim = new THREE.Mesh(rimGeo, frameMat);
          rightRim.position.set(0.54, 0, 0);
          group.add(rightRim);

          const bridgeGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.34, 16);
          bridgeGeo.rotateZ(Math.PI / 2);
          const bridge = new THREE.Mesh(bridgeGeo, frameMat);
          bridge.position.set(0, 0.08, 0);
          group.add(bridge);
        } else {
          // Teardrop Aviator Double-Bridge
          const lensGeo = new THREE.CylinderGeometry(0.45, 0.38, 0.03, 32);
          lensGeo.rotateX(Math.PI / 2);
          const leftLens = new THREE.Mesh(lensGeo, lensMat);
          leftLens.position.set(-0.52, -0.04, 0);
          group.add(leftLens);

          const rightLens = new THREE.Mesh(lensGeo, lensMat);
          rightLens.position.set(0.52, -0.04, 0);
          group.add(rightLens);

          const rimGeo = new THREE.TorusGeometry(0.44, 0.028, 16, 48);
          const leftRim = new THREE.Mesh(rimGeo, frameMat);
          leftRim.position.set(-0.52, -0.04, 0);
          group.add(leftRim);

          const rightRim = new THREE.Mesh(rimGeo, frameMat);
          rightRim.position.set(0.52, -0.04, 0);
          group.add(rightRim);

          // Top Brow Bar
          const browGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.25, 16);
          browGeo.rotateZ(Math.PI / 2);
          const brow = new THREE.Mesh(browGeo, frameMat);
          brow.position.set(0, 0.36, 0);
          group.add(brow);

          // Nose Bridge
          const bridgeGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.34, 16);
          bridgeGeo.rotateZ(Math.PI / 2);
          const bridge = new THREE.Mesh(bridgeGeo, frameMat);
          bridge.position.set(0, 0.08, 0);
          group.add(bridge);
        }

        // Temples (Sides angling back to ears)
        const templeGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.35, 16);
        templeGeo.rotateX(Math.PI / 2);

        const leftTemple = new THREE.Mesh(templeGeo, frameMat);
        leftTemple.position.set(-0.95, 0.05, -0.68);
        leftTemple.rotation.y = -0.08;
        group.add(leftTemple);

        const rightTemple = new THREE.Mesh(templeGeo, frameMat);
        rightTemple.position.set(0.95, 0.05, -0.68);
        rightTemple.rotation.y = 0.08;
        group.add(rightTemple);

        root.add(group);
      }
    } else if (cat === 'watch') {
      // Wristwatch with full 3D bezel, dial, and curved wrist strap
      const group = new THREE.Group();

      const caseGeo = new THREE.CylinderGeometry(0.58, 0.58, 0.12, 36);
      const watchCase = new THREE.Mesh(caseGeo, frameMat);
      group.add(watchCase);

      const dialGeo = new THREE.CylinderGeometry(0.50, 0.50, 0.02, 32);
      const dialMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.25 });
      const dial = new THREE.Mesh(dialGeo, dialMat);
      dial.position.y = 0.06;
      group.add(dial);

      const bezelGeo = new THREE.TorusGeometry(0.52, 0.04, 16, 40);
      bezelGeo.rotateX(Math.PI / 2);
      const bezel = new THREE.Mesh(bezelGeo, frameMat);
      bezel.position.y = 0.07;
      group.add(bezel);

      // Curved wristband wrapping around arm
      const bandMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.85 });
      const bandCurveGeo = new THREE.TorusGeometry(0.68, 0.14, 16, 32, Math.PI * 1.2);
      bandCurveGeo.rotateZ(Math.PI * 0.4);
      const bandMesh = new THREE.Mesh(bandCurveGeo, bandMat);
      bandMesh.position.y = -0.15;
      group.add(bandMesh);

      // Rotate watch dial to face upwards from wrist plane
      group.rotation.x = Math.PI / 2;
      root.add(group);
    } else {
      // Luxury Diamond / Gemstone Pendant
      const group = new THREE.Group();
      const gemGeo = new THREE.OctahedronGeometry(0.48);
      const gemMat = new THREE.MeshPhysicalMaterial({
        color: st === 'neon' ? 0x06b6d4 : 0x38bdf8,
        transmission: 0.92,
        transparent: true,
        opacity: 0.92,
        roughness: 0.05,
        reflectivity: 0.95,
      });
      group.add(new THREE.Mesh(gemGeo, gemMat));

      const bail = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.04, 16, 32), frameMat);
      bail.position.set(0, 0.54, 0);
      group.add(bail);

      // Chain loops hanging from neck
      const chainGeo = new THREE.TorusGeometry(0.65, 0.015, 12, 48);
      chainGeo.rotateX(Math.PI / 2);
      const chain = new THREE.Mesh(chainGeo, frameMat);
      chain.position.set(0, 0.65, 0);
      group.add(chain);

      root.add(group);
    }

    root.scale.setScalar(currentScale);
  }, []);

  useEffect(() => {
    rebuild3DModel();
  }, [category, eyewearModel, style, scale, loadedGlb, customWearable, rebuild3DModel]);

  /**
   * Draws Snapchat-style 2D mesh on debug canvas
   */
  const drawFaceMesh = (landmarks: any[], ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const toPx = (lm: any) => ({
      x: (1.0 - lm.x) * width,
      y: lm.y * height,
    });

    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.lineWidth = 1;

    // Eye contours
    const leftEyeIdxs = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246, 33];
    const rightEyeIdxs = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466, 263];

    const drawPath = (idxs: number[], strokeStyle: string) => {
      ctx.beginPath();
      idxs.forEach((idx, i) => {
        const pt = landmarks[idx];
        if (pt) {
          const px = toPx(pt);
          if (i === 0) ctx.moveTo(px.x, px.y);
          else ctx.lineTo(px.x, px.y);
        }
      });
      ctx.strokeStyle = strokeStyle;
      ctx.stroke();
    };

    drawPath(leftEyeIdxs, 'rgba(56, 189, 248, 0.5)');
    drawPath(rightEyeIdxs, 'rgba(56, 189, 248, 0.5)');

    // Nose Ridge
    drawPath([168, 6, 197, 195, 5, 4, 1], 'rgba(251, 191, 36, 0.6)');

    // Glabella Anchor Crosshair
    const anchor = landmarks[LM.NOSE_BRIDGE];
    if (anchor) {
      const aPx = toPx(anchor);
      ctx.beginPath();
      ctx.arc(aPx.x, aPx.y, 14, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.85)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(aPx.x - 16, aPx.y);
      ctx.lineTo(aPx.x + 16, aPx.y);
      ctx.moveTo(aPx.x, aPx.y - 16);
      ctx.lineTo(aPx.x, aPx.y + 16);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(aPx.x + 18, aPx.y - 14, 110, 18);
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 1;
      ctx.strokeRect(aPx.x + 18, aPx.y - 14, 110, 18);
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('NOSE BRIDGE [168]', aPx.x + 22, aPx.y - 1);
    }

    ctx.restore();
  };

  /**
   * Draws Hand/Wrist Tracking skeleton on debug canvas for Watch try-on
   */
  const drawHandSkeleton = (handLandmarks: any[], ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const toPx = (lm: any) => ({
      x: (1.0 - lm.x) * width,
      y: lm.y * height,
    });

    ctx.save();

    // Draw palm bones
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.6)';
    ctx.lineWidth = 2;

    const wrist = handLandmarks[0];
    const knuckles = [5, 9, 13, 17];

    if (wrist) {
      const wPx = toPx(wrist);
      knuckles.forEach((kIdx) => {
        const k = handLandmarks[kIdx];
        if (k) {
          const kPx = toPx(k);
          ctx.beginPath();
          ctx.moveTo(wPx.x, wPx.y);
          ctx.lineTo(kPx.x, kPx.y);
          ctx.stroke();
        }
      });

      // Wrist Watch Placement Ring
      ctx.beginPath();
      ctx.arc(wPx.x, wPx.y, 22, 0, Math.PI * 2);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(wPx.x + 26, wPx.y - 14, 100, 18);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 1;
      ctx.strokeRect(wPx.x + 26, wPx.y - 14, 100, 18);
      ctx.fillStyle = '#34d399';
      ctx.font = 'bold 9px monospace';
      ctx.fillText('WRIST JOINT [0]', wPx.x + 30, wPx.y - 1);
    }

    ctx.restore();
  };

  /**
   * Starts the Camera and 60 FPS Snapchat-style AR render loop
   */
  const startCamera = async () => {
    try {
      setStatusText('Requesting webcam access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          facingMode: 'user',
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsCameraActive(true);
      transformFilterRef.current.reset();

      // Initialize MediaPipe Engines
      await initMediaPipe();

      // Initialize Three.js viewport
      if (canvasRef.current && !rendererRef.current) {
        const width = canvasRef.current.clientWidth || 640;
        const height = canvasRef.current.clientHeight || 480;

        const scene = new THREE.Scene();
        sceneRef.current = scene;

        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
        camera.position.set(0, 0, 3.8);
        cameraObjRef.current = camera;

        const renderer = new THREE.WebGLRenderer({
          canvas: canvasRef.current,
          alpha: true,
          antialias: true,
          preserveDrawingBuffer: true,
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        rendererRef.current = renderer;

        const ambient = new THREE.AmbientLight(0xffffff, 1.4);
        scene.add(ambient);

        const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.8);
        keyLight.position.set(3, 4, 3);
        scene.add(keyLight);

        const fillLight = new THREE.DirectionalLight(0x60a5fa, 1.0);
        fillLight.position.set(-3, -2, 2);
        scene.add(fillLight);

        const rimLight = new THREE.DirectionalLight(0xc084fc, 0.8);
        rimLight.position.set(0, -3, -2);
        scene.add(rimLight);

        const modelRoot = new THREE.Group();
        scene.add(modelRoot);
        modelRootRef.current = modelRoot;

        rebuild3DModel();
      }

      setStatusText('🟢 Active • Real-Time Wearable Fitting');

      // 60 FPS Render & Tracking loop
      let lastTime = performance.now();
      let frames = 0;

      const loop = (currentTime: number) => {
        animFrameRef.current = requestAnimationFrame(loop);

        frames++;
        if (currentTime - lastTime >= 1000) {
          setFps(frames);
          frames = 0;
          lastTime = currentTime;
        }

        const video = videoRef.current;
        const modelRoot = modelRootRef.current;
        const debugCanvas = debugCanvasRef.current;
        const faceLM = faceLandmarkerRef.current;
        const handLM = handLandmarkerRef.current;

        if (video && video.readyState >= 2 && modelRoot) {
          const currentConfig = configRef.current;
          const nowMs = performance.now();

          // Camera Frustum dimensions for unprojection
          const fovRad = (45 * Math.PI) / 180;
          const camDist = 3.8;
          const visibleHalfH = camDist * Math.tan(fovRad / 2);
          const canvasW = canvasRef.current?.clientWidth || 640;
          const canvasH = canvasRef.current?.clientHeight || 480;
          const aspect = canvasW / Math.max(1, canvasH);
          const visibleHalfW = visibleHalfH * aspect;

          if (debugCanvas) {
            if (debugCanvas.width !== video.videoWidth || debugCanvas.height !== video.videoHeight) {
              debugCanvas.width = video.videoWidth;
              debugCanvas.height = video.videoHeight;
            }
            const dctx = debugCanvas.getContext('2d');
            if (dctx) dctx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
          }

          // Case 1: Watch Try-On -> Hand / Wrist Tracking
          if (currentConfig.category === 'watch') {
            let wristFound = false;

            if (handLM && nowMs > lastVideoTimeRef.current) {
              lastVideoTimeRef.current = nowMs;
              try {
                const handResults = handLM.detectForVideo(video, nowMs);

                if (handResults.landmarks && handResults.landmarks.length > 0) {
                  wristFound = true;
                  const hand = handResults.landmarks[0];
                  const wrist = hand[HAND_LM.WRIST];
                  const middleMcp = hand[HAND_LM.MIDDLE_MCP];
                  const indexMcp = hand[HAND_LM.INDEX_MCP];
                  const pinkyMcp = hand[HAND_LM.PINKY_MCP];

                  // Mirrored NDC coordinates
                  const ndcX = 1.0 - 2.0 * wrist.x;
                  const ndcY = 1.0 - 2.0 * (wrist.y + currentConfig.bridgeOffset * 0.1);

                  const targetWorldX = ndcX * visibleHalfW;
                  const targetWorldY = ndcY * visibleHalfH;

                  // Forearm scale ratio from knuckle to wrist span
                  const palmSpan = Math.hypot(middleMcp.x - wrist.x, middleMcp.y - wrist.y);
                  const targetWorldZ = (palmSpan / 0.22 - 1.0) * 1.5 + currentConfig.depthOffset;

                  // Dynamic model scale
                  const dynamicScale = currentConfig.scale * (palmSpan / 0.2) * 1.05;
                  modelRoot.scale.setScalar(dynamicScale);

                  // Forearm angle calculations
                  const fX = (1.0 - wrist.x) - (1.0 - middleMcp.x);
                  const fY = -(wrist.y - middleMcp.y);
                  const armRoll = Math.atan2(fY, fX) - Math.PI / 2;

                  const lZ = (pinkyMcp.z - indexMcp.z) * 1.5;
                  const wristTilt = Math.atan2(lZ, Math.hypot(pinkyMcp.x - indexMcp.x, pinkyMcp.y - indexMcp.y));

                  const targetPos = new THREE.Vector3(targetWorldX, targetWorldY, targetWorldZ);
                  const targetRot = new THREE.Euler(Math.PI / 2 + wristTilt * 0.5, 0, armRoll, 'YXZ');

                  const filtered = transformFilterRef.current.filter(
                    targetPos,
                    targetRot,
                    currentConfig.smoothingStrength
                  );
                  modelRoot.position.copy(filtered.pos);
                  modelRoot.rotation.copy(filtered.rot);

                  // Draw hand skeleton
                  if (debugCanvas && currentConfig.showLandmarks) {
                    const dctx = debugCanvas.getContext('2d');
                    if (dctx) drawHandSkeleton(hand, dctx, debugCanvas.width, debugCanvas.height);
                  }

                  setTelemetry({
                    metricA: `${Math.round(palmSpan * 1000) / 10} mm`,
                    metricALabel: 'WRIST BREADTH',
                    rollDeg: Math.round(armRoll * (180 / Math.PI)),
                    yawDeg: 0,
                    pitchDeg: Math.round(wristTilt * (180 / Math.PI)),
                    landmarkCount: 21,
                    trackingMode: 'MediaPipe Wrist Joint [0]',
                  });
                }
              } catch (hErr) {
                console.warn('Hand tracking frame err:', hErr);
              }
            }

            setIsWristDetected(wristFound);

            // If hand is not in view, park watch in friendly preview position
            if (!wristFound) {
              const previewPos = new THREE.Vector3(0, -0.65, 0.4);
              const previewRot = new THREE.Euler(Math.PI / 3, 0, 0, 'YXZ');
              const filtered = transformFilterRef.current.filter(previewPos, previewRot, 0.1);
              modelRoot.position.copy(filtered.pos);
              modelRoot.rotation.copy(filtered.rot);
              modelRoot.scale.setScalar(currentConfig.scale * 1.1);

              setTelemetry((prev) => ({
                ...prev,
                trackingMode: 'Show wrist to camera',
              }));
            }
          }
          // Case 2: Eyewear or Jewelry -> 478-Point Face Tracking
          else if (faceLM && nowMs > lastVideoTimeRef.current) {
            lastVideoTimeRef.current = nowMs;
            try {
              const results = faceLM.detectForVideo(video, nowMs);

              if (results.faceLandmarks && results.faceLandmarks.length > 0) {
                const landmarks = results.faceLandmarks[0];

                const noseBridge = landmarks[LM.NOSE_BRIDGE] || landmarks[LM.MID_NOSE];
                const leftEye = landmarks[LM.LEFT_EYE_OUTER];
                const rightEye = landmarks[LM.RIGHT_EYE_OUTER];
                const forehead = landmarks[LM.FOREHEAD];
                const chin = landmarks[LM.CHIN];
                const leftCheek = landmarks[LM.LEFT_CHEEK];
                const rightCheek = landmarks[LM.RIGHT_CHEEK];
                const noseTip = landmarks[LM.NOSE_TIP];
                const leftPupil = landmarks[LM.LEFT_PUPIL] || landmarks[LM.LEFT_EYE_INNER];
                const rightPupil = landmarks[LM.RIGHT_PUPIL] || landmarks[LM.RIGHT_EYE_INNER];

                // Debug face mesh
                if (debugCanvas && currentConfig.showLandmarks) {
                  const dctx = debugCanvas.getContext('2d');
                  if (dctx) drawFaceMesh(landmarks, dctx, debugCanvas.width, debugCanvas.height);
                }

                // Coordinate Anchors
                let anchorX = 1.0 - 2.0 * noseBridge.x;
                let anchorY = 1.0 - 2.0 * (noseBridge.y + currentConfig.bridgeOffset * 0.1);

                if (currentConfig.category === 'jewelry') {
                  // Pendant hangs at suprasternal notch below chin
                  anchorY = 1.0 - 2.0 * Math.min(0.96, chin.y + (chin.y - forehead.y) * 0.28);
                }

                const targetWorldX = anchorX * visibleHalfW;
                const targetWorldY = anchorY * visibleHalfH;

                // Scale from physical Inter-Pupillary Distance (IPD)
                const eyeDist = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y);
                const nominalEyeSpan = 0.24;
                const distanceRatio = Math.max(0.55, Math.min(2.0, eyeDist / nominalEyeSpan));
                const targetWorldZ = (distanceRatio - 1.0) * 1.6 + currentConfig.depthOffset;

                const dynamicScale = currentConfig.scale * distanceRatio;
                modelRoot.scale.setScalar(dynamicScale);

                // 6-DoF Head Angles:
                const rollAngleRad = -Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);

                const depthDelta = (rightEye.z - leftEye.z) * 1.8;
                const lateralSpan = Math.max(0.001, rightEye.x - leftEye.x);
                const rawYaw = Math.atan2(depthDelta, lateralSpan);

                const dxL = Math.abs(noseBridge.x - leftCheek.x);
                const dxR = Math.abs(rightCheek.x - noseBridge.x);
                const cheekAsymm = (dxL - dxR) / Math.max(0.001, dxL + dxR);
                const yawAngleRad = Math.max(-0.85, Math.min(0.85, -(rawYaw * 0.6 + cheekAsymm * 0.8)));

                const faceHeight = Math.max(0.01, chin.y - forehead.y);
                const eyeCenterY = (leftEye.y + rightEye.y) / 2;
                const noseRelPos = (noseTip.y - eyeCenterY) / faceHeight;
                const depthPitch = (chin.z - forehead.z) * 1.4;
                const pitchAngleRad = Math.max(-0.6, Math.min(0.6, (noseRelPos - 0.22) * 2.2 + depthPitch));

                const rollDeg = Math.round(rollAngleRad * (180 / Math.PI));
                const yawDeg = Math.round(yawAngleRad * (180 / Math.PI));
                const pitchDeg = Math.round(pitchAngleRad * (180 / Math.PI));
                const ipdMm = Math.round(63.5 * distanceRatio * 10) / 10;

                setTelemetry({
                  metricA: `${ipdMm} mm`,
                  metricALabel: 'IPD (PUPIL DIST)',
                  rollDeg,
                  yawDeg,
                  pitchDeg,
                  landmarkCount: landmarks.length,
                  trackingMode: 'MediaPipe 478 Mesh (GPU)',
                });

                const targetPos = new THREE.Vector3(targetWorldX, targetWorldY, targetWorldZ);
                const targetRot = new THREE.Euler(pitchAngleRad, yawAngleRad, rollAngleRad, 'YXZ');

                const filtered = transformFilterRef.current.filter(
                  targetPos,
                  targetRot,
                  currentConfig.smoothingStrength
                );
                modelRoot.position.copy(filtered.pos);
                modelRoot.rotation.copy(filtered.rot);
              }
            } catch (fErr) {
              console.warn('Face tracking frame err:', fErr);
            }
          }
        }

        // Render Three.js frame
        if (rendererRef.current && sceneRef.current && cameraObjRef.current) {
          rendererRef.current.render(sceneRef.current, cameraObjRef.current);
        }
      };

      animFrameRef.current = requestAnimationFrame(loop);
    } catch (err: any) {
      console.error(err);
      setStatusText('Camera Error: ' + err.message);
    }
  };

  const stopCamera = () => {
    if (animFrameRef.current !== null) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    if (debugCanvasRef.current) {
      const dctx = debugCanvasRef.current.getContext('2d');
      if (dctx) dctx.clearRect(0, 0, debugCanvasRef.current.width, debugCanvasRef.current.height);
    }
    transformFilterRef.current.reset();
    setIsCameraActive(false);
    setStatusText('Ready • Click "Start Camera Try-On" below');
  };

  const takeSnapshot = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = canvas.width;
    snapCanvas.height = canvas.height;
    const ctx = snapCanvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(video, -snapCanvas.width, 0, snapCanvas.width, snapCanvas.height);
    ctx.restore();

    ctx.drawImage(canvas, 0, 0);

    const link = document.createElement('a');
    link.download = `snapchat-quality-tryon-${category}-${Date.now()}.png`;
    link.href = snapCanvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2.5 py-1 rounded-full border border-cyan-500/20 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" /> High-Accuracy Fitting • Face Mesh [168] & Wrist Joint [0]
          </span>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            <ShieldCheck className="w-3.5 h-3.5" />
            {category === 'watch' ? 'MediaPipe HandLandmarker' : 'MediaPipe FaceLandmarker'}
          </span>
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Anatomical 3D Virtual Try-On Studio
        </h2>
        <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
          Sunglasses lock to the glabella nose bridge and pupil line; watches fit directly onto your physical wrist joint via hand landmark detection; jewelry suspends from the collarbone notch.
        </p>

        {customWearable && (
          <div className="mt-3 p-3 rounded-xl bg-indigo-900/30 border border-indigo-700/40 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span className="text-xs font-semibold text-white">
                Active AI Wearable: <span className="text-cyan-300">{customWearable.name}</span>
              </span>
            </div>
            <span className="text-[10px] font-mono text-indigo-300 bg-indigo-950 px-2 py-0.5 rounded border border-indigo-800">
              {customWearable.sku}
            </span>
          </div>
        )}
      </div>

      {/* Main Viewport & Controls Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Camera Viewport (2 cols) */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden shadow-2xl flex flex-col">
          {/* Viewport Header */}
          <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={`w-2.5 h-2.5 rounded-full ${isCameraActive ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-600'}`} />
              <span className="text-xs font-medium text-slate-300">{statusText}</span>
            </div>
            {isCameraActive && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowLandmarks(!showLandmarks)}
                  className={`text-xs font-medium px-2.5 py-1 rounded border transition flex items-center gap-1.5 cursor-pointer ${
                    showLandmarks
                      ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                  title="Toggle Face / Hand Tracking Mesh"
                >
                  <Eye className="w-3 h-3" />
                  {showLandmarks ? 'Mesh ON' : 'Mesh OFF'}
                </button>
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded">
                  {fps} FPS
                </span>
              </div>
            )}
          </div>

          {/* Video + WebGL Canvas + Debug Landmarks Stack */}
          <div className="relative aspect-[4/3] w-full bg-slate-950 flex items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover -scale-x-100 ${isCameraActive ? 'block' : 'hidden'}`}
            />
            {/* 3D WebGL Layer */}
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 w-full h-full pointer-events-none ${isCameraActive ? 'block' : 'hidden'}`}
            />
            {/* 2D Landmark Mesh Debug Layer */}
            <canvas
              ref={debugCanvasRef}
              className={`absolute inset-0 w-full h-full pointer-events-none ${isCameraActive && showLandmarks ? 'block' : 'hidden'}`}
            />

            {/* Watch Guide Prompt when in Watch mode and wrist not yet detected */}
            {isCameraActive && category === 'watch' && !isWristDetected && (
              <div className="absolute top-4 inset-x-4 mx-auto max-w-sm px-4 py-2.5 rounded-xl bg-slate-900/90 backdrop-blur border border-indigo-500/30 text-white text-xs font-medium text-center shadow-lg flex items-center justify-center gap-2 animate-bounce">
                <Hand className="w-4 h-4 text-emerald-400" />
                <span>👋 Hold your hand or wrist up to the camera to wear the watch!</span>
              </div>
            )}

            {!isCameraActive && (
              <div className="text-center p-8 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
                  <Camera className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-white">Camera Standby</h3>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Click the button below to start live tracking. Eyewear locks to your nose bridge & pupil line; watches lock to your physical wrist!
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Viewport Bottom Action Bar */}
          <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center gap-3">
            {!isCameraActive ? (
              <button
                onClick={startCamera}
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition shadow-lg shadow-emerald-900/30 cursor-pointer"
              >
                <Video className="w-4 h-4" />
                Start Camera Try-On
              </button>
            ) : (
              <>
                <button
                  onClick={stopCamera}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm transition cursor-pointer"
                >
                  <VideoOff className="w-4 h-4" />
                  Stop Camera
                </button>
                <button
                  onClick={takeSnapshot}
                  className="flex items-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition border border-slate-700 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Snapshot
                </button>
              </>
            )}
          </div>
        </div>

        {/* Controls & Configuration Sidebar (1 col) */}
        <div className="space-y-5">
          {/* Live Telemetry Panel */}
          {isCameraActive && (
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-400" />
                  Tracking Telemetry
                </h3>
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                  {telemetry.landmarkCount} Points
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-500">{telemetry.metricALabel}</div>
                  <div className="text-sm font-bold text-white">{telemetry.metricA}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-500">HEAD / ARM ROLL</div>
                  <div className="text-sm font-bold text-cyan-400">{telemetry.rollDeg > 0 ? `+${telemetry.rollDeg}` : telemetry.rollDeg}°</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-500">HEAD YAW</div>
                  <div className="text-sm font-bold text-amber-400">{telemetry.yawDeg > 0 ? `+${telemetry.yawDeg}` : telemetry.yawDeg}°</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                  <div className="text-[10px] text-slate-500">HEAD / HAND PITCH</div>
                  <div className="text-sm font-bold text-indigo-400">{telemetry.pitchDeg > 0 ? `+${telemetry.pitchDeg}` : telemetry.pitchDeg}°</div>
                </div>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center justify-between pt-1">
                <span>Active Target:</span>
                <span className="text-cyan-400 font-mono font-medium">{telemetry.trackingMode}</span>
              </div>
            </div>
          )}

          {/* Category Switcher */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Item Category</h3>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => setCategory('eyewear')}
                className={`p-3 rounded-xl text-xs font-semibold flex flex-col items-center gap-2 border transition cursor-pointer ${
                  category === 'eyewear'
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/30'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Glasses className="w-5 h-5" />
                <span>Eyewear</span>
              </button>
              <button
                onClick={() => setCategory('watch')}
                className={`p-3 rounded-xl text-xs font-semibold flex flex-col items-center gap-2 border transition cursor-pointer ${
                  category === 'watch'
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/30'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Watch className="w-5 h-5" />
                <span>Wristwatch</span>
              </button>
              <button
                onClick={() => setCategory('jewelry')}
                className={`p-3 rounded-xl text-xs font-semibold flex flex-col items-center gap-2 border transition cursor-pointer ${
                  category === 'jewelry'
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/30'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Gem className="w-5 h-5" />
                <span>Pendant</span>
              </button>
            </div>
          </div>

          {/* Eyewear Model Selector (when in eyewear mode) */}
          {category === 'eyewear' && (
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">3D Frame Silhouette</h3>
                {loadedGlb && <span className="text-[10px] font-mono text-emerald-400">GLB Ready</span>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'aviator_glb', name: 'Aviator 3D GLB', desc: 'Loaded GLTF Asset' },
                  { id: 'wayfarer', name: 'Wayfarer Acetate', desc: 'Thick Modern Rim' },
                  { id: 'round', name: 'Round Retro Wire', desc: 'Classic Wire Frame' },
                  { id: 'cateye', name: 'Aviator Classic', desc: 'Teardrop Double-Bridge' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setEyewearModel(m.id as any)}
                    className={`p-2.5 rounded-xl text-left border transition cursor-pointer ${
                      eyewearModel === m.id
                        ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-inner'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="text-xs font-semibold">{m.name}</div>
                    <div className="text-[10px] text-slate-500">{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Finish / Material */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Material & Finish</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'gold', name: 'Titanium Gold', color: '#eab308' },
                { id: 'silver', name: 'Platinum Silver', color: '#cbd5e1' },
                { id: 'onyx', name: 'Matte Obsidian', color: '#27272a' },
                { id: 'neon', name: 'Cyber Neon', color: '#06b6d4' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setStyle(item.id as any)}
                  className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 border transition cursor-pointer ${
                    style === item.id
                      ? 'bg-slate-800 border-indigo-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0" style={{ backgroundColor: item.color }} />
                  <span>{item.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Fitting Calibration Sliders */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              Fit & Calibration Controls
            </h3>

            {/* Fit Scale Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-400">Size / Width Scale</span>
                <span className="text-cyan-400 font-mono">{Math.round(scale * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.7"
                max="1.4"
                step="0.02"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>

            {/* Bridge Y Offset Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-400">Vertical Offset (Y)</span>
                <span className="text-amber-400 font-mono">{bridgeOffset > 0 ? `+${bridgeOffset}` : bridgeOffset}</span>
              </div>
              <input
                type="range"
                min="-0.15"
                max="0.15"
                step="0.01"
                value={bridgeOffset}
                onChange={(e) => setBridgeOffset(parseFloat(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer"
              />
            </div>

            {/* Depth Z Offset Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-400">Face / Wrist Depth (Z)</span>
                <span className="text-indigo-400 font-mono">{depthOffset > 0 ? `+${depthOffset}` : depthOffset}</span>
              </div>
              <input
                type="range"
                min="-0.1"
                max="0.25"
                step="0.01"
                value={depthOffset}
                onChange={(e) => setDepthOffset(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 cursor-pointer"
              />
            </div>

            {/* Smoothing Response Slider */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-400">Adaptive Jitter Filter</span>
                <span className="text-emerald-400 font-mono">
                  {smoothingStrength < 0.25 ? 'Ultra-Responsive' : smoothingStrength > 0.45 ? 'Cinematic Smooth' : 'Snapchat Balanced'}
                </span>
              </div>
              <input
                type="range"
                min="0.15"
                max="0.6"
                step="0.05"
                value={smoothingStrength}
                onChange={(e) => setSmoothingStrength(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
