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
  update(world: import('./World').World, deltaTime: number): void;
}
