import React from 'react';
import { Camera, Cpu, Layers, Box, Globe, ShieldCheck, ArrowRight, ArrowDown } from 'lucide-react';

export const ArchitectureFlowView: React.FC = () => {
  const steps = [
    {
      id: 'step1',
      title: '1. Host Page & SKU Detection',
      icon: <Globe className="w-5 h-5 text-sky-400" />,
      sub: 'Chrome Extension Content Script',
      description: 'Injects into e-commerce product DOM. Identifies 3D-eligible SKUs and triggers overlay mount.',
      metric: '0 layout shift',
    },
    {
      id: 'step2',
      title: '2. Vision Landmark Tracking',
      icon: <Camera className="w-5 h-5 text-indigo-400" />,
      sub: 'MediaPipe Tasks Vision',
      description: 'Acquires local camera frames. Computes 468 3D facial/pose landmarks via WebAssembly SIMD.',
      metric: '12ms inference',
    },
    {
      id: 'step3',
      title: '3. Math Projection & Jitter Filter',
      icon: <Cpu className="w-5 h-5 text-purple-400" />,
      sub: '@try-on/shared Math Engine',
      description: 'Transforms normalized landmarks to Three.js camera NDC. Solves 6-DoF pose and applies EMA smoothing.',
      metric: '< 0.8mm RMSE',
    },
    {
      id: 'step4',
      title: '4. Three.js Hardware Viewport',
      icon: <Box className="w-5 h-5 text-amber-400" />,
      sub: 'WebGL2 Skinned Mesh',
      description: 'Renders Draco-compressed 3D GLB model anchored to skeletal joints with real-time PBR shaders.',
      metric: '60 FPS render',
    },
    {
      id: 'step5',
      title: '5. Edge Asset & Config CDN',
      icon: <Layers className="w-5 h-5 text-emerald-400" />,
      sub: 'Cloudflare Workers & D1',
      description: 'Global low-latency delivery of 3D manifests, bone anchor configurations, and user calibration values.',
      metric: '< 20ms TTFB',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
        <h2 className="text-lg font-bold text-white mb-2">Real-Time Try-On Dataflow Pipeline</h2>
        <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
          Complete end-to-end dataflow showing how the client extension, on-device vision pipeline,
          coordinate projection engine, and edge asset backend interact to deliver zero-latency AR try-on.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 relative">
        {steps.map((step, idx) => (
          <div
            key={step.id}
            className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between relative group hover:border-indigo-500/50 transition"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700">
                  {step.icon}
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {step.metric}
                </span>
              </div>

              <h3 className="text-sm font-bold text-white mb-1">{step.title}</h3>
              <span className="text-[11px] font-medium text-indigo-400 block mb-2">{step.sub}</span>
              <p className="text-xs text-slate-400 leading-relaxed">{step.description}</p>
            </div>

            <div className="pt-4 mt-3 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-500 font-mono">
              <span>Phase {idx + 1} of 5</span>
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
