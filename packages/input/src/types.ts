import type { Vector2 } from '@mochigo/math';

export interface TouchPoint {
  id: number;
  position: Vector2;
  startPosition: Vector2;
  delta: Vector2;
}

export interface VirtualJoystickConfig {
  region: Rect;
  deadZone: number;
  maxRadius: number;
}

// Reexportado localmente por conveniencia; el tipo real vive en @mochigo/math
// según la nota de asunciones vista en el módulo Renderer.
import type { Rect } from '@mochigo/math';
export type { Rect };
