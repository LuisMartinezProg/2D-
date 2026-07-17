import { describe, it, expect, vi } from 'vitest';
import { World } from '../src/World';

class Position { static readonly componentName = 'Position'; constructor(public x = 0, public y = 0) {} }
class Velocity { static readonly componentName = 'Velocity'; constructor(public dx = 0, public dy = 0) {} }

describe('World — entidades', () => {
  it('createEntity retorna ids distintos y vivos', () => {
    const world = new World();
    const a = world.createEntity();
    const b = world.createEntity();
    expect(a).not.toBe(b);
    expect(world.isAlive(a)).toBe(true);
  });

  it('destruir una entidad ya destruida es no-op', () => {
    const world = new World();
    const a = world.createEntity();
    world.destroyEntity(a);
    expect(() => world.destroyEntity(a)).not.toThrow();
  });

  it('destruir libera TODOS los componentes sin dejar referencias colgantes', () => {
    const world = new World();
    const a = world.createEntity();
    world.addComponent(a, Position, new Position(1, 1));
    world.addComponent(a, Velocity, new Velocity(2, 2));
    world.destroyEntity(a);
    expect(world.getComponent(a, Position)).toBeUndefined();
    expect(world.getComponent(a, Velocity)).toBeUndefined();
  });

  it('recicla ids destruidos', () => {
    const world = new World();
    const a = world.createEntity();
    world.destroyEntity(a);
    expect(world.createEntity()).toBe(a);
  });
});

describe('World — componentes', () => {
  it('add/get/has funcionan', () => {
    const world = new World();
    const a = world.createEntity();
    world.addComponent(a, Position, new Position(3, 4));
    expect(world.hasComponent(a, Position)).toBe(true);
    expect(world.getComponent(a, Position)).toEqual(new Position(3, 4));
  });

  it('removeComponent en componente inexistente no lanza error', () => {
    const world = new World();
    const a = world.createEntity();
    expect(() => world.removeComponent(a, Position)).not.toThrow();
    world.addComponent(a, Position, new Position());
    expect(() => world.removeComponent(a, Velocity)).not.toThrow();
  });

  it('addComponent lanza error en entidad destruida', () => {
    const world = new World();
    const a = world.createEntity();
    world.destroyEntity(a);
    expect(() => world.addComponent(a, Position, new Position())).toThrow();
  });
});

describe('World — eventos', () => {
  it('emite entity-created/destroyed y component-added/removed', () => {
    const emit = vi.fn();
    const world = new World({ emit });
    const a = world.createEntity();
    expect(emit).toHaveBeenCalledWith('ecs:entity-created', { entityId: a });

    world.addComponent(a, Position, new Position());
    expect(emit).toHaveBeenCalledWith('ecs:component-added', { entityId: a, componentName: 'Position' });

    world.removeComponent(a, Position);
    expect(emit).toHaveBeenCalledWith('ecs:component-removed', { entityId: a, componentName: 'Position' });

    world.destroyEntity(a);
    expect(emit).toHaveBeenCalledWith('ecs:entity-destroyed', { entityId: a });
  });

  it('NO emite component-removed si no había nada que quitar', () => {
    const emit = vi.fn();
    const world = new World({ emit });
    const a = world.createEntity();
    world.removeComponent(a, Position);
    expect(emit).not.toHaveBeenCalledWith('ecs:component-removed', expect.anything());
  });
});

describe('World — systems', () => {
  it('ejecuta en orden de inserción', () => {
    const world = new World();
    const order: string[] = [];
    world.addSystem({ name: 'A', update: () => order.push('A') });
    world.addSystem({ name: 'B', update: () => order.push('B') });
    world.update(0.016);
    expect(order).toEqual(['A', 'B']);
  });
});
