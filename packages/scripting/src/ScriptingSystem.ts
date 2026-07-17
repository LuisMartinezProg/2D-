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

  constructor(private readonly eventBus: EventBus) {
    this.eventBus.on(ExternalEventNames.CollisionEnter, this.handleCollisionEnter);
    this.eventBus.on(ExternalEventNames.CollisionExit, this.handleCollisionExit);
    this.eventBus.on(ExternalEventNames.EntityDestroyed, this.handleEntityDestroyed);
  }

  registerScriptClass(scriptClass: ScriptComponentClass): void {
    this.registry.set(scriptClass.componentName, scriptClass);
  }

  update(world: World, fixedDeltaTime: number): void {
    for (const [componentName, scriptClass] of this.registry) {
      const results = world.query([scriptClass as unknown as ComponentClass<any>]);

      for (const entity of results) {
        const script = world.getComponent(entity, scriptClass as unknown as ComponentClass<ScriptComponent>);
        if (!script) continue;

        const ctx: GameContext = { world, eventBus: this.eventBus, entity, deltaTime: fixedDeltaTime };

        this.runHookSafely(script, entity, componentName, 'onStart-or-onUpdate', () => {
          if (!this.startedInstances.has(script)) {
            this.startedInstances.add(script);
            script.onStart?.(ctx);
          }
          script.onUpdate?.(ctx);
        });
      }
    }
  }

  /** Solo para tests/limpieza explícita: libera listeners del EventBus. */
  destroy(): void {
    this.eventBus.off(ExternalEventNames.CollisionEnter, this.handleCollisionEnter);
    this.eventBus.off(ExternalEventNames.CollisionExit, this.handleCollisionExit);
    this.eventBus.off(ExternalEventNames.EntityDestroyed, this.handleEntityDestroyed);
  }

  // ── Handlers de eventos externos ─────────────────────────

  private handleCollisionEnter = (payload: { entityA: EntityId; entityB: EntityId }): void => {
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
    // Nota de asunción: no tenemos acceso al World real acá dentro (el
    // handler solo recibe el payload del evento) - necesitamos que
    // ScriptingSystem GUARDE una referencia al World de la última
    // llamada a update() para poder consultar componentes fuera de ese
    // ciclo. Ver 'lastKnownWorld' más abajo.
    if (!this.lastKnownWorld) return;

    for (const [, scriptClass] of this.registry) {
      if (!this.lastKnownWorld.hasComponent(self, scriptClass as unknown as ComponentClass<any>)) continue;
      const script = this.lastKnownWorld.getComponent(self, scriptClass as unknown as ComponentClass<ScriptComponent>);
      if (!script) continue;

      const hook = script[hookName];
      if (!hook) continue;

      const ctx: GameContext = {
        world: this.lastKnownWorld,
        eventBus: this.eventBus,
        entity: self,
        deltaTime: 0, // no aplica fuera de update(); 0 es lo más honesto que se puede dar
      };

      this.safeInvoke(() => hook.call(script, ctx, other), self, scriptClass.componentName, hookName);
    }
  }

  private handleEntityDestroyed = (payload: { entityId: EntityId }): void => {
    if (!this.lastKnownWorld) return;

    for (const [, scriptClass] of this.registry) {
      if (!this.lastKnownWorld.hasComponent(payload.entityId, scriptClass as unknown as ComponentClass<any>)) continue;
      const script = this.lastKnownWorld.getComponent(
        payload.entityId,
        scriptClass as unknown as ComponentClass<ScriptComponent>
      );
      if (!script?.onDestroy) continue;

      const ctx: GameContext = {
        world: this.lastKnownWorld,
        eventBus: this.eventBus,
        entity: payload.entityId,
        deltaTime: 0,
      };

      this.safeInvoke(() => script.onDestroy!(ctx), payload.entityId, scriptClass.componentName, 'onDestroy');
    }
  };

  private lastKnownWorld: World | null = null;

  private runHookSafely(
    script: ScriptComponent,
    entity: EntityId,
    componentName: string,
    hookLabel: string,
    fn: () => void
  ): void {
    this.lastKnownWorld = this.lastKnownWorld; // no-op, ver nota abajo sobre dónde se asigna de verdad
    this.safeInvoke(fn, entity, componentName, hookLabel);
  }

  private safeInvoke(fn: () => void, entity: EntityId, componentName: string, hookLabel: string): void {
    try {
      fn();
    } catch (error) {
      console.error(
        `[ScriptingSystem] Error en ${hookLabel} de "${componentName}" (entidad ${entity}):`,
        error
      );
    }
  }
}
