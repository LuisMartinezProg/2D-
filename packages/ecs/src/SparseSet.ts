import type { EntityId } from './types';

export class SparseSet<T> {
  private sparse: number[] = [];
  private denseEntities: EntityId[] = [];
  private denseData: T[] = [];

  has(entityId: EntityId): boolean {
    const index = this.sparse[entityId];
    return index !== undefined && index !== -1 && this.denseEntities[index] === entityId;
  }

  add(entityId: EntityId, data: T): void {
    if (this.has(entityId)) {
      this.denseData[this.sparse[entityId]] = data;
      return;
    }
    const index = this.denseEntities.length;
    this.sparse[entityId] = index;
    this.denseEntities.push(entityId);
    this.denseData.push(data);
  }

  remove(entityId: EntityId): void {
    if (!this.has(entityId)) return;

    const index = this.sparse[entityId];
    const lastIndex = this.denseEntities.length - 1;
    const lastEntity = this.denseEntities[lastIndex];

    this.denseEntities[index] = lastEntity;
    this.denseData[index] = this.denseData[lastIndex];
    this.sparse[lastEntity] = index;

    this.denseEntities.pop();
    this.denseData.pop();
    this.sparse[entityId] = -1;
  }

  get(entityId: EntityId): T | undefined {
    return this.has(entityId) ? this.denseData[this.sparse[entityId]] : undefined;
  }

  get size(): number {
    return this.denseEntities.length;
  }

  get entities(): readonly EntityId[] {
    return this.denseEntities;
  }
}
