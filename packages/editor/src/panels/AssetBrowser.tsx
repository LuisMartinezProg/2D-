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
import { AtlasBuilderModal } from './components/AssetBrowser/AtlasBuilderModal';
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

// Shape mínimo que necesitamos del retorno de serializeCurrentScene(),
// sin asumir si trae un campo `id` propio (no confirmado en esta sesión).
interface SerializedEntityData {
  components: Record<string, Record<string, unknown>>;
}

interface ClipboardEntity {
  entityId: EntityId; // el EntityId original, guardado aparte por si SerializedEntityData no trae uno propio
  data: SerializedEntityData;
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
  const [atlasBuilderOpen, setAtlasBuilderOpen] = React.useState(false);
  const [manifestViewerOpen, setManifestViewerOpen] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  // Distingue qué tipo de archivo se está importando cuando se abre el <input type="file">
  // compartido — evita crear 4 inputs ocultos idénticos, uno por tipo de asset.
  const pendingImportKind = React.useRef<'texture' | 'sound' | 'json' | 'atlas' | 'scene' | null>(null);

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

  function handleSaveScene(): void {
    const sceneData = sceneManager.serializeCurrentScene();
    downloadJson(sceneData, `${sceneData.name || 'scene'}.json`);
  }

  function handleSaveSceneAs(): void {
    const name = window.prompt('Nombre de la escena:', sceneManager.getCurrentSceneName() ?? 'scene');
    if (!name) return; // cancelado
    const sceneData = { ...sceneManager.serializeCurrentScene(), name };
    downloadJson(sceneData, `${name}.json`);
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

  // Reusa exactamente el mismo patrón que SceneManager.loadScene() usa para poblar
  // una entidad componente-por-componente, aplicado a UNA sola entidad en vez de
  // a todas las de la escena. No existe un método "instantiateEntity" en
  // SceneManager, así que reconstruimos el mismo mini-loop acá.
  function instantiateFromSerializedData(data: SerializedEntityData): EntityId {
    const entity = world.createEntity();
    const currentScene = sceneManager.serializeCurrentScene(); // solo para llegar al registry indirectamente no es posible: SceneManager no expone su registry públicamente.
    // CORRECCIÓN: SceneManager no expone registry ni un método público para
    // deserializar un componente suelto — registerComponent() solo permite
    // ESCRIBIR en el registro, no leerlo desde afuera. Sin un método público
    // como sceneManager.deserializeComponent(name, data), el Editor no puede
    // reconstruir componentes por su cuenta sin duplicar cada serializer.
    // Documentado como bloqueo real más abajo, no simulado.
    return entity;
  }

  function handleCopyEntity(): void {
    if (selectedEntity === null) return;
    // serializeCurrentScene() no devuelve el EntityId dentro de cada entrada de
    // `entities` (según el shape visto), así que no hay forma de filtrar "la
    // entidad seleccionada" de ese array sin ambigüedad si hay varias entidades
    // con componentes idénticos. Bloqueo real, ver nota en el mensaje de abajo.
    window.alert('Copiar entidad: bloqueado — ver explicación debajo del código.');
  }

  function handlePasteEntity(): void {
    if (!clipboardEntity) return;
    window.alert('Pegar entidad: bloqueado — mismo motivo que Copiar.');
  }

  function handleCreateEntity(): EntityId {
    const entity = world.createEntity();
    editorState.selectEntity(entity);
    forceUpdate();
    return entity;
  }

  function handleCreateEntityWithSprite(): void {
    // Bloqueo real: crear un Sprite requiere textureId (string) + Sprite class,
    // ninguno de los dos fue compartido en esta sesión (Sprite.ts en sí, y qué
    // textureId usar como placeholder por defecto). No invento un textureId que
    // podría no existir en ningún manifest cargado.
    window.alert('Crear con Sprite: bloqueado — falta Sprite.ts y un textureId placeholder real.');
  }

  function handleDuplicateEntity(): void {
    if (selectedEntity === null) return;
    window.alert('Duplicar: mismo bloqueo que Copiar/Pegar — ver explicación debajo.');
  }

  function handleNewScene(): void {
    if (isPlayMode) return; // mismo criterio que Guardar: no tocar la escena en play mode
    sceneManager.unloadCurrentScene([]); // ya existe, destruye todo lo que la escena actual creó
    sceneManager.loadScene({ name: 'untitled', manifest: [], entities: [] });
    editorState.selectEntity(null as unknown as EntityId); // ajustar si selectEntity no acepta null
    forceUpdate();
  }

  function triggerFileInput(kind: typeof pendingImportKind.current): void {
    pendingImportKind.current = kind;
    fileInputRef.current?.click();
  }

  async function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    const kind = pendingImportKind.current;
    e.target.value = ''; // permite re-seleccionar el mismo archivo dos veces seguidas
    if (!file || !kind) return;

    if (kind === 'scene') {
      const text = await file.text();
      const sceneData = JSON.parse(text); // riesgo real: sin validar shape; ver nota abajo
      await sceneManager.loadScene(sceneData);
      forceUpdate();
      return;
    }

    // texture/sound/json/atlas: bloqueado, ver nota debajo del código —
    // AssetManager no expone un método tipo registerLoadedFile(id, blob) que
    // permita inyectar un asset ya en memoria sin pasar por loadManifest().
    window.alert(`Importar ${kind}: bloqueado — ver explicación debajo del código.`);
  }

  function handleExportBuild(): void {
    window.open('https://github.com/LuisMartinezProg/2D-/actions', '_blank');
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
      <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={handleFileInputChange}
        accept={pendingImportKind.current === 'scene' ? 'application/json' : undefined} />

      <div style={{ gridArea: 'toolbar', background: MochiGoTheme.skirk.deep, borderBottom: `2px solid ${MochiGoTheme.accent}` }}>
        <TopBar
          isPlayMode={isPlayMode}
          onTogglePlayMode={handleTogglePlayMode}
          onSaveScene={handleSaveScene}
          onSaveSceneAs={handleSaveSceneAs}
          onNewScene={handleNewScene}
          onOpenScene={() => triggerFileInput('scene')}
          onExportBuild={handleExportBuild}
          onCopyEntity={handleCopyEntity}
          onPasteEntity={handlePasteEntity}
          hasClipboardEntity={clipboardEntity !== null}
          onSelectAll={() => {}}
          onDeselectAll={() => editorState.selectEntity(null as unknown as EntityId)}
          onCreateEntity={handleCreateEntity}
          onCreateEntityWithSprite={handleCreateEntityWithSprite}
          onDuplicateEntity={handleDuplicateEntity}
          onDeleteEntity={() => selectedEntity !== null && handleDeleteEntity(selectedEntity)}
          hasSelectedEntity={selectedEntity !== null}
          onImportTexture={() => triggerFileInput('texture')}
          onImportSound={() => triggerFileInput('sound')}
          onImportJson={() => triggerFileInput('json')}
          onImportAtlas={() => triggerFileInput('atlas')}
          onOpenAtlasBuilder={() => setAtlasBuilderOpen(true)}
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

      {atlasBuilderOpen && (
        <AtlasBuilderModal
          onClose={() => setAtlasBuilderOpen(false)}
          onExport={(atlasPng, manifestJson) => {
            // Bloqueo real: igual que Importar textura, no hay forma de inyectar
            // este PNG+JSON ya generado dentro de AssetManager sin un método
            // tipo registerLoadedAsset(). Por ahora se descarga como archivos
            // sueltos para que el usuario los suba manualmente al repo.
            const url = URL.createObjectURL(atlasPng);
            const link = document.createElement('a');
            link.href = url; link.download = 'atlas.png'; link.click();
            URL.revokeObjectURL(url);
            downloadJson(JSON.parse(manifestJson), 'atlas.json');
            setAtlasBuilderOpen(false);
          }}
        />
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
    </div>
  );
}
