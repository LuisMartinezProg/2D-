import type { World } from '@mochigo/ecs';
import { Transform } from '@mochigo/ecs';
import type { EventBus } from '@mochigo/events';
import { Vector2 } from '@mochigo/math';
import type { RendererConfig } from './types';
import { Camera } from './components/Camera';
import { Sprite } from './components/Sprite';
import type { AssetManager } from './AssetManager';
import { Layer, type LayerDrawEntry, type CameraView, type CanvasFactory } from './Layer';
import { WorldTransformResolver } from './WorldTransformResolver';
import { CameraController } from './CameraController';
import { RendererEvents } from './events';

export class Renderer {
  private layersByName = new Map<string, Layer>();
  private cameraController = new CameraController();

  /**
   * DESVÍO DEL SPEC: sección 4 muestra el constructor como (config,
   * assetManager) solamente. Se agregan eventBus y canvasFactory como
   * parámetros OPCIONALES adicionales — necesarios porque sección 6 exige
   * emitir renderer:resized y escuchar asset:load-complete, y no hay otra
   * vía para inyectar el EventBus dado que el spec no lo contempla. Con
   * eventBus=undefined, el Renderer sigue funcionando, solo sin eventos.
   */
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

  /** No-op seguro si la capa no existe (mismo criterio que removeComponent en ECS). */
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

  /**
   * Encuentra la cámara activa (Camera.active === true, primera si hay
   * varias) y resuelve su posición de vista: sigue a followTarget si está
   * definido y vivo, si no usa la posición propia de la cámara. Aplica
   * followSmoothing y bounds. Sin cámara activa: identidad (zoom 1).
   *
   * ASUNCIÓN: una entidad Camera sin componente Transform no se considera
   * — la cámara necesita una posición propia cuando no sigue a nada.
   */
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

  /**
   * INTERPRETACIÓN: Sprite.layer (number) se matchea contra el `order`
   * (number) pasado a createLayer(name, order) — no contra `name`. El spec
   * define Sprite.layer como number y createLayer solo expone `order` como
   * handle numérico, así que se unifican en el mismo espacio de números.
   * `name` queda como etiqueta humana para removeLayer/setLayerVisible.
   * Vale la pena confirmar esto en integración.
   */
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
