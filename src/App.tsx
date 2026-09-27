/**
 * @file App.tsx
 * AI-Powered Browser-Based 3D Virtual Try-On
 * M.Tech Research Monorepo - Health-Check & Architecture Control Dashboard
 */

import React, { useState, useEffect, useCallback } from 'react';
import { MTechProjectHeader } from './components/MTechProjectHeader';
import { SystemDiagnosticsPanel } from './components/SystemDiagnosticsPanel';
import { MonorepoWorkspaceCard } from './components/MonorepoWorkspaceCard';
import { ThreeCanvasTestbed } from './components/ThreeCanvasTestbed';
import { HowToRunModal } from './components/HowToRunModal';
import { ArchitectureFlowView } from './components/ArchitectureFlowView';
import { LiveCameraStudio } from './components/LiveCameraStudio';
import { EcommerceAiGenerator, GeneratedWearable } from './components/EcommerceAiGenerator';
import {
  DiagnosticResult,
  checkWebGL2Support,
  checkWebAssemblySimd,
  checkCameraAvailability,
  checkThreeJsEngine,
  checkEdgeApiConnectivity,
  checkMathProjectionEngine,
} from './services/health-checker';

export default function App() {
  const [activeTab, setActiveTab] = useState<'studio' | 'ecommerce' | 'health' | 'architecture' | 'viewport' | 'runbook'>('studio');
  const [selectedWearable, setSelectedWearable] = useState<GeneratedWearable | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState<boolean>(false);

  const runAllDiagnostics = useCallback(async () => {
    setIsRunningDiagnostics(true);
    try {
      const [webgl, wasm, camera, threeEngine, edgeApi, math] = await Promise.all([
        checkWebGL2Support(),
        checkWebAssemblySimd(),
        checkCameraAvailability(),
        checkThreeJsEngine(),
        checkEdgeApiConnectivity(),
        checkMathProjectionEngine(),
      ]);

      setDiagnostics([webgl, wasm, camera, threeEngine, edgeApi, math]);
    } catch (err) {
      console.error('Diagnostic error:', err);
    } finally {
      setIsRunningDiagnostics(false);
    }
  }, []);

  useEffect(() => {
    runAllDiagnostics();
  }, [runAllDiagnostics]);

  const allPassed = diagnostics.length > 0 && diagnostics.every((d) => d.status === 'passed' || d.status === 'warning');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <MTechProjectHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        systemHealthy={allPassed}
        onRunDiagnostics={runAllDiagnostics}
        isRunningDiagnostics={isRunningDiagnostics}
      />

      {/* Main Content View */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {activeTab === 'studio' && (
          <div className="space-y-8">
            <LiveCameraStudio customWearable={selectedWearable} />
          </div>
        )}

        {activeTab === 'ecommerce' && (
          <div className="space-y-8">
            <EcommerceAiGenerator
              onSelectForTryOn={(wearable) => {
                setSelectedWearable(wearable);
                setActiveTab('studio');
              }}
            />
          </div>
        )}

        {activeTab === 'health' && (
          <div className="space-y-8">
            <SystemDiagnosticsPanel
              diagnostics={diagnostics}
              isRunning={isRunningDiagnostics}
              onRefresh={runAllDiagnostics}
            />
            <ArchitectureFlowView />
          </div>
        )}

        {activeTab === 'architecture' && (
          <div className="space-y-8">
            <MonorepoWorkspaceCard />
            <ArchitectureFlowView />
          </div>
        )}

        {activeTab === 'viewport' && (
          <div className="space-y-8">
            <ThreeCanvasTestbed />
          </div>
        )}

        {activeTab === 'runbook' && (
          <div className="space-y-8">
            <HowToRunModal />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800 bg-slate-950/80 py-6 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>AI-Powered Browser-Based 3D Virtual Try-On • M.Tech Research Monorepo</span>
          <span className="text-slate-400">Chrome MV3 • MediaPipe • Three.js • Cloudflare Edge</span>
        </div>
      </footer>
    </div>
  );
}
