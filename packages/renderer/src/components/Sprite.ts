import type { Rect } from '@mochigo/math';
import { Rect } from '@mochigo/math';
export class Sprite {
  static readonly componentName = 'Sprite';
 
export class Sprite {
  sourceRect: Rect;
  constructor(
    public textureId: string,
    public sourceRect: Rect | null = null,
    public layer: number = 0,
    public tint: string = '#FFFFFF',
    public opacity: number = 1,
    public flipX: boolean = false,
    public flipY: boolean = false,
    public visible: boolean = true
  ) {}
}
