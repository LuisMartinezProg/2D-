import type { World, EntityId } from '@mochigo/ecs';
import type { EventBus } from '@mochigo/events';
import type { SceneManager, SceneDefinition } from '@mochigo/scenes';
import { EditorEvents } from './EditorEvents';

/**
 * Estado y lógica del editor SIN nada de UI - separado deliberadamente
 * de los componentes React (más abajo) para que la lógica de selección
 * y de play mode sea testeable sin necesitar renderizar nada con
 * @testing-library/react. Los componentes React consumen esta clase
 * como fuente de verdad, nunca duplican su estado.
 */
export class EditorState {
  private selectedEntity: EntityId | null = null;
  private playModeSnapshot: SceneDefinition | null = null;

  constructor(
    private readonly world: World,
    private readonly eventBus: EventBus,
    private readonly sceneManager: SceneManager
  ) {}

  selectEntity(entity: EntityId | null): void {
    if (entity === this.selectedEntity) return; // evita emitir el evento si no cambió nada real

    // Defensivo: si se selecciona una entidad que ya no existe (fue
    // destruida entre el click y este llamado), tratamos como
    // deselección en vez de dejar el editor apuntando a un id muerto.
    if (entity !== null && !this.world.isAlive(entity)) {
      entity = null;
    }

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
    if (this.isInPlayMode()) return; // no-op si ya está en play mode

    // Snapshot en memoria (nunca vía Storage - es temporal, tal como
    // exige la sección 4 de la ficha explícitamente).
    this.playModeSnapshot = this.sceneManager.serializeCurrentScene();
  }

  async exitPlayMode(): Promise<void> {
    if (!this.isInPlayMode()) return; // no-op si no estaba en play mode

    const snapshot = this.playModeSnapshot!;
    this.playModeSnapshot = null;

    // loadScene() es async (carga el manifest de assets); play mode no
    // debería necesitar recargar ningún asset nuevo (la escena ya
    // estaba cargada antes de entrar a play mode), pero seguimos el
    // mismo camino que loadScene() normal para no duplicar lógica de
    // reconstrucción del World, tal como pide la ficha explícitamente
    // ("reutiliza directamente la infraestructura de serialización").
    await this.sceneManager.loadScene(snapshot);

    // La entidad seleccionada antes de entrar a play mode ya no existe
    // (el World fue destruido y reconstruido por loadScene) - se
    // deselecciona en vez de quedar apuntando a un id potencialmente
    // reciclado hacia otra entidad completamente distinta.
    this.selectEntity(null);
  }
}
