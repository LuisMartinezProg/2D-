import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World } from '@mochigo/ecs';
import { AssetManager } from '@mochigo/assets';
import { EventBus } from '@mochigo/events';
import { SceneManager } from '../src/SceneManager';
import { SceneEvents } from '../src/SceneEvents';
import type { SceneDefinition } from '../src/types';
import { TestTransform, transformSerializer, TestSprite, spriteSerializer, exampleSceneJSON } from './fixtures';

describe('SceneManager', () => {
  let world: World;
  let assetManager: AssetManager;
  let eventBus: EventBus;
  let sceneManager: SceneManager;

  beforeEach(() => {
    eventBus = new EventBus();
    world = new World();
    assetManager = new AssetManager(eventBus);

    // loadManifest real haría fetch/Image real - lo stubeamos para que
    // resuelva inmediato sin tocar red, ya que SceneManager no necesita
    // testear la carga de assets en sí (eso ya lo cubrimos en el módulo
    // de Assets). Lo que sí nos importa es que loadManifest fue LLAMADO
    // con el manifest correcto, y eso sigue siendo verificable con el spy.
    vi.spyOn(assetManager, 'loadManifest').mockResolvedValue(undefined);
    vi.spyOn(assetManager, 'unload').mockImplementation(() => {});

    sceneManager = new SceneManager(world, assetManager, eventBus);
    sceneManager.registerComponent(TestTransform, transformSerializer);
    sceneManager.registerComponent(TestSprite, spriteSerializer);
  });

  describe('loadScene(): puebla el World correctamente', () => {
    it('crea las entidades y componentes descritos en la definición de escena', async () => {
      await sceneManager.loadScene(exampleSceneJSON as SceneDefinition);

      let found: any = null;
      for (const entity of world.query([TestTransform, TestSprite])) {
        found = {
          transform: world.getComponent(entity, TestTransform),
          sprite: world.getComponent(entity, TestSprite),
        };
      }

      expect(found).not.toBeNull();
      expect(found.transform.position).toEqual({ x: 100, y: 200 });
      expect(found.sprite.textureId).toBe('characters-atlas');
      expect(found.sprite.layer).toBe(1);
    });

    it('getCurrentSceneName refleja el nombre de la escena recién cargada', async () => {
      await sceneManager.loadScene(exampleSceneJSON as SceneDefinition);
      expect(sceneManager.getCurrentSceneName()).toBe('nivel-1');
    });

    it('sigue el orden exacto: loading -> loadManifest -> entidades -> loaded', async () => {
      const callOrder: string[] = [];
      eventBus.on(SceneEvents.Loading, () => callOrder.push('loading-event'));
      eventBus.on(SceneEvents.Loaded, () => callOrder.push('loaded-event'));
      vi.mocked(assetManager.loadManifest).mockImplementation(async () => {
        callOrder.push('manifest-loaded');
      });

      await sceneManager.loadScene(exampleSceneJSON as SceneDefinition);

      expect(callOrder).toEqual(['loading-event', 'manifest-loaded', 'loaded-event']);
    });

    it('llama a AssetManager.loadManifest con el manifest exacto de la escena', async () => {
      await sceneManager.loadScene(exampleSceneJSON as SceneDefinition);

      expect(assetManager.loadManifest).toHaveBeenCalledWith(exampleSceneJSON.manifest);
    });

    it('emite scene:loading y scene:loaded con el sceneName correcto', async () => {
      const loadingEvents: any[] = [];
      const loadedEvents: any[] = [];
      eventBus.on(SceneEvents.Loading, (p) => loadingEvents.push(p));
      eventBus.on(SceneEvents.Loaded, (p) => loadedEvents.push(p));

      await sceneManager.loadScene(exampleSceneJSON as SceneDefinition);

      expect(loadingEvents).toEqual([{ sceneName: 'nivel-1' }]);
      expect(loadedEvents).toEqual([{ sceneName: 'nivel-1' }]);
    });
  });

  describe('loadScene(): manejo de error de componente no registrado', () => {
    it('lanza un error claro si la escena referencia un componentName no registrado', async () => {
      const badScene: SceneDefinition = {
        name: 'escena-rota',
        manifest: [],
        entities: [{ components: { Physics: { mass: 5 } } }],
      };

      await expect(sceneManager.loadScene(badScene)).rejects.toThrow(/Physics/);
    });

    it('el mensaje de error identifica específicamente qué componente falta registrar', async () => {
      const badScene: SceneDefinition = {
        name: 'escena-rota',
        manifest: [],
        entities: [{ components: { NoExiste: {} } }],
      };

      await expect(sceneManager.loadScene(badScene)).rejects.toThrow(/NoExiste.*registrad/i);
    });
  });

  describe('unloadCurrentScene()', () => {
    it('destruye todas las entidades de la escena actual en el World', async () => {
      await sceneManager.loadScene(exampleSceneJSON as SceneDefinition);

      let entityCount = 0;
      for (const _ of world.query([TestTransform])) entityCount++;
      expect(entityCount).toBe(1);

      sceneManager.unloadCurrentScene();

      entityCount = 0;
      for (const _ of world.query([TestTransform])) entityCount++;
      expect(entityCount).toBe(0);
    });

    it('emite scene:unloaded con el nombre de la escena que se descargó', async () => {
      await sceneManager.loadScene(exampleSceneJSON as SceneDefinition);

      const unloadedEvents: any[] = [];
      eventBus.on(SceneEvents.Unloaded, (p) => unloadedEvents.push(p));

      sceneManager.unloadCurrentScene();

      expect(unloadedEvents).toEqual([{ sceneName: 'nivel-1' }]);
    });

    it('getCurrentSceneName vuelve a null después de descargar', async () => {
      await sceneManager.loadScene(exampleSceneJSON as SceneDefinition);
      sceneManager.unloadCurrentScene();

      expect(sceneManager.getCurrentSceneName()).toBeNull();
    });

    it('es no-op seguro si no hay ninguna escena cargada', () => {
      expect(() => sceneManager.unloadCurrentScene()).not.toThrow();
      expect(assetManager.unload).not.toHaveBeenCalled();
    });

    it('sin manifest de la próxima escena, descarga TODOS los assets de la escena actual', async () => {
      await sceneManager.loadScene(exampleSceneJSON as SceneDefinition);

      sceneManager.unloadCurrentScene(); // sin argumento

      expect(assetManager.unload).toHaveBeenCalledWith('characters-atlas');
    });
  });

  describe('cargar una segunda escena descarga correctamente la primera', () => {
    const sceneA: SceneDefinition = {
      name: 'escena-a',
      manifest: [{ id: 'asset-exclusivo-a', type: 'texture', path: 'a.png' }],
      entities: [{ components: { Transform: { position: { x: 0, y: 0 }, rotation: 0, scale: { x: 1, y: 1 } } } }],
    };

    const sceneB: SceneDefinition = {
      name: 'escena-b',
      manifest: [{ id: 'asset-exclusivo-b', type: 'texture', path: 'b.png' }],
      entities: [{ components: { Transform: { position: { x: 5, y: 5 }, rotation: 0, scale: { x: 1, y: 1 } } } }],
    };

    it('las entidades de la escena A ya no existen tras cargar la escena B', async () => {
      await sceneManager.loadScene(sceneA);

      let countBefore = 0;
      for (const _ of world.query([TestTransform])) countBefore++;
      expect(countBefore).toBe(1);

      await sceneManager.loadScene(sceneB);

      let entityWithB: any = null;
      for (const entity of world.query([TestTransform])) {
        entityWithB = world.getComponent(entity, TestTransform);
      }
      // Solo debe quedar la entidad de B (position x:5), no la de A (x:0)
      let totalCount = 0;
      for (const _ of world.query([TestTransform])) totalCount++;
      expect(totalCount).toBe(1);
      expect(entityWithB.position).toEqual({ x: 5, y: 5 });
    });

    it('getCurrentSceneName pasa de "escena-a" a "escena-b"', async () => {
      await sceneManager.loadScene(sceneA);
      expect(sceneManager.getCurrentSceneName()).toBe('escena-a');

      await sceneManager.loadScene(sceneB);
      expect(sceneManager.getCurrentSceneName()).toBe('escena-b');
    });
  });

  describe('dos escenas consecutivas que comparten un asset no lo descargan', () => {
    const sceneA: SceneDefinition = {
      name: 'escena-a',
      manifest: [
        { id: 'compartido', type: 'texture', path: 'shared.png' },
        { id: 'exclusivo-a', type: 'texture', path: 'a.png' },
      ],
      entities: [],
    };

    const sceneB: SceneDefinition = {
      name: 'escena-b',
      manifest: [
        { id: 'compartido', type: 'texture', path: 'shared.png' },
        { id: 'exclusivo-b', type: 'texture', path: 'b.png' },
      ],
      entities: [],
    };

    it('unload() se llama para el asset exclusivo de A pero NUNCA para el compartido', async () => {
      await sceneManager.loadScene(sceneA);
      await sceneManager.loadScene(sceneB);

      expect(assetManager.unload).toHaveBeenCalledWith('exclusivo-a');
      expect(assetManager.unload).not.toHaveBeenCalledWith('compartido');
    });

    it('unload() nunca se llama para el asset exclusivo de B (todavía en uso)', async () => {
      await sceneManager.loadScene(sceneA);
      await sceneManager.loadScene(sceneB);

      expect(assetManager.unload).not.toHaveBeenCalledWith('exclusivo-b');
    });
  });

  describe('serializeCurrentScene(): round-trip', () => {
    it('lanza un error claro si no hay ninguna escena cargada', () => {
      expect(() => sceneManager.serializeCurrentScene()).toThrow(/no hay ninguna escena/i);
    });

    it('produce un SceneDefinition con el mismo name y manifest que la escena cargada', async () => {
      await sceneManager.loadScene(exampleSceneJSON as SceneDefinition);

      const serialized = sceneManager.serializeCurrentScene();

      expect(serialized.name).toBe('nivel-1');
      expect(serialized.manifest).toEqual(exampleSceneJSON.manifest);
    });

    it('round-trip completo: cargar -> serializar -> volver a cargar produce un World equivalente', async () => {
      await sceneManager.loadScene(exampleSceneJSON as SceneDefinition);

      const serialized = sceneManager.serializeCurrentScene();

      // Cargamos la definición SERIALIZADA (no la original) en un
      // SceneManager/World completamente nuevo, para confirmar que lo
      // que se exportó es realmente suficiente para reconstruir la
      // escena desde cero, no solo una copia en memoria.
      const world2 = new World();
      const eventBus2 = new EventBus();
      const assetManager2 = new AssetManager(eventBus2);
      vi.spyOn(assetManager2, 'loadManifest').mockResolvedValue(undefined);

      const sceneManager2 = new SceneManager(world2, assetManager2, eventBus2);
      sceneManager2.registerComponent(TestTransform, transformSerializer);
      sceneManager2.registerComponent(TestSprite, spriteSerializer);

      await sceneManager2.loadScene(serialized);

      let reconstructed: any = null;
      for (const entity of world2.query([TestTransform, TestSprite])) {
        reconstructed = {
          transform: world2.getComponent(entity, TestTransform),
          sprite: world2.getComponent(entity, TestSprite),
        };
      }

      expect(reconstructed.transform.position).toEqual({ x: 100, y: 200 });
      expect(reconstructed.transform.rotation).toBe(0);
      expect(reconstructed.sprite.textureId).toBe('characters-atlas');
      expect(reconstructed.sprite.layer).toBe(1);
    });

    it('serializa solo componentes registrados; ignora componentes desconocidos en la entidad, si los hubiera', async () => {
      await sceneManager.loadScene(exampleSceneJSON as SceneDefinition);

      // No debería lanzar aunque el World tenga (hipotéticamente) otros
      // componentes no registrados en este SceneManager - solo exporta
      // lo que sabe serializar.
      expect(() => sceneManager.serializeCurrentScene()).not.toThrow();
    });

    it('no incluye entidades que fueron destruidas manualmente fuera del ciclo de SceneManager', async () => {
      await sceneManager.loadScene(exampleSceneJSON as SceneDefinition);

      let theEntity: number | null = null;
      for (const entity of world.query([TestTransform])) theEntity = entity;
      world.destroyEntity(theEntity!); // gameplay la destruye directamente, sin pasar por SceneManager

      const serialized = sceneManager.serializeCurrentScene();

      expect(serialized.entities).toHaveLength(0);
    });
  });

  describe('registerComponent()', () => {
    it('permite registrar múltiples componentes y todos quedan disponibles para loadScene', async () => {
      // Ya registramos 2 en beforeEach; confirmamos que ambos funcionan juntos
      // en una sola entidad (ya cubierto arriba), así que acá probamos que
      // registrar de más no rompe nada.
      class TestExtra {
        static readonly componentName = 'Extra';
        constructor(public value: number = 0) {}
      }
      sceneManager.registerComponent(TestExtra, {
        serialize: (e) => ({ value: e.value }),
        deserialize: (d) => new TestExtra(d.value as number),
      });

      const scene: SceneDefinition = {
        name: 'con-extra',
        manifest: [],
        entities: [{ components: { Extra: { value: 42 } } }],
      };

      await expect(sceneManager.loadScene(scene)).resolves.not.toThrow();
    });
  });
});
