import type { System, World, EntityId, ComponentClass } from '@mochigo/ecs';
import type { EventBus } from '@mochigo/events';
import type { ScriptComponent, ScriptComponentClass, GameContext } from './types';
import { ExternalEventNames } from './ExternalEventNames';

export class ScriptingSystem implements System {
  readonly name = 'ScriptingSystem';

  private registry = new Map<string, ScriptComponentClass>();

  // Trackea qué instancias YA recibieron onStart, para no volver a
  // llamarlo. Se indexa por la instancia misma (no por entity+nombre),
  // porque una entidad puede tener múltiples scripts distintos
  // adjuntos simultáneamente, cada uno con su propio onStart pendiente.
  private startedInstances = new WeakSet<ScriptComponent>();

  // Los handlers de eventos externos (colisión, destrucción) no reciben
  // el World como parámetro - solo el payload del evento - así que
  // ScriptingSystem debe recordar el World de la última vez que corrió
  // update() para poder consultar componentes desde esos handlers.
  // Se asigna al principio de cada update(); si un evento externo se
  // dispara ANTES del primer update() (arranque en frío), se loguea una
  // advertencia explícita en vez de fallar en silencio.
  private lastKnownWorld: World | null = null;

  constructor(private readonly eventBus: EventBus) {
    this.eventBus.on(ExternalEventNames.CollisionEnter, this.handleCollisionEnter);
    this.eventBus.on(ExternalEventNames.CollisionExit, this.handleCollisionExit);
    this.eventBus.on(ExternalEventNames.EntityDestroyed, this.handleEntityDestroyed);
  }

  registerScriptClass(scriptClass: ScriptComponentClass): void {
    this.registry.set(scriptClass.componentName, scriptClass);
  }

  update(world: World, fixedDeltaTime: number): void {
    this.lastKnownWorld = world;

    for (const [, scriptClass] of this.registry) {
      const results = world.query([scriptClass as unknown as ComponentClass<any>]);

      for (const entity of results) {
        const script = world.getComponent(entity, scriptClass as unknown as ComponentClass<ScriptComponent>);
        if (!script) continue;

        const ctx: GameContext = { world, eventBus: this.eventBus, entity, deltaTime: fixedDeltaTime };

        this.safeInvoke(() => {
          if (!this.startedInstances.has(script)) {
            this.startedInstances.add(script);
            script.onStart?.(ctx);
          }
          script.onUpdate?.(ctx);
        }, entity, scriptClass.componentName, 'onStart/onUpdate');
      }
    }
  }

  /** Libera los listeners del EventBus. Llamar al destruir el sistema (ej. en tests). */
  destroy(): void {
    this.eventBus.off(ExternalEventNames.CollisionEnter, this.handleCollisionEnter);
    this.eventBus.off(ExternalEventNames.CollisionExit, this.handleCollisionExit);
    this.eventBus.off(ExternalEventNames.EntityDestroyed, this.handleEntityDestroyed);
  }

  // ── Handlers de eventos externos ─────────────────────────

  private handleCollisionEnter = (payload: { entityA: EntityId; entityB: EntityId }): void => {
    // Ambas entidades ven a la otra como "other" (checklist: si ambas
    // tienen scripts con ese hook, ambas deben recibir la llamada).
    this.dispatchCollisionHook(payload.entityA, payload.entityB, 'onCollisionEnter');
    this.dispatchCollisionHook(payload.entityB, payload.entityA, 'onCollisionEnter');
  };

  private handleCollisionExit = (payload: { entityA: EntityId; entityB: EntityId }): void => {
    this.dispatchCollisionHook(payload.entityA, payload.entityB, 'onCollisionExit');
    this.dispatchCollisionHook(payload.entityB, payload.entityA, 'onCollisionExit');
  };

  private dispatchCollisionHook(
    self: EntityId,
    other: EntityId,
    hookName: 'onCollisionEnter' | 'onCollisionExit'
  ): void {
    const world = this.requireWorld('collision');
    if (!world) return;

    for (const [, scriptClass] of this.registry) {
      const componentClass = scriptClass as unknown as ComponentClass<ScriptComponent>;
      if (!world.hasComponent(self, componentClass)) continue;

      const script = world.getComponent(self, componentClass);
      const hook = script?.[hookName];
      if (!script || !hook) continue;

      const ctx: GameContext = { world, eventBus: this.eventBus, entity: self, deltaTime: 0 };
      this.safeInvoke(() => hook.call(script, ctx, other), self, scriptClass.componentName, hookName);
    }
  }

  private handleEntityDestroyed = (payload: { entityId: EntityId }): void => {
    const world = this.requireWorld('entity-destroyed');
    if (!world) return;

    for (const [, scriptClass] of this.registry) {
      const componentClass = scriptClass as unknown as ComponentClass<ScriptComponent>;
      if (!world.hasComponent(payload.entityId, componentClass)) continue;

      const script = world.getComponent(payload.entityId, componentClass);
      if (!script?.onDestroy) continue;

      const ctx: GameContext = { world, eventBus: this.eventBus, entity: payload.entityId, deltaTime: 0 };
      this.safeInvoke(
        () => script.onDestroy!(ctx),
        payload.entityId,
        scriptClass.componentName,
        'onDestroy'
      );
    }
  };

  // ── Utilidades internas ──────────────────────────────────

  private requireWorld(context: string): World | null {
    if (!this.lastKnownWorld) {
      console.warn(
        `[ScriptingSystem] Se recibió un evento de "${context}" antes del primer update(). ` +
        `No hay un World disponible todavía para despachar hooks de scripts.`
      );
      return null;
    }
    return this.lastKnownWorld;
  }

  private safeInvoke(fn: () => void, entity: EntityId, componentName: string, hookLabel: string): void {
    try {
      fn();
    } catch (error) {
      // Checklist: aislamiento de fallos, mismo criterio que EventBus.emit real
      // (un error en un hook no debe detener la ejecución de los demás scripts).
      console.error(
        `[ScriptingSystem] Error en ${hookLabel} de "${componentName}" (entidad ${entity}):`,
        error
      );
    }
  }
}
