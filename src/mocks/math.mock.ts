// ============================================================
// MOCK — @mochigo/math
// ============================================================
// Stand-in temporal porque @mochigo/math todavía no existe
// (00-ARQUITECTURA.md sección 9: "Math Library: no iniciado").
// Solo tiene lo mínimo que el Renderer necesita.
//
// Cuando @mochigo/math exista de verdad:
//   1. Borrar este archivo.
//   2. Cambiar los imports de './mocks/math.mock' a '@mochigo/math'.
//   3. Confirmar que Vector2/Rect coinciden en forma con las reales.
// ============================================================

export class Vector2 {
  constructor(
    public x: number = 0,
    public y: number = 0
  ) {}

  static zero(): Vector2 {
    return new Vector2(0, 0);
  }

  static one(): Vector2 {
    return new Vector2(1, 1);
  }

  clone(): Vector2 {
    return new Vector2(this.x, this.y);
  }
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Matriz de transformación afín 2D, mismo orden que
// CanvasRenderingContext2D.setTransform(a, b, c, d, e, f):
//   | a  c  e |
//   | b  d  f |
//   | 0  0  1 |
export class Mat2D {
  constructor(
    public a: number = 1,
    public b: number = 0,
    public c: number = 0,
    public d: number = 1,
    public e: number = 0,
    public f: number = 0
  ) {}

  static identity(): Mat2D {
    return new Mat2D();
  }

  // Construye la matriz local a partir de Transform (orden TRS estándar:
  // primero escala, después rota, después traslada).
  static fromPositionRotationScale(
    position: Vector2,
    rotation: number,
    scale: Vector2
  ): Mat2D {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return new Mat2D(
      cos * scale.x,
      sin * scale.x,
      -sin * scale.y,
      cos * scale.y,
      position.x,
      position.y
    );
  }

  // this * other — "other" se aplica primero. Para sacar el world
  // transform de un hijo: parentWorld.multiply(localChild).
  multiply(other: Mat2D): Mat2D {
    return new Mat2D(
      this.a * other.a + this.c * other.b,
      this.b * other.a + this.d * other.b,
      this.a * other.c + this.c * other.d,
      this.b * other.c + this.d * other.d,
      this.a * other.e + this.c * other.f + this.e,
      this.b * other.e + this.d * other.f + this.f
    );
  }

  equals(other: Mat2D): boolean {
    return (
      this.a === other.a &&
      this.b === other.b &&
      this.c === other.c &&
      this.d === other.d &&
      this.e === other.e &&
      this.f === other.f
    );
  }
}
