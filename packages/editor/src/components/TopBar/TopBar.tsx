// packages/editor/src/components/TopBar/TopBar.tsx (actualizado)
import { useState, useRef, useEffect } from 'react';

const COLORS = {
  menuBarBg: '#2D1B4E',
  menuBarText: '#E8E0F5',
  menuHoverBg: '#7B4FBF',
  dropdownBg: '#1F1236',
  dropdownBorder: '#7B4FBF',
  accent: '#EDD47A',
  playGreen: '#4CAF88',
  controlsBarBg: '#2D1B4E',
  disabledText: '#8877A8',
  searchBg: '#1F1236',
} as const;

type MenuId = 'file' | 'edit' | 'entity' | 'assets' | 'window' | 'help';
type PivotMode = 'pivot' | 'center';
type SpaceMode = 'local' | 'global';

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

  // Nuevos props para esta pasada
  searchQuery: string;
  onSearchChange: (query: string) => void;
  pivotMode: PivotMode;
  onPivotModeChange: (mode: PivotMode) => void;
  spaceMode: SpaceMode;
  onSpaceModeChange: (mode: SpaceMode) => void;
  availableLayouts: string[]; // hoy: ['Default'] — la UI ya soporta más a futuro
  activeLayout: string;
  onLayoutChange: (layout: string) => void;
}

export function TopBar(props: TopBarProps) {
  const [openMenu, setOpenMenu] = useState<MenuId | null>(null);
  const [layoutMenuOpen, setLayoutMenuOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
        setLayoutMenuOpen(false);
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
      entries: [{ label: 'Acerca de MochiGo Engine', onClick: () => {} }],
    },
  };

  return (
    <div ref={barRef} style={{ userSelect: 'none' }}>
      {/* Fila 1: menús de texto + búsqueda + layout selector */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: COLORS.menuBarBg,
          height: 32,
          fontSize: 13,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {(Object.keys(menus) as MenuId[]).map((id) => (
          <div key={id} style={{ position: 'relative' }}>
            <button
              onClick={() => setOpenMenu(openMenu === id ? null : id)}
              onMouseEnter={() => {
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
                    <div key={i} style={{ height: 1, background: COLORS.dropdownBorder, opacity: 0.4, margin: '4px 0' }} />
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
                    >
                      {entry.label}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        ))}

        {/* Search bar — filtra el Hierarchy Panel por nombre de entidad */}
        <div style={{ marginLeft: 'auto', marginRight: 12, position: 'relative' }}>
          <input
            type="text"
            value={props.searchQuery}
            onChange={(e) => props.onSearchChange(e.target.value)}
            placeholder="Buscar entidad..."
            style={{
              background: COLORS.searchBg,
              color: COLORS.menuBarText,
              border: `1px solid ${COLORS.menuHoverBg}`,
              borderRadius: 4,
              padding: '4px 10px',
              fontSize: 12,
              width: 160,
              outline: 'none',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = COLORS.accent)}
            onBlur={(e) => (e.currentTarget.style.borderColor = COLORS.menuHoverBg)}
          />
        </div>

        {/* Layout selector — hoy un solo layout, UI lista para más */}
        <div style={{ position: 'relative', marginRight: 8 }}>
          <button
            onClick={() => setLayoutMenuOpen(!layoutMenuOpen)}
            style={{
              background: layoutMenuOpen ? COLORS.menuHoverBg : 'transparent',
              color: COLORS.menuBarText,
              border: `1px solid ${COLORS.menuHoverBg}`,
              borderRadius: 4,
              padding: '4px 10px',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {props.activeLayout} ▾
          </button>
          {layoutMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: 30,
                right: 0,
                minWidth: 140,
                background: COLORS.dropdownBg,
                border: `1px solid ${COLORS.dropdownBorder}`,
                boxShadow: '0 8px 16px rgba(0,0,0,0.4)',
                zIndex: 1000,
                padding: '4px 0',
              }}
            >
              {props.availableLayouts.map((layout) => (
                <button
                  key={layout}
                  onClick={() => {
                    props.onLayoutChange(layout);
                    setLayoutMenuOpen(false);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    background: 'transparent',
                    border: 'none',
                    padding: '6px 14px',
                    fontSize: 12,
                    color: layout === props.activeLayout ? COLORS.accent : COLORS.menuBarText,
                    cursor: 'pointer',
                  }}
                >
                  {layout === props.activeLayout ? '✓ ' : '   '}{layout}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Fila 2: pivot/space + Play/Pause/Step centrados */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          background: COLORS.controlsBarBg,
          height: 40,
          borderTop: `1px solid ${COLORS.menuHoverBg}`,
          position: 'relative',
        }}
      >
        {/* Pivot/Center + Local/Global — a la izquierda, junto a los gizmos Move/Rotate/Scale existentes */}
        <div style={{ display: 'flex', gap: 4, marginLeft: 12 }}>
          <ToggleGroup
            options={[{ value: 'pivot', label: 'Pivot' }, { value: 'center', label: 'Center' }]}
            value={props.pivotMode}
            onChange={(v) => props.onPivotModeChange(v as PivotMode)}
          />
          <ToggleGroup
            options={[{ value: 'local', label: 'Local' }, { value: 'global', label: 'Global' }]}
            value={props.spaceMode}
            onChange={(v) => props.onSpaceModeChange(v as SpaceMode)}
          />
        </div>

        {/* Play/Pause/Step centrados */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            display: 'flex',
            gap: 8,
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
    </div>
  );
}

// Pequeño toggle de 2 estados reutilizado para Pivot/Center y Local/Global
function ToggleGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div style={{ display: 'flex', border: `1px solid ${COLORS.menuHoverBg}`, borderRadius: 4, overflow: 'hidden' }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            background: value === opt.value ? COLORS.accent : 'transparent',
            color: value === opt.value ? '#4A3B0D' : COLORS.menuBarText,
            border: 'none',
            padding: '5px 10px',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
