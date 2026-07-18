import type { World, EntityId } from '@mochigo/ecs';
import type { EventBus } from '@mochigo/events';
import type { SceneManager, SceneDefinition } from '@mochigo/scenes';
import { EditorEvents } from './EditorEvents';
import { ExternalEcsEventNames } from './ExternalEcsEventNames';

export class EditorState {
  private selectedEntity: EntityId | null = null;
  private playModeSnapshot: SceneDefinition | null = null;
  private knownEntities = new Set<EntityId>();

  constructor(
    private readonly world: World,
    private readonly eventBus: EventBus,
    private readonly sceneManager: SceneManager
  ) {
    this.refreshKnownEntitiesFromScene();

    this.eventBus.on(ExternalEcsEventNames.EntityCreated, (payload: { entityId: EntityId }) => {
      this.knownEntities.add(payload.entityId);
    });
    this.eventBus.on(ExternalEcsEventNames.EntityDestroyed, (payload: { entityId: EntityId }) => {
      this.knownEntities.delete(payload.entityId);
      if (this.selectedEntity === payload.entityId) this.selectEntity(null);
    });
  }

  private refreshKnownEntitiesFromScene(): void {
    this.knownEntities = new Set(this.sceneManager.getCurrentSceneEntities());
  }

  getKnownEntities(): ReadonlySet<EntityId> {
    return this.knownEntities;
  }

  /** Las acciones del propio Editor (crear vía drag-drop, eliminar desde
   * Hierarchy) llaman esto directamente, sin depender de que el evento
   * global efectivamente les llegue de vuelta. */
  notifyEntityCreated(entity: EntityId): void {
    this.knownEntities.add(entity);
  }

  notifyEntityDestroyed(entity: EntityId): void {
    this.knownEntities.delete(entity);
    if (this.selectedEntity === entity) this.selectEntity(null);
  }

  selectEntity(entity: EntityId | null): void {
    if (entity === this.selectedEntity) return;
    if (entity !== null && !this.world.isAlive(entity)) entity = null;

    this.selectedEntity = entity;
    this.eventBus.emit(EditorEvents.SelectionChanged, { entity });
  }

  getSelectedEntity(): EntityId | null {
    return this.selectedEntity;
  }

  isInPlayMode(): boolean {
    return this.playModeSnapshot !== null;
  }

  enterPlayMode(): void {
    if (this.isInPlayMode()) return;
    this.playModeSnapshot = this.sceneManager.serializeCurrentScene();
  }

  async exitPlayMode(): Promise<void> {
    if (!this.isInPlayMode()) return;

    const snapshot = this.playModeSnapshot!;
    this.playModeSnapshot = null;

    await this.sceneManager.loadScene(snapshot);
    this.refreshKnownEntitiesFromScene(); // el World fue reconstruido: IDs nuevos
    this.selectEntity(null);
  }
}
