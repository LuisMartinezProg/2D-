import type { EntityId, QueryResult } from './types';

export class LazyQueryResult implements QueryResult {
  constructor(
    private readonly candidates: readonly EntityId[],
    private readonly matches: (entityId: EntityId) => boolean
  ) {}

  *[Symbol.iterator](): Iterator<EntityId> {
    for (const entityId of this.candidates) {
      if (this.matches(entityId)) yield entityId;
    }
  }

  count(): number {
    let total = 0;
    for (const entityId of this.candidates) {
      if (this.matches(entityId)) total++;
    }
    return total;
  }
}

export const EMPTY_QUERY_RESULT: QueryResult = new LazyQueryResult([], () => true);
