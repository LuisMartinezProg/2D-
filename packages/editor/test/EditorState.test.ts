import { describe, it, expect, beforeEach, vi } from 'vitest';
import { World, Transform } from '@mochigo/ecs';
import type { EntityId } from '@mochigo/ecs';
import { EventBus } from '@mochigo/events';
import { AssetManager } from '@mochigo/assets';
import { SceneManager, type SceneDefinition } from '@mochigo/scenes';
import { Vector2 } from '@mochigo/math';
import { EditorState } from '../src/EditorState';
import { EditorEvents } from '../src/EditorEvents';
import { ExternalEcsEventNames } from '../src/ExternalEcsEventNames';

const transformSerializer = {
  serialize: (t: Transform) => ({
    position: { x: t.position.x, y: t.position.y }, rotation: t.rotation,
    scale: { x: t.scale.x, y: t.scale.y }, parent: t.parent,
  }),
  deserialize: (data: any) =>
    new Transform(new Vector2(data.position.x, data.position.y), data.rotation, new Vector2(data.scale.x, data.scale.y), data.parent ?? null),
};

function makeInitialScene(): SceneDefinition {
  return {
    name: 'test-scene', manifest: [],
    entities: [{ components: { Transform: { position: { x: 10, y: 20 }, rotation: 0, scale: { x: 1, y: 1 }, parent: null } } }],
  };
}

describe('EditorState', () => {
  let world: World;
  let eventBus: EventBus;
  let sceneManager: SceneManager;
  let editorState: EditorState;
  let initialEntity: EntityId;

  beforeEach(async () => {
    eventBus = new EventBus();
    world = new World();
    const assetManager = new AssetManager(eventBus);
    vi.spyOn(assetManager, 'loadManifest').mockResolvedValue(undefined);

    sceneManager = new SceneManager(world, assetManager, eventBus);
    sceneManager.registerComponent(Transform, transformSerializer);
    await sceneManager.loadScene(makeInitialScene());

    let found: EntityId | undefined;
    for (const e of world.query([Transform])) found = e;
    initialEntity = found!;

    editorState = new EditorState(world, eventBus, sceneManager);
  });

  describe('conocimiento inicial de entidades', () => {
    it('al construirse, ya conoce las entidades de la escena previamente cargada', () => {
      expect(editorState.getKnownEntities().size).toBe(1);
      expect(editorState.getKnownEntities().has(initialEntity)).toBe(true);
    });
  });

  describe('selectEntity() / getSelectedEntity()', () => {
    it('seleccionar una entidad la refleja en getSelectedEntity', () => {
      editorState.selectEntity(initialEntity);
      expect(editorState.getSelectedEntity()).toBe(initialEntity);
    });

    it('seleccionar null deselecciona', () => {
      editorState.selectEntity(initialEntity);
      editorState.selectEntity(null);
      expect(editorState.getSelectedEntity()).toBeNull();
    });

    it('seleccionar una entidad que no existe la trata como null', () => {
      editorState.selectEntity(99999);
      expect(editorState.getSelectedEntity()).toBeNull();
    });

    it('emite editor:selection-changed con el payload correcto', () => {
      const events: any[] = [];
      eventBus.on(EditorEvents.SelectionChanged, (p) => events.push(p));
      editorState.selectEntity(initialEntity);
      expect(events).toEqual([{ entity: initialEntity }]);
    });

    it('seleccionar la misma entidad ya activa no vuelve a emitir el evento', () => {
      editorState.selectEntity(initialEntity);
      const events: any[] = [];
      eventBus.on(EditorEvents.SelectionChanged, (p) => events.push(p));
      editorState.selectEntity(initialEntity);
      expect(events).toHaveLength(0);
    });
  });

  describe('notifyEntityCreated() / notifyEntityDestroyed()', () => {
    it('notifyEntityCreated agrega la entidad al conjunto conocido', () => {
      const newEntity = world.createEntity();
      editorState.notifyEntityCreated(newEntity);
      expect(editorState.getKnownEntities().has(newEntity)).toBe(true);
    });

    it('notifyEntityDestroyed la quita y deselecciona si era la activa', () => {
      editorState.selectEntity(initialEntity);
      editorState.notifyEntityDestroyed(initialEntity);
      expect(editorState.getKnownEntities().has(initialEntity)).toBe(false);
      expect(editorState.getSelectedEntity()).toBeNull();
    });
  });

  describe('eventos externos ecs:entity-created / ecs:entity-destroyed', () => {
    it('ecs:entity-destroyed quita la entidad y deselecciona si estaba seleccionada', () => {
      editorState.selectEntity(initialEntity);
      eventBus.emit(ExternalEcsEventNames.EntityDestroyed, { entityId: initialEntity });
      expect(editorState.getKnownEntities().has(initialEntity)).toBe(false);
      expect(editorState.getSelectedEntity()).toBeNull();
    });
  });

  describe('play mode: snapshot/restore', () => {
    it('isInPlayMode es false antes de entrar', () => {
      expect(editorState.isInPlayMode()).toBe(false);
    });

    it('enterPlayMode() llamado dos veces seguidas no vuelve a tomar snapshot', () => {
      const spy = vi.spyOn(sceneManager, 'serializeCurrentScene');
      editorState.enterPlayMode();
      editorState.enterPlayMode();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('exitPlayMode() sin haber entrado antes es no-op seguro', async () => {
      await expect(editorState.exitPlayMode()).resolves.toBeUndefined();
    });

    it('modificar la posición de una entidad durante play mode y salir restaura la posición original exacta', async () => {
      const transform = world.getComponent(initialEntity, Transform)!;
      expect(transform.position).toEqual({ x: 10, y: 20 });

      editorState.enterPlayMode();
      transform.position.x = 999; // simula que un script la movió
      transform.position.y = -500;

      await editorState.exitPlayMode();

      let restored: EntityId | undefined;
      for (const e of world.query([Transform])) restored = e;

      expect(world.getComponent(restored!, Transform)!.position).toEqual({ x: 10, y: 20 });
      expect(editorState.isInPlayMode()).toBe(false);
    });

    it('exitPlayMode() deselecciona (el World fue reconstruido, los IDs pueden no coincidir)', async () => {
      editorState.selectEntity(initialEntity);
      editorState.enterPlayMode();
      await editorState.exitPlayMode();
      expect(editorState.getSelectedEntity()).toBeNull();
    });

    it('exitPlayMode() descarta del conjunto conocido cualquier entidad creada solo durante play mode', async () => {
      editorState.enterPlayMode();
      const transientEntity = world.createEntity();
      editorState.notifyEntityCreated(transientEntity);

      await editorState.exitPlayMode();

      expect(editorState.getKnownEntities().has(transientEntity)).toBe(false);
      expect(editorState.getKnownEntities().size).toBe(1);
    });
  });
});
