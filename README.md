# @mochigo/math

Estructuras matemáticas 2D para MochiGo Engine: vectores, matrices de
transformación, rectángulos y utilidades de interpolación/easing. Sin
dependencias — es la base de la que dependen todos los demás paquetes del motor.

Ver la especificación completa en `docs/01-MODULOS/00-math.md` del repo raíz.

## Instalación

Dentro del monorepo, este paquete se referencia como `@mochigo/math` desde
cualquier otro paquete en `packages/*/package.json`.

## Uso

### Vector2

Inmutable — cada operación retorna una nueva instancia.

```typescript
import { Vector2 } from "@mochigo/math";

const position = Vector2.from(100, 200);
const velocity = Vector2.from(5, 0);

// Mover una posición (nunca muta `position`, retorna una nueva)
const nextPosition = position.add(velocity.scale(deltaTime));

// Dirección normalizada hacia un objetivo
const target = Vector2.from(300, 200);
const direction = target.subtract(position).normalize();

// Interpolar entre dos puntos (útil para cámaras suaves, tweens simples)
const smoothed = position.lerp(target, 0.1);

// El vector cero se maneja de forma segura al normalizar (no produce NaN)
const stillVector = Vector2.zero().normalize(); // → Vector2.zero()
```

### Matrix2D

Formato de 6 valores compatible 1:1 con
`CanvasRenderingContext2D.setTransform(a, b, c, d, e, f)`.

```typescript
import { Matrix2D, Vector2 } from "@mochigo/math";

// Componer transformaciones: trasladar, luego rotar, luego escalar
const transform = Matrix2D.translation(200, 150)
  .multiply(Matrix2D.rotation(Math.PI / 4))
  .multiply(Matrix2D.scaling(2, 2));

// Aplicar directamente al contexto de canvas
const ctx = canvas.getContext("2d")!;
ctx.setTransform(...transform.toCanvasTransform());

// Transformar un punto manualmente (por ejemplo, para hit-testing)
const worldPoint = transform.transformPoint(Vector2.from(10, 10));

// Invertir para ir de coordenadas de pantalla a coordenadas locales
const localPoint = transform.invert().transformPoint(screenClickPosition);
```

### Rect

Interfaz plana (no clase) — se usa en hot paths como colisiones y lookup de
regiones de atlas.

```typescript
import { type Rect, rectsIntersect } from "@mochigo/math";

const player: Rect = { x: 0, y: 0, width: 32, height: 32 };
const enemy: Rect = { x: 20, y: 10, width: 32, height: 32 };

if (rectsIntersect(player, enemy)) {
  // manejar colisión
}
```

### Easing

Funciones puras `(t: number) => number`, con `t` en `[0, 1]`.

```typescript
import { Easing, lerp } from "@mochigo/math";

function animateValue(from: number, to: number, t: number): number {
  const easedT = Easing.easeOutCubic(t);
  return lerp(from, to, easedT);
}
```

### Utilidades sueltas

```typescript
import { lerp, clamp, degToRad, radToDeg } from "@mochigo/math";

const health = clamp(currentHealth - damage, 0, maxHealth);
const angleInRadians = degToRad(45);
```

## Scripts

```bash
npm run build        # compila a dist/ con declaraciones de tipos
npm run test          # corre la suite de tests una vez
npm run test:watch    # corre tests en modo watch
npm run test:bench    # corre benchmarks (si se agregan a futuro)
npm run typecheck     # solo verifica tipos, sin emitir output
```

## Cobertura

Este paquete exige 100% de cobertura de tests (líneas, funciones, branches y
statements) — ver `vitest.config.ts`. Es la base matemática de todo el motor,
por lo que no puede tener bugs silenciosos.

## Decisiones de diseño

Ver `docs/01-MODULOS/00-math.md` sección 4 para el razonamiento detrás de:

- Por qué `Vector2` es inmutable en vez de mutable
- Por qué `Matrix2D` usa el formato de 6 valores en vez de una matriz 3x3 completa
- Por qué `Rect` es una interfaz plana y no una clase
