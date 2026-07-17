// ============================================================
// MOCK — @mochigo/ecs
// ============================================================
// Stand-in temporal porque @mochigo/ecs todavía no existe
// (00-ARQUITECTURA.md sección 9: "ECS: no iniciado").
// La interfaz pública (World, System, Transform, etc.) está copiada
// exacta de 01-ecs.md secciones 3 y 6, no debe divergir de esa ficha.
// La implementación de acá NO es la real (no usa sparse set, no está
// pensada para 10,000 entidades): es solo lo mínimo funcional para
// poder escribir y correr los tests del Renderer contra un World que
// realmente funcione.
//
// Cuando @mochigo/ecs exista de verdad:
//   1. Borrar este archivo.
//   2. Cambiar los imports de './mocks/ecs.mock' a '@mochigo/ecs'.
//   3. Correr los tests del Renderer contra el World real, si algo
//      falla ahí es porque el World real no respeta 01-ecs.md al pie
//      de la letra, repórtalo en ese módulo, no lo parches acá.
// ============================================================

import { Vector2 } from './math.mock';

export type EntityId = number;

export interface ComponentClass<T> {
  readonly componentName: string;
  new (...args: any[]): T;
}

export interface QueryResult extends Iterable<EntityId> {
  count(): number;
}

export interface System {
  readonly name: string;
  update(world: World, deltaTime: number): void;
}

export class Transform {
  static readonly componentName = 'Transform';
  constructor(
    public position: Vector2 = Vector2.zero(),
    public rotation: number = 0,
    public scale: Vector2 = Vector2.one(),
    public parent: EntityId | null = null
  ) {}
}

export class World {
  private nextEntityId = 1;
  private alive = new Set<EntityId>();
  private stores = new Map<string, Map<EntityId, unknown>>();
  private systems: System[] = [];

  createEntity(): EntityId {
    const id = this.nextEntityId++;
    this.alive.add(id);
    return id;
  }

  destroyEntity(id: EntityId): void {
    if (!this.alive.has(id)) return;
    for (const store of this.stores.values()) {
      store.delete(id);
    }
    this.alive.delete(id);
  }

  isAlive(id: EntityId): boolean {
    return this.alive.has(id);
  }

  addComponent<T>(entity: EntityId, componentClass: ComponentClass<T>, instance: T): void {
    let store = this.stores.get(componentClass.componentName);
    if (!store) {
      store = new Map();
      this.stores.set(componentClass.componentName, store);
    }
    store.set(entity, instance);
  }

  removeComponent<T>(entity: EntityId, componentClass: ComponentClass<T>): void {
    this.stores.get(componentClass.componentName)?.delete(entity);
  }

  getComponent<T>(entity: EntityId, componentClass: ComponentClass<T>): T | undefined {
    return this.stores.get(componentClass.componentName)?.get(entity) as T | undefined;
  }

  hasComponent<T>(entity: EntityId, componentClass: ComponentClass<T>): boolean {
    return this.stores.get(componentClass.componentName)?.has(entity) ?? false;
  }

  query(componentClasses: ComponentClass<any>[]): QueryResult {
    const matches: EntityId[] = [];
    for (const entity of this.alive) {
      if (componentClasses.every((c) => this.hasComponent(entity, c))) {
        matches.push(entity);
      }
    }
    return {
      [Symbol.iterator]: () => matches[Symbol.iterator](),
      count: () => matches.length,
    };
  }

  addSystem(system: System): void {
    this.systems.push(system);
  }

  removeSystem(system: System): void {
    this.systems = this.systems.filter((s) => s !== system);
  }

  update(deltaTime: number): void {
    for (const system of this.systems) {
      system.update(this, deltaTime);
    }
  }
}
