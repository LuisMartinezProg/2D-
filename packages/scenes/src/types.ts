import type { ComponentClass } from '@mochigo/ecs';
import type { AssetManifestEntry } from '@mochigo/assets';

export interface SceneDefinition {
  name: string;
  manifest: AssetManifestEntry[];
  entities: Array<{
    components: Record<string, Record<string, unknown>>;
  }>;
}

export interface ComponentSerializer<T> {
  serialize(instance: T): Record<string, unknown>;
  deserialize(data: Record<string, unknown>): T;
}

/** Entrada interna del registro: guarda la clase junto a su serializador,
 * ya que ambos hacen falta juntos tanto para reconstruir (deserialize +
 * addComponent con la clase correcta) como para exportar (serialize). */
export interface RegisteredComponent {
  componentClass: ComponentClass<any>;
  serializer: ComponentSerializer<any>;
}
