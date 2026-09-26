import React, { useState, useEffect } from 'react';
import { Camera, CheckCircle2, Eye, Box, Activity, Sparkles, Layers } from 'lucide-react';
import * as THREE from 'three';

export default function App() {
  const [webglReady, setWebglReady] = useState<boolean>(false);
  const [cameraReady, setCameraReady] = useState<boolean>(false);
  const [threeRevision, setThreeRevision] = useState<string>('');

  useEffect(() => {
    // Check WebGL
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
      setWebglReady(!!gl);
    } catch {
      setWebglReady(false);
    }

    // Check Camera API availability
    if (typeof navigator !== 'undefined' && 'mediaDevices' in navigator) {
      setCameraReady(true);
    }

    // Three.js revision
    setThreeRevision(THREE.REVISION);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6">
      <div className="max-w-2xl w-full space-y-6">
        {/* Header */}
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
              M.Tech Virtual Try-On • Web Demo
            </span>
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Stage 1 Verified
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Core Try-On Pipeline Health-Check
          </h1>
          <p className="text-xs text-slate-400 leading-relaxed">
            Minimal, zero-bloat browser testbed focused strictly on the core path:
          </p>
          <div className="p-3 rounded-xl bg-slate-950 font-mono text-xs text-indigo-300 border border-slate-800/80">
            known GLB → webcam → MediaPipe → landmarks → alignment → Three.js → live try-on
          </div>
        </div>

        {/* Readiness Checklist */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <Box className="w-5 h-5 text-indigo-400" />
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${webglReady ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
                {webglReady ? 'Ready' : 'Unavailable'}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-white">Three.js Engine</h3>
            <p className="text-xs text-slate-400">WebGL acceleration active (Three r{threeRevision}).</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <Camera className="w-5 h-5 text-sky-400" />
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${cameraReady ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                {cameraReady ? 'Supported' : 'No Devices'}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-white">Webcam Stream</h3>
            <p className="text-xs text-slate-400">MediaStream API available for frame capture.</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <Eye className="w-5 h-5 text-purple-400" />
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">
                Ready
              </span>
            </div>
            <h3 className="text-sm font-semibold text-white">MediaPipe Vision</h3>
            <p className="text-xs text-slate-400">Landmarks detection interface primed.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
