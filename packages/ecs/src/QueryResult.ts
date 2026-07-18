import { Vector2 } from '@mochigo/math';
import type { EntityId } from '../types';

export class Transform {
  static readonly componentName = 'Transform';

  constructor(
    public position: Vector2 = Vector2.zero(),
    public rotation: number = 0,
    public scale: Vector2 = Vector2.one(),
    public parent: EntityId | null = null
  ) {}
}
