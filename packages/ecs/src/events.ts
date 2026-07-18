export const EcsEvents = {
  EntityCreated: 'ecs:entity-created',
  EntityDestroyed: 'ecs:entity-destroyed',
  ComponentAdded: 'ecs:component-added',
  ComponentRemoved: 'ecs:component-removed',
} as const;

export interface EcsEntityCreatedPayload {
  entityId: import('./types').EntityId;
}
export interface EcsEntityDestroyedPayload {
  entityId: import('./types').EntityId;
}
export interface EcsComponentAddedPayload {
  entityId: import('./types').EntityId;
  componentName: string;
}
export interface EcsComponentRemovedPayload {
  entityId: import('./types').EntityId;
  componentName: string;
}

/** Firma mínima compatible con @mochigo/events.EventBus, sin depender del paquete. */
export interface EcsEventEmitter {
  emit(event: string, payload: unknown): void;
}

export const noopEventEmitter: EcsEventEmitter = { emit: () => {} };
