# Módulo: Scripting System

**Paquete**: `@mochigo/scripting` → carpeta `packages/scripting/`
**Depende de**: `@mochigo/ecs`, `@mochigo/events`, `@mochigo/math`
**Del mapa de arquitectura**: nivel 2 — es la capa donde el usuario final del motor
(quien construye un juego CON este motor) escribe su propia lógica de juego

## 1. Responsabilidad exacta

Definir el modelo de "componente con comportamiento" que usan los desarrolladores de
juegos (no los desarrolladores del motor) para escribir lógica: clases con hooks de
ciclo de vida (`onStart`, `onUpdate`, etc.) que se adjuntan a una entidad del ECS.
Es intencionalmente similar al patrón `MonoBehaviour` de Unity / `Component` de
Godot, porque se investigó que ese patrón (clase con lifecycle hooks + schema
declarado para que el Editor Visual genere un inspector automáticamente) es el
estándar de facto que los desarrolladores de juegos ya conocen, y facilita que el
Editor Visual (`13-editor.md`) pueda construir su panel de inspección sin lógica
especial por cada tipo de script.

## 2. Interfaz principal

```typescript
// Tipo de dato de un campo expuesto al inspector del editor
type SchemaFieldType = "number" | "string" | "boolean" | "vector2" | "color" | "entity";

interface SchemaField {
  type: SchemaFieldType;
  default: unknown;
  label?: string;   // nombre a mostrar en el editor; si no se da, se usa el nombre del campo
  min?: number;      // solo aplica a "number"
  max?: number;
}

type ComponentSchema = Record<string, SchemaField>;

interface GameContext {
  world: World;
  eventBus: EventBus;
  entity: EntityId;   // la entidad a la que este script está adjunto
  deltaTime: number;
}

// Clase base que el usuario final extiende para escribir su propia lógica
abstract class ScriptComponent {
  static readonly componentName: string;   // cada subclase DEBE definir el suyo
  static readonly schema: ComponentSchema = {};  // campos expuestos al inspector; vacío por default

  onStart?(ctx: GameContext): void;               // se llama una vez, la primera vez que la
                                                    // entidad con este script entra en un World activo
  onUpdate?(ctx: GameContext): void;               // se llama cada paso fijo (fixedUpdate)
  onCollisionEnter?(ctx: GameContext, other: EntityId): void;
  onCollisionExit?(ctx: GameContext, other: EntityId): void;
  onDestroy?(ctx: GameContext): void;              // se llama antes de que la entidad sea destruida
}
```

Ejemplo de uso (para incluir en el README del paquete, no es parte del motor en sí):

```typescript
class Spin extends ScriptComponent {
  static readonly componentName = "Spin";
  static readonly schema: ComponentSchema = {
    speed: { type: "number", default: 1.5, label: "Velocidad de giro" }
  };

  speed = 1.5;

  onUpdate(ctx: GameContext) {
    const transform = ctx.world.getComponent(ctx.entity, Transform);
    if (transform) transform.rotation += this.speed * ctx.deltaTime;
  }
}
```

## 3. Sistema que ejecuta los scripts

```typescript
class ScriptingSystem implements System {
  readonly name = "ScriptingSystem";
  constructor(eventBus: EventBus);

  // Registro de qué clases de script existen — necesario para poder reconstruir
  // instancias al deserializar una escena (ver 09-scenes.md)
  registerScriptClass(scriptClass: typeof ScriptComponent): void;

  update(world: World, fixedDeltaTime: number): void;
}
```

Internamente, cada instancia de `ScriptComponent` se almacena como un componente ECS
normal (su `componentName` estático la identifica igual que cualquier otro
componente definido por otros módulos) — el `ScriptingSystem` simplemente recorre
todas las entidades que tienen algún componente cuya clase extiende
`ScriptComponent`, y llama los hooks correspondientes en el orden correcto.

## 4. Orden de ejecución de los hooks

1. `onStart`: se llama exactamente una vez por instancia, en el primer
   `ScriptingSystem.update()` en el que esa instancia está presente en el `World`.
   El sistema debe trackear qué instancias ya recibieron su `onStart` para no
   volver a llamarlo.
2. `onUpdate`: se llama en cada `update()` posterior (incluyendo el mismo frame en
   que se llamó `onStart`, después de él).
3. `onCollisionEnter`/`onCollisionExit`: el `ScriptingSystem` debe suscribirse a los
   eventos `collision:enter`/`collision:exit` (emitidos por Physics, ver
   `06-physics.md`) y, cuando una de las dos entidades del evento tiene un script con
   ese hook definido, llamarlo pasándole la otra entidad como `other`.
4. `onDestroy`: el `ScriptingSystem` debe suscribirse a `ecs:entity-destroyed`
   (emitido por ECS) y llamar este hook antes de que los componentes se liberen —
   esto requiere coordinación de orden con el ECS (ver nota abajo).

**Nota de coordinación entre módulos**: para que `onDestroy` pueda leer aún los
componentes de la entidad que está por destruirse, el evento `ecs:entity-destroyed`
debe emitirse ANTES de liberar los componentes internamente, no después. Esto ya
está especificado así en `01-ecs.md` sección 5 — este módulo depende de que esa
implementación respete ese orden.

## 5. Checklist de implementación

- [ ] Clase abstracta `ScriptComponent` y tipos `ComponentSchema`/`SchemaField`/`GameContext`
      tal como están especificados
- [ ] Clase `ScriptingSystem` con la interfaz de la sección 3
- [ ] Ejecución de `onStart` exactamente una vez por instancia, siguiendo el
      tracking descrito en la sección 4 punto 1
- [ ] Ejecución de `onUpdate` en cada paso, para todas las instancias activas
- [ ] Suscripción a `collision:enter`/`collision:exit` y despacho correcto a
      `onCollisionEnter`/`onCollisionExit` de los scripts relevantes de ambas
      entidades involucradas (si ambas tienen scripts con ese hook, ambas deben
      recibir la llamada, cada una viendo a la otra como `other`)
- [ ] Suscripción a `ecs:entity-destroyed` y despacho a `onDestroy`
- [ ] `registerScriptClass()` mantiene un registro `componentName → clase`,
      necesario para que Scene Manager pueda deserializar escenas que incluyen
      instancias de scripts del usuario (ver `09-scenes.md` sección 3)
- [ ] Si un hook lanza una excepción, debe capturarse y loguearse sin detener la
      ejecución de los demás scripts de otras entidades en el mismo frame (mismo
      principio de aislamiento de fallos que en `03-event-manager.md` sección 5)
- [ ] Tests: `onStart` se llama exactamente una vez incluso a través de múltiples
      llamadas a `update()`
- [ ] Tests: un script con `onCollisionEnter` definido lo recibe correctamente
      cuando `PhysicsSystem` emite `collision:enter` para su entidad
- [ ] Tests: `onDestroy` se llama antes de que los componentes de la entidad se
      vuelvan inaccesibles
- [ ] Tests: una excepción dentro de `onUpdate` de un script no impide que los demás
      scripts de otras entidades sigan ejecutándose ese mismo frame
- [ ] README del paquete con el ejemplo completo de la sección 2 y explicación de
      cómo el `schema` estático se usa para generar el inspector en el Editor Visual
      (aunque la implementación del inspector en sí vive en `13-editor.md`, no aquí)
