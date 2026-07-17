/**
 * Nombres de eventos que ScriptingSystem CONSUME pero que son emitidos
 * por otros módulos (Physics, ECS) todavía no confirmados con código real
 * en este chat. La ficha 11-scripting.md los asume así:
 *
 *   - collision:enter / collision:exit  -> emitidos por PhysicsSystem (06-physics.md, no
 *     implementado aún en este proyecto)
 *   - ecs:entity-destroyed              -> emitido por World/ECS al destruir una entidad
 *     (no confirmado: solo vimos referencias a EcsEvents.EntityDestroyed como símbolo,
 *     nunca el archivo events.ts de @mochigo/ecs con su valor string real)
 *
 * Se centralizan ACÁ, en vez de hardcodearse dentro de ScriptingSystem,
 * para que si el nombre real termina siendo distinto, el ajuste sea de
 * una sola línea en este archivo durante la integración - no una
 * búsqueda por todo ScriptingSystem.ts.
 */
export const ExternalEventNames = {
  CollisionEnter: 'collision:enter',
  CollisionExit: 'collision:exit',
  EntityDestroyed: 'ecs:entity-destroyed',
} as const;
