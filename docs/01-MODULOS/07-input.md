# Módulo: Input Manager

**Paquete**: `@mochigo/input` → carpeta `packages/input/`
**Depende de**: `@mochigo/math`, `@mochigo/events`
**Del mapa de arquitectura**: nivel 1 — no depende del ECS directamente, es consumido
por Scripting

## 1. Responsabilidad exacta

Capturar y normalizar la entrada del usuario: teclado, mouse, y **táctil (touch)**.
El soporte táctil es de importancia crítica en este proyecto porque el motor debe
poder probarse desde celular — no es un caso secundario del input, es un ciudadano de
primera clase igual que teclado/mouse. Incluye un widget de joystick virtual listo
para usar, ya que es el patrón de control más común en juegos móviles 2D.

## 2. Interfaz principal

```typescript
interface TouchPoint {
  id: number;           // identifica un dedo específico a través de múltiples eventos
                          // (multi-touch: cada dedo mantiene su id mientras esté en pantalla)
  position: Vector2;
  startPosition: Vector2;
  delta: Vector2;        // movimiento desde el evento anterior de ese mismo touch
}

class InputManager {
  constructor(targetElement: HTMLElement, eventBus: EventBus);

  // Teclado
  isKeyDown(key: string): boolean;
  isKeyPressed(key: string): boolean;   // true solo en el frame exacto en que se presionó
  isKeyReleased(key: string): boolean;  // true solo en el frame exacto en que se soltó

  // Mouse (también usado como fallback de touch en desktop, ver sección 4)
  getMousePosition(): Vector2;
  isMouseButtonDown(button: number): boolean;

  // Touch
  getActiveTouches(): TouchPoint[];
  getTouch(id: number): TouchPoint | undefined;

  // Debe llamarse una vez por frame, típicamente desde el onFixedUpdate del Game Loop,
  // para actualizar los estados "pressed"/"released" de un solo frame y limpiar deltas
  update(): void;
}
```

## 3. Virtual Joystick — componente de input listo para usar

```typescript
interface VirtualJoystickConfig {
  region: Rect;           // área de la pantalla donde este joystick responde a touches
  deadZone: number;        // radio mínimo de movimiento antes de reportar dirección, 0 a 1
  maxRadius: number;       // radio máximo del joystick en píxeles
}

class VirtualJoystick {
  constructor(config: VirtualJoystickConfig, inputManager: InputManager);

  // Vector normalizado (magnitud entre 0 y 1) de la dirección actual del joystick;
  // Vector2.zero() si no está siendo tocado
  getDirection(): Vector2;
  isActive(): boolean;
}
```

Basado en el patrón estándar investigado (usado por GameMaker, Godot, y la mayoría de
motores móviles): cada joystick virtual reclama un `id` de touch específico apenas
detecta un `touchstart` dentro de su `region`, e ignora cualquier otro touch hasta que
ese id se libera (`touchend`) — esto es lo que permite tener, por ejemplo, un
joystick de movimiento con un dedo y un botón de acción con otro, simultáneamente
(multi-touch real, no solo un puntero a la vez).

## 4. Decisión de arquitectura: mouse como fallback de touch en desktop

Para que el mismo código de gameplay (escrito contra eventos `input:touch-*`)
funcione igual probando en desktop (donde no hay pantalla táctil) y en celular real,
el `InputManager` debe **sintetizar** eventos de touch a partir de eventos de mouse
cuando el dispositivo no reporta soporte táctil: `mousedown` → `input:touch-start` con
`id: 0`, `mousemove` mientras el botón está presionado → `input:touch-move`,
`mouseup` → `input:touch-end`. Esto es intencional y debe documentarse claramente en
el código, ya que es la única razón por la que el motor es "probarlo desde celular o
desde la compu indistintamente" sin duplicar lógica de juego.

## 5. Eventos

Ya documentados en la tabla central, reproducidos aquí:

| Evento | Payload |
|---|---|
| `input:touch-start` | `{ touchId: number, position: Vector2 }` |
| `input:touch-move` | `{ touchId: number, position: Vector2, delta: Vector2 }` |
| `input:touch-end` | `{ touchId: number, position: Vector2 }` |
| `input:key-down` | `{ key: string }` |
| `input:key-up` | `{ key: string }` |

## 6. Checklist de implementación

- [ ] Clase `InputManager` con la interfaz completa de la sección 2
- [ ] Registro de listeners nativos: `keydown`/`keyup`, `mousedown`/`mousemove`/`mouseup`,
      `touchstart`/`touchmove`/`touchend`/`touchcancel` sobre `targetElement`
- [ ] Distinción correcta entre `isKeyDown` (true mientras se mantiene) vs
      `isKeyPressed`/`isKeyReleased` (true solo un frame) — requiere trackear el estado
      del frame anterior dentro de `update()`
- [ ] Síntesis de eventos touch desde mouse en dispositivos sin soporte táctil, según
      sección 4
- [ ] Manejo correcto de `touchcancel` (ej: cuando el sistema operativo interrumpe el
      touch con una notificación) — debe tratarse igual que `touchend` para no dejar
      touches "fantasma" activos
- [ ] Clase `VirtualJoystick` con la lógica de reclamar/liberar un touch id según
      sección 3
- [ ] `VirtualJoystick.getDirection()` respeta `deadZone` (no reporta dirección
      dentro de la zona muerta) y normaliza correctamente contra `maxRadius`
- [ ] Prevenir el comportamiento default del navegador en touch dentro del canvas del
      juego (scroll, zoom por pinch, etc. — usar `preventDefault()` en los listeners
      de touch) para que no interfiera con el juego
- [ ] Tests: simular una secuencia de eventos touch sintéticos (no requiere navegador
      real, se pueden despachar `TouchEvent` simulados o mockear el DOM) y verificar
      que `getActiveTouches()` refleja el estado correcto en cada paso
- [ ] Tests del `VirtualJoystick`: touch dentro de la región lo activa, touch fuera de
      la región lo ignora, y un segundo touch mientras el primero sigue activo no lo
      "roba"
- [ ] Tests de `isKeyPressed`/`isKeyReleased`: solo son true en el frame exacto del
      cambio de estado, false en los frames siguientes aunque la tecla siga
      presionada/soltada
