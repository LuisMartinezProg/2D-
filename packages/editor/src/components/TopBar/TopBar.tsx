// packages/editor/src/components/TopBar/TopBar.tsx
import { useState, useRef, useEffect } from 'react';

// Paleta MochiGo — Clorinde (tema de la topbar/menús del editor)
const COLORS = {
  menuBarBg: '#2D1B4E',       // Clorinde oscuro
  menuBarText: '#E8E0F5',     // texto claro sobre Clorinde
  menuHoverBg: '#7B4FBF',     // Clorinde claro (hover)
  dropdownBg: '#1F1236',      // más oscuro que la barra, para que "flote"
  dropdownBorder: '#7B4FBF',
  accent: '#EDD47A',          // acento global dorado
  playGreen: '#4CAF88',       // Jahoda verde (ya usado en el botón Play real)
  controlsBarBg: '#2D1B4E',
  disabledText: '#8877A8',
} as const;

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

interface TopBarProps {
  isPlaying: boolean;
  isPaused: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStep: () => void;
  onSaveScene: () => void;
  onNewScene: () => void;
  onOpenScene: () => void;
  onCreateEntity: () => void;
  onDuplicateEntity: () => void;
  onDeleteEntity: () => void;
  hasSelectedEntity: boolean;
  onImportTexture: () => void;
  onImportAtlas: () => void;
  onReloadAssets: () => void;
  panelVisibility: {
    hierarchy: boolean;
    sceneView: boolean;
    inspector: boolean;
    assetBrowser: boolean;
  };
  onTogglePanel: (panel: keyof TopBarProps['panelVisibility']) => void;
}

export function TopBar(props: TopBarProps) {
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  // Cerrar el dropdown al hacer click afuera (comportamiento estándar de menú tipo Unity/desktop)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
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
        { label: 'Guardar escena', onClick: props.onSaveScene },
      ],
    },
    edit: {
      label: 'Edit',
      entries: [
        { label: 'Deshacer', onClick: () => {}, disabled: true },
        { label: 'Rehacer', onClick: () => {}, disabled: true },
        { divider: true },
        { label: 'Preferencias', onClick: () => {}, disabled: true },
      ],
    },
    entity: {
      label: 'Entity',
      entries: [
        { label: 'Crear entidad vacía', onClick: props.onCreateEntity },
        { label: 'Duplicar', onClick: props.onDuplicateEntity, disabled: !props.hasSelectedEntity },
        { divider: true },
        { label: 'Eliminar', onClick: props.onDeleteEntity, disabled: !props.hasSelectedEntity },
      ],
    },
    assets: {
      label: 'Assets',
      entries: [
        { label: 'Importar textura', onClick: props.onImportTexture },
        { label: 'Importar atlas (TexturePacker JSON)', onClick: props.onImportAtlas },
        { divider: true },
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
      ],
    },
    help: {
      label: 'Help',
      entries: [
        { label: 'Acerca de MochiGo Engine', onClick: () => {} },
      ],
    },
  };

  return (
    <div ref={barRef} style={{ userSelect: 'none' }}>
      {/* Fila 1: menús de texto */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: COLORS.menuBarBg,
          height: 32,
          fontSize: 13,
          fontFamily: 'system-ui, sans-serif',
          position: 'relative',
        }}
      >
        {(Object.keys(menus) as MenuId[]).map((id) => (
          <div key={id} style={{ position: 'relative' }}>
            <button
              onClick={() => setOpenMenu(openMenu === id ? null : id)}
              onMouseEnter={() => {
                // Si ya hay un menú abierto, cambiar de menú al pasar el mouse (comportamiento estándar de menú desktop)
                if (openMenu !== null) setOpenMenu(id);
              }}
              style={{
                background: openMenu === id ? COLORS.menuHoverBg : 'transparent',
                color: COLORS.menuBarText,
                border: 'none',
                padding: '0 14px',
                height: 32,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {menus[id].label}
            </button>

            {openMenu === id && (
              <div
                style={{
                  position: 'absolute',
                  top: 32,
                  left: 0,
                  minWidth: 220,
                  background: COLORS.dropdownBg,
                  border: `1px solid ${COLORS.dropdownBorder}`,
                  boxShadow: '0 8px 16px rgba(0,0,0,0.4)',
                  zIndex: 1000,
                  padding: '4px 0',
                }}
              >
                {menus[id].entries.map((entry, i) =>
                  'divider' in entry ? (
                    <div
                      key={i}
                      style={{ height: 1, background: COLORS.dropdownBorder, opacity: 0.4, margin: '4px 0' }}
                    />
                  ) : (
                    <button
                      key={i}
                      disabled={entry.disabled}
                      onClick={() => {
                        entry.onClick();
                        setOpenMenu(null);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        padding: '7px 16px',
                        fontSize: 13,
                        fontFamily: 'monospace',
                        color: entry.disabled ? COLORS.disabledText : COLORS.menuBarText,
                        cursor: entry.disabled ? 'default' : 'pointer',
                      }}
                      onMouseEnter={(e) => {
                        if (!entry.disabled) e.currentTarget.style.borderLeft = `3px solid ${COLORS.accent}`;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderLeft = 'none';
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

      {/* Fila 2: controles de reproducción (Play/Pause/Step), centrados como en Unity */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          background: COLORS.controlsBarBg,
          height: 40,
          borderTop: `1px solid ${COLORS.menuHoverBg}`,
        }}
      >
        <button
          onClick={props.onPlay}
          style={{
            background: props.isPlaying ? COLORS.menuHoverBg : COLORS.playGreen,
            color: '#0D2110',
            border: 'none',
            borderRadius: 4,
            padding: '6px 16px',
            fontWeight: 700,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          {props.isPlaying ? '■ Stop' : '▶ Play'}
        </button>

        <button
          onClick={props.onPause}
          disabled={!props.isPlaying}
          style={{
            background: props.isPaused ? COLORS.accent : 'transparent',
            color: props.isPaused ? '#4A3B0D' : props.isPlaying ? COLORS.menuBarText : COLORS.disabledText,
            border: `1px solid ${props.isPlaying ? COLORS.accent : COLORS.disabledText}`,
            borderRadius: 4,
            padding: '6px 14px',
            fontWeight: 700,
            cursor: props.isPlaying ? 'pointer' : 'default',
            fontSize: 13,
          }}
        >
          ⏸ Pause
        </button>

        <button
          onClick={props.onStep}
          disabled={!props.isPlaying || !props.isPaused}
          style={{
            background: 'transparent',
            color: props.isPlaying && props.isPaused ? COLORS.menuBarText : COLORS.disabledText,
            border: `1px solid ${props.isPlaying && props.isPaused ? COLORS.menuHoverBg : COLORS.disabledText}`,
            borderRadius: 4,
            padding: '6px 14px',
            fontWeight: 700,
            cursor: props.isPlaying && props.isPaused ? 'pointer' : 'default',
            fontSize: 13,
          }}
        >
          ⏭ Step
        </button>
      </div>
    </div>
  );
}
