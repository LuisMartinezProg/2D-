import { Vector2 } from './vector2';

/**
 * Matriz de transformación 2D (3x3 representada como 6 valores):
 *   a c e
 *   b d f
 *   0 0 1
 * Formato compatible 1:1 con CanvasRenderingContext2D.setTransform(a,b,c,d,e,f).
 */
export class Matrix2D {
  constructor(
    public a: number,
    public b: number,
    public c: number,
    public d: number,
    public e: number,
    public f: number
  ) {}

  static identity(): Matrix2D {
    return new Matrix2D(1, 0, 0, 1, 0, 0);
  }

  static translation(x: number, y: number): Matrix2D {
    return new Matrix2D(1, 0, 0, 1, x, y);
  }

  static rotation(radians: number): Matrix2D {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return new Matrix2D(cos, sin, -sin, cos, 0, 0);
  }

  static scaling(sx: number, sy: number): Matrix2D {
    return new Matrix2D(sx, 0, 0, sy, 0, 0);
  }

  /** this * other (aplica `other` primero, luego `this` — orden estándar de composición de transformaciones). */
  multiply(other: Matrix2D): Matrix2D {
    return new Matrix2D(
      this.a * other.a + this.c * other.b,
      this.b * other.a + this.d * other.b,
      this.a * other.c + this.c * other.d,
      this.b * other.c + this.d * other.d,
      this.a * other.e + this.c * other.f + this.e,
      this.b * other.e + this.d * other.f + this.f
    );
  }

  invert(): Matrix2D {
    const det = this.a * this.d - this.b * this.c;
    if (det === 0) {
      // Matriz no invertible (degenerada, ej. escala 0): identidad como
      // fallback seguro en vez de propagar NaN/Infinity al resto del motor.
      return Matrix2D.identity();
    }
    const invDet = 1 / det;
    const a = this.d * invDet;
    const b = -this.b * invDet;
    const c = -this.c * invDet;
    const d = this.a * invDet;
    const e = -(a * this.e + c * this.f);
    const f = -(b * this.e + d * this.f);
    return new Matrix2D(a, b, c, d, e, f);
  }

  transformPoint(point: Vector2): Vector2 {
    return new Vector2(
      this.a * point.x + this.c * point.y + this.e,
      this.b * point.x + this.d * point.y + this.f
    );
  }

  /** Ignora la traslación — para direcciones/magnitudes, no posiciones. */
  transformVector(vector: Vector2): Vector2 {
    return new Vector2(
      this.a * vector.x + this.c * vector.y,
      this.b * vector.x + this.d * vector.y
    );
  }

  toCanvasTransform(): [number, number, number, number, number, number] {
    return [this.a, this.b, this.c, this.d, this.e, this.f];
  }
}
