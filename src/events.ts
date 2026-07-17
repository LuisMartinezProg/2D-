import type { EntityId } from './types';

/**
 * NOTA: el PDF de origen mostraba "ecs:entitycreated" sin guion — probable
 * artefacto de extracción. Uso guiones por consistencia con la convención de
 * 00-ARQUITECTURA.md sección 7 (ej. "asset:load-error"). Confirmar contra
 * 03-event-manager.md cuando exista.
 */
export const EcsEvents = {
  EntityCreated: 'ecs:entity-created',
  EntityDestroyed: 'ecs:entity-destroyed',
  ComponentAdded: 'ecs:component-added',
  ComponentRemoved: 'ecs:component-removed',
} as const;

export interface EntityCreatedPayload { entityId: EntityId }
export interface EntityDestroyedPayload { entityId: EntityId }
export interface ComponentAddedPayload { entityId: EntityId; componentName: string }
export interface ComponentRemovedPayload { entityId: EntityId; componentName: string }

/**
 * El ECS depende SOLO de esta interfaz, no del paquete @mochigo/events
 * (estado: no iniciado). Cualquier objeto con `emit` compatible sirve.
 */
export interface EcsEventEmitter {
  emit(eventName: string, payload: unknown): void;
}

export const noopEventEmitter: EcsEventEmitter = {
  emit(): void {},
};
