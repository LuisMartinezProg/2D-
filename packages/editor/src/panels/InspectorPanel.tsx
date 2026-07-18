import React from 'react';
import type { World, EntityId, ComponentClass } from '@mochigo/ecs';
import type { ComponentSchema } from '@mochigo/scripting';
import { CoreComponentSchemas } from '../coreComponentSchemas';
import { FieldEditor } from './FieldEditor';
import { getFieldValue, setFieldValue, schemaFieldEntries } from '../inspectorFields';
import { MochiGoTheme } from '../theme';

interface InspectorPanelProps {
  world: World;
  selectedEntity: EntityId | null;
  knownComponentClasses: Map<string, ComponentClass<any>>;
  scriptSchemas: Map<string, ComponentSchema>;
  onFieldChanged: () => void;
}

export function InspectorPanel({
  world, selectedEntity, knownComponentClasses, scriptSchemas, onFieldChanged,
}: InspectorPanelProps) {
  const header = (title: string) => (
    <div style={{
      padding: '8px 10px', fontSize: 12, fontWeight: 600, color: MochiGoTheme.skirk.light,
      background: MochiGoTheme.skirk.deep, borderBottom: `2px solid ${MochiGoTheme.clorinde.bright}`,
    }}>
      {title}
    </div>
  );

  if (selectedEntity === null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: MochiGoTheme.skirk.black }}>
        {header('Inspector')}
        <div style={{ padding: 12, opacity: 0.6, fontSize: 12, color: MochiGoTheme.skirk.light }}>
          Ninguna entidad seleccionada.
        </div>
      </div>
    );
  }

  const presentComponents: Array<{ name: string; schema: ComponentSchema; instance: Record<string, unknown> }> = [];
  for (const [name, componentClass] of knownComponentClasses) {
    if (!world.hasComponent(selectedEntity, componentClass)) continue;
    const schema = CoreComponentSchemas.get(name) ?? scriptSchemas.get(name);
    if (!schema) continue;
    presentComponents.push({ name, schema, instance: world.getComponent(selectedEntity, componentClass) as Record<string, unknown> });
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: MochiGoTheme.skirk.black }}>
      {header(`Inspector — Entity #${selectedEntity}`)}
      <div style={{ overflowY: 'auto', flex: 1, padding: 8 }}>
        {presentComponents.length === 0 && (
          <div style={{ opacity: 0.6, fontSize: 12, color: MochiGoTheme.skirk.light }}>
            Esta entidad no tiene componentes editables.
          </div>
        )}
        {presentComponents.map(({ name, schema, instance }) => (
          <div key={name} style={{ marginBottom: 16 }}>
            <h4 style={{
              fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, color: MochiGoTheme.accent,
              borderBottom: `1px solid ${MochiGoTheme.clorinde.deep}`, paddingBottom: 4, marginBottom: 8,
            }}>
              {name}
            </h4>
            {schemaFieldEntries(schema).map(([fieldName, field]) => (
              <FieldEditor
                key={fieldName} fieldName={fieldName} field={field}
                value={getFieldValue(instance, fieldName)}
                onChange={(newValue) => { setFieldValue(instance, fieldName, newValue); onFieldChanged(); }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
