// packages/scenes/src/SceneManager.ts — completo, reemplaza el archivo entero
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

  getCurrentSceneEntities(): ReadonlySet<EntityId> {
    return this.currentSceneEntities;
  }

  async loadScene(sceneData: SceneDefinition): Promise<void> {
    this.eventBus.emit(SceneEvents.Loading, { sceneName: sceneData.name });

    const previousManifest = this.currentSceneManifest;
    if (this.currentSceneName !== null) {
      this.unloadCurrentScene(sceneData.manifest);
    }

    await this.assetManager.loadManifest(sceneData.manifest);

    const createdEntities = new Set<EntityId>();
    for (const entityDef of sceneData.entities) {
      const entity = this.world.createEntity();
      createdEntities.add(entity);

      for (const [componentName, componentData] of Object.entries(entityDef.components)) {
        const registered = this.registry.get(componentName);
        if (!registered) {
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

    this.eventBus.emit(SceneEvents.Loaded, { sceneName: sceneData.name });
  }

  unloadCurrentScene(nextManifest: AssetManifestEntry[] = []): void {
    if (this.currentSceneName === null) return;

    const unloadedSceneName = this.currentSceneName;

    for (const entity of this.currentSceneEntities) {
      this.world.destroyEntity(entity);
    }

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
      if (!this.world.isAlive(entity)) continue;
      entities.push(this.serializeEntity(entity));
    }

    return {
      name: this.currentSceneName,
      manifest: this.currentSceneManifest,
      entities,
    };
  }

  /**
   * NUEVO — serializa UNA sola entidad viva a la misma forma que ya usa
   * serializeCurrentScene() por entidad, extraído para reusarlo también
   * desde el Editor (Copiar entidad) sin duplicar el bucle del registry.
   */
  serializeEntity(entity: EntityId): SceneDefinition['entities'][number] {
    if (!this.world.isAlive(entity)) {
      throw new Error(`SceneManager.serializeEntity: la entidad ${entity} no existe o ya fue destruida.`);
    }

    const components: Record<string, Record<string, unknown>> = {};

    for (const [componentName, registered] of this.registry) {
      if (!this.world.hasComponent(entity, registered.componentClass)) continue;
      const instance = this.world.getComponent(entity, registered.componentClass);
      components[componentName] = registered.serializer.serialize(instance);
    }

    return { components };
  }

  /**
   * NUEVO — reconstruye una entidad nueva a partir de datos ya serializados
   * (el mismo shape que produce serializeEntity()/serializeCurrentScene()).
   * Es literalmente el cuerpo interno del for-loop de loadScene(), extraído
   * para poder llamarlo también desde fuera cuando NO se está cargando una
   * escena completa (Duplicar entidad, Pegar entidad en el Editor).
   *
   * NO registra la entidad creada en currentSceneEntities: esa lista representa
   * específicamente "lo que la escena actual cargó desde su definición", y una
   * entidad duplicada en caliente durante edición no es parte de esa carga
   * original. Si serializeCurrentScene() se llama después de duplicar, esta
   * nueva entidad NO aparecerá en el JSON exportado — decisión a confirmar:
   * si preferís que sí se incluya, avisame y agrego entity a currentSceneEntities
   * también acá (un solo agregar, ver comentario al final del método).
   */
  instantiateEntityFromData(data: SceneDefinition['entities'][number]): EntityId {
    const entity = this.world.createEntity();

    for (const [componentName, componentData] of Object.entries(data.components)) {
      const registered = this.registry.get(componentName);
      if (!registered) {
        // Mismo mensaje de error que loadScene(), por consistencia.
        throw new Error(
          `SceneManager.instantiateEntityFromData: el componente "${componentName}" no está registrado. ` +
          `¿Olvidaste llamar sceneManager.registerComponent(${componentName}, serializer) ` +
          `durante la inicialización del módulo que lo define?`
        );
      }
      const instance = registered.serializer.deserialize(componentData);
      this.world.addComponent(entity, registered.componentClass, instance);
    }

    // Para incluir esta entidad en el próximo serializeCurrentScene()/Guardar escena,
    // descomentar la siguiente línea (requiere que currentSceneEntities deje de ser
    // readonly-por-convención desde afuera del loop de loadScene — ya lo es, es una
    // propiedad privada normal, así que esto es seguro):
    // this.currentSceneEntities.add(entity);

    return entity;
  }
}
