# Módulo: Physics / Collisions

**Paquete**: `@mochigo/physics` → carpeta `packages/physics/`
**Depende de**: `@mochigo/math`, `@mochigo/ecs`, `@mochigo/events`
**Del mapa de arquitectura**: nivel 2 — usa ECS directamente, se comunica hacia
Scripting solo vía eventos (nunca llamada directa, ver `00-ARQUITECTURA.md` sección 5)

## 1. Responsabilidad exacta

Simular movimiento básico (integración de velocidad/aceleración) y detectar +
resolver colisiones entre entidades en 2D. Trabaja en dos fases estándar de la
industria: **broad phase** (descartar rápido los pares de entidades que claramente no
pueden estar colisionando) y **narrow phase** (test preciso solo sobre los pares que
sobrevivieron la fase anterior).

## 2. Componentes ECS que este módulo define

```typescript
class RigidBody {
  static readonly componentName = "RigidBody";
  constructor(
    public velocity: Vector2 = Vector2.zero(),
    public acceleration: Vector2 = Vector2.zero(),
    public mass: number = 1,
    public isStatic: boolean = false,  // los cuerpos estáticos no se mueven ni son
                                        // afectados por colisiones, pero sí las generan
                                        // (ej: el suelo, una pared)
    public gravityScale: number = 1    // multiplicador sobre la gravedad global; 0 = no le afecta la gravedad
  ) {}
}

// Forma de colisión — solo AABB en la v1 (ver decisión en sección 3)
class Collider {
  static readonly componentName = "Collider";
  constructor(
    public size: Vector2,           // ancho/alto del AABB
    public offset: Vector2 = Vector2.zero(),  // desplazamiento respecto al Transform.position
    public isTrigger: boolean = false  // si es true, detecta colisión y emite eventos
                                        // pero NO aplica resolución física (no empuja)
  ) {}
}
```

## 3. Decisión de arquitectura: solo AABB en la v1, quadtree para broad phase

- **Narrow phase: solo cajas alineadas a los ejes (AABB)** en esta primera versión —
  no polígonos arbitrarios, no rotación de colliders. Motivo: cubre la gran mayoría de
  los casos de un motor 2D orientado a plataformeros/top-down/puzzle (los géneros más
  comunes en proyectos indie/hobby), y es significativamente más simple y rápido de
  implementar y testear correctamente que SAT (Separating Axis Theorem) para polígonos
  rotados. Si a futuro se necesitan formas más complejas, se puede añadir un tipo de
  `Collider` adicional (círculo, polígono) sin romper esta interfaz.
- **Broad phase: quadtree.** Se investigó que para escenas con pocas entidades
  (decenas), un enfoque de fuerza bruta (comparar todos los pares) es más que
  suficiente y un quadtree sería sobre-ingeniería. Pero como este motor no puede
  asumir de antemano cuántas entidades tendrá cada juego construido con él, se
  implementa el quadtree desde la v1 para que el motor escale razonablemente sin
  requerir que el usuario final del motor optimice nada por su cuenta. El quadtree se
  reconstruye una vez por paso fijo (no incrementalmente) — es lo suficientemente
  barato de reconstruir para las escalas objetivo de este motor.

## 4. Interfaz del sistema

```typescript
interface PhysicsConfig {
  gravity: Vector2;             // default sugerido: (0, 980) — píxeles/seg², "abajo" es +Y
  quadtreeMaxDepth: number;     // default sugerido: 5
  quadtreeMaxEntitiesPerNode: number;  // default sugerido: 8
}

class PhysicsSystem implements System {
  readonly name = "PhysicsSystem";
  constructor(config: PhysicsConfig, eventBus: EventBus);
  update(world: World, fixedDeltaTime: number): void;  // OJO: recibe fixedDeltaTime del
                                                          // Game Loop, no el delta variable de render
}
```

## 5. Orden de operaciones dentro de `update()`

1. Integración: para cada entidad con `RigidBody` no estático, aplicar gravedad
   (según `gravityScale`) y `acceleration` a `velocity`, y `velocity` a
   `Transform.position`, usando `fixedDeltaTime`.
2. Reconstruir el quadtree con las posiciones actualizadas de todos los `Collider`.
3. Broad phase: para cada entidad, consultar el quadtree y obtener candidatos
   cercanos.
4. Narrow phase: sobre cada par candidato, test AABB-AABB exacto (ver
   `rectsIntersect` de `00-math.md` sección 5 — este módulo reutiliza esa función, no
   duplica la lógica).
5. Para cada par que efectivamente colisiona:
   - Si alguno de los dos `Collider` tiene `isTrigger: true`: solo emitir el evento
     correspondiente (`collision:enter`/`stay`/`exit`), sin resolución física.
   - Si ninguno es trigger: aplicar resolución física simple (separar los dos AABB a
     lo largo del eje de menor solapamiento) además de emitir el evento.
6. Mantener un registro de qué pares estaban colisionando en el paso anterior, para
   poder distinguir `collision:enter` (primer frame de contacto) de `collision:stay`
   (sigue en contacto) y `collision:exit` (dejaron de estar en contacto).

## 6. Eventos

Ya documentados en la tabla central (`03-event-manager.md`), reproducidos aquí por
completitud:

| Evento | Payload |
|---|---|
| `collision:enter` | `{ entityA: EntityId, entityB: EntityId, contactPoint: Vector2 }` |
| `collision:stay` | `{ entityA: EntityId, entityB: EntityId }` |
| `collision:exit` | `{ entityA: EntityId, entityB: EntityId }` |

## 7. Checklist de implementación

- [ ] Componentes `RigidBody` y `Collider` tal como están especificados
- [ ] Estructura de datos Quadtree: inserción, consulta por región, y
      reconstrucción completa por paso fijo, respetando `quadtreeMaxDepth` y
      `quadtreeMaxEntitiesPerNode`
- [ ] `PhysicsSystem.update()` siguiendo exactamente el orden de la sección 5
- [ ] Integración de física básica (gravedad, velocidad, aceleración) usando
      `fixedDeltaTime`, nunca el delta variable de render
- [ ] Resolución de colisión por separación en el eje de menor solapamiento, para
      pares no-trigger
- [ ] Registro de pares en colisión del frame anterior, para poder emitir
      `enter`/`stay`/`exit` correctamente
- [ ] Cuerpos estáticos (`isStatic: true`) nunca se mueven por integración ni por
      resolución de colisión, pero sí participan como "empujadores" cuando algo no
      estático colisiona con ellos
- [ ] Tests: dos AABB que no se tocan no generan evento; que se tocan generan
      `collision:enter` una sola vez, no uno por frame mientras siguen tocándose
- [ ] Tests: separar el eje correcto cuando el solapamiento es mayor en X que en Y y
      viceversa
- [ ] Tests: un `Collider` con `isTrigger: true` emite eventos pero no mueve las
      entidades involucradas
- [ ] Tests del quadtree en aislamiento: insertar N entidades dispersas, verificar que
      una consulta por región retorna exactamente las que están dentro
- [ ] Benchmark: medir el tiempo de un `update()` completo con al menos 500 entidades
      con `Collider`, para tener una referencia de rendimiento documentada
