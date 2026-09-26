/**
 * @file try-on.ts
 * Core domain types for real-time 3D Virtual Try-On pipeline.
 * Designed for MediaPipe Tasks Vision + Three.js anchor alignment.
 */

export type TryOnCategory = 'eyewear' | 'hat' | 'jewelry' | 'watch' | 'upper_wear';

export interface NormalizedLandmark {
  x: number; // [0.0, 1.0] relative to image width
  y: number; // [0.0, 1.0] relative to image height
  z: number; // Depth relative to landmark origin
  visibility?: number; // [0.0, 1.0]
  presence?: number; // [0.0, 1.0]
}

export interface WorldLandmark {
  x: number; // Real-world 3D coordinates in meters
  y: number;
  z: number;
  visibility?: number;
}

export interface PoseEstimateFrame {
  timestampMs: number;
  faceLandmarks?: NormalizedLandmark[];
  poseLandmarks?: NormalizedLandmark[];
  worldPoseLandmarks?: WorldLandmark[];
  confidence: number;
}

export interface AnchorTransform {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number; w: number }; // Quaternion
  scale: { x: number; y: number; z: number };
}

export interface CalibrationProfile {
  interpupillaryDistanceMm: number; // Average human: 63mm
  faceWidthMm: number;
  cameraFovDeg: number;
  smoothingFactorAlpha: number; // EMA filter factor [0.1 - 0.9]
}
