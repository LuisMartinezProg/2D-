import { Vector2 } from './Vector2';

/**
 * Rect: inmutable, igual que Vector2. Representa un rectángulo alineado a
 * ejes (AABB) mediante x/y (esquina superior-izquierda) + width/height.
 * Usado como forma de Sprite.sourceRect y Camera.bounds.
 */
export class Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;

  constructor(x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  static zero(): Rect {
    return new Rect(0, 0, 0, 0);
  }

  static fromCenter(center: Vector2, width: number, height: number): Rect {
    return new Rect(center.x - width / 2, center.y - height / 2, width, height);
  }

  get left(): number {
    return this.x;
  }

  get right(): number {
    return this.x + this.width;
  }

  get top(): number {
    return this.y;
  }

  get bottom(): number {
    return this.y + this.height;
  }

  get center(): Vector2 {
    return new Vector2(this.x + this.width / 2, this.y + this.height / 2);
  }

  get position(): Vector2 {
    return new Vector2(this.x, this.y);
  }

  get size(): Vector2 {
    return new Vector2(this.width, this.height);
  }

  contains(point: Vector2): boolean {
    return (
      point.x >= this.left &&
      point.x <= this.right &&
      point.y >= this.top &&
      point.y <= this.bottom
    );
  }

  intersects(other: Rect): boolean {
    return rectsIntersect(this, other);
  }

  translate(offset: Vector2): Rect {
    return new Rect(this.x + offset.x, this.y + offset.y, this.width, this.height);
  }

  equals(other: Rect): boolean {
    return (
      this.x === other.x &&
      this.y === other.y &&
      this.width === other.width &&
      this.height === other.height
    );
  }

  clone(): Rect {
    return new Rect(this.x, this.y, this.width, this.height);
  }

  toString(): string {
    return `Rect(${this.x}, ${this.y}, ${this.width}, ${this.height})`;
  }
}

/**
 * Test AABB-AABB exacto. Exportada como función standalone (no solo método)
 * porque @mochigo/physics ya la importa así en su narrow phase.
 */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}
