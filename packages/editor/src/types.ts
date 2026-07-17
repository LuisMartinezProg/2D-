import type { EntityId } from '@mochigo/ecs';
import type { SceneDefinition } from '@mochigo/scenes';

export type { SceneDefinition };

export interface EditorSelectionChangedPayload {
  entity: EntityId | null;
}
