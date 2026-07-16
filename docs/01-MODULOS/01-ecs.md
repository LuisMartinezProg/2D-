# Módulo: ECS (Entity Component System)

**Paquete**: `@mochigo/ecs` → carpeta `packages/ecs/`
**Depende de**: `@mochigo/math` (solo para tipos, no lógica)
**Del mapa de arquitectura**: núcleo — todos los módulos de gameplay se conectan aquí

## 1. Responsabilidad exacta

Implementar el patrón Entity-Component-System completo: creación/destrucción de
entidades, registro y almacenamiento de componentes, y el mecanismo de queries que
usan los Systems para encontrar qué entidades procesar cada frame. Este módulo NO
sabe nada de renderizado, física, ni ningún concepto de "juego" — es infraestructura
pura de organización de datos.

## 2. Decisión de arquitectura: sparse set (no archetype)

Se investigaron dos enfoques estándar de la industria:

- **Sparse set**: cada tipo de componente vive en su propio array, indexado por el ID
  de entidad a través de un array disperso (sparse) que mapea `entityId → índice denso`.
  Añadir/quitar un componente de una entidad es O(1) y no afecta a otros componentes.
- **Archetype**: las entidades con la misma combinación exacta de componentes se
  agrupan en una tabla ("archetype"). Iteración más rápida en teoría, pero
  añadir/quitar un componente mueve la entidad entre tablas (más caro), y es
  significativamente más complejo de implementar correctamente.

**Decisión: sparse set.** Para un motor 2D orientado a proyectos indie/hobby (no un
motor AAA con decenas de miles de entidades simultáneas), la simplicidad de
implementación y la facilidad de añadir/quitar componentes en caliente pesan más que
el rendimiento marginal de archetypes. Esta decisión no se cambia sin discutirla
primero en `00-ARQUITECTURA.md`.

## 3. Estructuras de datos e interfaces exactas

```typescript
// Una entidad es solo un número. No hay clase Entity.
type EntityId = number;

// Un componente es una clase de datos puros — SIN métodos con lógica de juego.
// Convención: toda clase de componente debe tener un `static readonly componentName`
// que la identifique de forma única (se usa como clave interna, más estable que
// depender del nombre de la clase JS que puede minificarse en build).
interface ComponentClass<T> {
  readonly componentName: string;
  new (...args: any[]): T;
}

// El World es el contenedor central: dueño de todas las entidades y componentes.
class World {
  createEntity(): EntityId;
  destroyEntity(id: EntityId): void;
  isAlive(id: EntityId): boolean;

  addComponent<T>(entity: EntityId, componentClass: ComponentClass<T>, instance: T): void;
  removeComponent<T>(entity: EntityId, componentClass: ComponentClass<T>): void;
  getComponent<T>(entity: EntityId, componentClass: ComponentClass<T>): T | undefined;
  hasComponent<T>(entity: EntityId, componentClass: ComponentClass<T>): boolean;

  // Query: retorna todas las entidades que tienen TODOS los componentes listados.
  // Debe soportar iteración eficiente — ver sección 4 sobre rendimiento de queries.
  query(componentClasses: ComponentClass<any>[]): QueryResult;

  // Registro y ejecución de systems (ver interfaz System abajo)
  addSystem(system: System): void;
  removeSystem(system: System): void;
  update(deltaTime: number): void;  // ejecuta todos los systems registrados, en orden de inserción
}

// Resultado de una query — iterable, no almacena copias de datos, solo referencias/índices
interface QueryResult {
  [Symbol.iterator](): Iterator<EntityId>;
  count(): number;
}

// Un System contiene la lógica. No almacena estado de entidades individuales —
// solo lógica que opera sobre lo que el World le da vía queries.
interface System {
  readonly name: string;
  // qué componentes le interesan — el World usa esto para pasarle la query correcta,
  // aunque el system también puede hacer sus propias queries dentro de update() si
  // necesita combinaciones más complejas
  update(world: World, deltaTime: number): void;
}
```

## 4. Rendimiento de queries — requisito no negociable

Las queries se llaman **cada frame**, potencialmente varias veces por frame (una por
system). La implementación de `query()` debe:

- Iterar sobre el componente con menor cantidad de instancias registradas primero
  (para minimizar cuántas entidades se testean contra los demás componentes) — este
  es el patrón estándar en ECS basados en sparse set.
- No crear arrays nuevos ni hacer allocations en cada llamada a `query()` si es
  evitable — reutilizar buffers internos donde sea posible.
- Estar cubierta por un benchmark (usar `vitest bench` o similar) que mida el tiempo
  de una query típica con al menos 10,000 entidades, para detectar regresiones de
  rendimiento en el futuro.

## 5. Eventos

El ECS en sí no emite eventos de dominio de juego (eso lo hacen los Systems que
construyan otros módulos), pero SÍ debe emitir, vía el Event Manager
(`03-event-manager.md`), estos eventos de ciclo de vida — otros módulos (como
Scripting o Editor Visual) dependen de ellos:

| Evento | Payload | Cuándo se emite |
|---|---|---|
| `ecs:entity-created` | `{ entityId: EntityId }` | al llamar `createEntity()` |
| `ecs:entity-destroyed` | `{ entityId: EntityId }` | al llamar `destroyEntity()`, antes de liberar sus componentes |
| `ecs:component-added` | `{ entityId: EntityId, componentName: string }` | al llamar `addComponent()` |
| `ecs:component-removed` | `{ entityId: EntityId, componentName: string }` | al llamar `removeComponent()` |

## 6. Componentes "core" que este módulo debe definir

Estos son componentes tan fundamentales que viven en el paquete ECS en vez de en
otro módulo, porque casi todo lo demás los necesita:

```typescript
class Transform {
  static readonly componentName = "Transform";
  constructor(
    public position: Vector2 = Vector2.zero(),
    public rotation: number = 0,       // radianes
    public scale: Vector2 = Vector2.one(),
    public parent: EntityId | null = null  // para jerarquías padre-hijo, ver nota abajo
  ) {}
}
```

Nota sobre jerarquías: `Transform.parent` permite construir una jerarquía tipo scene
graph encima del ECS (una entidad "sigue" a otra). El cálculo de la transformación
mundial final (world transform) resolviendo la cadena de padres es responsabilidad
del Renderer, no del ECS — el ECS solo almacena el dato `parent`.

## 7. Checklist de implementación

- [ ] Clase `World` con todos los métodos de la sección 3
- [ ] Sistema de almacenamiento de componentes basado en sparse set, uno por tipo de
      componente
- [ ] `query()` implementado siguiendo el requisito de rendimiento de la sección 4,
      con benchmark incluido
- [ ] Registro y ejecución ordenada de Systems vía `addSystem`/`update`
- [ ] Componente `Transform` tal como está especificado en la sección 6
- [ ] Emisión de los 4 eventos de ciclo de vida de la sección 5 (requiere que
      `@mochigo/events` exista o al menos su interfaz — coordinar con ese módulo)
- [ ] Manejo correcto de destrucción de entidades: al destruir una entidad, se deben
      liberar TODOS sus componentes sin dejar referencias colgantes en los sparse sets
- [ ] Tests unitarios: creación/destrucción de entidades, add/remove/get/has de
      componentes, queries con 1, 2 y 3+ componentes combinados, y el caso borde de
      query sobre un World vacío
- [ ] Tests de que `removeComponent` en un componente que no existe no lanza error
      (debe ser un no-op seguro)
- [ ] README del paquete con un ejemplo completo: crear world, crear entidad, añadir
      Transform, registrar un system simple, correr update
