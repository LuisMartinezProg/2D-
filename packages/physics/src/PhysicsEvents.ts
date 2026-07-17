import type { EntityId } from '@mochigo/ecs';
import type { Vector2 } from '@mochigo/math';

export const PhysicsEvents = {
  CollisionEnter: 'collision:enter',
  CollisionStay: 'collision:stay',
  CollisionExit: 'collision:exit',
} as const;

export interface CollisionEnterPayload {
  entityA: EntityId;
  entityB: EntityId;
  contactPoint: Vector2;
}

export interface CollisionStayPayload {
  entityA: EntityId;
  entityB: EntityId;
}

export interface CollisionExitPayload {
  entityA: EntityId;
  entityB: EntityId;
}
