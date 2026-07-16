# Módulo: Animation System

**Paquete**: `@mochigo/animation` → carpeta `packages/animation/`
**Depende de**: `@mochigo/math`, `@mochigo/ecs`, `@mochigo/renderer` (usa el componente `Sprite`), `@mochigo/events`
**Del mapa de arquitectura**: nivel 3 — construye sobre Renderer

## 1. Responsabilidad exacta

Animar sprites basados en sprite sheets (secuencias de frames dentro de un atlas de
textura), y manejar transiciones entre distintas animaciones de una misma entidad
(ej: pasar de "idle" a "correr"). No dibuja nada directamente — modifica el
`sourceRect` del componente `Sprite` (definido en `04-renderer.md`) frame a frame; el
Renderer se encarga de dibujar ese `sourceRect` actualizado.

## 2. Estructuras de datos

```typescript
// Definición de una animación — típicamente cargada desde JSON vía Asset Manager
interface AnimationClip {
  name: string;
  frames: Rect[];        // secuencia de source rects dentro del atlas, en orden
  frameDuration: number; // segundos por frame (asume duración uniforme; ver nota abajo)
  loopMode: "once" | "loop" | "ping-pong";
}

class Animator {
  static readonly componentName = "Animator";
  constructor(
    public clips: Map<string, AnimationClip>,
    public currentClip: string | null = null,
    public currentFrameIndex: number = 0,
    public elapsedInFrame: number = 0,
    public playing: boolean = false,
    public playbackSpeed: number = 1  // multiplicador, 1 = velocidad normal
  ) {}
}
```

Nota sobre duración uniforme: la primera versión asume que todos los frames de un
clip duran lo mismo (`frameDuration` único para todo el clip). Si a futuro se
necesitan clips con frames de duración variable, se puede extender `frames` a un
array de `{ rect: Rect, duration: number }` sin romper la forma general de la
interfaz — no implementar esto ahora, dejar la simplicidad uniforme para la v1.

## 3. Interfaz del sistema

```typescript
class AnimationSystem implements System {
  readonly name = "AnimationSystem";
  constructor(eventBus: EventBus);
  update(world: World, deltaTime: number): void;
}

// Funciones de control expuestas para que Scripting las llame sobre una entidad concreta
function playAnimation(world: World, entity: EntityId, clipName: string, restart?: boolean): void;
function stopAnimation(world: World, entity: EntityId): void;
function pauseAnimation(world: World, entity: EntityId): void;
```

## 4. Lógica de avance de frames (comportamiento exacto por `loopMode`)

- **`once`**: avanza frame por frame; al llegar al último frame, se queda ahí, pone
  `playing = false`, y emite `animation:completed`.
- **`loop`**: al llegar al último frame, vuelve al frame 0 y sigue.
- **`ping-pong`**: avanza hasta el último frame, luego retrocede hasta el frame 0, y
  repite indefinidamente (no emite `animation:completed`, ya que no tiene un final
  natural — solo se detiene si algo externo llama `stopAnimation`).

## 5. Eventos

| Evento | Payload | Cuándo se emite |
|---|---|---|
| `animation:frame-changed` | `{ entityId: EntityId, frameIndex: number }` | cada vez que `currentFrameIndex` cambia |
| `animation:completed` | `{ entityId: EntityId, animationName: string }` | solo para `loopMode: "once"`, al llegar al final |

## 6. Checklist de implementación

- [ ] Componente `Animator` y tipo `AnimationClip` tal como están especificados
- [ ] `AnimationSystem.update()`: recorre entidades con `Animator` + `Sprite`,
      avanza `elapsedInFrame` según `deltaTime * playbackSpeed`, y cuando supera
      `frameDuration`, avanza `currentFrameIndex` según la lógica de `loopMode` de la
      sección 4, y actualiza `Sprite.sourceRect` al rect correspondiente
- [ ] `playAnimation`/`stopAnimation`/`pauseAnimation` implementadas
- [ ] `playAnimation` con `restart: false` (o sin ese argumento) sobre un clip que ya
      está sonando no debe reiniciarlo desde el frame 0 — debe ser un no-op si ya es el
      clip activo
- [ ] Emisión de ambos eventos de la sección 5 en los momentos correctos
- [ ] Tests: los tres `loopMode` se comportan exactamente como se describe en la
      sección 4, incluyendo el caso borde de un clip de un solo frame
- [ ] Tests: cambiar de clip a mitad de animación reinicia correctamente
      `currentFrameIndex` y `elapsedInFrame`
- [ ] Tests: `playbackSpeed` de 2 avanza los frames al doble de velocidad; `0`
      congela la animación sin avanzar (sin dividir por cero en ningún cálculo)
