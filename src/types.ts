import type { Vector2 } from '@mochigo/math';

/**
 * Asunciones sobre @mochigo/math (todavía "no iniciado", mismo caso que en
 * @mochigo/ecs): Vector2 con constructor(x, y) y estáticos zero()/one()
 * (confirmado por el uso en Transform de ECS). Rect se asume con forma
 * { x, y, width, height } — inferido de su uso en Sprite.sourceRect y
 * Camera.bounds, todavía sin confirmar en math.
 */

export interface RendererConfig {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  backgroundColor: string;
  pixelArt: boolean;
}

/** Transformación mundial ya resuelta (jerarquía padre-hijo aplanada). */
export interface ResolvedTransform {
  position: Vector2;
  rotation: number;
  scale: Vector2;
}
