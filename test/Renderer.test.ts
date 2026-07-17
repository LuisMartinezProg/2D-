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
import { World, Transform } from '@mochigo/ecs';
import { Renderer } from '../src/Renderer';
import { Sprite } from '../src/components/Sprite';
import { Camera } from '../src/components/Camera';
import type { AssetManager } from '../src/AssetManager';
import type { CanvasFactory } from '../src/Layer';

function createMockContext() {
  return {
    clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(), scale: vi.fn(),
    translate: vi.fn(), rotate: vi.fn(), drawImage: vi.fn(), fillRect: vi.fn(),
    imageSmoothingEnabled: true, globalAlpha: 1,
    globalCompositeOperation: 'source-over', fillStyle: '#000000',
  };
}

function createMockMainCanvas() {
  const ctx = createMockContext();
  return { canvas: { width: 0, height: 0, getContext: vi.fn(() => ctx) } as any, ctx };
}

function createLayerCanvasFactory() {
  const contexts: ReturnType<typeof createMockContext>[] = [];
  const factory: CanvasFactory = () => {
    const ctx = createMockContext();
    contexts.push(ctx);
    return { width: 0, height: 0, getContext: vi.fn(() => ctx) } as any;
  };
  return { factory, contexts };
}

const fakeAssetManager: AssetManager = { getTexture: () => ({ width: 32, height: 32 } as any) };
const baseConfig = { width: 800, height: 600, backgroundColor: '#000', pixelArt: false };

describe('Renderer — capas', () => {
  it('capa visible:false no compone su contenido en el canvas principal', () => {
    const { canvas, ctx: mainCtx } = createMockMainCanvas();
    const { factory } = createLayerCanvasFactory();
    const renderer = new Renderer({ canvas, ...baseConfig }, fakeAssetManager, undefined, factory);
    renderer.createLayer('hidden', 0);
    renderer.setLayerVisible('hidden', false);

    renderer.render(new World(), 0);
    expect(mainCtx.drawImage).not.toHaveBeenCalled();
  });

  it('capa visible sí compone su contenido', () => {
    const { canvas, ctx: mainCtx } = createMockMainCanvas();
    const { factory } = createLayerCanvasFactory();
    const renderer = new Renderer({ canvas, ...baseConfig }, fakeAssetManager, undefined, factory);
    renderer.createLayer('main', 0);

    renderer.render(new World(), 0);
    expect(mainCtx.drawImage).toHaveBeenCalledTimes(1);
  });
});

describe('Renderer — cámara', () => {
  it('el zoom de la cámara activa se aplica como ctx.scale al dibujar la capa', () => {
    const { canvas } = createMockMainCanvas();
    const { factory, contexts } = createLayerCanvasFactory();
    const renderer = new Renderer({ canvas, ...baseConfig }, fakeAssetManager, undefined, factory);
    renderer.createLayer('main', 0);

    const world = new World();
    const cameraEntity = world.createEntity();
    world.addComponent(cameraEntity, Transform, new Transform(new Vector2(0, 0), 0, Vector2.one(), null));
    world.addComponent(cameraEntity, Camera, new Camera(2.5, null, 0, null, true));

    const spriteEntity = world.createEntity();
    world.addComponent(spriteEntity, Transform, new Transform());
    world.addComponent(spriteEntity, Sprite, new Sprite('tex-a', null, 0));

    renderer.render(world, 0);
    expect(contexts[0].scale).toHaveBeenCalledWith(2.5, 2.5);
  });

  it('sin cámara activa, usa zoom 1 por defecto', () => {
    const { canvas } = createMockMainCanvas();
    const { factory, contexts } = createLayerCanvasFactory();
    const renderer = new Renderer({ canvas, ...baseConfig }, fakeAssetManager, undefined, factory);
    renderer.createLayer('main', 0);

    const world = new World();
    const spriteEntity = world.createEntity();
    world.addComponent(spriteEntity, Transform, new Transform());
    world.addComponent(spriteEntity, Sprite, new Sprite('tex-a', null, 0));

    renderer.render(world, 0);
    expect(contexts[0].scale).toHaveBeenCalledWith(1, 1);
  });
});

describe('Renderer — resize', () => {
  it('resize() emite renderer:resized y actualiza el canvas principal', () => {
    const { canvas } = createMockMainCanvas();
    const { factory } = createLayerCanvasFactory();
    const emit = vi.fn();
    const renderer = new Renderer({ canvas, ...baseConfig }, fakeAssetManager, { emit, on: vi.fn() } as any, factory);

    renderer.resize(1024, 768);
    expect(emit).toHaveBeenCalledWith('renderer:resized', { width: 1024, height: 768 });
    expect(canvas.width).toBe(1024);
    expect(canvas.height).toBe(768);
  });
});

describe('Renderer — asset:load-complete', () => {
  it('marca todas las capas dirty y fuerza redibujo', () => {
    const { canvas } = createMockMainCanvas();
    const { factory, contexts } = createLayerCanvasFactory();
    let assetHandler: (() => void) | undefined;
    const eventBus = { emit: vi.fn(), on: vi.fn((name: string, cb: () => void) => { if (name === 'asset:load-complete') assetHandler = cb; }) };

    const renderer = new Renderer({ canvas, ...baseConfig }, fakeAssetManager, eventBus as any, factory);
    renderer.createLayer('main', 0);

    const world = new World();
    renderer.render(world, 0);
    renderer.render(world, 0);
    expect(contexts[0].clearRect).toHaveBeenCalledTimes(1); // segundo render: no dirty

    assetHandler?.();
    renderer.render(world, 0);
    expect(contexts[0].clearRect).toHaveBeenCalledTimes(2);
  });
});
