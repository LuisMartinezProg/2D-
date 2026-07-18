import type { ComponentSchema, SchemaField } from '@mochigo/scripting';

export function getFieldValue(instance: Record<string, unknown>, fieldName: string): unknown {
  return instance[fieldName];
}

/** Muta la instancia directamente — el mismo objeto que ya vive en el
 * World (los componentes son referencias, no copias), así el cambio se
 * refleja de inmediato sin volver a llamar addComponent(). */
export function setFieldValue(instance: Record<string, unknown>, fieldName: string, value: unknown): void {
  instance[fieldName] = value;
}

export function schemaFieldEntries(schema: ComponentSchema): Array<[string, SchemaField]> {
  return Object.entries(schema);
}
