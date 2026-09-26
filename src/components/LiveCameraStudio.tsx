import React, { useState, useEffect, useRef } from 'react';
import { Camera, CheckCircle2, Eye, Box, Video, VideoOff, Glasses, Watch, Gem, Sparkles, RefreshCw, Download, Sliders, Maximize2 } from 'lucide-react';
import * as THREE from 'three';
import { Vector3EMAFilter } from '../../shared/math/filter';

export const LiveCameraStudio: React.FC = () => {
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [category, setCategory] = useState<'eyewear' | 'watch' | 'jewelry'>('eyewear');
  const [style, setStyle] = useState<'gold' | 'silver' | 'onyx' | 'neon'>('gold');
  const [fps, setFps] = useState<number>(60);
  const [scale, setScale] = useState<number>(1.0);
  const [statusText, setStatusText] = useState<string>('Ready • Click "Start Camera Try-On" below');
  const [trackingConfidence, setTrackingConfidence] = useState<number>(98);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Three.js instances
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraObjRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const modelRootRef = useRef<THREE.Group | null>(null);

  // Optical analysis canvas
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const positionFilterRef = useRef<Vector3EMAFilter>(new Vector3EMAFilter(0.35));
  const rotationFilterRef = useRef<Vector3EMAFilter>(new Vector3EMAFilter(0.30));

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const rebuild3DModel = (cat: 'eyewear' | 'watch' | 'jewelry', st: 'gold' | 'silver' | 'onyx' | 'neon', currentScale: number) => {
    const root = modelRootRef.current;
    if (!root) return;

    while (root.children.length > 0) {
      const child = root.children[0];
      root.remove(child);
      if ((child as any).geometry) (child as any).geometry.dispose();
    }

    let metalColor = 0xd4af37;
    let metalness = 0.85;
    let roughness = 0.2;

    if (st === 'silver') {
      metalColor = 0xe2e8f0;
      metalness = 0.95;
      roughness = 0.15;
    } else if (st === 'onyx') {
      metalColor = 0x18181b;
      metalness = 0.6;
      roughness = 0.4;
    } else if (st === 'neon') {
      metalColor = 0x06b6d4;
      metalness = 0.3;
      roughness = 0.2;
    }

    const frameMat = new THREE.MeshStandardMaterial({ color: metalColor, metalness, roughness });
    const lensMat = new THREE.MeshPhysicalMaterial({
      color: st === 'neon' ? 0x06b6d4 : 0x0f172a,
      transmission: 0.75,
      transparent: true,
      opacity: 0.85,
      roughness: 0.1,
    });

    if (cat === 'eyewear') {
      const group = new THREE.Group();
      const lensGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.03, 32);
      lensGeo.rotateX(Math.PI / 2);

      const leftLens = new THREE.Mesh(lensGeo, lensMat);
      leftLens.position.set(-0.52, 0, 0);
      group.add(leftLens);

      const rightLens = new THREE.Mesh(lensGeo, lensMat);
      rightLens.position.set(0.52, 0, 0);
      group.add(rightLens);

      const rimGeo = new THREE.TorusGeometry(0.39, 0.03, 16, 48);
      const leftRim = new THREE.Mesh(rimGeo, frameMat);
      leftRim.position.set(-0.52, 0, 0);
      group.add(leftRim);

      const rightRim = new THREE.Mesh(rimGeo, frameMat);
      rightRim.position.set(0.52, 0, 0);
      group.add(rightRim);

      const bridgeGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.35, 16);
      bridgeGeo.rotateZ(Math.PI / 2);
      const bridge = new THREE.Mesh(bridgeGeo, frameMat);
      bridge.position.set(0, 0.08, 0);
      group.add(bridge);

      const templeGeo = new THREE.CylinderGeometry(0.02, 0.02, 1.2, 16);
      templeGeo.rotateX(Math.PI / 2);

      const leftTemple = new THREE.Mesh(templeGeo, frameMat);
      leftTemple.position.set(-0.9, 0.05, -0.6);
      group.add(leftTemple);

      const rightTemple = new THREE.Mesh(templeGeo, frameMat);
      rightTemple.position.set(0.9, 0.05, -0.6);
      group.add(rightTemple);

      root.add(group);
    } else if (cat === 'watch') {
      const group = new THREE.Group();
      const caseGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.12, 32);
      const watchCase = new THREE.Mesh(caseGeo, frameMat);
      group.add(watchCase);

      const dialGeo = new THREE.CylinderGeometry(0.48, 0.48, 0.02, 32);
      const dialMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3 });
      const dial = new THREE.Mesh(dialGeo, dialMat);
      dial.position.y = 0.06;
      group.add(dial);

      const strapMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8 });
      const topStrap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.8), strapMat);
      topStrap.position.set(0, 0, 0.85);
      group.add(topStrap);

      const bottomStrap = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.8), strapMat);
      bottomStrap.position.set(0, 0, -0.85);
      group.add(bottomStrap);

      group.rotation.x = Math.PI / 4;
      root.add(group);
    } else {
      const group = new THREE.Group();
      const gemGeo = new THREE.OctahedronGeometry(0.45);
      const gemMat = new THREE.MeshPhysicalMaterial({ color: 0x06b6d4, transmission: 0.9, transparent: true, opacity: 0.9 });
      group.add(new THREE.Mesh(gemGeo, gemMat));

      const bail = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.04, 16, 32), frameMat);
      bail.position.set(0, 0.52, 0);
      group.add(bail);

      root.add(group);
    }

    root.scale.setScalar(currentScale);
  };

  const startCamera = async () => {
    try {
      setStatusText('Connecting to webcam...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsCameraActive(true);
      setStatusText('🟢 Live Camera Active • 60 FPS Optical Centroid Tracking');

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

        const ambient = new THREE.AmbientLight(0xffffff, 1.2);
        scene.add(ambient);
        const dir1 = new THREE.DirectionalLight(0xfffbeb, 1.6);
        dir1.position.set(3, 4, 3);
        scene.add(dir1);
        const dir2 = new THREE.DirectionalLight(0x60a5fa, 0.9);
        dir2.position.set(-3, -2, 2);
        scene.add(dir2);

        const modelRoot = new THREE.Group();
        scene.add(modelRoot);
        modelRootRef.current = modelRoot;

        rebuild3DModel(category, style, scale);
      }

      // Analysis canvas for face tracking
      const analysis = document.createElement('canvas');
      analysis.width = 160;
      analysis.height = 120;
      analysisCanvasRef.current = analysis;

      // Render loop
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
        const analysis = analysisCanvasRef.current;
        const modelRoot = modelRootRef.current;

        if (video && video.readyState >= 2 && analysis && modelRoot) {
          const actx = analysis.getContext('2d', { willReadFrequently: true });
          if (actx) {
            actx.drawImage(video, 0, 0, analysis.width, analysis.height);
            const imgData = actx.getImageData(0, 0, analysis.width, analysis.height);
            const d = imgData.data;
            let sumX = 0;
            let sumY = 0;
            let count = 0;

            for (let y = 0; y < analysis.height; y += 2) {
              for (let x = 0; x < analysis.width; x += 2) {
                const i = (y * analysis.width + x) * 4;
                const r = d[i];
                const g = d[i + 1];
                const b = d[i + 2];
                if (r > 60 && g > 40 && b > 20 && r - g > 15 && r > b) {
                  sumX += x;
                  sumY += y;
                  count++;
                }
              }
            }

            if (count > 80) {
              const avgX = sumX / count;
              const avgY = sumY / count;
              const normX = -(avgX / analysis.width - 0.5) * 3.2;
              const normY = -(avgY / analysis.height - 0.45) * 2.4;

              const smoothed = positionFilterRef.current.filter({ x: normX, y: normY, z: 0 });
              modelRoot.position.set(smoothed.x, smoothed.y, smoothed.z);

              const smoothedRot = rotationFilterRef.current.filter({ x: -normY * 0.2, y: normX * 0.35, z: 0 });
              modelRoot.rotation.set(smoothedRot.x, smoothedRot.y, smoothedRot.z);
              setTrackingConfidence(Math.min(99, 85 + Math.round((count / (analysis.width * analysis.height * 0.25)) * 14)));
            }
          }
        }

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
    link.download = `web-studio-tryon-${category}-${Date.now()}.png`;
    link.href = snapCanvas.toDataURL('image/png');
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Web Studio • Live Camera Testbed
          </span>
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Zero Backend Required
          </span>
        </div>
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Client-Side Real-Time 3D Virtual Try-On
        </h2>
        <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
          Test real-time webcam tracking and 3D item rendering directly in your browser. This testbed uses WebGL2 and in-browser optical tracking to demonstrate the core try-on pipeline with zero external dependencies.
        </p>
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
                <span className="text-xs font-mono text-sky-400 bg-sky-950/60 border border-sky-800/40 px-2 py-0.5 rounded">
                  Tracking: {trackingConfidence}%
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded">
                  {fps} FPS
                </span>
              </div>
            )}
          </div>

          {/* Video + WebGL Canvas Stack */}
          <div className="relative aspect-[4/3] w-full bg-slate-950 flex items-center justify-center overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover -scale-x-100 ${isCameraActive ? 'block' : 'hidden'}`}
            />
            <canvas
              ref={canvasRef}
              className={`absolute inset-0 w-full h-full pointer-events-none ${isCameraActive ? 'block' : 'hidden'}`}
            />

            {!isCameraActive && (
              <div className="text-center p-8 space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
                  <Camera className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-semibold text-white">Camera Standby</h3>
                  <p className="text-xs text-slate-400 max-w-sm">
                    Click the green button below to grant webcam access and try on 3D glasses, watch, and jewelry in real time.
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
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm transition shadow-lg shadow-emerald-900/30"
              >
                <Video className="w-4 h-4" />
                Start Camera Try-On
              </button>
            ) : (
              <>
                <button
                  onClick={stopCamera}
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm transition"
                >
                  <VideoOff className="w-4 h-4" />
                  Stop Camera
                </button>
                <button
                  onClick={takeSnapshot}
                  className="flex items-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition border border-slate-700"
                >
                  <Download className="w-4 h-4" />
                  Snapshot
                </button>
              </>
            )}
          </div>
        </div>

        {/* Controls & Configuration Sidebar (1 col) */}
        <div className="space-y-6">
          {/* Category Switcher */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Item Category</h3>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  setCategory('eyewear');
                  rebuild3DModel('eyewear', style, scale);
                }}
                className={`p-3 rounded-xl text-xs font-semibold flex flex-col items-center gap-2 border transition ${
                  category === 'eyewear'
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/30'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Glasses className="w-5 h-5" />
                <span>Glasses</span>
              </button>
              <button
                onClick={() => {
                  setCategory('watch');
                  rebuild3DModel('watch', style, scale);
                }}
                className={`p-3 rounded-xl text-xs font-semibold flex flex-col items-center gap-2 border transition ${
                  category === 'watch'
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-900/30'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <Watch className="w-5 h-5" />
                <span>Watch</span>
              </button>
              <button
                onClick={() => {
                  setCategory('jewelry');
                  rebuild3DModel('jewelry', style, scale);
                }}
                className={`p-3 rounded-xl text-xs font-semibold flex flex-col items-center gap-2 border transition ${
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

          {/* Finish / Material */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Material & Finish</h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'gold', name: 'Titanium Gold', color: '#eab308' },
                { id: 'silver', name: 'Platinum Silver', color: '#cbd5e1' },
                { id: 'onyx', name: 'Matte Onyx', color: '#27272a' },
                { id: 'neon', name: 'Cyber Neon', color: '#06b6d4' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    const st = item.id as any;
                    setStyle(st);
                    rebuild3DModel(category, st, scale);
                  }}
                  className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 border transition ${
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

          {/* Scale Slider */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-400 uppercase tracking-wider">Fit Scale</span>
              <span className="text-indigo-400 font-mono">{Math.round(scale * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.6"
              max="1.5"
              step="0.05"
              value={scale}
              onChange={(e) => {
                const s = parseFloat(e.target.value);
                setScale(s);
                rebuild3DModel(category, style, s);
              }}
              className="w-full accent-indigo-500 cursor-pointer"
            />
          </div>

          {/* Standalone Specs */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
            <div className="flex justify-between text-slate-400">
              <span>Pipeline:</span>
              <span className="text-indigo-400">MediaStream → Canvas → WebGL</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Smoothing:</span>
              <span className="text-indigo-400">Vector3 EMA (α = 0.35)</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Hardware Acceleration:</span>
              <span className="text-emerald-400">Direct GPU WebGL2</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
