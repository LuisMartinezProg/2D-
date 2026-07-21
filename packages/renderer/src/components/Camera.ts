import type { EntityId } from '@mochigo/ecs';
import type { Rect } from '@mochigo/math';
import { Rect } from '@mochigo/math';

export class Camera {
  bounds: Rect;
  static readonly componentName = 'Camera';

  constructor(
    public zoom: number = 1,
    public followTarget: EntityId | null = null,
    public followSmoothing: number = 0,
    public bounds: Rect | null = null,
    public active: boolean = true
  ) {}
}
