import React from 'react';
import { Layers, Activity, BookOpen, Terminal, Sparkles, CheckCircle2, ShieldAlert } from 'lucide-react';

interface HeaderProps {
  activeTab: 'health' | 'architecture' | 'viewport' | 'runbook';
  setActiveTab: (tab: 'health' | 'architecture' | 'viewport' | 'runbook') => void;
  systemHealthy: boolean;
  onRunDiagnostics: () => void;
  isRunningDiagnostics: boolean;
}

export const MTechProjectHeader: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  systemHealthy,
  onRunDiagnostics,
  isRunningDiagnostics,
}) => {
  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Title & Research Tag */}
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20 text-white shrink-0 mt-0.5">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  M.Tech Research Monorepo
                </span>
                <span className="text-xs font-mono text-slate-400">
                  Manifest V3 • MediaPipe • Three.js • Cloudflare
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                AI-Powered Browser-Based 3D Virtual Try-On
              </h1>
            </div>
          </div>

          {/* System Status & Actions */}
          <div className="flex items-center gap-3">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${
                systemHealthy
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              }`}
            >
              {systemHealthy ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 animate-pulse" />
                  <span>Architecture Healthy</span>
                </>
              ) : (
                <>
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>Degraded Checks</span>
                </>
              )}
            </div>

            <button
              onClick={onRunDiagnostics}
              disabled={isRunningDiagnostics}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition disabled:opacity-50"
            >
              <Activity className={`w-3.5 h-3.5 ${isRunningDiagnostics ? 'animate-spin' : ''}`} />
              <span>{isRunningDiagnostics ? 'Testing...' : 'Run Diagnostics'}</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 border-t border-slate-800/80 -mb-px overflow-x-auto text-sm">
          <button
            onClick={() => setActiveTab('health')}
            className={`flex items-center gap-2 px-4 py-3 font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'health'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Health-Check & Diagnostics</span>
          </button>

          <button
            onClick={() => setActiveTab('architecture')}
            className={`flex items-center gap-2 px-4 py-3 font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'architecture'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Monorepo Architecture (6 Workspaces)</span>
          </button>

          <button
            onClick={() => setActiveTab('viewport')}
            className={`flex items-center gap-2 px-4 py-3 font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'viewport'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>3D Try-On Engine Testbed</span>
          </button>

          <button
            onClick={() => setActiveTab('runbook')}
            className={`flex items-center gap-2 px-4 py-3 font-medium border-b-2 transition whitespace-nowrap ${
              activeTab === 'runbook'
                ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-4 h-4" />
            <span>How to Run Locally</span>
          </button>
        </div>
      </div>
    </header>
  );
};
