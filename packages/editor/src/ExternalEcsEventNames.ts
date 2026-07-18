/**
 * Nombres de eventos ECS que Editor escucha para la Hierarchy. Nunca
 * confirmamos el archivo real de @mochigo/ecs/src/events.ts (solo las
 * referencias simbólicas EcsEvents.EntityCreated/etc. en World.ts), así
 * que se centralizan acá para ajuste de una línea si difieren — mismo
 * patrón que ExternalEventNames.ts en Scripting.
 *
 * Por eso Editor NO depende exclusivamente de este broadcast: cada vez
 * que el propio Editor crea/destruye una entidad, actualiza su registro
 * local directamente (ver EditorState.notifyEntityCreated/Destroyed).
 * Este evento es solo un "best effort" adicional para enterarse de
 * cambios que NO vinieron de una acción del propio Editor (ej. un
 * script en play mode creando una entidad).
 */
export const ExternalEcsEventNames = {
  EntityCreated: 'ecs:entity-created',
  EntityDestroyed: 'ecs:entity-destroyed',
  ComponentAdded: 'ecs:component-added',
  ComponentRemoved: 'ecs:component-removed',
} as const;
