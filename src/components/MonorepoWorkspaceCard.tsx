import React, { useState } from 'react';
import { Folder, FileCode, CheckCircle, ChevronRight, ChevronDown, Layers, Terminal, Sparkles, BookOpen, HardDrive, Cpu } from 'lucide-react';

interface WorkspaceInfo {
  id: string;
  name: string;
  path: string;
  role: string;
  technologies: string[];
  files: string[];
  keyDesignFeature: string;
  status: 'configured' | 'active';
}

const WORKSPACES: WorkspaceInfo[] = [
  {
    id: 'extension',
    name: 'Chrome Manifest V3 Extension',
    path: '/extension',
    role: 'Zero-install DOM injection into e-commerce product pages, overlay canvas lifecycle, and user HUD.',
    technologies: ['Chrome MV3', 'TypeScript', 'React 19', 'Vite', 'Service Worker'],
    files: [
      'manifest.json',
      'src/background/service-worker.ts',
      'src/content/content-script.ts',
      'src/content/overlay-injector.ts',
      'src/popup/Popup.tsx',
      'src/popup/index.html',
      'vite.config.ts',
      'package.json',
    ],
    keyDesignFeature: 'Non-persistent background service worker with zero host-page style collisions.',
    status: 'configured',
  },
  {
    id: 'server',
    name: 'Cloudflare Workers & KV/D1 API',
    path: '/server',
    role: 'Sub-20ms edge distribution of Draco 3D assets, bone anchor specs, and user anthropometric calibration.',
    technologies: ['Cloudflare Workers', 'V8 Isolates', 'Cloudflare KV', 'Cloudflare D1', 'Wrangler'],
    files: [
      'wrangler.jsonc',
      'schema.sql',
      'src/index.ts',
      'src/types/env.ts',
      'package.json',
      'tsconfig.json',
    ],
    keyDesignFeature: 'Edge-cached 3D model delivery with serverless SQLite relational storage.',
    status: 'configured',
  },
  {
    id: 'web-demo',
    name: 'Web Demo & Diagnostics Control Room',
    path: '/web-demo',
    role: 'Browser testbed for evaluating 3D Try-On pipeline, hardware readiness, and Three.js viewport testing.',
    technologies: ['React 19', 'Vite 8', 'Three.js', 'Tailwind CSS v4'],
    files: [
      'package.json',
      'tsconfig.json',
      'README.md',
    ],
    keyDesignFeature: 'Interactive hardware acceleration diagnostics and Three.js 3D viewport testbed.',
    status: 'active',
  },
  {
    id: 'shared',
    name: 'Shared Types & Math Projections',
    path: '/shared',
    role: 'Single source of truth for landmark types, PnP camera projections, quaternion alignment, and EMA filters.',
    technologies: ['TypeScript', '3D Math', 'EMA Filters', 'PnP Projections'],
    files: [
      'types/try-on.ts',
      'types/asset.ts',
      'types/protocol.ts',
      'types/health.ts',
      'math/transforms.ts',
      'math/filter.ts',
      'index.ts',
      'package.json',
    ],
    keyDesignFeature: 'Shared spatial coordinate conversions between MediaPipe normalized space and Three.js camera frustum.',
    status: 'configured',
  },
  {
    id: 'assets',
    name: 'Blender & Offline 3D Prep Pipeline',
    path: '/assets',
    role: 'Automated headless Blender Python scripts for mesh decimation, Draco compression, and bone origin centering.',
    technologies: ['Python 3.10+', 'Blender Headless API', 'Draco Mesh Compression'],
    files: [
      'scripts/prepare_glb.py',
      'scripts/validate_mesh.py',
      'requirements.txt',
      'models/manifest.json',
      'README.md',
    ],
    keyDesignFeature: 'Reduces raw high-poly scans by 85% to sustain 60 FPS on integrated mobile GPUs.',
    status: 'configured',
  },
  {
    id: 'docs',
    name: 'M.Tech Thesis Research Documentation',
    path: '/docs',
    role: 'Academic dissertation documentation detailing mathematical derivations, MV3 security, and latency budgets.',
    technologies: ['Markdown', 'LaTeX Math', 'Benchmarking Specs'],
    files: [
      'architecture.md',
      'mediapipe-threejs-math.md',
      'extension-mv3-spec.md',
      'cloudflare-architecture.md',
      'evaluation-metrics.md',
    ],
    keyDesignFeature: 'Complete mathematical formulations and sub-33ms frame latency budget allocations.',
    status: 'configured',
  },
];

export const MonorepoWorkspaceCard: React.FC = () => {
  const [expandedId, setExpandedId] = useState<string | null>('extension');

  return (
    <div className="space-y-6">
      {/* Overview Intro */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
        <h2 className="text-lg font-bold text-white mb-2">Monorepo Workspace Architecture</h2>
        <p className="text-xs text-slate-400 leading-relaxed max-w-3xl">
          The project follows a clean production monorepo structure separating client extension injection,
          edge worker distribution, offline asset preparation, shared mathematical foundations, and academic documentation.
        </p>
      </div>

      {/* Grid of Workspaces */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {WORKSPACES.map((ws) => {
          const isExpanded = expandedId === ws.id;
          return (
            <div
              key={ws.id}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
                isExpanded
                  ? 'bg-slate-900/90 border-indigo-500/40 shadow-lg shadow-indigo-950/20'
                  : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <span className="text-[11px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                      {ws.path}
                    </span>
                    <h3 className="text-base font-bold text-white mt-1.5">{ws.name}</h3>
                  </div>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    <CheckCircle className="w-3 h-3" />
                    Ready
                  </span>
                </div>

                <p className="text-xs text-slate-400 mb-4 leading-relaxed">{ws.role}</p>

                {/* Key feature */}
                <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 mb-4">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 block mb-1">
                    Architectural Highlight
                  </span>
                  <p className="text-xs text-slate-300">{ws.keyDesignFeature}</p>
                </div>

                {/* Tech Pills */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {ws.technologies.map((tech) => (
                    <span
                      key={tech}
                      className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700/60"
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>

              {/* Files Accordion Trigger */}
              <div className="border-t border-slate-800/80 bg-slate-950/30">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : ws.id)}
                  className="w-full px-5 py-2.5 flex items-center justify-between text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
                >
                  <span className="flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Workspace Files ({ws.files.length})</span>
                  </span>
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                {isExpanded && (
                  <div className="px-5 pb-4 pt-1 space-y-1 font-mono text-[11px] text-slate-400">
                    {ws.files.map((file) => (
                      <div key={file} className="flex items-center gap-2 text-slate-400 hover:text-slate-200 py-0.5">
                        <FileCode className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate">{file}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
