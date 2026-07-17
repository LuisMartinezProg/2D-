import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '@mochigo/ecs';
import { EventBus } from '@mochigo/events';
import { ScriptingSystem } from '../src/ScriptingSystem';
import { ExternalEventNames } from '../src/ExternalEventNames';
import {
  FullLifecycleScript,
  UpdateOnlyScript,
  ThrowingScript,
  EmptyScript,
} from './fixtures';

describe('ScriptingSystem', () => {
  let world: World;
  let eventBus: EventBus;
  let system: ScriptingSystem;

  beforeEach(() => {
    world = new World();
    eventBus = new EventBus();
    system = new ScriptingSystem(eventBus);
  });

  describe('registerScriptClass() + onUpdate cada frame', () => {
    it('llama onUpdate en cada update() para cada entidad con el script registrado', () => {
      system.registerScriptClass(UpdateOnlyScript);

      const entity = world.createEntity();
      const script = new UpdateOnlyScript();
      world.addComponent(entity, UpdateOnlyScript, script);

      system.update(world, 0.016);
      system.update(world, 0.016);
      system.update(world, 0.016);

      expect(script.updateCalls).toBe(3);
    });

    it('un script no registrado en el sistema es ignorado (no lanza, simplemente no corre)', () => {
      // Nunca llamamos registerScriptClass(UpdateOnlyScript) acá.
      const entity = world.createEntity();
      world.addComponent(entity, UpdateOnlyScript, new UpdateOnlyScript());

      expect(() => system.update(world, 0.016)).not.toThrow();
    });

    it('entidades sin ningún script no afectan al sistema', () => {
      world.createEntity(); // entidad vacía, sin componentes de scripting

      expect(() => system.update(world, 0.016)).not.toThrow();
    });
  });

  describe('onStart: se llama exactamente una vez por instancia', () => {
    beforeEach(() => {
      system.registerScriptClass(FullLifecycleScript);
    });

    it('onStart corre en el primer update() y nunca más, aunque el sistema siga actualizando', () => {
      const entity = world.createEntity();
      const script = new FullLifecycleScript();
      world.addComponent(entity, FullLifecycleScript, script);

      system.update(world, 0.016);
      system.update(world, 0.016);
      system.update(world, 0.016);

      expect(script.startCalls).toHaveLength(1);
      expect(script.updateCalls).toHaveLength(3); // onUpdate sí corre todas las veces
    });

    it('onStart corre ANTES que onUpdate en el mismo frame de aparición', () => {
      const entity = world.createEntity();
      const script = new FullLifecycleScript();
      const callOrder: string[] = [];
      script.onStart = () => callOrder.push('start');
      script.onUpdate = () => callOrder.push('update');
      world.addComponent(entity, FullLifecycleScript, script);

      system.update(world, 0.016);

      expect(callOrder).toEqual(['start', 'update']);
    });

    it('dos instancias distintas de la misma clase de script tienen su propio onStart independiente', () => {
      const entityA = world.createEntity();
      const scriptA = new FullLifecycleScript();
      world.addComponent(entityA, FullLifecycleScript, scriptA);

      system.update(world, 0.016); // scriptA ya recibió su onStart

      const entityB = world.createEntity();
      const scriptB = new FullLifecycleScript();
      world.addComponent(entityB, FullLifecycleScript, scriptB);

      system.update(world, 0.016); // scriptB debería recibir el SUYO recién ahora

      expect(scriptA.startCalls).toHaveLength(1); // no un segundo start
      expect(scriptB.startCalls).toHaveLength(1); // el suyo, en su propio primer frame
    });
  });

  describe('scripts con hooks parciales no rompen el sistema', () => {
    it('un script sin onCollisionEnter/onDestroy no lanza cuando esos eventos ocurren', () => {
      system.registerScriptClass(UpdateOnlyScript);
      const entity = world.createEntity();
      world.addComponent(entity, UpdateOnlyScript, new UpdateOnlyScript());
      system.update(world, 0.016); // establece lastKnownWorld

      expect(() => {
        eventBus.emit(ExternalEventNames.CollisionEnter, {
          entityA: entity, entityB: 999, contactPoint: { x: 0, y: 0 },
        });
        eventBus.emit(ExternalEventNames.EntityDestroyed, { entityId: entity });
      }).not.toThrow();
    });

    it('un EmptyScript (sin ningún hook) puede registrarse y actualizarse sin lanzar', () => {
      system.registerScriptClass(EmptyScript);
      const entity = world.createEntity();
      world.addComponent(entity, EmptyScript, new EmptyScript());

      expect(() => system.update(world, 0.016)).not.toThrow();
    });
  });

  describe('collision:enter / collision:exit despachan a los scripts correctos', () => {
    beforeEach(() => {
      system.registerScriptClass(FullLifecycleScript);
    });

    it('ambas entidades involucradas reciben onCollisionEnter, cada una viendo a la otra como "other"', () => {
      const entityA = world.createEntity();
      const scriptA = new FullLifecycleScript();
      world.addComponent(entityA, FullLifecycleScript, scriptA);

      const entityB = world.createEntity();
      const scriptB = new FullLifecycleScript();
      world.addComponent(entityB, FullLifecycleScript, scriptB);

      system.update(world, 0.016); // establece lastKnownWorld

      eventBus.emit(ExternalEventNames.CollisionEnter, {
        entityA, entityB, contactPoint: { x: 10, y: 20 },
      });

      expect(scriptA.collisionEnterCalls).toHaveLength(1);
      expect(scriptA.collisionEnterCalls[0].other).toBe(entityB);
      expect(scriptB.collisionEnterCalls).toHaveLength(1);
      expect(scriptB.collisionEnterCalls[0].other).toBe(entityA);
    });

    it('el GameContext de onCollisionEnter incluye contactPoint', () => {
      const entityA = world.createEntity();
      const scriptA = new FullLifecycleScript();
      world.addComponent(entityA, FullLifecycleScript, scriptA);
      const entityB = world.createEntity();

      system.update(world, 0.016);

      eventBus.emit(ExternalEventNames.CollisionEnter, {
        entityA, entityB, contactPoint: { x: 42, y: 7 },
      });

      expect(scriptA.collisionEnterCalls[0].ctx.contactPoint).toEqual({ x: 42, y: 7 });
    });

    it('collision:exit despacha a onCollisionExit sin incluir contactPoint (undefined)', () => {
      const entityA = world.createEntity();
      const scriptA = new FullLifecycleScript();
      world.addComponent(entityA, FullLifecycleScript, scriptA);
      const entityB = world.createEntity();

      system.update(world, 0.016);

      eventBus.emit(ExternalEventNames.CollisionExit, { entityA, entityB });

      expect(scriptA.collisionExitCalls).toHaveLength(1);
      expect(scriptA.collisionExitCalls[0].ctx.contactPoint).toBeUndefined();
    });

    it('una entidad SIN ningún script no genera ninguna llamada, aunque colisione', () => {
      const entityA = world.createEntity(); // sin componentes de scripting
      const entityB = world.createEntity();

      system.update(world, 0.016);

      expect(() => {
        eventBus.emit(ExternalEventNames.CollisionEnter, {
          entityA, entityB, contactPoint: { x: 0, y: 0 },
        });
      }).not.toThrow();
    });

    it('si una entidad tiene MÚLTIPLES scripts registrados, todos reciben el hook de colisión', () => {
      system.registerScriptClass(UpdateOnlyScript); // segunda clase, sin hook de colisión

      const entity = world.createEntity();
      const fullScript = new FullLifecycleScript();
      world.addComponent(entity, FullLifecycleScript, fullScript);
      world.addComponent(entity, UpdateOnlyScript, new UpdateOnlyScript()); // no tiene el hook, no debe romper nada

      const other = world.createEntity();

      system.update(world, 0.016);

      expect(() => {
        eventBus.emit(ExternalEventNames.CollisionEnter, {
          entityA: entity, entityB: other, contactPoint: { x: 1, y: 1 },
        });
      }).not.toThrow();

      expect(fullScript.collisionEnterCalls).toHaveLength(1);
    });
  });

  describe('ecs:entity-destroyed despacha onDestroy correctamente', () => {
    beforeEach(() => {
      system.registerScriptClass(FullLifecycleScript);
    });

    it('llama onDestroy cuando se emite el evento de entidad destruida', () => {
      const entity = world.createEntity();
      const script = new FullLifecycleScript();
      world.addComponent(entity, FullLifecycleScript, script);

      system.update(world, 0.016);

      eventBus.emit(ExternalEventNames.EntityDestroyed, { entityId: entity });

      expect(script.destroyCalls).toHaveLength(1);
    });

    it('no llama onDestroy de una entidad distinta a la destruida', () => {
      const entityA = world.createEntity();
      const scriptA = new FullLifecycleScript();
      world.addComponent(entityA, FullLifecycleScript, scriptA);

      const entityB = world.createEntity();
      const scriptB = new FullLifecycleScript();
      world.addComponent(entityB, FullLifecycleScript, scriptB);

      system.update(world, 0.016);

      eventBus.emit(ExternalEventNames.EntityDestroyed, { entityId: entityA });

      expect(scriptA.destroyCalls).toHaveLength(1);
      expect(scriptB.destroyCalls).toHaveLength(0);
    });
  });

  describe('aislamiento de fallos: un script roto no detiene a los demás', () => {
    beforeEach(() => {
      system.registerScriptClass(ThrowingScript);
      system.registerScriptClass(UpdateOnlyScript);
    });

    it('si un script lanza en onUpdate, otros scripts en OTRAS entidades igual se actualizan', () => {
      const brokenEntity = world.createEntity();
      world.addComponent(brokenEntity, ThrowingScript, new ThrowingScript());

      const healthyEntity = world.createEntity();
      const healthyScript = new UpdateOnlyScript();
      world.addComponent(healthyEntity, UpdateOnlyScript, healthyScript);

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => system.update(world, 0.016)).not.toThrow();

      expect(healthyScript.updateCalls).toBe(1); // no se vio afectado por el fallo del otro
      expect(consoleErrorSpy).toHaveBeenCalled(); // el error sí se logueó, no se tragó en silencio

      consoleErrorSpy.mockRestore();
    });

    it('un script que lanza en onUpdate sigue recibiendo onUpdate en frames posteriores (no queda "baneado")', () => {
      const entity = world.createEntity();
      world.addComponent(entity, ThrowingScript, new ThrowingScript());
      vi.spyOn(console, 'error').mockImplementation(() => {});

      system.update(world, 0.016);
      expect(() => system.update(world, 0.016)).not.toThrow(); // segundo frame, sigue sin explotar el sistema entero

      vi.restoreAllMocks();
    });
  });

  describe('advertencia cuando un evento externo llega antes del primer update()', () => {
    it('loguea una advertencia y no lanza si collision:enter llega antes de cualquier update()', () => {
      system.registerScriptClass(FullLifecycleScript);
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      expect(() => {
        eventBus.emit(ExternalEventNames.CollisionEnter, {
          entityA: 1, entityB: 2, contactPoint: { x: 0, y: 0 },
        });
      }).not.toThrow();

      expect(consoleWarnSpy).toHaveBeenCalled();
      consoleWarnSpy.mockRestore();
    });
  });

  describe('destroy(): libera los listeners del EventBus', () => {
    it('después de destroy(), los eventos externos ya no despachan ningún hook', () => {
      system.registerScriptClass(FullLifecycleScript);
      const entity = world.createEntity();
      const script = new FullLifecycleScript();
      world.addComponent(entity, FullLifecycleScript, script);

      system.update(world, 0.016);
      system.destroy();

      eventBus.emit(ExternalEventNames.EntityDestroyed, { entityId: entity });

      expect(script.destroyCalls).toHaveLength(0); // ya no debería haber sido llamado
    });
  });
});
