/**
 * Vector 2D inmutable. Cada operación retorna una nueva instancia en vez de mutar
 * `this` — más seguro (evita bugs por aliasing) a costa de más allocations. Ver
 * decisión de diseño en docs/01-MODULOS/00-math.md sección 4.
 */
export class Vector2 {
  constructor(
    public readonly x: number,
    public readonly y: number
  ) {}

  static zero(): Vector2 {
    return new Vector2(0, 0);
  }

  static one(): Vector2 {
    return new Vector2(1, 1);
  }

  static from(x: number, y: number): Vector2 {
    return new Vector2(x, y);
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

  dot(other: Vector2): number {
    return this.x * other.x + this.y * other.y;
  }

  lengthSquared(): number {
    return this.x * this.x + this.y * this.y;
  }

  length(): number {
    return Math.sqrt(this.lengthSquared());
  }

  /**
   * Vector unitario en la misma dirección. Caso borde: normalizar el vector cero
   * matemáticamente no está definido (división por longitud 0). En vez de propagar
   * NaN al resto del motor —que sería un bug silencioso muy difícil de rastrear en
   * quien lo consuma— se retorna Vector2.zero() de forma explícita y documentada.
   */
  normalize(): Vector2 {
    const len = this.length();
    if (len === 0) {
      return Vector2.zero();
    }
    return new Vector2(this.x / len, this.y / len);
  }

  distanceTo(other: Vector2): number {
    return this.subtract(other).length();
  }

  /**
   * Ángulo del vector respecto al eje +X, en radianes, usando atan2 (maneja
   * correctamente los 4 cuadrantes, incluyendo el vector cero que retorna 0).
   */
  angle(): number {
    return Math.atan2(this.y, this.x);
  }

  rotate(radians: number): Vector2 {
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return new Vector2(
      this.x * cos - this.y * sin,
      this.x * sin + this.y * cos
    );
  }

  lerp(other: Vector2, t: number): Vector2 {
    return new Vector2(
      this.x + (other.x - this.x) * t,
      this.y + (other.y - this.y) * t
    );
  }

  equals(other: Vector2, epsilon = 1e-6): boolean {
    return Math.abs(this.x - other.x) <= epsilon && Math.abs(this.y - other.y) <= epsilon;
  }

  clone(): Vector2 {
    return new Vector2(this.x, this.y);
  }

  toArray(): [number, number] {
    return [this.x, this.y];
  }
}
