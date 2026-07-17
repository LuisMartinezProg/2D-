import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '@mochigo/ecs';
import { EventBus } from '@mochigo/events';
import { Vector2 } from '@mochigo/math';
import { PhysicsSystem, type PhysicsConfig } from '../src/PhysicsSystem';
import { RigidBody, Collider } from '../src/components';
import { PhysicsEvents } from '../src/PhysicsEvents';
import { TestTransform } from './fixtures';

// NOTA: para que estos tests corran contra el PhysicsSystem real, hace
// falta un alias de módulo que resuelva '@mochigo/renderer' -> algo que
// exporte TestTransform como 'Transform'. Ver comentario al final del
// mensaje sobre este punto específico.

const noGravityConfig: PhysicsConfig = {
  gravity: Vector2.zero(),
  quadtreeMaxDepth: 5,
  quadtreeMaxEntitiesPerNode: 8,
  worldBounds: { x: -1000, y: -1000, width: 2000, height: 2000 },
};

describe('PhysicsSystem', () => {
  let world: World;
  let eventBus: EventBus;
  let system: PhysicsSystem;

  beforeEach(() => {
    world = new World();
    eventBus = new EventBus();
  });

  function makeBody(x: number, y: number, opts: Partial<{ isStatic: boolean; isTrigger: boolean; width: number; height: number }> = {}) {
    const entity = world.createEntity();
    world.addComponent(entity, TestTransform, new TestTransform(new Vector2(x, y)));
    world.addComponent(entity, RigidBody, new RigidBody(Vector2.zero(), Vector2.zero(), 1, opts.isStatic ?? false));
    world.addComponent(
      entity,
      Collider,
      new Collider(new Vector2(opts.width ?? 20, opts.height ?? 20), Vector2.zero(), opts.isTrigger ?? false)
    );
    return entity;
  }

  describe('integración: gravedad, velocidad, posición', () => {
    beforeEach(() => {
      system = new PhysicsSystem(
        { ...noGravityConfig, gravity: new Vector2(0, 980) },
        eventBus
      );
    });

    it('aplica gravedad a la velocidad y la velocidad a la posición, usando fixedDeltaTime', () => {
      const entity = world.createEntity();
      world.addComponent(entity, TestTransform, new TestTransform(new Vector2(0, 0)));
      world.addComponent(entity, RigidBody, new RigidBody());

      system.update(world, 0.1);

      const body = world.getComponent(entity, RigidBody)!;
      const transform = world.getComponent(entity, TestTransform)!;

      expect(body.velocity.y).toBeCloseTo(98, 5); // 980 * 0.1
      expect(transform.position.y).toBeCloseTo(9.8, 5); // velocity(98) * 0.1, tras el mismo paso
    });

    it('gravityScale de 0 anula completamente el efecto de la gravedad', () => {
      const entity = world.createEntity();
      world.addComponent(entity, TestTransform, new TestTransform(new Vector2(0, 0)));
      world.addComponent(entity, RigidBody, new RigidBody(Vector2.zero(), Vector2.zero(), 1, false, 0));

      system.update(world, 0.1);

      const body = world.getComponent(entity, RigidBody)!;
      expect(body.velocity.y).toBe(0);
    });

    it('un cuerpo isStatic: true nunca se mueve por integración, sin importar la gravedad', () => {
      const entity = world.createEntity();
      world.addComponent(entity, TestTransform, new TestTransform(new Vector2(5, 5)));
      world.addComponent(entity, RigidBody, new RigidBody(Vector2.zero(), Vector2.zero(), 1, true));

      system.update(world, 0.1);
      system.update(world, 0.1);

      const transform = world.getComponent(entity, TestTransform)!;
      expect(transform.position).toEqual({ x: 5, y: 5 });
    });
  });

  describe('detección de colisión: enter una sola vez, no por frame', () => {
    beforeEach(() => {
      system = new PhysicsSystem(noGravityConfig, eventBus);
    });

    it('dos AABB que NO se tocan no generan ningún evento', () => {
      makeBody(0, 0);
      makeBody(500, 500); // muy lejos, no debería intersectar

      const events: string[] = [];
      eventBus.on(PhysicsEvents.CollisionEnter, () => events.push('enter'));

      system.update(world, 0.016);

      expect(events).toHaveLength(0);
    });

    it('dos AABB que se tocan generan collision:enter exactamente una vez, no una por frame', () => {
      makeBody(0, 0, { isStatic: true });
      makeBody(5, 0, { isStatic: true }); // se solapan (ambos 20x20, separados solo 5px)

      const enterEvents: any[] = [];
      eventBus.on(PhysicsEvents.CollisionEnter, (p) => enterEvents.push(p));

      system.update(world, 0.016);
      system.update(world, 0.016);
      system.update(world, 0.016);

      expect(enterEvents).toHaveLength(1); // no 3, aunque siguieron tocándose 3 frames
    });

    it('collision:enter incluye contactPoint en el payload', () => {
      makeBody(0, 0, { isStatic: true });
      makeBody(5, 0, { isStatic: true });

      const enterEvents: any[] = [];
      eventBus.on(PhysicsEvents.CollisionEnter, (p) => enterEvents.push(p));

      system.update(world, 0.016);

      expect(enterEvents[0].contactPoint).toBeDefined();
      expect(typeof enterEvents[0].contactPoint.x).toBe('number');
      expect(typeof enterEvents[0].contactPoint.y).toBe('number');
    });
  });

  describe('collision:stay y collision:exit', () => {
    beforeEach(() => {
      system = new PhysicsSystem(noGravityConfig, eventBus);
    });

    it('mientras dos AABB siguen tocándose, emite collision:stay en los frames siguientes (no enter de nuevo)', () => {
      makeBody(0, 0, { isStatic: true });
      makeBody(5, 0, { isStatic: true });

      const enterEvents: any[] = [];
      const stayEvents: any[] = [];
      eventBus.on(PhysicsEvents.CollisionEnter, (p) => enterEvents.push(p));
      eventBus.on(PhysicsEvents.CollisionStay, (p) => stayEvents.push(p));

      system.update(world, 0.016); // frame 1: enter
      system.update(world, 0.016); // frame 2: stay
      system.update(world, 0.016); // frame 3: stay

      expect(enterEvents).toHaveLength(1);
      expect(stayEvents).toHaveLength(2);
    });

    it('cuando dos AABB dejan de tocarse, emite collision:exit exactamente una vez', () => {
      const entityA = world.createEntity();
      world.addComponent(entityA, TestTransform, new TestTransform(new Vector2(0, 0)));
      world.addComponent(entityA, RigidBody, new RigidBody(Vector2.zero(), Vector2.zero(), 1, true));
      world.addComponent(entityA, Collider, new Collider(new Vector2(20, 20)));

      const entityB = world.createEntity();
      const transformB = new TestTransform(new Vector2(5, 0));
      world.addComponent(entityB, TestTransform, transformB);
      world.addComponent(entityB, RigidBody, new RigidBody(Vector2.zero(), Vector2.zero(), 1, true));
      world.addComponent(entityB, Collider, new Collider(new Vector2(20, 20)));

      const exitEvents: any[] = [];
      eventBus.on(PhysicsEvents.CollisionExit, (p) => exitEvents.push(p));

      system.update(world, 0.016); // se tocan: enter

      // Los separamos manualmente muy lejos, simulando que gameplay o
      // integración los movió (ambos son isStatic, así que la propia
      // resolución de colisión nunca los habría separado por sí sola).
      transformB.position.x = 1000;

      system.update(world, 0.016); // ya no se tocan: debe emitir exit

      expect(exitEvents).toHaveLength(1);
    });

    it('no emite exit si el par nunca estuvo colisionando en el frame anterior', () => {
      makeBody(0, 0);
      makeBody(500, 500);

      const exitEvents: any[] = [];
      eventBus.on(PhysicsEvents.CollisionExit, (p) => exitEvents.push(p));

      system.update(world, 0.016);

      expect(exitEvents).toHaveLength(0);
    });
  });

  describe('resolución de colisión: separación por eje de menor solapamiento', () => {
    beforeEach(() => {
      system = new PhysicsSystem(noGravityConfig, eventBus);
    });

    it('separa en X cuando el solapamiento es mayor en Y que en X', () => {
      // A: 20x20 en (0,0). B: 20x20 en (15, 2) -> overlap X = 5, overlap Y = 18.
      // El overlap es MENOR en X, así que debe separar a lo largo de X.
      const entityA = world.createEntity();
      const transformA = new TestTransform(new Vector2(0, 0));
      world.addComponent(entityA, TestTransform, transformA);
      world.addComponent(entityA, RigidBody, new RigidBody());
      world.addComponent(entityA, Collider, new Collider(new Vector2(20, 20)));

      const entityB = world.createEntity();
      const transformB = new TestTransform(new Vector2(15, 2));
      world.addComponent(entityB, TestTransform, transformB);
      world.addComponent(entityB, RigidBody, new RigidBody());
      world.addComponent(entityB, Collider, new Collider(new Vector2(20, 20)));

      const yBefore = { a: transformA.position.y, b: transformB.position.y };

      system.update(world, 0.016);

      // Y no debería haber cambiado por la resolución (solo la
      // integración podría afectarlo, pero acá no hay gravedad ni
      // velocidad inicial).
      expect(transformA.position.y).toBeCloseTo(yBefore.a, 5);
      expect(transformB.position.y).toBeCloseTo(yBefore.b, 5);
      // X sí debe haber cambiado: se separaron.
      expect(transformA.position.x).not.toBeCloseTo(0, 1);
    });

    it('separa en Y cuando el solapamiento es mayor en X que en Y', () => {
      // A: 20x20 en (0,0). B: 20x20 en (2, 15) -> overlap X = 18, overlap Y = 5.
      const entityA = world.createEntity();
      const transformA = new TestTransform(new Vector2(0, 0));
      world.addComponent(entityA, TestTransform, transformA);
      world.addComponent(entityA, RigidBody, new RigidBody());
      world.addComponent(entityA, Collider, new Collider(new Vector2(20, 20)));

      const entityB = world.createEntity();
      const transformB = new TestTransform(new Vector2(2, 15));
      world.addComponent(entityB, TestTransform, transformB);
      world.addComponent(entityB, RigidBody, new RigidBody());
      world.addComponent(entityB, Collider, new Collider(new Vector2(20, 20)));

      system.update(world, 0.016);

      expect(transformA.position.y).not.toBeCloseTo(0, 1); // se separaron en Y
    });

    it('con un cuerpo isStatic y otro no, solo el no-estático se mueve en la resolución', () => {
      const staticEntity = world.createEntity();
      const staticTransform = new TestTransform(new Vector2(0, 0));
      world.addComponent(staticEntity, TestTransform, staticTransform);
      world.addComponent(staticEntity, RigidBody, new RigidBody(Vector2.zero(), Vector2.zero(), 1, true));
      world.addComponent(staticEntity, Collider, new Collider(new Vector2(20, 20)));

      const dynamicEntity = world.createEntity();
      const dynamicTransform = new TestTransform(new Vector2(5, 0));
      world.addComponent(dynamicEntity, TestTransform, dynamicTransform);
      world.addComponent(dynamicEntity, RigidBody, new RigidBody(Vector2.zero(), Vector2.zero(), 1, false));
      world.addComponent(dynamicEntity, Collider, new Collider(new Vector2(20, 20)));

      system.update(world, 0.016);

      expect(staticTransform.position).toEqual({ x: 0, y: 0 }); // el estático NUNCA se mueve
      expect(dynamicTransform.position.x).not.toBeCloseTo(5, 1); // el dinámico sí se movió
    });
  });

  describe('isTrigger: emite eventos pero no aplica resolución física', () => {
    beforeEach(() => {
      system = new PhysicsSystem(noGravityConfig, eventBus);
    });

    it('un Collider con isTrigger: true emite collision:enter pero no mueve ninguna entidad', () => {
      const entityA = world.createEntity();
      const transformA = new TestTransform(new Vector2(0, 0));
      world.addComponent(entityA, TestTransform, transformA);
      world.addComponent(entityA, RigidBody, new RigidBody());
      world.addComponent(entityA, Collider, new Collider(new Vector2(20, 20), Vector2.zero(), true)); // trigger

      const entityB = world.createEntity();
      const transformB = new TestTransform(new Vector2(5, 0));
      world.addComponent(entityB, TestTransform, transformB);
      world.addComponent(entityB, RigidBody, new RigidBody());
      world.addComponent(entityB, Collider, new Collider(new Vector2(20, 20)));

      const enterEvents: any[] = [];
      eventBus.on(PhysicsEvents.CollisionEnter, (p) => enterEvents.push(p));

      system.update(world, 0.016);

      expect(enterEvents).toHaveLength(1); // sí detecta y emite
      expect(transformA.position).toEqual({ x: 0, y: 0 }); // pero NO empuja a ninguno
      expect(transformB.position).toEqual({ x: 5, y: 0 });
    });
  });

  describe('cuerpos estáticos como "empujadores"', () => {
    beforeEach(() => {
      system = new PhysicsSystem({ ...noGravityConfig, gravity: new Vector2(0, 980) }, eventBus);
    });

    it('un cuerpo dinámico cayendo sobre uno estático es empujado hacia afuera (el estático actúa como suelo)', () => {
      const ground = world.createEntity();
      const groundTransform = new TestTransform(new Vector2(0, 20));
      world.addComponent(ground, TestTransform, groundTransform);
      world.addComponent(ground, RigidBody, new RigidBody(Vector2.zero(), Vector2.zero(), 1, true));
      world.addComponent(ground, Collider, new Collider(new Vector2(100, 20)));

      const faller = world.createEntity();
      const fallerTransform = new TestTransform(new Vector2(0, 15)); // ya solapado con el suelo
      world.addComponent(faller, TestTransform, fallerTransform);
      world.addComponent(faller, RigidBody, new RigidBody());
      world.addComponent(faller, Collider, new Collider(new Vector2(10, 10)));

      system.update(world, 0.016);

      expect(groundTransform.position).toEqual({ x: 0, y: 20 }); // el suelo nunca se mueve
      // El faller debería haber sido reubicado (empujado) por la resolución,
      // no simplemente seguir cayendo libre a través del suelo.
      expect(fallerTransform.position.y).not.toBe(15 + 980 * 0.016 * 0.016);
    });
  });
});
