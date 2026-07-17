import { Vector2 } from '@mochigo/math';

export class RigidBody {
  static readonly componentName = 'RigidBody';
  constructor(
    public velocity: Vector2 = Vector2.zero(),
    public acceleration: Vector2 = Vector2.zero(),
    public mass: number = 1,
    public isStatic: boolean = false,
    public gravityScale: number = 1
  ) {}
}

export class Collider {
  static readonly componentName = 'Collider';
  constructor(
    public size: Vector2,
    public offset: Vector2 = Vector2.zero(),
    public isTrigger: boolean = false
  ) {}
}
