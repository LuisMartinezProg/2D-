export type EntityId = number;

export interface ComponentClass<T> {
  readonly componentName: string;
  new (...args: any[]): T;
}

export interface QueryResult {
  [Symbol.iterator](): Iterator<EntityId>;
  count(): number;
}

export interface System {
  readonly name: string;
  update(world: World, deltaTime: number): void;
}

// Import type-only para evitar ciclo circular con World.ts
import type { World } from './World';
