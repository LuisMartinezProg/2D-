import React from 'react';
import type { World, EntityId, ComponentClass } from '@mochigo/ecs';
import type { EventBus } from '@mochigo/events';
import type { Renderer } from '@mochigo/renderer';
import type { SceneManager } from '@mochigo/scenes';
import type { AssetManager } from '@mochigo/assets';
import type { ComponentSchema } from '@mochigo/scripting';
import type { EditorState } from './EditorState';
import { HierarchyPanel } from './panels/HierarchyPanel';
import { InspectorPanel } from './panels/InspectorPanel';
import { SceneView } from './panels/SceneView';
import { AssetBrowser } from './panels/AssetBrowser';
import { collectDescendants } from './hierarchyTree';
import { ExternalEcsEventNames } from './ExternalEcsEventNames';
import { EditorEvents } from './EditorEvents';
import { MochiGoTheme } from './theme';

interface EditorAppProps {
  world: World; eventBus: EventBus; renderer: Renderer;
  sceneManager: SceneManager; assetManager: AssetManager; editorState: EditorState;
  componentRegistry: Map<string, ComponentClass<any>>;
  scriptSchemas: Map<string, ComponentSchema>;
}

export function EditorApp({
  world, eventBus, renderer, sceneManager, assetManager, editorState, componentRegistry, scriptSchemas,
}: EditorAppProps) {
  const [, forceUpdate] = React.useReducer((n) => n + 1, 0);
  const [selectedEntity, setSelectedEntity] = React.useState<EntityId | null>(editorState.getSelectedEntity());
  const [isPlayMode, setIsPlayMode] = React.useState(editorState.isInPlayMode());

  React.useEffect(() => {
    const onSelectionChanged = (p: { entity: EntityId | null }) => setSelectedEntity(p.entity);
    const onEcsChanged = () => forceUpdate();

    eventBus.on(EditorEvents.SelectionChanged, onSelectionChanged);
    eventBus.on(ExternalEcsEventNames.EntityCreated, onEcsChanged);
    eventBus.on(ExternalEcsEventNames.EntityDestroyed, onEcsChanged);
    eventBus.on(ExternalEcsEventNames.ComponentAdded, onEcsChanged);
    eventBus.on(ExternalEcsEventNames.ComponentRemoved, onEcsChanged);
    return () => {
      eventBus.off(EditorEvents.SelectionChanged, onSelectionChanged);
      eventBus.off(ExternalEcsEventNames.EntityCreated, onEcsChanged);
      eventBus.off(ExternalEcsEventNames.EntityDestroyed, onEcsChanged);
      eventBus.off(ExternalEcsEventNames.ComponentAdded, onEcsChanged);
      eventBus.off(ExternalEcsEventNames.ComponentRemoved, onEcsChanged);
    };
  }, [eventBus]);

  function handleDeleteEntity(entity: EntityId): void {
    // Cascada: eliminar un padre elimina también a sus hijos (estándar
    // en editores de motores), no especificado en la ficha, decisión propia.
    const descendants = collectDescendants(world, editorState.getKnownEntities(), entity);
    for (const child of descendants) {
      world.destroyEntity(child);
      editorState.notifyEntityDestroyed(child);
    }
    world.destroyEntity(entity);
    editorState.notifyEntityDestroyed(entity);
    forceUpdate();
  }

  async function handleTogglePlayMode(): Promise<void> {
    if (isPlayMode) await editorState.exitPlayMode();
    else editorState.enterPlayMode();
    setIsPlayMode(editorState.isInPlayMode());
    forceUpdate();
  }

  function handleSaveScene(): void {
    const sceneData = sceneManager.serializeCurrentScene();
    const blob = new Blob([JSON.stringify(sceneData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sceneData.name || 'scene'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const knownTextureIds = React.useMemo(() => {
    try {
      return sceneManager.serializeCurrentScene().manifest.filter((e) => e.type === 'texture').map((e) => e.id);
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneManager, selectedEntity]);

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '220px 1fr 260px', gridTemplateRows: '40px 1fr 160px',
      gridTemplateAreas: `"toolbar toolbar toolbar" "hierarchy scene inspector" "hierarchy assets inspector"`,
      height: '100%', width: '100%', fontFamily: 'system-ui, sans-serif', background: MochiGoTheme.skirk.black,
    }}>
      <div style={{
        gridArea: 'toolbar', display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px',
        background: MochiGoTheme.skirk.deep, borderBottom: `2px solid ${MochiGoTheme.accent}`,
      }}>
        <button onClick={handleTogglePlayMode} style={{
          padding: '4px 14px', fontSize: 12, fontWeight: 600,
          background: isPlayMode ? MochiGoTheme.jahoda.violet : MochiGoTheme.jahoda.green,
          color: MochiGoTheme.skirk.black, border: 'none', cursor: 'pointer',
        }}>
          {isPlayMode ? '■ Stop' : '▶ Play'}
        </button>
        {/* Guardar deshabilitado en play mode: evita persistir el estado
            temporal mutado por scripts como si fuera la escena real. */}
        <button onClick={handleSaveScene} disabled={isPlayMode} style={{
          padding: '4px 14px', fontSize: 12, fontWeight: 600, background: MochiGoTheme.accent,
          color: MochiGoTheme.skirk.black, border: 'none',
          cursor: isPlayMode ? 'not-allowed' : 'pointer', opacity: isPlayMode ? 0.5 : 1,
        }}>
          Guardar escena
        </button>
      </div>

      <div style={{ gridArea: 'hierarchy', borderRight: `1px solid ${MochiGoTheme.navia.bright}`, overflow: 'hidden' }}>
        <HierarchyPanel world={world} editorState={editorState} selectedEntity={selectedEntity} version={0} onDeleteEntity={handleDeleteEntity} />
      </div>
      <div style={{ gridArea: 'scene', overflow: 'hidden' }}>
        <SceneView world={world} renderer={renderer} selectedEntity={selectedEntity}
          onSelect={(e) => editorState.selectEntity(e)} onTransformChanged={forceUpdate} isInPlayMode={isPlayMode} />
      </div>
      <div style={{ gridArea: 'inspector', borderLeft: `1px solid ${MochiGoTheme.clorinde.bright}`, overflow: 'hidden' }}>
        <InspectorPanel world={world} selectedEntity={selectedEntity} knownComponentClasses={componentRegistry}
          scriptSchemas={scriptSchemas} onFieldChanged={forceUpdate} />
      </div>
      <div style={{ gridArea: 'assets', borderTop: `1px solid ${MochiGoTheme.jahoda.green}`, overflow: 'hidden' }}>
        <AssetBrowser assetManager={assetManager} knownTextureIds={knownTextureIds} />
      </div>
    </div>
  );
}
