import { Vector2 } from '@mochigo/math';
import type { EntityId } from './EntityId';

export class Transform {
  static readonly componentName = 'Transform';

  position: Vector2;
  rotation: number;
  scale: Vector2;
  parent: EntityId | null;

  constructor(
    position: Vector2 = Vector2.zero(),
    rotation: number = 0,
    scale: Vector2 = Vector2.one(),
    parent: EntityId | null = null
  ) {
    this.position = position;
    this.rotation = rotation;
    this.scale = scale;
    this.parent = parent;
  }
}
