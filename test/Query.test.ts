import { describe, it, expect } from 'vitest';
import { World } from '../src/World';

class A { static readonly componentName = 'A'; }
class B { static readonly componentName = 'B'; }
class C { static readonly componentName = 'C'; }

describe('World.query', () => {
  it('vacío en un World sin entidades', () => {
    const world = new World();
    expect(world.query([A]).count()).toBe(0);
  });

  it('1 componente retorna solo las que lo tienen', () => {
    const world = new World();
    const a1 = world.createEntity();
    const noA = world.createEntity();
    world.addComponent(a1, A, new A());
    expect([...world.query([A])]).toEqual([a1]);
  });

  it('2 componentes retorna solo la intersección', () => {
    const world = new World();
    const both = world.createEntity();
    const onlyA = world.createEntity();
    world.addComponent(both, A, new A());
    world.addComponent(both, B, new B());
    world.addComponent(onlyA, A, new A());
    expect([...world.query([A, B])]).toEqual([both]);
  });

  it('3+ componentes combinados', () => {
    const world = new World();
    const all3 = world.createEntity();
    const missingC = world.createEntity();
    world.addComponent(all3, A, new A());
    world.addComponent(all3, B, new B());
    world.addComponent(all3, C, new C());
    world.addComponent(missingC, A, new A());
    world.addComponent(missingC, B, new B());
    expect([...world.query([A, B, C])]).toEqual([all3]);
  });

  it('query([]) retorna vacío por diseño', () => {
    const world = new World();
    world.createEntity();
    expect(world.query([]).count()).toBe(0);
  });
});
