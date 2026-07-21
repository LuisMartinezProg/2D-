import { Vector2 } from '@mochigo/math';

export class Transform {
  position: Vector2;
  rotation: number;
  scale: Vector2;

  constructor(
    position: Vector2 = Vector2.zero(),
    rotation: number = 0,
    scale: Vector2 = Vector2.one()
  ) {
    this.position = position;
    this.rotation = rotation;
    this.scale = scale;
  }
}
