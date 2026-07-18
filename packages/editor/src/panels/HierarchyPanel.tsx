import React from 'react';
import type { EntityId, World } from '@mochigo/ecs';
import type { EditorState } from '../EditorState';
import { buildHierarchyTree, type HierarchyNode } from '../hierarchyTree';
import { MochiGoTheme } from '../theme';

interface HierarchyPanelProps {
  world: World;
  editorState: EditorState;
  selectedEntity: EntityId | null;
  version: number; // fuerza re-render; no se lee directamente
  onDeleteEntity: (entity: EntityId) => void;
}

export function HierarchyPanel({ world, editorState, selectedEntity, onDeleteEntity }: HierarchyPanelProps) {
  const tree = buildHierarchyTree(world, editorState.getKnownEntities());

  return (
    <div style={{ overflowY: 'auto', height: '100%', background: MochiGoTheme.skirk.black }}>
      <div style={{
        padding: '8px 10px', fontSize: 12, fontWeight: 600, color: MochiGoTheme.skirk.light,
        background: MochiGoTheme.skirk.deep, borderBottom: `2px solid ${MochiGoTheme.navia.bright}`,
      }}>
        Hierarchy
      </div>
      {tree.map((node) => (
        <HierarchyNodeView
          key={node.entity} node={node} depth={0} selectedEntity={selectedEntity}
          onSelect={(id) => editorState.selectEntity(id)} onDelete={onDeleteEntity}
        />
      ))}
      {tree.length === 0 && (
        <div style={{ padding: 8, opacity: 0.6, fontSize: 12, color: MochiGoTheme.skirk.light }}>
          Sin entidades en la escena.
        </div>
      )}
    </div>
  );
}

function HierarchyNodeView({
  node, depth, selectedEntity, onSelect, onDelete,
}: {
  node: HierarchyNode; depth: number; selectedEntity: EntityId | null;
  onSelect: (id: EntityId) => void; onDelete: (id: EntityId) => void;
}) {
  const [expanded, setExpanded] = React.useState(true);
  const isSelected = selectedEntity === node.entity;

  return (
    <div>
      <div
        onClick={() => onSelect(node.entity)}
        style={{
          paddingLeft: 12 + depth * 16, paddingTop: 4, paddingBottom: 4,
          background: isSelected ? MochiGoTheme.skirk.deep : 'transparent',
          borderLeft: isSelected ? `3px solid ${MochiGoTheme.accent}` : '3px solid transparent',
          color: MochiGoTheme.skirk.light, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4, fontSize: 13,
        }}
      >
        {node.children.length > 0 ? (
          <span onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }} style={{ width: 12 }}>
            {expanded ? '▾' : '▸'}
          </span>
        ) : <span style={{ width: 12 }} />}
        <span>Entity #{node.entity}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(node.entity); }}
          style={{ marginLeft: 'auto', fontSize: 10, background: 'transparent', color: MochiGoTheme.skirk.light, border: 'none', cursor: 'pointer' }}
          aria-label={`Eliminar entidad ${node.entity}`}
        >
          ×
        </button>
      </div>
      {expanded && node.children.map((child) => (
        <HierarchyNodeView key={child.entity} node={child} depth={depth + 1} selectedEntity={selectedEntity} onSelect={onSelect} onDelete={onDelete} />
      ))}
    </div>
  );
}
