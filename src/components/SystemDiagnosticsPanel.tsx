import React from 'react';
import { DiagnosticResult } from '../services/health-checker';
import { CheckCircle2, AlertTriangle, XCircle, Cpu, Eye, Box, Globe, Calculator, RefreshCw } from 'lucide-react';

interface DiagnosticsProps {
  diagnostics: DiagnosticResult[];
  isRunning: boolean;
  onRefresh: () => void;
}

export const SystemDiagnosticsPanel: React.FC<DiagnosticsProps> = ({ diagnostics, isRunning, onRefresh }) => {
  const getIcon = (category: DiagnosticResult['category']) => {
    switch (category) {
      case 'hardware':
        return <Cpu className="w-4 h-4 text-blue-400" />;
      case 'vision':
        return <Eye className="w-4 h-4 text-purple-400" />;
      case 'renderer':
        return <Box className="w-4 h-4 text-amber-400" />;
      case 'network':
        return <Globe className="w-4 h-4 text-emerald-400" />;
      case 'math':
        return <Calculator className="w-4 h-4 text-cyan-400" />;
      default:
        return <Cpu className="w-4 h-4 text-slate-400" />;
    }
  };

  const getStatusBadge = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'passed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Passed
          </span>
        );
      case 'warning':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <AlertTriangle className="w-3.5 h-3.5" />
            Warning
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-400">
            Running...
          </span>
        );
    }
  };

  const passedCount = diagnostics.filter((d) => d.status === 'passed').length;
  const totalCount = diagnostics.length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">System Runtime & Readiness Report</h2>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
              {passedCount} / {totalCount} Validated
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Automated verification of browser APIs, WebGL2 hardware graphics pipelines, WebAssembly SIMD
            execution vectors, and mathematical transformation stability.
          </p>
        </div>

        <button
          onClick={onRefresh}
          disabled={isRunning}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition self-start md:self-center"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
          <span>Re-run Diagnostics</span>
        </button>
      </div>

      {/* Diagnostic Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {diagnostics.map((item) => (
          <div
            key={item.id}
            className="p-5 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 transition flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-slate-800 border border-slate-700/60">
                    {getIcon(item.category)}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100">{item.name}</h3>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                      {item.category} • {item.latencyMs}ms
                    </span>
                  </div>
                </div>
                {getStatusBadge(item.status)}
              </div>

              <p className="text-xs text-slate-400 mb-3">{item.details}</p>
            </div>

            {item.metrics && (
              <div className="pt-3 border-t border-slate-800/60 font-mono text-[11px] text-slate-400 space-y-1">
                {Object.entries(item.metrics).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between text-slate-400">
                    <span className="text-slate-500 capitalize">{key.replace(/([A-Z])/g, ' $1')}:</span>
                    <span className="text-slate-300 font-semibold truncate max-w-[160px] text-right" title={String(val)}>
                      {String(val)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
