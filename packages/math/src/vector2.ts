/**
 * Vector2: inmutable. Ningún método muta la instancia sobre la que se llama;
 * todos devuelven una instancia nueva. Esto es intencional (confirmado por uso
 * real en PhysicsSystem, que reconstruye con `new Vector2(...)` en vez de
 * mutar position.x/velocity.x directo).
 */
export class Vector2 {
  readonly x: number;
  readonly y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  static zero(): Vector2 {
    return new Vector2(0, 0);
  }

  static one(): Vector2 {
    return new Vector2(1, 1);
  }

  add(other: Vector2): Vector2 {
    return new Vector2(this.x + other.x, this.y + other.y);
  }

  subtract(other: Vector2): Vector2 {
    return new Vector2(this.x - other.x, this.y - other.y);
  }

  scale(scalar: number): Vector2 {
    return new Vector2(this.x * scalar, this.y * scalar);
  }

  multiply(other: Vector2): Vector2 {
    return new Vector2(this.x * other.x, this.y * other.y);
  }

  negate(): Vector2 {
    return new Vector2(-this.x, -this.y);
  }

  magnitude(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  magnitudeSquared(): number {
    return this.x * this.x + this.y * this.y;
  }

  normalize(): Vector2 {
    const mag = this.magnitude();
    if (mag === 0) {
      return Vector2.zero();
    }
    return new Vector2(this.x / mag, this.y / mag);
  }

  dot(other: Vector2): number {
    return this.x * other.x + this.y * other.y;
  }

  distanceTo(other: Vector2): number {
    return this.subtract(other).magnitude();
  }

  distanceSquaredTo(other: Vector2): number {
    return this.subtract(other).magnitudeSquared();
  }

  lerp(other: Vector2, t: number): Vector2 {
    return new Vector2(
      this.x + (other.x - this.x) * t,
      this.y + (other.y - this.y) * t
    );
  }

  equals(other: Vector2): boolean {
    return this.x === other.x && this.y === other.y;
  }

  clone(): Vector2 {
    return new Vector2(this.x, this.y);
  }

  toString(): string {
    return `Vector2(${this.x}, ${this.y})`;
  }
}
