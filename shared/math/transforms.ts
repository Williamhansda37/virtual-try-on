/**
 * @file transforms.ts
 * Mathematical projection algorithms between MediaPipe normalized coordinates (2D/3D)
 * and Three.js 3D camera coordinate space.
 */

import { NormalizedLandmark, AnchorTransform } from '../types/try-on';

/**
 * Converts MediaPipe normalized landmark [0, 1] to Normalized Device Coordinates (NDC) [-1, 1].
 */
export function landmarkToNDC(landmark: NormalizedLandmark): { x: number; y: number; z: number } {
  return {
    x: landmark.x * 2 - 1,
    y: -(landmark.y * 2 - 1), // Invert Y because WebGL Y is up, Canvas Y is down
    z: landmark.z ?? 0,
  };
}

/**
 * Calculates centroid of a set of landmark indices.
 */
export function computeCentroid(
  landmarks: NormalizedLandmark[],
  indices: number[]
): { x: number; y: number; z: number } {
  let sumX = 0;
  let sumY = 0;
  let sumZ = 0;
  const count = indices.length;

  for (const idx of indices) {
    const lm = landmarks[idx];
    if (lm) {
      sumX += lm.x;
      sumY += lm.y;
      sumZ += lm.z ?? 0;
    }
  }

  return {
    x: sumX / count,
    y: sumY / count,
    z: sumZ / count,
  };
}

/**
 * Computes face orientation quaternion based on key facial landmarks:
 * Nose tip (1), Left Eye Outer (33), Right Eye Outer (263), Chin (152), Glabella (168)
 */
export function estimateHeadOrientation(
  landmarks: NormalizedLandmark[]
): { x: number; y: number; z: number; w: number } {
  const leftEye = landmarks[33];
  const rightEye = landmarks[263];
  const noseTip = landmarks[1];
  const chin = landmarks[152];

  if (!leftEye || !rightEye || !noseTip || !chin) {
    return { x: 0, y: 0, z: 0, w: 1 };
  }

  // Pitch (tilt up/down)
  const dy = chin.y - noseTip.y;
  const dz = (chin.z ?? 0) - (noseTip.z ?? 0);
  const pitch = Math.atan2(dz, dy) * 0.5;

  // Yaw (turn left/right)
  const dxEye = rightEye.x - leftEye.x;
  const dzEye = (rightEye.z ?? 0) - (leftEye.z ?? 0);
  const yaw = Math.atan2(dzEye, dxEye);

  // Roll (tilt ear to shoulder)
  const roll = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x);

  // Convert Euler (pitch, yaw, roll) to approximate Quaternion
  const c1 = Math.cos(pitch / 2);
  const s1 = Math.sin(pitch / 2);
  const c2 = Math.cos(yaw / 2);
  const s2 = Math.sin(yaw / 2);
  const c3 = Math.cos(roll / 2);
  const s3 = Math.sin(roll / 2);

  return {
    x: s1 * c2 * c3 + c1 * s2 * s3,
    y: c1 * s2 * c3 - s1 * c2 * s3,
    z: c1 * c2 * s3 - s1 * s2 * c3,
    w: c1 * c2 * c3 + s1 * s2 * s3,
  };
}

/**
 * Calculates Euclidean distance between two landmarks.
 */
export function landmarkDistance(a: NormalizedLandmark, b: NormalizedLandmark): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = (a.z ?? 0) - (b.z ?? 0);
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}
