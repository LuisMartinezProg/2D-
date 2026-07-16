# Módulo: Game Loop

**Paquete**: `@mochigo/core` → carpeta `packages/core/`
**Depende de**: `@mochigo/ecs`, `@mochigo/events`
**Del mapa de arquitectura**: nivel 1 — orquesta la ejecución de todos los demás
módulos, pero no contiene su lógica interna

## 1. Responsabilidad exacta

Controlar el ciclo update/render del motor: cuándo se llama a `World.update()`,
cuándo se dispara el render, y cómo se maneja el tiempo (delta time, timestep fijo
para física vs timestep variable para render). Es el punto de entrada que arranca y
detiene el motor completo.

## 2. Decisión de arquitectura: fixed timestep para lógica, variable para render

Problema estándar en motores de juego: si la lógica (especialmente física) se
actualiza con un delta time variable (el tiempo real entre frames, que fluctúa según
el dispositivo), el comportamiento del juego se vuelve no determinista y puede
romperse en dispositivos lentos (física inestable, colisiones que se saltan un
frame). La solución estándar de la industria es:

- La lógica de **física y gameplay** se actualiza en pasos de tiempo **fijos** (ej:
  siempre 1/60 de segundo por paso), acumulando el tiempo real transcurrido y
  ejecutando tantos pasos fijos como haga falta para "ponerse al día".
- El **render** se hace una vez por frame real, usando interpolación entre el estado
  anterior y el actual para que el movimiento se vea fluido incluso si la tasa de
  frames no es exactamente 60fps.

## 3. Interfaz exacta

```typescript
interface GameLoopConfig {
  fixedTimestep: number;       // en segundos, default 1/60
  maxCatchUpSteps: number;     // límite de pasos fijos por frame real, para evitar
                                // "espiral de la muerte" si un frame tarda demasiado
                                // (default sugerido: 5)
}

class GameLoop {
  constructor(world: World, eventBus: EventBus, config?: Partial<GameLoopConfig>);

  // Registra la función que se llama en cada paso fijo (física, gameplay lógico)
  onFixedUpdate(callback: (fixedDelta: number) => void): void;

  // Registra la función que se llama una vez por frame real (render), recibe el
  // valor de interpolación (0 a 1) entre el estado del paso fijo anterior y el actual
  onRender(callback: (interpolation: number, frameDelta: number) => void): void;

  start(): void;
  stop(): void;
  pause(): void;   // emite `game:paused`, detiene fixedUpdate pero sigue renderizando
  resume(): void;  // emite `game:resumed`

  isRunning(): boolean;
  isPaused(): boolean;
}
```

Internamente, `start()` usa `requestAnimationFrame` (no `setInterval`/`setTimeout`)
como fuente del loop de render, por ser el estándar del navegador para animaciones
sincronizadas con el refresco de pantalla.

## 4. Eventos

| Evento | Payload | Cuándo se emite |
|---|---|---|
| `game:paused` | `{}` | al llamar `pause()` |
| `game:resumed` | `{}` | al llamar `resume()` |
| `game:started` | `{}` | al llamar `start()` |
| `game:stopped` | `{}` | al llamar `stop()` |

## 5. Checklist de implementación

- [ ] Clase `GameLoop` con la interfaz completa de la sección 3
- [ ] Implementación del acumulador de tiempo fijo (fixed timestep accumulator) según
      el algoritmo estándar: acumular delta real, mientras el acumulador sea mayor o
      igual al timestep fijo, ejecutar un paso fijo y restar el timestep del
      acumulador; el resto se usa para calcular la interpolación pasada a `onRender`
- [ ] Protección contra "espiral de la muerte": si el número de pasos fijos
      necesarios en un frame excede `maxCatchUpSteps`, descartar el tiempo sobrante en
      vez de seguir acumulando deuda (documentar esto claramente en el código, es una
      decisión deliberada de trade-off entre determinismo y estabilidad)
- [ ] `pause()`/`resume()` deben afectar solo a `onFixedUpdate` — `onRender` sigue
      corriendo en pausa (para que el Editor Visual pueda seguir mostrando la escena
      congelada sin que se vea "trabada")
- [ ] Tests: verificar que con un delta time simulado grande (ej: simular que el
      navegador se congeló 2 segundos), el fixed update se llama el número correcto de
      veces sin exceder `maxCatchUpSteps`
- [ ] Tests: verificar que `interpolation` pasado a `onRender` está siempre en el
      rango [0, 1]
- [ ] Mock de `requestAnimationFrame` para poder testear el loop sin un navegador real
      (usar algo como `vi.useFakeTimers` de Vitest o un mock manual)
