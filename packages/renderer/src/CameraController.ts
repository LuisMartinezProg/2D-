import type { Rect } from '@mochigo/math';
import { Vector2 } from '@mochigo/math';

export class CameraController {
  private smoothedPosition: Vector2 | null = null;
  private lastUpdateTimeMs: number | null = null;

  reset(): void {
    this.smoothedPosition = null;
    this.lastUpdateTimeMs = null;
  }

  computeViewPosition(
    desiredPosition: Vector2,
    followSmoothing: number,
    bounds: Rect | null,
    viewportWidth: number,
    viewportHeight: number,
    zoom: number
  ): Vector2 {
    const now = performance.now();
    const dt = this.lastUpdateTimeMs === null ? 0 : (now - this.lastUpdateTimeMs) / 1000;
    this.lastUpdateTimeMs = now;

    if (this.smoothedPosition === null || followSmoothing <= 0) {
      this.smoothedPosition = desiredPosition;
    } else {
      const alpha = 1 - Math.exp(-dt / followSmoothing);
      this.smoothedPosition = new Vector2(
        lerp(this.smoothedPosition.x, desiredPosition.x, alpha),
        lerp(this.smoothedPosition.y, desiredPosition.y, alpha)
      );
    }

    return clampToBounds(this.smoothedPosition, bounds, viewportWidth, viewportHeight, zoom);
  }
}

function lerp(from: number, to: number, alpha: number): number {
  return from + (to - from) * alpha;
}

export function clampToBounds(
  position: Vector2,
  bounds: Rect | null,
  viewportWidth: number,
  viewportHeight: number,
  zoom: number
): Vector2 {
  if (!bounds) return position;

  const halfViewW = viewportWidth / zoom / 2;
  const halfViewH = viewportHeight / zoom / 2;

  return new Vector2(
    clampAxis(position.x, bounds.x, bounds.width, halfViewW),
    clampAxis(position.y, bounds.y, bounds.height, halfViewH)
  );
}

function clampAxis(value: number, boundsMin: number, boundsSize: number, halfViewport: number): number {
  const min = boundsMin + halfViewport;
  const max = boundsMin + boundsSize - halfViewport;
  if (min > max) return boundsMin + boundsSize / 2;
  return Math.min(Math.max(value, min), max);
}
