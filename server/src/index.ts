/**
 * @file index.ts
 * Cloudflare Worker API for 3D Virtual Try-On Asset Delivery & Calibration.
 */

import { Env } from './types/env';
import { ModelAssetMetadata } from '../../shared/types/asset';

// Sample in-memory catalog fallback for local zero-dependency development
const SEED_MODELS: ModelAssetMetadata[] = [
  {
    id: 'asset-aviator-01',
    sku: 'RB-AVIATOR-GOLD',
    name: 'Aviator Classic 3D Eyewear',
    category: 'eyewear',
    modelUrl: '/assets/models/aviator_classic.glb',
    thumbnailUrl: 'https://images.unsplash.com/photo-1572635196237-14b3f281503f?auto=format&fit=crop&w=300&q=80',
    fileSizeBytes: 420000,
    polyCount: 4800,
    defaultScale: [1, 1, 1],
    boneAnchors: [
      {
        boneName: 'nose_bridge',
        landmarkIndices: [168, 6], // Glabella & Bridge
        offset: [0, 0.002, 0.015],
        rotationOffsetEuler: [0, 0, 0],
        scaleMultiplier: 1.0,
      },
    ],
    materials: [
      { slotName: 'frame', type: 'metallic', colorHex: '#d4af37', roughness: 0.2, metalness: 0.9 },
      { slotName: 'lenses', type: 'translucent', colorHex: '#1e293b', roughness: 0.1, transmission: 0.8 },
    ],
    createdAt: new Date().toISOString(),
    version: '1.0.0',
  },
  {
    id: 'asset-wayfarer-02',
    sku: 'RB-WAYFARER-BLK',
    name: 'Wayfarer Acetate Frames',
    category: 'eyewear',
    modelUrl: '/assets/models/wayfarer.glb',
    thumbnailUrl: 'https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=300&q=80',
    fileSizeBytes: 380000,
    polyCount: 3950,
    defaultScale: [1, 1, 1],
    boneAnchors: [
      {
        boneName: 'nose_bridge',
        landmarkIndices: [168, 6],
        offset: [0, 0.001, 0.014],
        rotationOffsetEuler: [0, 0, 0],
        scaleMultiplier: 0.98,
      },
    ],
    materials: [
      { slotName: 'frame', type: 'pbr', colorHex: '#18181b', roughness: 0.4, metalness: 0.0 },
    ],
    createdAt: new Date().toISOString(),
    version: '1.0.0',
  },
];

export default {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '*';

    // CORS preflight response
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const corsHeaders = {
      'Access-Control-Allow-Origin': origin,
      'Content-Type': 'application/json',
    };

    // Route: /api/health
    if (url.pathname === '/api/health') {
      return new Response(
        JSON.stringify({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          edgeRegion: 'cloudflare-worker',
          bindings: {
            kvActive: !!env.ASSET_CACHE_KV,
            d1Active: !!env.DB,
          },
          version: '1.0.0',
        }),
        { headers: corsHeaders }
      );
    }

    // Route: /api/models
    if (url.pathname === '/api/models') {
      const category = url.searchParams.get('category');
      const filtered = category ? SEED_MODELS.filter((m) => m.category === category) : SEED_MODELS;

      return new Response(
        JSON.stringify({
          success: true,
          count: filtered.length,
          models: filtered,
        }),
        { headers: corsHeaders }
      );
    }

    // Route: /api/calibration/:category
    if (url.pathname.startsWith('/api/calibration')) {
      return new Response(
        JSON.stringify({
          success: true,
          calibration: {
            interpupillaryDistanceMm: 63.5,
            faceWidthMm: 142.0,
            cameraFovDeg: 60,
            smoothingFactorAlpha: 0.35,
          },
        }),
        { headers: corsHeaders }
      );
    }

    // Default 404
    return new Response(
      JSON.stringify({
        error: 'Not Found',
        path: url.pathname,
      }),
      { status: 404, headers: corsHeaders }
    );
  },
};
