import React, { useState } from 'react';
import { Terminal, Copy, Check, ExternalLink, Chrome, Cloud, Box, Play } from 'lucide-react';

export const HowToRunModal: React.FC = () => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'quick' | 'extension' | 'server' | 'blender'>('quick');

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
        <h2 className="text-lg font-bold text-white mb-2">Development Execution Runbook</h2>
        <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
          Follow these exact instructions to install, verify, and run each component of the M.Tech monorepo
          locally. All configurations are strictly offline-friendly and require no cloud credentials for testing.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveTab('quick')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'quick' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Play className="w-3.5 h-3.5" />
          <span>Quickstart (Web Demo)</span>
        </button>

        <button
          onClick={() => setActiveTab('extension')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'extension' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Chrome className="w-3.5 h-3.5" />
          <span>Chrome MV3 Extension</span>
        </button>

        <button
          onClick={() => setActiveTab('server')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'server' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Cloud className="w-3.5 h-3.5" />
          <span>Cloudflare Workers & D1</span>
        </button>

        <button
          onClick={() => setActiveTab('blender')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition ${
            activeTab === 'blender' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'
          }`}
        >
          <Box className="w-3.5 h-3.5" />
          <span>Blender Python 3D Prep</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'quick' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs">1</span>
              Install Monorepo Workspace Dependencies
            </h3>
            <p className="text-xs text-slate-400">
              Installs all dependencies across root, shared types, extension, and web-demo packages.
            </p>
            <div className="relative">
              <pre className="p-3.5 rounded-xl bg-slate-950 font-mono text-xs text-indigo-300 border border-slate-800/80 overflow-x-auto">
                npm install
              </pre>
              <button
                onClick={() => copyToClipboard('npm install', 1)}
                className="absolute right-3 top-3 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1"
              >
                {copiedIndex === 1 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs">2</span>
              Launch Local Health-Check & Architecture Stage
            </h3>
            <p className="text-xs text-slate-400">
              Starts the development server with real-time hardware diagnostics and interactive 3D WebGL viewport.
            </p>
            <div className="relative">
              <pre className="p-3.5 rounded-xl bg-slate-950 font-mono text-xs text-indigo-300 border border-slate-800/80 overflow-x-auto">
                npm run dev
              </pre>
              <button
                onClick={() => copyToClipboard('npm run dev', 2)}
                className="absolute right-3 top-3 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1"
              >
                {copiedIndex === 2 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              Accessible in your browser at <span className="font-mono text-slate-300">http://localhost:3000</span>.
            </p>
          </div>
        </div>
      )}

      {activeTab === 'extension' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs">1</span>
              Build Chrome Manifest V3 Extension
            </h3>
            <p className="text-xs text-slate-400">
              Bundles background service worker, DOM content scripts, and popup HUD into <code className="text-indigo-300">extension/dist</code>.
            </p>
            <div className="relative">
              <pre className="p-3.5 rounded-xl bg-slate-950 font-mono text-xs text-indigo-300 border border-slate-800/80 overflow-x-auto">
                npm run build:extension
              </pre>
              <button
                onClick={() => copyToClipboard('npm run build:extension', 3)}
                className="absolute right-3 top-3 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1"
              >
                {copiedIndex === 3 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs">2</span>
              Load Unpacked Extension into Chrome
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-xs text-slate-400 leading-relaxed">
              <li>Open Google Chrome and navigate to <code className="text-slate-200">chrome://extensions/</code></li>
              <li>Toggle on <strong className="text-white">Developer mode</strong> in the upper right corner</li>
              <li>Click the <strong className="text-white">Load unpacked</strong> button in the top left</li>
              <li>Select the <code className="text-indigo-300">/extension</code> directory from this repository</li>
              <li>Pin the <strong className="text-white">3D Virtual Try-On Engine</strong> icon in your browser toolbar</li>
            </ol>
          </div>
        </div>
      )}

      {activeTab === 'server' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs">1</span>
              Run Cloudflare Worker Locally via Wrangler
            </h3>
            <p className="text-xs text-slate-400">
              Executes the V8 isolate worker locally with zero cloud dependencies.
            </p>
            <div className="relative">
              <pre className="p-3.5 rounded-xl bg-slate-950 font-mono text-xs text-indigo-300 border border-slate-800/80 overflow-x-auto">
{`cd server
npm install
npm run dev`}
              </pre>
              <button
                onClick={() => copyToClipboard('cd server\nnpm install\nnpm run dev', 4)}
                className="absolute right-3 top-3 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1"
              >
                {copiedIndex === 4 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs">2</span>
              Initialize Local D1 Database Schema
            </h3>
            <p className="text-xs text-slate-400">
              Creates local SQLite tables for model assets, bone anchors, and anthropometric calibration.
            </p>
            <div className="relative">
              <pre className="p-3.5 rounded-xl bg-slate-950 font-mono text-xs text-indigo-300 border border-slate-800/80 overflow-x-auto">
                npm run d1:init
              </pre>
              <button
                onClick={() => copyToClipboard('npm run d1:init', 5)}
                className="absolute right-3 top-3 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1"
              >
                {copiedIndex === 5 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'blender' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs">1</span>
              Run Headless Blender Asset Optimization
            </h3>
            <p className="text-xs text-slate-400">
              Executes automated geometry decimation, origin centering, and Draco mesh compression.
            </p>
            <div className="relative">
              <pre className="p-3.5 rounded-xl bg-slate-950 font-mono text-xs text-indigo-300 border border-slate-800/80 overflow-x-auto">
{`blender --background --python assets/scripts/prepare_glb.py -- \\
  --input sample_raw.obj \\
  --output assets/models/optimized.glb \\
  --category eyewear \\
  --target-poly 4500`}
              </pre>
              <button
                onClick={() => copyToClipboard(`blender --background --python assets/scripts/prepare_glb.py -- --input sample_raw.obj --output assets/models/optimized.glb --category eyewear --target-poly 4500`, 6)}
                className="absolute right-3 top-3 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1"
              >
                {copiedIndex === 6 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs">2</span>
              Validate Mesh Geometry & UV Budget
            </h3>
            <div className="relative">
              <pre className="p-3.5 rounded-xl bg-slate-950 font-mono text-xs text-indigo-300 border border-slate-800/80 overflow-x-auto">
                python3 assets/scripts/validate_mesh.py assets/models/optimized.glb
              </pre>
              <button
                onClick={() => copyToClipboard('python3 assets/scripts/validate_mesh.py assets/models/optimized.glb', 7)}
                className="absolute right-3 top-3 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs flex items-center gap-1"
              >
                {copiedIndex === 7 ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
