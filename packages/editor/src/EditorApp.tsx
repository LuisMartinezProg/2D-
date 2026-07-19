// packages/editor/src/EditorApp.tsx — completo, reemplaza el archivo entero
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
import { TopBar } from './components/TopBar/TopBar';
import { collectDescendants } from './hierarchyTree';
import { ExternalEcsEventNames } from './ExternalEcsEventNames';
import { EditorEvents } from './EditorEvents';
import { MochiGoTheme } from './theme';
import type { SceneDefinition } from '@mochigo/scenes'; // ajustar el path de import si SceneDefinition vive en otro archivo dentro de @mochigo/scenes

interface EditorAppProps {
  world: World; eventBus: EventBus; renderer: Renderer;
  sceneManager: SceneManager; assetManager: AssetManager; editorState: EditorState;
  componentRegistry: Map<string, ComponentClass<any>>;
  scriptSchemas: Map<string, ComponentSchema>;
}

interface ClipboardEntity {
  entityId: EntityId; // el EntityId original en el momento de copiar, solo para referencia/depuración
  data: SceneDefinition['entities'][number];
}

export function EditorApp({
  world, eventBus, renderer, sceneManager, assetManager, editorState, componentRegistry, scriptSchemas,
}: EditorAppProps) {
  const [, forceUpdate] = React.useReducer((n) => n + 1, 0);
  const [selectedEntity, setSelectedEntity] = React.useState<EntityId | null>(editorState.getSelectedEntity());
  const [isPlayMode, setIsPlayMode] = React.useState(editorState.isInPlayMode());
  const [clipboardEntity, setClipboardEntity] = React.useState<ClipboardEntity | null>(null);
  const [panelVisibility, setPanelVisibility] = React.useState({
    hierarchy: true, sceneView: true, inspector: true, assetBrowser: true,
  });
  const [manifestViewerOpen, setManifestViewerOpen] = React.useState(false);
  const [assetsBlockedNotice, setAssetsBlockedNotice] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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

  function downloadJson(data: unknown, filename: string): void {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleSaveScene(): void {
    const sceneData = sceneManager.serializeCurrentScene();
    downloadJson(sceneData, `${sceneData.name || 'scene'}.json`);
  }

  function handleSaveSceneAs(): void {
    const name = window.prompt('Nombre de la escena:', sceneManager.getCurrentSceneName() ?? 'scene');
    if (!name) return;
    const sceneData = { ...sceneManager.serializeCurrentScene(), name };
    downloadJson(sceneData, `${name}.json`);
  }

  function handleNewScene(): void {
    if (isPlayMode) return;
    sceneManager.unloadCurrentScene([]);
    sceneManager.loadScene({ name: 'untitled', manifest: [], entities: [] });
    setSelectedEntity(null);
    forceUpdate();
  }

  function handleOpenSceneFile(): void {
    fileInputRef.current?.click();
  }

  async function handleSceneFileSelected(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite re-seleccionar el mismo archivo dos veces seguidas
    if (!file) return;
    const text = await file.text();
    const sceneData: SceneDefinition = JSON.parse(text); // sin validar el shape más allá de lo que loadScene() ya valida internamente (throw claro si un componentName no está registrado)
    await sceneManager.loadScene(sceneData);
    setSelectedEntity(null);
    forceUpdate();
  }

  function handleCreateEntity(): void {
    const entity = world.createEntity();
    editorState.selectEntity(entity);
    forceUpdate();
  }

  // Copiar/Pegar/Duplicar ya funcionan de punta a punta usando los 2 métodos
  // nuevos de SceneManager (serializeEntity/instantiateEntityFromData).
  function handleCopyEntity(): void {
    if (selectedEntity === null) return;
    const data = sceneManager.serializeEntity(selectedEntity);
    setClipboardEntity({ entityId: selectedEntity, data });
  }

  function handlePasteEntity(): void {
    if (!clipboardEntity) return;
    const newEntity = sceneManager.instantiateEntityFromData(clipboardEntity.data);
    editorState.selectEntity(newEntity);
    forceUpdate();
  }

  function handleDuplicateEntity(): void {
    if (selectedEntity === null) return;
    const data = sceneManager.serializeEntity(selectedEntity);
    const newEntity = sceneManager.instantiateEntityFromData(data);
    editorState.selectEntity(newEntity);
    forceUpdate();
  }

  function handleExportBuild(): void {
    window.open('https://github.com/LuisMartinezProg/2D-/actions', '_blank');
  }

  // Assets: bloqueado de raíz (ver ficha) hasta que @mochigo/assets tenga
  // métodos de escritura reales. En vez de un alert() molesto, muestra un
  // aviso breve y desaparece solo — no rompe el flujo, pero tampoco simula
  // que la importación funcionó.
  function showAssetsBlockedNotice(action: string): void {
    setAssetsBlockedNotice(`${action}: pendiente — @mochigo/assets todavía no tiene métodos de escritura al caché.`);
    setTimeout(() => setAssetsBlockedNotice(null), 4000);
  }

  const knownTextureIds = React.useMemo(() => {
    try {
      return sceneManager.serializeCurrentScene().manifest
        .filter((e) => e.type === 'texture')
        .map((e) => e.id);
    } catch {
      return [];
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneManager, selectedEntity]);

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '220px 1fr 260px', gridTemplateRows: '64px 1fr 160px',
      gridTemplateAreas: `"toolbar toolbar toolbar" "hierarchy scene inspector" "hierarchy assets inspector"`,
      height: '100%', width: '100%', fontFamily: 'system-ui, sans-serif', background: MochiGoTheme.skirk.black,
    }}>
      <input ref={fileInputRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={handleSceneFileSelected} />

      <div style={{ gridArea: 'toolbar', background: MochiGoTheme.skirk.deep, borderBottom: `2px solid ${MochiGoTheme.accent}` }}>
        <TopBar
          isPlayMode={isPlayMode}
          onTogglePlayMode={handleTogglePlayMode}
          onSaveScene={handleSaveScene}
          onSaveSceneAs={handleSaveSceneAs}
          onNewScene={handleNewScene}
          onOpenScene={handleOpenSceneFile}
          onExportBuild={handleExportBuild}
          onCopyEntity={handleCopyEntity}
          onPasteEntity={handlePasteEntity}
          hasClipboardEntity={clipboardEntity !== null}
          onSelectAll={() => {}} // bloqueado: EditorState no soporta selección múltiple hoy (ver ficha)
          onDeselectAll={() => editorState.selectEntity(null as unknown as EntityId)}
          onCreateEntity={handleCreateEntity}
          onCreateEntityWithSprite={() => showAssetsBlockedNotice('Crear con Sprite')} // requiere Sprite.ts + un textureId real, no inventado
          onDuplicateEntity={handleDuplicateEntity}
          onDeleteEntity={() => selectedEntity !== null && handleDeleteEntity(selectedEntity)}
          hasSelectedEntity={selectedEntity !== null}
          onImportTexture={() => showAssetsBlockedNotice('Importar textura')}
          onImportSound={() => showAssetsBlockedNotice('Importar sonido')}
          onImportJson={() => showAssetsBlockedNotice('Importar JSON')}
          onImportAtlas={() => showAssetsBlockedNotice('Importar atlas')}
          onOpenAtlasBuilder={() => showAssetsBlockedNotice('Generar atlas')}
          onViewManifest={() => setManifestViewerOpen(true)}
          onReloadAssets={() => forceUpdate()}
          panelVisibility={panelVisibility}
          onTogglePanel={(panel) => setPanelVisibility((prev) => ({ ...prev, [panel]: !prev[panel] }))}
          onResetLayout={() => setPanelVisibility({ hierarchy: true, sceneView: true, inspector: true, assetBrowser: true })}
        />
      </div>

      {panelVisibility.hierarchy && (
        <div style={{ gridArea: 'hierarchy', borderRight: `1px solid ${MochiGoTheme.navia.bright}`, overflow: 'hidden' }}>
          <HierarchyPanel world={world} editorState={editorState} selectedEntity={selectedEntity} version={0} onDeleteEntity={handleDeleteEntity} />
        </div>
      )}
      {panelVisibility.sceneView && (
        <div style={{ gridArea: 'scene', overflow: 'hidden' }}>
          <SceneView world={world} renderer={renderer} selectedEntity={selectedEntity}
            onSelect={(e) => editorState.selectEntity(e)} onTransformChanged={forceUpdate} isInPlayMode={isPlayMode} />
        </div>
      )}
      {panelVisibility.inspector && (
        <div style={{ gridArea: 'inspector', borderLeft: `1px solid ${MochiGoTheme.clorinde.bright}`, overflow: 'hidden' }}>
          <InspectorPanel world={world} selectedEntity={selectedEntity} knownComponentClasses={componentRegistry}
            scriptSchemas={scriptSchemas} onFieldChanged={forceUpdate} />
        </div>
      )}
      {panelVisibility.assetBrowser && (
        <div style={{ gridArea: 'assets', borderTop: `1px solid ${MochiGoTheme.jahoda.green}`, overflow: 'hidden' }}>
          <AssetBrowser assetManager={assetManager} knownTextureIds={knownTextureIds} />
        </div>
      )}

      {manifestViewerOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setManifestViewerOpen(false)}>
          <pre style={{
            background: MochiGoTheme.skirk.black, border: `1px solid ${MochiGoTheme.clorinde.bright}`,
            color: MochiGoTheme.skirk.light, padding: 16, maxHeight: '70vh', overflow: 'auto', borderRadius: 6,
          }} onClick={(e) => e.stopPropagation()}>
            {JSON.stringify(sceneManager.serializeCurrentScene().manifest, null, 2)}
          </pre>
        </div>
      )}

      {assetsBlockedNotice && (
        <div style={{
          position: 'fixed', bottom: 16, right: 16, background: MochiGoTheme.skirk.deep,
          border: `1px solid ${MochiGoTheme.accent}`, color: MochiGoTheme.skirk.light,
          padding: '10px 14px', borderRadius: 6, fontSize: 12, zIndex: 3000, maxWidth: 280,
        }}>
          {assetsBlockedNotice}
        </div>
      )}
    </div>
  );
}
