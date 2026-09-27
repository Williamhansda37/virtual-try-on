/**
 * @file index.ts
 * Cloudflare Worker API for 3D Virtual Try-On Asset Delivery & Calibration.
 */

import { Env } from './types/env';
import { ModelAssetMetadata } from '../../shared/types/asset';
import { GoogleGenAI, Type } from '@google/genai';

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

    // Route: POST /api/ai/generate-wearable
    if (url.pathname === '/api/ai/generate-wearable' && request.method === 'POST') {
      try {
        let body: any = {};
        try {
          body = await request.json();
        } catch {
          body = {};
        }

        const productTitle = body.productTitle || 'Aviator Classic 3D Eyewear';
        const category = body.category || 'eyewear';
        const imageBase64 = body.image || '';

        // If Gemini API Key is available, use real Gemini 3.8 Flash model
        if (process.env.GEMINI_API_KEY) {
          try {
            const ai = new GoogleGenAI({
              apiKey: process.env.GEMINI_API_KEY,
              httpOptions: {
                headers: {
                  'User-Agent': 'aistudio-build',
                },
              },
            });

            const prompt = `Analyze this product for real-time 3D Virtual Try-On AR fitting.
Product Title: "${productTitle}"
Category: "${category}"
Generate exact physical metric dimensions (in mm), PBR shader properties (hex colors, metalness, roughness, lens transmission), 3D geometry parameters, and landmark anchor calibration coordinates for browser WebGL rendering.`;

            let contents: any;
            if (imageBase64 && imageBase64.includes('base64,')) {
              const mimeMatch = imageBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/);
              const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
              const cleanBase64 = imageBase64.split('base64,')[1];
              contents = {
                parts: [
                  { inlineData: { mimeType, data: cleanBase64 } },
                  { text: prompt },
                ],
              };
            } else {
              contents = prompt;
            }

            const response = await ai.models.generateContent({
              model: 'gemini-3.8-flash',
              contents,
              config: {
                systemInstruction:
                  'You are an expert 3D computer vision and AR wearable engineer specializing in photorealistic PBR virtual try-on models. Generate accurate physical dimensions and PBR values.',
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    sku: { type: Type.STRING },
                    category: { type: Type.STRING },
                    dimensionsMm: {
                      type: Type.OBJECT,
                      properties: {
                        frameWidth: { type: Type.NUMBER },
                        lensWidth: { type: Type.NUMBER },
                        lensHeight: { type: Type.NUMBER },
                        bridgeDistance: { type: Type.NUMBER },
                        templeLength: { type: Type.NUMBER },
                      },
                      required: ['frameWidth', 'lensWidth', 'bridgeDistance'],
                    },
                    geometry: {
                      type: Type.OBJECT,
                      properties: {
                        rimShape: { type: Type.STRING, description: 'aviator, wayfarer, round, or cateye' },
                        rimThickness: { type: Type.NUMBER },
                        hasBrowBar: { type: Type.BOOLEAN },
                        bridgeCurve: { type: Type.NUMBER },
                        lensCurvature: { type: Type.NUMBER },
                      },
                      required: ['rimShape', 'hasBrowBar'],
                    },
                    materials: {
                      type: Type.OBJECT,
                      properties: {
                        frameColorHex: { type: Type.STRING },
                        metalness: { type: Type.NUMBER },
                        roughness: { type: Type.NUMBER },
                        lensColorHex: { type: Type.STRING },
                        lensTransmission: { type: Type.NUMBER },
                        lensRoughness: { type: Type.NUMBER },
                        lensOpacity: { type: Type.NUMBER },
                      },
                      required: ['frameColorHex', 'metalness', 'roughness'],
                    },
                    anchors: {
                      type: Type.OBJECT,
                      properties: {
                        landmarkIndices: { type: Type.ARRAY, items: { type: Type.INTEGER } },
                        offsetY: { type: Type.NUMBER },
                        offsetZ: { type: Type.NUMBER },
                        scaleMultiplier: { type: Type.NUMBER },
                      },
                      required: ['landmarkIndices', 'offsetY', 'offsetZ', 'scaleMultiplier'],
                    },
                    aiInsights: { type: Type.STRING },
                  },
                  required: ['name', 'sku', 'category', 'dimensionsMm', 'geometry', 'materials', 'anchors', 'aiInsights'],
                },
              },
            });

            if (response.text) {
              const parsed = JSON.parse(response.text.trim());
              return new Response(
                JSON.stringify({
                  success: true,
                  source: 'gemini-3.8-flash',
                  wearable: parsed,
                }),
                { headers: corsHeaders }
              );
            }
          } catch (geminiErr: any) {
            console.warn('[AI Wearable Engine] Gemini generation error, using smart fallback:', geminiErr.message);
          }
        }

        // Smart procedural fallback if API key is not present or offline
        const isWatch = category === 'watch' || productTitle.toLowerCase().includes('watch') || productTitle.toLowerCase().includes('chronograph');
        const isJewelry = category === 'jewelry' || productTitle.toLowerCase().includes('pendant') || productTitle.toLowerCase().includes('necklace');
        const isRound = productTitle.toLowerCase().includes('round') || productTitle.toLowerCase().includes('retro');
        const isWayfarer = productTitle.toLowerCase().includes('wayfarer') || productTitle.toLowerCase().includes('acetate');

        let rimShape = 'aviator';
        if (isRound) rimShape = 'round';
        else if (isWayfarer) rimShape = 'wayfarer';

        const isSilver = productTitle.toLowerCase().includes('silver') || productTitle.toLowerCase().includes('platinum');
        const isBlack = productTitle.toLowerCase().includes('black') || productTitle.toLowerCase().includes('onyx');

        const frameColorHex = isSilver ? '#e2e8f0' : isBlack ? '#18181b' : '#d4af37';
        const metalness = isBlack ? 0.4 : 0.9;
        const roughness = isBlack ? 0.4 : 0.15;

        const fallbackWearable = {
          name: productTitle,
          sku: `SKU-${Date.now().toString().slice(-6)}`,
          category: isWatch ? 'watch' : isJewelry ? 'jewelry' : 'eyewear',
          dimensionsMm: isWatch
            ? { frameWidth: 42, lensWidth: 38, lensHeight: 38, bridgeDistance: 20, templeLength: 190 }
            : { frameWidth: 142, lensWidth: 54, lensHeight: 48, bridgeDistance: 16, templeLength: 140 },
          geometry: {
            rimShape,
            rimThickness: isWayfarer ? 0.05 : 0.025,
            hasBrowBar: rimShape === 'aviator',
            bridgeCurve: 0.1,
            lensCurvature: 0.06,
          },
          materials: {
            frameColorHex,
            metalness,
            roughness,
            lensColorHex: '#0f172a',
            lensTransmission: 0.8,
            lensRoughness: 0.08,
            lensOpacity: 0.85,
          },
          anchors: isWatch
            ? {
                landmarkIndices: [0], // Wrist joint
                offsetY: 0.0,
                offsetZ: 0.02,
                scaleMultiplier: 1.0,
              }
            : isJewelry
            ? {
                landmarkIndices: [152], // Chin / Throat
                offsetY: -0.28,
                offsetZ: 0.02,
                scaleMultiplier: 1.0,
              }
            : {
                landmarkIndices: [168, 6], // Glabella
                offsetY: 0.0,
                offsetZ: 0.04,
                scaleMultiplier: 1.0,
              },
          aiInsights: `Extracted PBR parameters from catalog title: ${frameColorHex} ${metalness > 0.5 ? 'Metallic' : 'Acetate'} finish with calibrated ${isWatch ? 'wrist joint' : 'glabella [168]'} anchor.`,
        };

        return new Response(
          JSON.stringify({
            success: true,
            source: 'smart-parametric-engine',
            wearable: fallbackWearable,
          }),
          { headers: corsHeaders }
        );
      } catch (err: any) {
        return new Response(
          JSON.stringify({
            error: 'AI Generation Failed',
            message: err.message,
          }),
          { status: 500, headers: corsHeaders }
        );
      }
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
