/**
 * @file asset.ts
 * 3D Asset specifications and metadata schemas for Virtual Try-On models.
 */

import { TryOnCategory } from './try-on';

export interface BoneAnchorDefinition {
  boneName: string;
  landmarkIndices: number[]; // MediaPipe landmark indices used to solve position/orientation
  offset: [number, number, number]; // [X, Y, Z] spatial offset from landmark centroid (meters)
  rotationOffsetEuler: [number, number, number]; // [Pitch, Yaw, Roll] in radians
  scaleMultiplier: number;
}

export interface ModelAssetMetadata {
  id: string;
  sku: string;
  name: string;
  category: TryOnCategory;
  modelUrl: string; // CDN URL to compressed GLB (Draco optimized)
  thumbnailUrl: string;
  fileSizeBytes: number;
  polyCount: number;
  boneAnchors: BoneAnchorDefinition[];
  occlusionMesh?: string; // Optional URL for human head/neck depth mask
  defaultScale: [number, number, number];
  materials: {
    slotName: string;
    type: 'pbr' | 'translucent' | 'metallic';
    colorHex: string;
    roughness?: number;
    metalness?: number;
    transmission?: number;
  }[];
  createdAt: string;
  version: string;
}

export interface AssetManifest {
  manifestVersion: string;
  updatedAt: string;
  items: ModelAssetMetadata[];
}
