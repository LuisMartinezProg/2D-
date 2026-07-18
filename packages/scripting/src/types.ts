import type { World, EntityId } from '@mochigo/ecs';
import type { EventBus } from '@mochigo/events';
import type { Vector2 } from '@mochigo/math';

export type { Vector2 };

export type SchemaFieldType = 'number' | 'string' | 'boolean' | 'vector2' | 'color' | 'entity';

export interface SchemaField {
  type: SchemaFieldType;
  default: unknown;
  label?: string;
  min?: number;
  max?: number;
}

export type ComponentSchema = Record<string, SchemaField>;

export interface GameContext {
  world: World;
  eventBus: EventBus;
  entity: EntityId;
  deltaTime: number;
  contactPoint?: Vector2;
}

export abstract class ScriptComponent {
  static readonly componentName: string;
  static readonly schema: ComponentSchema = {};

  onStart?(ctx: GameContext): void;
  onUpdate?(ctx: GameContext): void;
  onCollisionEnter?(ctx: GameContext, other: EntityId): void;
  onCollisionExit?(ctx: GameContext, other: EntityId): void;
  onDestroy?(ctx: GameContext): void;
}

export type ScriptComponentClass = (new () => ScriptComponent) & {
  componentName: string;
  schema: ComponentSchema;
};
