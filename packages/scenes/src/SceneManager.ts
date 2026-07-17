import type { World, ComponentClass, EntityId } from '@mochigo/ecs';
import type { AssetManager, AssetManifestEntry } from '@mochigo/assets';
import type { EventBus } from '@mochigo/events';
import type { SceneDefinition, ComponentSerializer, RegisteredComponent } from './types';
import { SceneEvents } from './SceneEvents';

export class SceneManager {
  private registry = new Map<string, RegisteredComponent>();

  private currentSceneName: string | null = null;
  private currentSceneManifest: AssetManifestEntry[] = [];
  private currentSceneEntities = new Set<EntityId>();

  constructor(
    private readonly world: World,
    private readonly assetManager: AssetManager,
    private readonly eventBus: EventBus
  ) {}

  registerComponent<T>(componentClass: ComponentClass<T>, serializer: ComponentSerializer<T>): void {
    this.registry.set(componentClass.componentName, { componentClass, serializer });
  }

  getCurrentSceneName(): string | null {
    return this.currentSceneName;
  }

  async loadScene(sceneData: SceneDefinition): Promise<void> {
    // Paso 1: emitir scene:loading (sección 4, orden exacto)
    this.eventBus.emit(SceneEvents.Loading, { sceneName: sceneData.name });

    // Paso 2: descargar la escena actual, si había una
    const previousManifest = this.currentSceneManifest;
    if (this.currentSceneName !== null) {
      this.unloadCurrentScene(sceneData.manifest);
    }

    // Paso 3: cargar el manifest de la nueva escena
    await this.assetManager.loadManifest(sceneData.manifest);

    // Paso 4: crear entidades y poblarlas con sus componentes
    const createdEntities = new Set<EntityId>();
    for (const entityDef of sceneData.entities) {
      const entity = this.world.createEntity();
      createdEntities.add(entity);

      for (const [componentName, componentData] of Object.entries(entityDef.components)) {
        const registered = this.registry.get(componentName);
        if (!registered) {
          // Checklist: debe fallar con mensaje claro, no silencioso ni genérico.
          throw new Error(
            `SceneManager.loadScene: el componente "${componentName}" no está registrado. ` +
            `¿Olvidaste llamar sceneManager.registerComponent(${componentName}, serializer) ` +
            `durante la inicialización del módulo que lo define?`
          );
        }
        const instance = registered.serializer.deserialize(componentData);
        this.world.addComponent(entity, registered.componentClass, instance);
      }
    }

    this.currentSceneName = sceneData.name;
    this.currentSceneManifest = sceneData.manifest;
    this.currentSceneEntities = createdEntities;

    // Paso 5: emitir scene:loaded
    this.eventBus.emit(SceneEvents.Loaded, { sceneName: sceneData.name });
  }

  unloadCurrentScene(nextManifest: AssetManifestEntry[] = []): void {
    if (this.currentSceneName === null) return;

    const unloadedSceneName = this.currentSceneName;

    // Destruir todas las entidades que esta escena creó.
    for (const entity of this.currentSceneEntities) {
      this.world.destroyEntity(entity);
    }

    // Descargar solo los assets EXCLUSIVOS de la escena que se va: los
    // que también aparecen en el manifest de la próxima escena se
    // conservan cacheados (checklist: nunca descargar assets compartidos).
    const nextIds = new Set(nextManifest.map((entry) => entry.id));
    for (const entry of this.currentSceneManifest) {
      if (!nextIds.has(entry.id)) {
        this.assetManager.unload(entry.id);
      }
    }

    this.currentSceneName = null;
    this.currentSceneManifest = [];
    this.currentSceneEntities = new Set();

    this.eventBus.emit(SceneEvents.Unloaded, { sceneName: unloadedSceneName });
  }

  serializeCurrentScene(): SceneDefinition {
    if (this.currentSceneName === null) {
      throw new Error('SceneManager.serializeCurrentScene: no hay ninguna escena cargada actualmente.');
    }

    const entities: SceneDefinition['entities'] = [];

    for (const entity of this.currentSceneEntities) {
      if (!this.world.isAlive(entity)) continue; // pudo haber sido destruida manualmente por gameplay

      const components: Record<string, Record<string, unknown>> = {};

      for (const [componentName, registered] of this.registry) {
        if (!this.world.hasComponent(entity, registered.componentClass)) continue;

        const instance = this.world.getComponent(entity, registered.componentClass);
        components[componentName] = registered.serializer.serialize(instance);
      }

      entities.push({ components });
    }

    return {
      name: this.currentSceneName,
      manifest: this.currentSceneManifest,
      entities,
    };
  }
}
