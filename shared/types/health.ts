/**
 * @file health.ts
 * Health check & diagnostic schemas for the monorepo architecture verification.
 */

export type HealthStatus = 'healthy' | 'degraded' | 'failing' | 'unknown';

export interface ModuleHealthCheck {
  id: string;
  name: string;
  path: string;
  status: HealthStatus;
  latencyMs: number;
  details: string;
  checks: {
    checkName: string;
    passed: boolean;
    info?: string;
  }[];
}

export interface SystemHealthReport {
  timestamp: string;
  overallStatus: HealthStatus;
  environment: {
    browser: string;
    webGlSupported: boolean;
    webGpuSupported: boolean;
    webAssemblySimd: boolean;
    cameraApiAvailable: boolean;
  };
  modules: ModuleHealthCheck[];
  metrics: {
    memoryHeapMb: number;
    recommendedFpsTarget: number;
  };
}
