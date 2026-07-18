import type { ComponentClass, EntityId, QueryResult, System } from './types';
import { SparseSet } from './SparseSet';
import { LazyQueryResult, EMPTY_QUERY_RESULT } from './QueryResult';
import { EcsEvents, noopEventEmitter, type EcsEventEmitter } from './events';

export class World {
  private nextEntityId: EntityId = 0;
  private freeEntityIds: EntityId[] = [];
  private aliveFlags: boolean[] = [];
  private componentStores = new Map<string, SparseSet<any>>();
  private systems: System[] = [];

  constructor(private readonly eventEmitter: EcsEventEmitter = noopEventEmitter) {}

  createEntity(): EntityId {
    const id = this.freeEntityIds.pop() ?? this.nextEntityId++;
    this.aliveFlags[id] = true;
    this.eventEmitter.emit(EcsEvents.EntityCreated, { entityId: id });
    return id;
  }

  isAlive(id: EntityId): boolean {
    return this.aliveFlags[id] === true;
  }

  destroyEntity(id: EntityId): void {
    if (!this.isAlive(id)) return;
    this.eventEmitter.emit(EcsEvents.EntityDestroyed, { entityId: id });
    for (const store of this.componentStores.values()) store.remove(id);
    this.aliveFlags[id] = false;
    this.freeEntityIds.push(id);
  }

  addComponent<T>(entity: EntityId, componentClass: ComponentClass<T>, instance: T): void {
    if (!this.isAlive(entity)) {
      throw new Error(`No se puede añadir "${componentClass.componentName}" a la entidad ${entity}: no existe.`);
    }
    this.getOrCreateStore(componentClass).add(entity, instance);
    this.eventEmitter.emit(EcsEvents.ComponentAdded, {
      entityId: entity,
      componentName: componentClass.componentName,
    });
  }

  removeComponent<T>(entity: EntityId, componentClass: ComponentClass<T>): void {
    const store = this.componentStores.get(componentClass.componentName);
    if (!store || !store.has(entity)) return;
    store.remove(entity);
    this.eventEmitter.emit(EcsEvents.ComponentRemoved, {
      entityId: entity,
      componentName: componentClass.componentName,
    });
  }

  getComponent<T>(entity: EntityId, componentClass: ComponentClass<T>): T | undefined {
    return this.componentStores.get(componentClass.componentName)?.get(entity);
  }

  hasComponent<T>(entity: EntityId, componentClass: ComponentClass<T>): boolean {
    return this.componentStores.get(componentClass.componentName)?.has(entity) ?? false;
  }

  private getOrCreateStore<T>(componentClass: ComponentClass<T>): SparseSet<T> {
    let store = this.componentStores.get(componentClass.componentName);
    if (!store) {
      store = new SparseSet<T>();
      this.componentStores.set(componentClass.componentName, store);
    }
    return store;
  }

  query(componentClasses: ComponentClass<any>[]): QueryResult {
    if (componentClasses.length === 0) return EMPTY_QUERY_RESULT;

    const stores = componentClasses.map((cc) => this.componentStores.get(cc.componentName));
    if (stores.some((s) => s === undefined)) return EMPTY_QUERY_RESULT;
    const validStores = stores as SparseSet<any>[];

    let smallest = validStores[0];
    for (let i = 1; i < validStores.length; i++) {
      if (validStores[i].size < smallest.size) smallest = validStores[i];
    }

    const matches = (entityId: EntityId): boolean => {
      for (const store of validStores) {
        if (store !== smallest && !store.has(entityId)) return false;
      }
      return true;
    };

    return new LazyQueryResult(smallest.entities, matches);
  }

  addSystem(system: System): void {
    this.systems.push(system);
  }

  removeSystem(system: System): void {
    const index = this.systems.indexOf(system);
    if (index !== -1) this.systems.splice(index, 1);
  }

  update(deltaTime: number): void {
    for (const system of this.systems) system.update(this, deltaTime);
  }
}
