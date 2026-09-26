/**
 * @file filter.ts
 * Jitter filtering and smoothing algorithms for 3D Pose and Landmark trajectories.
 * Prevents high-frequency tremor in browser-based AR try-on.
 */

export class ExponentialMovingAverageFilter {
  private alpha: number;
  private previousValue: number | null = null;

  constructor(alpha: number = 0.4) {
    this.alpha = Math.max(0.01, Math.min(1.0, alpha));
  }

  public filter(currentValue: number): number {
    if (this.previousValue === null) {
      this.previousValue = currentValue;
      return currentValue;
    }
    const filtered = this.alpha * currentValue + (1 - this.alpha) * this.previousValue;
    this.previousValue = filtered;
    return filtered;
  }

  public reset(): void {
    this.previousValue = null;
  }
}

export class Vector3EMAFilter {
  private filterX: ExponentialMovingAverageFilter;
  private filterY: ExponentialMovingAverageFilter;
  private filterZ: ExponentialMovingAverageFilter;

  constructor(alpha: number = 0.35) {
    this.filterX = new ExponentialMovingAverageFilter(alpha);
    this.filterY = new ExponentialMovingAverageFilter(alpha);
    this.filterZ = new ExponentialMovingAverageFilter(alpha);
  }

  public filter(vec: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
    return {
      x: this.filterX.filter(vec.x),
      y: this.filterY.filter(vec.y),
      z: this.filterZ.filter(vec.z),
    };
  }

  public reset(): void {
    this.filterX.reset();
    this.filterY.reset();
    this.filterZ.reset();
  }
}
