import type { System, World, EntityId } from '@mochigo/ecs';
import type { EventBus } from '@mochigo/events';
import type { Rect, Vector2 } from '@mochigo/math';
import { Quadtree } from './Quadtree';
import { RigidBody, Collider } from './components';
import { PhysicsEvents } from './PhysicsEvents';

// Transform se asume del mismo módulo Renderer que ya vimos referenciado
// en Sprite.ts y en el formato de escena (09-scenes.md) - no confirmado
// con código real de un archivo Transform.ts propio en este chat, pero
// su forma ({ position: Vector2, rotation: number, scale: Vector2 }) sí
// está confirmada por el JSON de ejemplo de 09-scenes.md sección 2.
import type { Transform } from '@mochigo/renderer';

export interface PhysicsConfig {
  gravity: Vector2;
  quadtreeMaxDepth: number;
  quadtreeMaxEntitiesPerNode: number;
  // No estaba en la ficha original: el Quadtree necesita un área total
  // sobre la cual construirse, y ningún campo de PhysicsConfig la
  // provee. Ver nota de decisión más abajo.
  worldBounds: Rect;
}

/** Clave estable para un par de entidades, sin importar el orden en que
 * se descubrió el par (A,B) === (B,A). */
function pairKey(a: EntityId, b: EntityId): string {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return `${lo}:${hi}`;
}

export class PhysicsSystem implements System {
  readonly name = 'PhysicsSystem';

  // Pares en colisión durante el paso anterior, para derivar enter/stay/exit.
  private previousCollidingPairs = new Set<string>();

  constructor(
    private readonly config: PhysicsConfig,
    private readonly eventBus: EventBus
  ) {}

  update(world: World, fixedDeltaTime: number): void {
    this.integrate(world, fixedDeltaTime);

    const quadtree = this.buildQuadtree(world);
    const currentCollidingPairs = new Set<string>();

    this.detectAndResolveCollisions(world, quadtree, currentCollidingPairs);
    this.emitStayAndExitEvents(currentCollidingPairs);

    this.previousCollidingPairs = currentCollidingPairs;
  }

  // ── Paso 1: integración ──────────────────────────────────

  private integrate(world: World, dt: number): void {
    for (const entity of world.query([RigidBody, Transform])) {
      const body = world.getComponent(entity, RigidBody)!;
      if (body.isStatic) continue; // los estáticos nunca se mueven por integración

      const transform = world.getComponent(entity, Transform)!;

      // gravedad (escalada) + acceleration -> velocity
      const gravityX = this.config.gravity.x * body.gravityScale;
      const gravityY = this.config.gravity.y * body.gravityScale;

      body.velocity.x += (gravityX + body.acceleration.x) * dt;
      body.velocity.y += (gravityY + body.acceleration.y) * dt;

      // velocity -> position
      transform.position.x += body.velocity.x * dt;
      transform.position.y += body.velocity.y * dt;
    }
  }

  // ── Paso 2: reconstrucción del quadtree ──────────────────

  private buildQuadtree(world: World): Quadtree {
    const quadtree = new Quadtree(
      this.config.worldBounds,
      this.config.quadtreeMaxDepth,
      this.config.quadtreeMaxEntitiesPerNode
    );

    for (const entity of world.query([Collider, Transform])) {
      const bounds = this.getColliderBounds(world, entity);
      if (bounds) quadtree.insert(entity, bounds);
    }

    return quadtree;
  }

  private getColliderBounds(world: World, entity: EntityId): Rect | null {
    const collider = world.getComponent(entity, Collider);
    const transform = world.getComponent(entity, Transform);
    if (!collider || !transform) return null;

    return {
      x: transform.position.x + collider.offset.x - collider.size.x / 2,
      y: transform.position.y + collider.offset.y - collider.size.y / 2,
      width: collider.size.x,
      height: collider.size.y,
    };
  }

  // ── Pasos 3-5: broad phase + narrow phase + resolución ───

  private detectAndResolveCollisions(
    world: World,
    quadtree: Quadtree,
    currentCollidingPairs: Set<string>
  ): void {
    const entitiesWithCollider = Array.from(world.query([Collider, Transform]));
    // Evita procesar el mismo par dos veces (A vs B Y B vs A) dentro del
    // mismo update(): un Set de claves ya vistas EN ESTE FRAME, separado
    // de previousCollidingPairs (que es del frame anterior).
    const processedThisFrame = new Set<string>();

    for (const entityA of entitiesWithCollider) {
      const boundsA = this.getColliderBounds(world, entityA);
      if (!boundsA) continue;

      // Broad phase: candidatos cercanos vía quadtree.
      const candidates = quadtree.query(boundsA);

      for (const entityB of candidates) {
        if (entityA === entityB) continue;

        const key = pairKey(entityA, entityB);
        if (processedThisFrame.has(key)) continue;
        processedThisFrame.add(key);

        const boundsB = this.getColliderBounds(world, entityB);
        if (!boundsB) continue;

        // Narrow phase: test AABB-AABB exacto.
        const overlap = this.getOverlap(boundsA, boundsB);
        if (!overlap) continue;

        currentCollidingPairs.add(key);

        const colliderA = world.getComponent(entityA, Collider)!;
        const colliderB = world.getComponent(entityB, Collider)!;
        const isFirstContact = !this.previousCollidingPairs.has(key);

        if (colliderA.isTrigger || colliderB.isTrigger) {
          if (isFirstContact) {
            this.emitEnter(entityA, entityB, overlap);
          }
          continue; // trigger: nunca resolución física
        }

        // Resolución física: separar en el eje de MENOR solapamiento.
        this.resolveCollision(world, entityA, entityB, overlap);

        if (isFirstContact) {
          this.emitEnter(entityA, entityB, overlap);
        }
      }
    }
  }

  private getOverlap(a: Rect, b: Rect): { x: number; y: number; contactPoint: Vector2 } | null {
    const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
    const overlapY = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);

    if (overlapX <= 0 || overlapY <= 0) return null; // no hay intersección real

    const contactPoint: Vector2 = {
      x: Math.max(a.x, b.x) + overlapX / 2,
      y: Math.max(a.y, b.y) + overlapY / 2,
    } as Vector2;

    return { x: overlapX, y: overlapY, contactPoint };
  }

  private resolveCollision(
    world: World,
    entityA: EntityId,
    entityB: EntityId,
    overlap: { x: number; y: number }
  ): void {
    const bodyA = world.getComponent(entityA, RigidBody);
    const bodyB = world.getComponent(entityB, RigidBody);
    const transformA = world.getComponent(entityA, Transform)!;
    const transformB = world.getComponent(entityB, Transform)!;

    const aIsStatic = !bodyA || bodyA.isStatic;
    const bIsStatic = !bodyB || bodyB.isStatic;

    if (aIsStatic && bIsStatic) return; // dos estáticos no se separan entre sí

    // Eje de MENOR solapamiento: es el camino más corto para separar los AABB.
    const separateOnX = overlap.x < overlap.y;
    const boundsA = this.getColliderBounds(world, entityA)!;
    const boundsB = this.getColliderBounds(world, entityB)!;

    if (separateOnX) {
      const direction = boundsA.x < boundsB.x ? -1 : 1;
      this.applySeparation(transformA, transformB, aIsStatic, bIsStatic, overlap.x * direction, 0);
    } else {
      const direction = boundsA.y < boundsB.y ? -1 : 1;
      this.applySeparation(transformA, transformB, aIsStatic, bIsStatic, 0, overlap.y * direction);
    }
  }

  private applySeparation(
    transformA: Transform,
    transformB: Transform,
    aIsStatic: boolean,
    bIsStatic: boolean,
    dx: number,
    dy: number
  ): void {
    if (aIsStatic) {
      // Solo B se mueve, la separación completa recae sobre B.
      transformB.position.x -= dx;
      transformB.position.y -= dy;
    } else if (bIsStatic) {
      transformA.position.x += dx;
      transformA.position.y += dy;
    } else {
      // Ninguno estático: cada uno absorbe la mitad de la separación.
      transformA.position.x += dx / 2;
      transformA.position.y += dy / 2;
      transformB.position.x -= dx / 2;
      transformB.position.y -= dy / 2;
    }
  }

  // ── Paso 6: derivar stay / exit ──────────────────────────

  private emitEnter(entityA: EntityId, entityB: EntityId, overlap: { contactPoint: Vector2 }): void {
    this.eventBus.emit(PhysicsEvents.CollisionEnter, {
      entityA,
      entityB,
      contactPoint: overlap.contactPoint,
    });
  }

  private emitStayAndExitEvents(currentCollidingPairs: Set<string>): void {
    for (const key of currentCollidingPairs) {
      if (this.previousCollidingPairs.has(key)) {
        const [entityA, entityB] = this.parsePairKey(key);
        this.eventBus.emit(PhysicsEvents.CollisionStay, { entityA, entityB });
      }
    }

    for (const key of this.previousCollidingPairs) {
      if (!currentCollidingPairs.has(key)) {
        const [entityA, entityB] = this.parsePairKey(key);
        this.eventBus.emit(PhysicsEvents.CollisionExit, { entityA, entityB });
      }
    }
  }

  private parsePairKey(key: string): [EntityId, EntityId] {
    const [a, b] = key.split(':').map(Number);
    return [a, b];
  }
}
