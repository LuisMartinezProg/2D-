import type { World, EntityId } from '@mochigo/ecs';
import type { EventBus } from '@mochigo/events';
import type { Vector2 } from '@mochigo/math';

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
  // Solo presente cuando el contexto acompaña a onCollisionEnter (Physics
  // lo incluye en el payload real de collision:enter, pero no en
  // stay/exit - ver 06-physics.md sección 6). undefined en cualquier
  // otro hook.
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
