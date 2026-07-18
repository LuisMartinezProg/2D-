import type { World } from '@mochigo/ecs';
import { Transform } from '@mochigo/ecs';
import type { EventBus } from '@mochigo/events';
import { Vector2 } from '@mochigo/math';
import type { RendererConfig } from './types';
import { Camera } from './components/Camera';
import { Sprite } from './components/Sprite';
import type { AssetManager } from '@mochigo/assets';
import { Layer, type LayerDrawEntry, type CameraView, type CanvasFactory } from './Layer';
import { WorldTransformResolver } from './WorldTransformResolver';
import { CameraController } from './CameraController';
import { RendererEvents } from './events';

export class Renderer {
  private layersByName = new Map<string, Layer>();
  private cameraController = new CameraController();

  constructor(
    private config: RendererConfig,
    private assetManager: AssetManager,
    private eventBus?: EventBus,
    private canvasFactory?: CanvasFactory
  ) {
    this.applyPixelArtToMainCanvas();

    this.eventBus?.on('asset:load-complete', () => {
      for (const layer of this.layersByName.values()) layer.markDirty();
    });
  }

  render(world: World, _interpolation: number): void {
    const mainCtx = this.config.canvas.getContext('2d');
    if (!mainCtx) return;

    const transformResolver = new WorldTransformResolver(world);
    const camera = this.resolveActiveCameraView(world, transformResolver);

    mainCtx.clearRect(0, 0, this.config.width, this.config.height);

    const layersOrdered = [...this.layersByName.values()].sort((a, b) => a.order - b.order);
    for (const layer of layersOrdered) {
      if (!layer.visible) continue;
      const entries = this.collectEntriesForLayer(world, layer.order, transformResolver);
      layer.draw(entries, camera, this.config.width, this.config.height, this.assetManager);
      mainCtx.drawImage(layer.canvas, 0, 0);
    }
  }

  createLayer(name: string, order: number): void {
    if (this.layersByName.has(name)) {
      throw new Error(`Ya existe una capa llamada "${name}".`);
    }
    this.layersByName.set(
      name,
      new Layer(name, order, this.config.width, this.config.height, this.config.pixelArt, this.canvasFactory)
    );
  }

  removeLayer(name: string): void {
    this.layersByName.delete(name);
  }

  setLayerVisible(name: string, visible: boolean): void {
    const layer = this.layersByName.get(name);
    if (layer) layer.visible = visible;
  }

  resize(width: number, height: number): void {
    this.config.width = width;
    this.config.height = height;
    this.config.canvas.width = width;
    this.config.canvas.height = height;

    for (const layer of this.layersByName.values()) layer.resize(width, height);

    this.eventBus?.emit(RendererEvents.Resized, { width, height });
  }

  private applyPixelArtToMainCanvas(): void {
    this.config.canvas.width = this.config.width;
    this.config.canvas.height = this.config.height;
    const ctx = this.config.canvas.getContext('2d');
    if (ctx) ctx.imageSmoothingEnabled = !this.config.pixelArt;
  }

  private resolveActiveCameraView(world: World, transformResolver: WorldTransformResolver): CameraView {
    const cameraEntities = [...world.query([Camera, Transform])];
    const activeCameraId = cameraEntities.find((id) => world.getComponent(id, Camera)!.active);

    if (activeCameraId === undefined) {
      return { position: new Vector2(0, 0), zoom: 1 };
    }

    const cameraComponent = world.getComponent(activeCameraId, Camera)!;

    const desiredPosition =
      cameraComponent.followTarget !== null && world.isAlive(cameraComponent.followTarget)
        ? transformResolver.resolve(cameraComponent.followTarget).position
        : transformResolver.resolve(activeCameraId).position;

    const viewPosition = this.cameraController.computeViewPosition(
      desiredPosition,
      cameraComponent.followSmoothing,
      cameraComponent.bounds,
      this.config.width,
      this.config.height,
      cameraComponent.zoom
    );

    return { position: viewPosition, zoom: cameraComponent.zoom };
  }

  private collectEntriesForLayer(world: World, layerOrder: number, transformResolver: WorldTransformResolver): LayerDrawEntry[] {
    const entries: LayerDrawEntry[] = [];
    for (const entityId of world.query([Transform, Sprite])) {
      const sprite = world.getComponent(entityId, Sprite)!;
      if (sprite.layer !== layerOrder) continue;
      entries.push({ entityId, transform: transformResolver.resolve(entityId), sprite });
    }
    return entries;
  }
}
