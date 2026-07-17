import { describe, it, expect, vi } from 'vitest';

// @mochigo/math no existe todavía — se mockea para poder correr estos
// tests ya. Reemplazar por el import real cuando el paquete exista.
vi.mock('@mochigo/math', () => {
  class Vector2 {
    constructor(public x: number, public y: number) {}
    static zero() { return new Vector2(0, 0); }
    static one() { return new Vector2(1, 1); }
  }
  return { Vector2 };
});

import { World, Transform } from '@mochigo/ecs';
import { Vector2 } from '@mochigo/math';
import { WorldTransformResolver } from '../src/WorldTransformResolver';

describe('WorldTransformResolver', () => {
  it('entidad sin parent retorna su Transform local tal cual', () => {
    const world = new World();
    const e = world.createEntity();
    world.addComponent(e, Transform, new Transform(new Vector2(5, 3), 0, Vector2.one(), null));

    const resolved = new WorldTransformResolver(world).resolve(e);
    expect(resolved.position.x).toBe(5);
    expect(resolved.position.y).toBe(3);
  });

  it('entidad sin componente Transform retorna identidad', () => {
    const world = new World();
    const e = world.createEntity();
    const resolved = new WorldTransformResolver(world).resolve(e);
    expect(resolved.position.x).toBe(0);
    expect(resolved.rotation).toBe(0);
  });

  it('jerarquía de 3 niveles: posición mundial final es la esperada', () => {
    const world = new World();

    const grandparent = world.createEntity();
    world.addComponent(grandparent, Transform, new Transform(new Vector2(10, 0), 0, Vector2.one(), null));

    const parent = world.createEntity();
    world.addComponent(parent, Transform, new Transform(new Vector2(5, 0), 0, Vector2.one(), grandparent));

    const child = world.createEntity();
    world.addComponent(child, Transform, new Transform(new Vector2(2, 0), 0, Vector2.one(), parent));

    const resolved = new WorldTransformResolver(world).resolve(child);
    expect(resolved.position.x).toBeCloseTo(17, 5); // 10 + 5 + 2
    expect(resolved.position.y).toBeCloseTo(0, 5);
  });

  it('la rotación del padre afecta la posición mundial del hijo', () => {
    const world = new World();

    const parent = world.createEntity();
    world.addComponent(parent, Transform, new Transform(new Vector2(0, 0), Math.PI / 2, Vector2.one(), null));

    const child = world.createEntity();
    world.addComponent(child, Transform, new Transform(new Vector2(1, 0), 0, Vector2.one(), parent));

    const resolved = new WorldTransformResolver(world).resolve(child);
    expect(resolved.position.x).toBeCloseTo(0, 5);
    expect(resolved.position.y).toBeCloseTo(1, 5); // rotar (1,0) 90° ≈ (0,1)
  });

  it('memoiza dentro del mismo frame: el padre se resuelve una sola vez para 2 hermanos', () => {
    const world = new World();

    const parent = world.createEntity();
    world.addComponent(parent, Transform, new Transform(new Vector2(10, 10), 0, Vector2.one(), null));

    const childA = world.createEntity();
    world.addComponent(childA, Transform, new Transform(new Vector2(1, 0), 0, Vector2.one(), parent));
    const childB = world.createEntity();
    world.addComponent(childB, Transform, new Transform(new Vector2(0, 1), 0, Vector2.one(), parent));

    const getComponentSpy = vi.spyOn(world, 'getComponent');
    const resolver = new WorldTransformResolver(world);
    resolver.resolve(childA);
    resolver.resolve(childB);

    const parentLookups = getComponentSpy.mock.calls.filter(([id]) => id === parent).length;
    expect(parentLookups).toBe(1);
  });

  it('parent apuntando a una entidad destruida se trata como sin parent', () => {
    const world = new World();
    const parent = world.createEntity();
    world.addComponent(parent, Transform, new Transform(new Vector2(100, 0), 0, Vector2.one(), null));

    const child = world.createEntity();
    world.addComponent(child, Transform, new Transform(new Vector2(1, 0), 0, Vector2.one(), parent));

    world.destroyEntity(parent);

    const resolved = new WorldTransformResolver(world).resolve(child);
    expect(resolved.position.x).toBe(1); // solo su posición local, sin la del padre destruido
  });
});
