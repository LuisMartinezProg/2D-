import type { Vector2 } from '@mochigo/math';

export interface RendererConfig {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  backgroundColor: string;
  pixelArt: boolean;
}

export interface ResolvedTransform {
  position: Vector2;
  rotation: number;
  scale: Vector2;
}
