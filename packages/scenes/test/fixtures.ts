import type { ComponentClass } from '@mochigo/ecs';
import type { ComponentSerializer } from '../src/types';

/**
 * Componentes de prueba mínimos, independientes de @mochigo/renderer o
 * cualquier otro paquete real, para no acoplar los tests de SceneManager
 * a la implementación de otros módulos. Siguen el mismo patrón
 * (static componentName) confirmado en Sprite.ts real.
 */
export class TestTransform {
  static readonly componentName = 'Transform';
  constructor(
    public position: { x: number; y: number } = { x: 0, y: 0 },
    public rotation: number = 0,
    public scale: { x: number; y: number } = { x: 1, y: 1 }
  ) {}
}

export const transformSerializer: ComponentSerializer<TestTransform> = {
  serialize: (t) => ({ position: t.position, rotation: t.rotation, scale: t.scale }),
  deserialize: (data) =>
    new TestTransform(
      data.position as { x: number; y: number },
      data.rotation as number,
      data.scale as { x: number; y: number }
    ),
};

export class TestSprite {
  static readonly componentName = 'Sprite';
  constructor(
    public textureId: string = '',
    public sourceRect: unknown = null,
    public layer: number = 0
  ) {}
}

export const spriteSerializer: ComponentSerializer<TestSprite> = {
  serialize: (s) => ({ textureId: s.textureId, sourceRect: s.sourceRect, layer: s.layer }),
  deserialize: (data) =>
    new TestSprite(data.textureId as string, data.sourceRect, data.layer as number),
};

export const exampleSceneJSON = {
  name: 'nivel-1',
  manifest: [
    { id: 'characters-atlas', type: 'texture' as const, path: 'characters-atlas.png', atlasData: 'characters-atlas.json' },
  ],
  entities: [
    {
      components: {
        Transform: { position: { x: 100, y: 200 }, rotation: 0, scale: { x: 1, y: 1 } },
        Sprite: { textureId: 'characters-atlas', sourceRect: null, layer: 1 },
      },
    },
  ],
};
