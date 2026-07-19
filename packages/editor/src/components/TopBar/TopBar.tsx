// packages/editor/src/components/TopBar/TopBar.tsx
import { useState, useRef, useEffect } from 'react';
import { MochiGoTheme } from '../../theme';

type MenuId = 'file' | 'edit' | 'entity' | 'assets' | 'window' | 'help';

interface MenuItemDef {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  divider?: false;
}
interface DividerDef {
  divider: true;
}
type MenuEntry = MenuItemDef | DividerDef;

export interface TopBarProps {
  isPlayMode: boolean;
  onTogglePlayMode: () => void;

  onSaveScene: () => void;
  onSaveSceneAs: () => void;
  onNewScene: () => void;
  onOpenScene: () => void;
  onExportBuild: () => void;

  onCopyEntity: () => void;
  onPasteEntity: () => void;
  hasClipboardEntity: boolean;
  onSelectAll: () => void;
  onDeselectAll: () => void;

  onCreateEntity: () => void;
  onCreateEntityWithSprite: () => void;
  onDuplicateEntity: () => void;
  onDeleteEntity: () => void;
  hasSelectedEntity: boolean;

  onImportTexture: () => void;
  onImportSound: () => void;
  onImportJson: () => void;
  onImportAtlas: () => void;
  onOpenAtlasBuilder: () => void;
  onViewManifest: () => void;
  onReloadAssets: () => void;

  panelVisibility: { hierarchy: boolean; sceneView: boolean; inspector: boolean; assetBrowser: boolean };
  onTogglePanel: (panel: keyof TopBarProps['panelVisibility']) => void;
  onResetLayout: () => void;
}

export function TopBar(props: TopBarProps) {
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpenMenu(null);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const menus: Record<MenuId, { label: string; entries: MenuEntry[] }> = {
    file: {
      label: 'File',
      entries: [
        { label: 'Nueva escena', onClick: props.onNewScene },
        { label: 'Abrir escena', onClick: props.onOpenScene },
        { divider: true },
        // Guardar/Guardar como respetan la misma regla que ya tenía handleSaveScene
        // en EditorApp: no tiene sentido persistir mientras isPlayMode muta estado temporal.
        { label: 'Guardar escena', onClick: props.onSaveScene, disabled: props.isPlayMode },
        { label: 'Guardar como...', onClick: props.onSaveSceneAs, disabled: props.isPlayMode },
        { divider: true },
        { label: 'Exportar build', onClick: props.onExportBuild },
      ],
    },
    edit: {
      label: 'Edit',
      entries: [
        { label: 'Deshacer', onClick: () => {}, disabled: true },
        { label: 'Rehacer', onClick: () => {}, disabled: true },
        { divider: true },
        { label: 'Copiar entidad', onClick: props.onCopyEntity, disabled: !props.hasSelectedEntity },
        { label: 'Pegar entidad', onClick: props.onPasteEntity, disabled: !props.hasClipboardEntity },
        { divider: true },
        { label: 'Seleccionar todo', onClick: props.onSelectAll },
        { label: 'Deseleccionar', onClick: props.onDeselectAll },
      ],
    },
    entity: {
      label: 'Entity',
      entries: [
        { label: 'Crear entidad vacía', onClick: props.onCreateEntity },
        { label: 'Crear entidad con Sprite', onClick: props.onCreateEntityWithSprite },
        { label: 'Duplicar', onClick: props.onDuplicateEntity, disabled: !props.hasSelectedEntity },
        { divider: true },
        // Deshabilitados a propósito: no hay campo de orden entre hermanos
        // (Transform.parent no trae siblingIndex), solo agrupación por padre.
        // Reordenar de verdad requeriría agregar ese campo — cambio de Transform,
        // no de la topbar; lo dejo visible pero inactivo en vez de simular un
        // reordenamiento que no persiste en ningún lado.
        { label: 'Mover arriba', onClick: () => {}, disabled: true },
        { label: 'Mover abajo', onClick: () => {}, disabled: true },
        { divider: true },
        { label: 'Eliminar', onClick: props.onDeleteEntity, disabled: !props.hasSelectedEntity },
      ],
    },
    assets: {
      label: 'Assets',
      entries: [
        { label: 'Importar textura', onClick: props.onImportTexture },
        { label: 'Importar sonido', onClick: props.onImportSound },
        { label: 'Importar JSON', onClick: props.onImportJson },
        { label: 'Importar atlas (TexturePacker JSON)', onClick: props.onImportAtlas },
        { label: 'Generar atlas desde imágenes...', onClick: props.onOpenAtlasBuilder },
        { divider: true },
        { label: 'Ver manifest de la escena actual', onClick: props.onViewManifest },
        { label: 'Recargar assets', onClick: props.onReloadAssets },
      ],
    },
    window: {
      label: 'Window',
      entries: [
        { label: `${props.panelVisibility.hierarchy ? '✓ ' : '   '}Hierarchy`, onClick: () => props.onTogglePanel('hierarchy') },
        { label: `${props.panelVisibility.sceneView ? '✓ ' : '   '}Scene View`, onClick: () => props.onTogglePanel('sceneView') },
        { label: `${props.panelVisibility.inspector ? '✓ ' : '   '}Inspector`, onClick: () => props.onTogglePanel('inspector') },
        { label: `${props.panelVisibility.assetBrowser ? '✓ ' : '   '}Asset Browser`, onClick: () => props.onTogglePanel('assetBrowser') },
        { divider: true },
        { label: 'Restablecer layout', onClick: props.onResetLayout },
      ],
    },
    help: { label: 'Help', entries: [{ label: 'Acerca de MochiGo Engine', onClick: () => {} }] },
  };

  return (
    <div ref={barRef} style={{ userSelect: 'none' }}>
      <div style={{
        display: 'flex', alignItems: 'center', background: MochiGoTheme.skirk.deep,
        height: 32, fontSize: 13, fontFamily: 'system-ui, sans-serif',
      }}>
        {(Object.keys(menus) as MenuId[]).map((id) => (
          <div key={id} style={{ position: 'relative' }}>
            <button
              onClick={() => setOpenMenu(openMenu === id ? null : id)}
              onMouseEnter={() => { if (openMenu !== null) setOpenMenu(id); }}
              style={{
                background: openMenu === id ? MochiGoTheme.clorinde.bright : 'transparent',
                color: MochiGoTheme.skirk.light, border: 'none', padding: '0 14px',
                height: 32, cursor: 'pointer', fontSize: 13, fontWeight: 500,
              }}
            >
              {menus[id].label}
            </button>

            {openMenu === id && (
              <div style={{
                position: 'absolute', top: 32, left: 0, minWidth: 240,
                background: MochiGoTheme.skirk.black, border: `1px solid ${MochiGoTheme.clorinde.bright}`,
                boxShadow: '0 8px 16px rgba(0,0,0,0.4)', zIndex: 1000, padding: '4px 0',
              }}>
                {menus[id].entries.map((entry, i) =>
                  'divider' in entry ? (
                    <div key={i} style={{ height: 1, background: MochiGoTheme.clorinde.bright, opacity: 0.4, margin: '4px 0' }} />
                  ) : (
                    <button
                      key={i}
                      disabled={entry.disabled}
                      onClick={() => { entry.onClick(); setOpenMenu(null); }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left', background: 'transparent',
                        border: 'none', padding: '7px 16px', fontSize: 13, fontFamily: 'monospace',
                        color: entry.disabled ? MochiGoTheme.navia.bright : MochiGoTheme.skirk.light,
                        cursor: entry.disabled ? 'default' : 'pointer',
                      }}
                    >
                      {entry.label}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
