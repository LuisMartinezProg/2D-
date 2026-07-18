import { ScriptComponent } from '@mochigo/scripting';

/** Script de prueba cuyo schema cubre los 6 SchemaFieldType posibles —
 * exigido explícitamente por el checklist de la ficha. */
export class FullSchemaTestScript extends ScriptComponent {
  static readonly componentName = 'FullSchemaTestScript';
  static readonly schema = {
    speed: { type: 'number' as const, default: 5, min: 0, max: 20 },
    label: { type: 'string' as const, default: 'hola' },
    enabled: { type: 'boolean' as const, default: true },
    offset: { type: 'vector2' as const, default: { x: 0, y: 0 } },
    tint: { type: 'color' as const, default: '#FF0000' },
    target: { type: 'entity' as const, default: null },
  };

  speed = 5;
  label = 'hola';
  enabled = true;
  offset = { x: 0, y: 0 };
  tint = '#FF0000';
  target: number | null = null;
}
