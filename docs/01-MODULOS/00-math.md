# Módulo: Math Library

**Paquete**: `@mochigo/math` → carpeta `packages/math/`
**Depende de**: nada (es la base de todo)
**Del mapa de arquitectura**: nivel 0 (todos dependen de este módulo)

## 1. Responsabilidad exacta

Proveer las estructuras matemáticas de 2D que **todos** los demás módulos van a usar:
vectores, matrices de transformación 2D, y utilidades de interpolación/easing. No
contiene lógica de juego, ni conoce el ECS, ni el renderer. Es una librería pura de
matemáticas, sin efectos secundarios, 100% testeable de forma aislada.

## 2. Estructuras de datos (interfaces exactas)

```typescript
// Vector 2D — inmutable en las operaciones (cada operación retorna un nuevo Vector2)
class Vector2 {
  constructor(public readonly x: number, public readonly y: number) {}

  static zero(): Vector2;
  static one(): Vector2;
  static from(x: number, y: number): Vector2;

  add(other: Vector2): Vector2;
  subtract(other: Vector2): Vector2;
  scale(scalar: number): Vector2;
  dot(other: Vector2): number;
  length(): number;
  lengthSquared(): number;   // evitar sqrt cuando solo se necesita comparar magnitudes
  normalize(): Vector2;
  distanceTo(other: Vector2): number;
  angle(): number;           // en radianes
  rotate(radians: number): Vector2;
  lerp(other: Vector2, t: number): Vector2;
  equals(other: Vector2, epsilon?: number): boolean;
  clone(): Vector2;
  toArray(): [number, number];
}

// Matriz de transformación 2D (3x3, representada como 6 valores — formato estándar
// para transformaciones afines 2D, compatible 1:1 con CanvasRenderingContext2D.setTransform)
class Matrix2D {
  // a c e
  // b d f
  // 0 0 1
  constructor(
    public a: number, public b: number,
    public c: number, public d: number,
    public e: number, public f: number
  ) {}

  static identity(): Matrix2D;
  static translation(x: number, y: number): Matrix2D;
  static rotation(radians: number): Matrix2D;
  static scaling(sx: number, sy: number): Matrix2D;

  multiply(other: Matrix2D): Matrix2D;
  invert(): Matrix2D;
  transformPoint(point: Vector2): Vector2;
  transformVector(vector: Vector2): Vector2;  // ignora la traslación (para direcciones, no posiciones)
  toCanvasTransform(): [number, number, number, number, number, number]; // para ctx.setTransform(...)
}

// Rectángulo alineado a ejes — usado por Renderer, Physics (AABB) y Asset Manager (atlas regions)
interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Utilidades de easing/interpolación — funciones puras, todas con firma (t: number) => number
// donde t está en [0, 1] y el retorno también debe estar (idealmente) en [0, 1]
namespace Easing {
  function linear(t: number): number;
  function easeInQuad(t: number): number;
  function easeOutQuad(t: number): number;
  function easeInOutQuad(t: number): number;
  function easeInCubic(t: number): number;
  function easeOutCubic(t: number): number;
  function easeInOutCubic(t: number): number;
}

function lerp(a: number, b: number, t: number): number;
function clamp(value: number, min: number, max: number): number;
function degToRad(degrees: number): number;
function radToDeg(radians: number): number;
```

## 3. Eventos

Ninguno. Este módulo no emite ni escucha eventos — es matemática pura.

## 4. Decisiones de diseño importantes

- **Inmutabilidad en `Vector2`**: cada operación retorna una nueva instancia en vez de
  mutar `this`. Es más seguro (evita bugs por aliasing) a costa de más allocations;
  para un motor 2D orientado a hobby/indie, la claridad importa más que exprimir el
  último % de rendimiento aquí. Si en el futuro se detecta que esto es un cuello de
  botella real (medido, no asumido), se puede añadir una variante mutable
  (`Vector2Mutable` o métodos `addInPlace`, etc.) sin romper esta API.
- **`Matrix2D` en formato de 6 valores**: se eligió deliberadamente para que
  `toCanvasTransform()` mapee 1:1 con `CanvasRenderingContext2D.setTransform(a, b, c,
  d, e, f)`, sin conversión adicional cuando el Renderer dibuje.
- **`Rect` es una interfaz plana, no una clase**: se usa constantemente en hot paths
  (colisiones, atlas lookup) — mantenerlo como objeto plano evita overhead de métodos
  de clase donde no se necesitan.

## 5. Checklist de implementación

- [ ] `Vector2`: todos los métodos listados arriba, con tests unitarios para cada uno
      (incluyendo casos borde: vector cero, normalize de vector cero debe manejarse sin
      lanzar `NaN`)
- [ ] `Matrix2D`: todos los métodos listados, con tests que verifiquen que
      `matrix.multiply(matrix.invert())` da como resultado (aprox.) la identidad
- [ ] `Rect`: función utilitaria `rectsIntersect(a: Rect, b: Rect): boolean` (se usa en
      Physics para el broad-phase, ver `01-MODULOS/06-physics.md`)
- [ ] Namespace `Easing` con las 6 funciones listadas, con tests verificando que
      `easing(0) === 0` y `easing(1) === 1` para todas
- [ ] Funciones sueltas `lerp`, `clamp`, `degToRad`, `radToDeg` con tests
- [ ] 100% de cobertura de tests (este módulo es la base de todo, no puede tener bugs
      silenciosos)
- [ ] `README.md` del paquete con ejemplos de uso de cada estructura
- [ ] Exportar todo desde un único `index.ts` en la raíz del paquete
