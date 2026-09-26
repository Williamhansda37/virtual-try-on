import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Eye, RotateCw, Sparkles, Sliders, Layers, Play, Pause } from 'lucide-react';
import { Vector3EMAFilter } from '../../shared/math/filter';

export const ThreeCanvasTestbed: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [isRotating, setIsRotating] = useState<boolean>(true);
  const [wireframe, setWireframe] = useState<boolean>(false);
  const [showAnchors, setShowAnchors] = useState<boolean>(true);
  const [showAxes, setShowAxes] = useState<boolean>(true);
  const [useEmaFilter, setUseEmaFilter] = useState<boolean>(true);
  const [yaw, setYaw] = useState<number>(0);
  const [pitch, setPitch] = useState<number>(0);
  const [scaleFactor, setScaleFactor] = useState<number>(1.0);
  const [fps, setFps] = useState<number>(60);
  const [drawCalls, setDrawCalls] = useState<number>(0);

  const sceneRef = useRef<THREE.Scene | null>(null);
  const modelGroupRef = useRef<THREE.Group | null>(null);
  const anchorsGroupRef = useRef<THREE.Group | null>(null);
  const axesRef = useRef<THREE.AxesHelper | null>(null);
  const emaFilterRef = useRef<Vector3EMAFilter>(new Vector3EMAFilter(0.35));

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = 440;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060913);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 4.2);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    // Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x60a5fa, 1.5);
    dirLight1.position.set(3, 4, 3);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xc084fc, 1.2);
    dirLight2.position.set(-3, -2, 2);
    scene.add(dirLight2);

    // Grid Floor
    const grid = new THREE.GridHelper(10, 20, 0x1e293b, 0x0f172a);
    grid.position.y = -1.5;
    scene.add(grid);

    // Axes Helper
    const axes = new THREE.AxesHelper(1.2);
    axes.visible = showAxes;
    scene.add(axes);
    axesRef.current = axes;

    // Eyewear Model Construct
    const modelGroup = new THREE.Group();

    // Frame material
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4af37, // Titanium Gold
      metalness: 0.85,
      roughness: 0.25,
      wireframe: wireframe,
    });

    // Lens material
    const lensMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x1e293b,
      metalness: 0.1,
      roughness: 0.1,
      transmission: 0.7,
      transparent: true,
      opacity: 0.85,
      wireframe: wireframe,
    });

    // Left Lens
    const leftLensGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.04, 32);
    leftLensGeo.rotateX(Math.PI / 2);
    const leftLens = new THREE.Mesh(leftLensGeo, lensMaterial);
    leftLens.position.set(-0.62, 0, 0);
    modelGroup.add(leftLens);

    // Left Rim
    const leftRimGeo = new THREE.TorusGeometry(0.43, 0.035, 16, 48);
    const leftRim = new THREE.Mesh(leftRimGeo, frameMaterial);
    leftRim.position.set(-0.62, 0, 0);
    modelGroup.add(leftRim);

    // Right Lens
    const rightLensGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.04, 32);
    rightLensGeo.rotateX(Math.PI / 2);
    const rightLens = new THREE.Mesh(rightLensGeo, lensMaterial);
    rightLens.position.set(0.62, 0, 0);
    modelGroup.add(rightLens);

    // Right Rim
    const rightRimGeo = new THREE.TorusGeometry(0.43, 0.035, 16, 48);
    const rightRim = new THREE.Mesh(rightRimGeo, frameMaterial);
    rightRim.position.set(0.62, 0, 0);
    modelGroup.add(rightRim);

    // Nose Bridge
    const bridgeGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.45, 16);
    bridgeGeo.rotateZ(Math.PI / 2);
    const bridge = new THREE.Mesh(bridgeGeo, frameMaterial);
    bridge.position.set(0, 0.12, 0.05);
    modelGroup.add(bridge);

    // Left Temple
    const leftTempleGeo = new THREE.BoxGeometry(0.03, 0.04, 1.4);
    const leftTemple = new THREE.Mesh(leftTempleGeo, frameMaterial);
    leftTemple.position.set(-1.05, 0.02, -0.65);
    modelGroup.add(leftTemple);

    // Right Temple
    const rightTempleGeo = new THREE.BoxGeometry(0.03, 0.04, 1.4);
    const rightTemple = new THREE.Mesh(rightTempleGeo, frameMaterial);
    rightTemple.position.set(1.05, 0.02, -0.65);
    modelGroup.add(rightTemple);

    scene.add(modelGroup);
    modelGroupRef.current = modelGroup;

    // Anchor Points Visualization Group (MediaPipe Landmarks)
    const anchorsGroup = new THREE.Group();
    const anchorGeo = new THREE.SphereGeometry(0.045, 16, 16);
    const anchorMatNose = new THREE.MeshBasicMaterial({ color: 0x10b981 });
    const anchorMatEye = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    // Glabella Anchor (#168)
    const glabellaAnchor = new THREE.Mesh(anchorGeo, anchorMatNose);
    glabellaAnchor.position.set(0, 0.15, 0.1);
    anchorsGroup.add(glabellaAnchor);

    // Left Eye Outer (#33)
    const leftEyeAnchor = new THREE.Mesh(anchorGeo, anchorMatEye);
    leftEyeAnchor.position.set(-0.95, 0, 0);
    anchorsGroup.add(leftEyeAnchor);

    // Right Eye Outer (#263)
    const rightEyeAnchor = new THREE.Mesh(anchorGeo, anchorMatEye);
    rightEyeAnchor.position.set(0.95, 0, 0);
    anchorsGroup.add(rightEyeAnchor);

    scene.add(anchorsGroup);
    anchorsGroupRef.current = anchorsGroup;

    // Animation & Render Loop
    let animationFrameId: number;
    let lastTime = performance.now();
    let frameCount = 0;
    let fpsTime = performance.now();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // FPS tracking
      frameCount++;
      const now = performance.now();
      if (now - fpsTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - fpsTime)));
        frameCount = 0;
        fpsTime = now;
      }

      if (modelGroupRef.current && anchorsGroupRef.current) {
        if (isRotating) {
          modelGroupRef.current.rotation.y += 0.01;
          anchorsGroupRef.current.rotation.y = modelGroupRef.current.rotation.y;
        } else {
          // Manual rotation from sliders
          let targetYaw = yaw * (Math.PI / 180);
          let targetPitch = pitch * (Math.PI / 180);

          if (useEmaFilter) {
            const filtered = emaFilterRef.current.filter({ x: targetPitch, y: targetYaw, z: 0 });
            targetPitch = filtered.x;
            targetYaw = filtered.y;
          }

          modelGroupRef.current.rotation.y = targetYaw;
          modelGroupRef.current.rotation.x = targetPitch;
          anchorsGroupRef.current.rotation.y = targetYaw;
          anchorsGroupRef.current.rotation.x = targetPitch;
        }

        const scale = scaleFactor;
        modelGroupRef.current.scale.set(scale, scale, scale);
        anchorsGroupRef.current.scale.set(scale, scale, scale);
      }

      renderer.render(scene, camera);
      setDrawCalls(renderer.info.render.calls);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      const newWidth = container.clientWidth;
      camera.aspect = newWidth / height;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, height);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isRotating, wireframe]);

  // Update wireframe property
  useEffect(() => {
    if (!modelGroupRef.current) return;
    modelGroupRef.current.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.material.wireframe = wireframe;
      }
    });
  }, [wireframe]);

  // Update helper visibility
  useEffect(() => {
    if (anchorsGroupRef.current) anchorsGroupRef.current.visible = showAnchors;
    if (axesRef.current) axesRef.current.visible = showAxes;
  }, [showAnchors, showAxes]);

  return (
    <div className="space-y-6">
      {/* Viewport Header */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">Three.js 3D Viewport & Anchor Testbed</h2>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Live WebGL Canvas
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Simulates the real-time client-side rendering pipeline: PBR material shaders, MediaPipe landmark
            bone anchors, and projective camera alignment in action.
          </p>
        </div>

        {/* Live FPS & Telemetry */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-center font-mono text-xs">
            <span className="text-slate-500 block text-[10px]">FPS</span>
            <span className={`font-bold ${fps >= 55 ? 'text-emerald-400' : 'text-amber-400'}`}>{fps}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-center font-mono text-xs">
            <span className="text-slate-500 block text-[10px]">Draw Calls</span>
            <span className="font-bold text-cyan-400">{drawCalls || 7}</span>
          </div>
        </div>
      </div>

      {/* Main Interactive Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Canvas Area */}
        <div className="lg:col-span-3 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 relative shadow-2xl">
          <div ref={mountRef} className="w-full h-[440px]" />

          {/* Canvas Floating Overlay Controls */}
          <div className="absolute top-4 left-4 flex items-center gap-2">
            <button
              onClick={() => setIsRotating(!isRotating)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 backdrop-blur-md border border-slate-700/80 text-white text-xs font-medium hover:bg-slate-800 transition"
            >
              {isRotating ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
              <span>{isRotating ? 'Pause Orbit' : 'Auto Orbit'}</span>
            </button>

            <button
              onClick={() => setWireframe(!wireframe)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg backdrop-blur-md border text-xs font-medium transition ${
                wireframe
                  ? 'bg-indigo-600/80 border-indigo-500 text-white'
                  : 'bg-slate-900/80 border-slate-700/80 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Wireframe</span>
            </button>
          </div>

          {/* Anchor Points Legend */}
          <div className="absolute bottom-4 left-4 bg-slate-900/85 backdrop-blur-md border border-slate-800/80 rounded-xl px-3 py-2 text-[11px] font-mono text-slate-300 flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span>Glabella (#168)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span>
              <span>Eye Corners (#33, #263)</span>
            </div>
          </div>
        </div>

        {/* Viewport Control Panel */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-slate-800">
              <Sliders className="w-4 h-4 text-indigo-400" />
              <h3 className="text-sm font-bold text-white">Spatial Calibration</h3>
            </div>

            {/* Yaw Slider */}
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Head Yaw (Rotation)</span>
                <span className="font-mono text-white">{yaw}°</span>
              </div>
              <input
                type="range"
                min="-60"
                max="60"
                value={yaw}
                disabled={isRotating}
                onChange={(e) => setYaw(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-40"
              />
            </div>

            {/* Pitch Slider */}
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Head Pitch (Tilt)</span>
                <span className="font-mono text-white">{pitch}°</span>
              </div>
              <input
                type="range"
                min="-45"
                max="45"
                value={pitch}
                disabled={isRotating}
                onChange={(e) => setPitch(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 disabled:opacity-40"
              />
            </div>

            {/* Scale / IPD factor */}
            <div>
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>Metric IPD Scale</span>
                <span className="font-mono text-white">{scaleFactor.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.7"
                max="1.4"
                step="0.05"
                value={scaleFactor}
                onChange={(e) => setScaleFactor(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>

            {/* Helper Toggles */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                <span>Landmark Anchors</span>
                <input
                  type="checkbox"
                  checked={showAnchors}
                  onChange={(e) => setShowAnchors(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                <span>Coordinate Axes (XYZ)</span>
                <input
                  type="checkbox"
                  checked={showAxes}
                  onChange={(e) => setShowAxes(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-slate-300 cursor-pointer">
                <span>EMA Jitter Smoothing</span>
                <input
                  type="checkbox"
                  checked={useEmaFilter}
                  onChange={(e) => setUseEmaFilter(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-0 cursor-pointer"
                />
              </label>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 leading-relaxed font-mono">
            <span className="text-indigo-400 font-bold block mb-1">Anchor Solvers</span>
            Glabella #168 & Eye Outer #33 / #263 form a planar constraint for rigid 6-DoF transformation.
          </div>
        </div>
      </div>
    </div>
  );
};
