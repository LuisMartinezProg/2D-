import { describe, it, expect, vi } from 'vitest';

vi.mock('@mochigo/math', () => {
  class Vector2 {
    constructor(public x: number, public y: number) {}
    static zero() { return new Vector2(0, 0); }
    static one() { return new Vector2(1, 1); }
  }
  return { Vector2 };
});

import { Vector2 } from '@mochigo/math';
import { Layer, type CanvasFactory } from '../src/Layer';
import { Sprite } from '../src/components/Sprite';
import type { AssetManager } from '../src/AssetManager';

function createMockContext() {
  return {
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    scale: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    imageSmoothingEnabled: true,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '#000000',
  };
}

function createMockCanvasFactory() {
  const ctx = createMockContext();
  const canvas = { width: 0, height: 0, getContext: vi.fn(() => ctx) };
  const factory: CanvasFactory = () => canvas as any;
  return { factory, ctx };
}

const fakeAssetManager: AssetManager = { getTexture: () => ({ width: 32, height: 32 } as any) };

describe('Layer — dirty flag', () => {
  it('no redibuja si la firma de entries no cambió', () => {
    const { factory, ctx } = createMockCanvasFactory();
    const layer = new Layer('bg', 0, 800, 600, false, factory);

    const entries = [
      { entityId: 1, transform: { position: new Vector2(0, 0), rotation: 0, scale: new Vector2(1, 1) }, sprite: new Sprite('tex-a') },
    ];

    expect(layer.draw(entries, { position: new Vector2(0, 0), zoom: 1 }, 800, 600, fakeAssetManager)).toBe(true);
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);

    expect(layer.draw(entries, { position: new Vector2(0, 0), zoom: 1 }, 800, 600, fakeAssetManager)).toBe(false);
    expect(ctx.clearRect).toHaveBeenCalledTimes(1);
  });

  it('redibuja si algo en entries cambió', () => {
    const { factory, ctx } = createMockCanvasFactory();
    const layer = new Layer('bg', 0, 800, 600, false, factory);
    const makeEntry = (x: number) => [
      { entityId: 1, transform: { position: new Vector2(x, 0), rotation: 0, scale: new Vector2(1, 1) }, sprite: new Sprite('tex-a') },
    ];

    layer.draw(makeEntry(0), { position: new Vector2(0, 0), zoom: 1 }, 800, 600, fakeAssetManager);
    expect(layer.draw(makeEntry(5), { position: new Vector2(0, 0), zoom: 1 }, 800, 600, fakeAssetManager)).toBe(true);
    expect(ctx.clearRect).toHaveBeenCalledTimes(2);
  });

  it('markDirty() fuerza el redibujo aunque la firma no cambie', () => {
    const { factory } = createMockCanvasFactory();
    const layer = new Layer('bg', 0, 800, 600, false, factory);
    const entries: any[] = [];

    layer.draw(entries, { position: new Vector2(0, 0), zoom: 1 }, 800, 600, fakeAssetManager);
    layer.markDirty();
    expect(layer.draw(entries, { position: new Vector2(0, 0), zoom: 1 }, 800, 600, fakeAssetManager)).toBe(true);
  });
});

describe('Layer — texturas y visibilidad', () => {
  it('sprite con textura no cargada se saltea sin fallar', () => {
    const { factory, ctx } = createMockCanvasFactory();
    const layer = new Layer('main', 1, 800, 600, false, factory);
    const noTexture: AssetManager = { getTexture: () => undefined };

    const entries = [
      { entityId: 1, transform: { position: new Vector2(0, 0), rotation: 0, scale: new Vector2(1, 1) }, sprite: new Sprite('tex-x') },
    ];

    expect(() => layer.draw(entries, { position: new Vector2(0, 0), zoom: 1 }, 800, 600, noTexture)).not.toThrow();
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it('sprite con visible:false individual no se dibuja aunque la capa sí sea visible', () => {
    const { factory, ctx } = createMockCanvasFactory();
    const layer = new Layer('main', 0, 800, 600, false, factory);
    const invisibleSprite = new Sprite('tex-a');
    invisibleSprite.visible = false;

    const entries = [{ entityId: 1, transform: { position: new Vector2(0, 0), rotation: 0, scale: new Vector2(1, 1) }, sprite: invisibleSprite }];
    layer.draw(entries, { position: new Vector2(0, 0), zoom: 1 }, 800, 600, fakeAssetManager);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });
});

describe('Layer — pixel art', () => {
  it('pixelArt=true desactiva imageSmoothingEnabled', () => {
    const { factory, ctx } = createMockCanvasFactory();
    new Layer('main', 0, 800, 600, true, factory);
    expect(ctx.imageSmoothingEnabled).toBe(false);
  });

  it('pixelArt=false mantiene imageSmoothingEnabled activo', () => {
    const { factory, ctx } = createMockCanvasFactory();
    new Layer('main', 0, 800, 600, false, factory);
    expect(ctx.imageSmoothingEnabled).toBe(true);
  });
});
