import React from 'react';
import type { SchemaField } from '@mochigo/scripting';
import type { EntityId } from '@mochigo/ecs';
import { MochiGoTheme } from '../theme';

interface FieldEditorProps {
  fieldName: string;
  field: SchemaField;
  value: unknown;
  onChange: (newValue: unknown) => void;
}

/** Un tipo de input por cada SchemaFieldType (Scripting, sección 2).
 * "entity" usa un input numérico simple — un selector visual de
 * entidades (lista buscable) queda fuera de alcance de esta v1. */
export function FieldEditor({ fieldName, field, value, onChange }: FieldEditorProps) {
  const label = field.label ?? fieldName;
  const labelStyle: React.CSSProperties = {
    fontSize: 11, color: MochiGoTheme.skirk.light, opacity: 0.8,
    display: 'block', marginBottom: 2,
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', background: MochiGoTheme.skirk.black,
    border: `1px solid ${MochiGoTheme.clorinde.bright}`,
    color: MochiGoTheme.skirk.light, padding: '4px 6px', fontSize: 12, borderRadius: 2,
  };

  switch (field.type) {
    case 'number':
      return (
        <div style={{ marginBottom: 8 }}>
          <label style={labelStyle}>{label}</label>
          <input
            type="number"
            value={typeof value === 'number' ? value : (field.default as number)}
            min={field.min} max={field.max} step="any" style={inputStyle}
            onChange={(e) => onChange(e.target.valueAsNumber)}
          />
        </div>
      );

    case 'string':
      return (
        <div style={{ marginBottom: 8 }}>
          <label style={labelStyle}>{label}</label>
          <input
            type="text" value={typeof value === 'string' ? value : (field.default as string)}
            style={inputStyle} onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );

    case 'boolean':
      return (
        <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="checkbox" checked={typeof value === 'boolean' ? value : (field.default as boolean)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <label style={{ ...labelStyle, marginBottom: 0 }}>{label}</label>
        </div>
      );

    case 'vector2': {
      const v = (value as { x: number; y: number } | undefined) ?? (field.default as { x: number; y: number });
      return (
        <div style={{ marginBottom: 8 }}>
          <label style={labelStyle}>{label}</label>
          <div style={{ display: 'flex', gap: 4 }}>
            <input type="number" step="any" value={v.x} style={inputStyle}
              onChange={(e) => onChange({ ...v, x: e.target.valueAsNumber })} aria-label={`${label} X`} />
            <input type="number" step="any" value={v.y} style={inputStyle}
              onChange={(e) => onChange({ ...v, y: e.target.valueAsNumber })} aria-label={`${label} Y`} />
          </div>
        </div>
      );
    }

    case 'color':
      return (
        <div style={{ marginBottom: 8 }}>
          <label style={labelStyle}>{label}</label>
          <input
            type="color" value={typeof value === 'string' ? value : (field.default as string)}
            style={{ ...inputStyle, padding: 0, height: 28 }}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      );

    case 'entity': {
      const entityValue = value as EntityId | null;
      return (
        <div style={{ marginBottom: 8 }}>
          <label style={labelStyle}>{label}</label>
          <input
            type="number" value={entityValue ?? ''} placeholder="(ninguna)" style={inputStyle}
            onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          />
        </div>
      );
    }

    default:
      return null;
  }
}
