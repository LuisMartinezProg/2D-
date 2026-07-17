import { bench, describe } from 'vitest';
import { World } from '../src/World';

class Position { static readonly componentName = 'Position'; constructor(public x = 0, public y = 0) {} }
class Velocity { static readonly componentName = 'Velocity'; constructor(public dx = 0, public dy = 0) {} }
class Health { static readonly componentName = 'Health'; constructor(public hp = 100) {} }

const ENTITY_COUNT = 10_000;

function buildWorld(): World {
  const world = new World();
  for (let i = 0; i < ENTITY_COUNT; i++) {
    const e = world.createEntity();
    world.addComponent(e, Position, new Position(i, i));
    if (i % 2 === 0) world.addComponent(e, Velocity, new Velocity(1, 1));
    if (i % 10 === 0) world.addComponent(e, Health, new Health());
  }
  return world;
}

describe(`query() con ${ENTITY_COUNT} entidades`, () => {
  const world = buildWorld();

  bench('1 componente (10,000 coincidencias)', () => {
    world.query([Position]).count();
  });

  bench('2 componentes (5,000 coincidencias)', () => {
    world.query([Position, Velocity]).count();
  });

  bench('3 componentes (1,000 coincidencias, más selectivo primero)', () => {
    world.query([Position, Velocity, Health]).count();
  });
});
