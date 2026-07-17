import type { World, EntityId } from '@mochigo/ecs';
import type { EventBus } from '@mochigo/events';

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

/** Constructor de una subclase concreta de ScriptComponent (no la clase abstracta en sí). */
export type ScriptComponentClass = (new () => ScriptComponent) & {
  componentName: string;
  schema: ComponentSchema;
};
