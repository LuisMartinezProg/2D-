import { Vector2 } from '@mochigo/math';

/**
 * Transform de prueba, con la misma forma confirmada indirectamente por
 * el JSON de ejemplo en 09-scenes.md ({ position, rotation, scale }) -
 * no se importa el Transform real de @mochigo/renderer porque no
 * confirmamos su archivo real en este chat.
 */
export class TestTransform {
  static readonly componentName = 'Transform';
  constructor(
    public position: Vector2 = Vector2.zero(),
    public rotation: number = 0,
    public scale: Vector2 = Vector2.one()
  ) {}
}
