# Módulo: Event Manager

**Paquete**: `@mochigo/events` → carpeta `packages/events/`
**Depende de**: nada
**Del mapa de arquitectura**: nivel 1 — usado por prácticamente todos los demás módulos

## 1. Responsabilidad exacta

Proveer el mecanismo de publicación/suscripción (pub/sub) que usan los módulos para
comunicarse sin depender directamente unos de otros. Es deliberadamente genérico —
no sabe nada de "colisiones" ni "escenas"; solo sabe manejar `nombre de evento →
lista de callbacks suscritos`.

## 2. Interfaz exacta

```typescript
type EventPayload = Record<string, unknown>;
type EventCallback<T extends EventPayload = EventPayload> = (payload: T) => void;

class EventBus {
  on<T extends EventPayload>(eventName: string, callback: EventCallback<T>): void;
  off<T extends EventPayload>(eventName: string, callback: EventCallback<T>): void;
  once<T extends EventPayload>(eventName: string, callback: EventCallback<T>): void;
  emit<T extends EventPayload>(eventName: string, payload: T): void;

  // Limpia todos los listeners de un evento específico, o de todos los eventos si
  // no se pasa argumento. Se usa principalmente al descargar una escena.
  clear(eventName?: string): void;
}
```

Debe existir una única instancia compartida de `EventBus` para todo el motor
(patrón singleton, o inyectada explícitamente desde `Game Loop` — a decidir en
integración, pero NUNCA una instancia por módulo, porque entonces los módulos no
podrían escucharse entre sí).

## 3. Tabla central de eventos estándar del motor

**Esta tabla es el contrato de comunicación entre módulos.** Cada módulo, al
implementarse, debe:
1. Revisar esta tabla y respetar los nombres/payloads ya definidos aquí.
2. Si necesita un evento nuevo que no está en esta tabla, añadirlo aquí como parte de
   su propio trabajo, siguiendo la convención `dominio:accion` de
   `00-ARQUITECTURA.md` sección 7.

| Evento | Emitido por | Escuchado por (típico) | Payload |
|---|---|---|---|
| `ecs:entity-created` | ECS | Scripting, Editor | `{ entityId: EntityId }` |
| `ecs:entity-destroyed` | ECS | Scripting, Editor, Renderer | `{ entityId: EntityId }` |
| `ecs:component-added` | ECS | Scripting, Editor | `{ entityId: EntityId, componentName: string }` |
| `ecs:component-removed` | ECS | Scripting, Editor | `{ entityId: EntityId, componentName: string }` |
| `collision:enter` | Physics | Scripting | `{ entityA: EntityId, entityB: EntityId, contactPoint: Vector2 }` |
| `collision:stay` | Physics | Scripting | `{ entityA: EntityId, entityB: EntityId }` |
| `collision:exit` | Physics | Scripting | `{ entityA: EntityId, entityB: EntityId }` |
| `scene:loading` | Scene Manager | Editor, Asset Manager | `{ sceneName: string }` |
| `scene:loaded` | Scene Manager | Scripting, Editor, todos | `{ sceneName: string }` |
| `scene:unloaded` | Scene Manager | todos | `{ sceneName: string }` |
| `asset:load-progress` | Asset Manager | Editor, Scene Manager | `{ assetId: string, progress: number }` (0 a 1) |
| `asset:load-complete` | Asset Manager | Scene Manager, Renderer | `{ assetId: string }` |
| `asset:load-error` | Asset Manager | Editor, Scene Manager | `{ assetId: string, error: string }` |
| `input:touch-start` | Input Manager | Scripting | `{ touchId: number, position: Vector2 }` |
| `input:touch-move` | Input Manager | Scripting | `{ touchId: number, position: Vector2, delta: Vector2 }` |
| `input:touch-end` | Input Manager | Scripting | `{ touchId: number, position: Vector2 }` |
| `input:key-down` | Input Manager | Scripting | `{ key: string }` |
| `input:key-up` | Input Manager | Scripting | `{ key: string }` |
| `animation:frame-changed` | Animation System | Scripting | `{ entityId: EntityId, frameIndex: number }` |
| `animation:completed` | Animation System | Scripting | `{ entityId: EntityId, animationName: string }` |
| `sound:playback-ended` | Sound Manager | Scripting | `{ soundId: string }` |
| `game:paused` | Game Loop | todos | `{}` |
| `game:resumed` | Game Loop | todos | `{}` |

## 4. Decisiones de diseño importantes

- **Sin espacios de nombres jerárquicos ni wildcards** (por ejemplo, no soportar
  suscribirse a `collision:*` para recibir todos los eventos de colisión). Se
  descartó deliberadamente por simplicidad — si en el futuro se necesita, se añade
  como extensión sin romper la API actual, pero no es parte del alcance inicial.
- **Los payloads son objetos planos, no clases.** Esto los hace fáciles de serializar
  (relevante para debugging en el Editor Visual, que probablemente quiera mostrar un
  log de eventos) y evita acoplar el Event Manager a los tipos de otros módulos.
- **`emit` es síncrono.** Todos los callbacks suscritos a un evento se ejecutan
  inmediatamente, en el mismo tick, en el orden en que se suscribieron. No hay cola
  de eventos diferida en esta primera versión — si un módulo necesita procesar
  eventos en un momento específico del frame (por ejemplo, "todos los eventos de
  colisión se procesan al final del update de física, no apenas se detectan"), ese
  módulo es responsable de encolarlos internamente y emitirlos cuando corresponda.

## 5. Checklist de implementación

- [ ] Clase `EventBus` con los 5 métodos de la sección 2
- [ ] `once()` debe des-suscribirse automáticamente después de la primera invocación
- [ ] Si un callback lanza una excepción, no debe interrumpir la ejecución de los
      demás callbacks suscritos al mismo evento (capturar y loguear el error, seguir
      con el resto)
- [ ] Tests: suscribir/emitir/recibir payload correcto, `off` deja de recibir, `once`
      solo se dispara una vez, `clear` sin argumento limpia todo, `clear` con nombre
      limpia solo ese evento
- [ ] Test específico del caso de excepción en un callback (verificar que los demás
      callbacks sí se ejecutan)
- [ ] Documentar en el README del paquete cómo añadir un evento nuevo a la tabla de
      la sección 3 (apunta al proceso: edita este mismo archivo `.md`, no solo el
      código)
- [ ] Exportar `EventBus` y los tipos `EventPayload`/`EventCallback` desde `index.ts`
