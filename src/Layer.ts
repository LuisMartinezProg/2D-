import type { EntityId } from '@mochigo/ecs';
import type { Vector2 } from '@mochigo/math';
import type { AssetManager } from './AssetManager';
import type { Sprite } from './components/Sprite';
import type { ResolvedTransform } from './types';

export interface LayerDrawEntry {
  entityId: EntityId;
  transform: ResolvedTransform;
  sprite: Sprite;
}

export interface CameraView {
  position: Vector2;
  zoom: number;
}

type CanvasLike = OffscreenCanvas | HTMLCanvasElement;
type ContextLike = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

/** Fábrica inyectable — permite testear sin navegador real (mismo motivo que el mock de rAF en Game Loop). */
export type CanvasFactory = (width: number, height: number) => CanvasLike;

const defaultCanvasFactory: CanvasFactory = (width, height) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

export class Layer {
  readonly canvas: CanvasLike;
  private readonly ctx: ContextLike;
  private lastSignature: string | null = null;
  visible = true;

  constructor(
    public readonly name: string,
    public order: number,
    width: number,
    height: number,
    private pixelArt: boolean,
    canvasFactory: CanvasFactory = defaultCanvasFactory
  ) {
    this.canvas = canvasFactory(width, height);
    const ctx = this.canvas.getContext('2d') as ContextLike | null;
    if (!ctx) throw new Error(`No se pudo obtener contexto 2D para la capa "${name}".`);
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = !pixelArt;
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx.imageSmoothingEnabled = !this.pixelArt;
    this.lastSignature = null; // fuerza redibujo tras resize
  }

  setPixelArt(pixelArt: boolean): void {
    this.pixelArt = pixelArt;
    this.ctx.imageSmoothingEnabled = !pixelArt;
  }

  /** Fuerza redibujo en el próximo draw() aunque la firma no cambie (ej: tras asset:load-complete). */
  markDirty(): void {
    this.lastSignature = null;
  }

  /**
   * Redibuja SOLO si la firma de entries cambió desde el último frame
   * (dirty-flag vía comparación de firma — sección 2 del spec). Retorna
   * true si efectivamente redibujó.
   */
  draw(entries: LayerDrawEntry[], camera: CameraView, viewportWidth: number, viewportHeight: number, assetManager: AssetManager): boolean {
    const signature = computeSignature(entries);
    if (signature === this.lastSignature) return false;
    this.lastSignature = signature;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();

    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(
      viewportWidth / (2 * camera.zoom) - camera.position.x,
      viewportHeight / (2 * camera.zoom) - camera.position.y
    );

    // Batching por textura: sort ESTABLE, agrupa sin romper el orden
    // relativo entre sprites de la misma textura. Nota: esto puede alterar
    // el orden de dibujo ENTRE texturas distintas dentro de la misma capa
    // — trade-off deliberado del spec (sección 2), señalado también al
    // final de la respuesta.
    const sorted = entries.slice().sort((a, b) => a.sprite.textureId.localeCompare(b.sprite.textureId));

    for (const entry of sorted) {
      if (!entry.sprite.visible) continue;
      const texture = assetManager.getTexture(entry.sprite.textureId);
      if (!texture) continue; // textura aún no cargada — se saltea, no falla
      this.drawSprite(ctx, entry, texture);
    }

    ctx.restore();
    return true;
  }

  private drawSprite(ctx: ContextLike, entry: LayerDrawEntry, texture: CanvasImageSource): void {
    const { transform, sprite } = entry;

    ctx.save();
    ctx.translate(transform.position.x, transform.position.y);
    ctx.rotate(transform.rotation);
    ctx.scale(transform.scale.x * (sprite.flipX ? -1 : 1), transform.scale.y * (sprite.flipY ? -1 : 1));
    ctx.globalAlpha = sprite.opacity;

    let drawX: number;
    let drawY: number;
    let drawW: number;
    let drawH: number;

    if (sprite.sourceRect) {
      const r = sprite.sourceRect;
      drawW = r.width;
      drawH = r.height;
      drawX = -r.width / 2;
      drawY = -r.height / 2;
      ctx.drawImage(texture, r.x, r.y, r.width, r.height, drawX, drawY, drawW, drawH);
    } else {
      drawW = (texture as { width?: number }).width ?? 0;
      drawH = (texture as { height?: number }).height ?? 0;
      drawX = -drawW / 2;
      drawY = -drawH / 2;
      ctx.drawImage(texture, drawX, drawY, drawW, drawH);
    }

    if (sprite.tint !== '#FFFFFF') {
      // Tinte simple (overlay plano, no multiply-preserving-shading):
      // 'source-atop' restringe el fill al área ya dibujada (respeta el
      // alpha/silueta del sprite). Un tinte más fiel requeriría una pasada
      // extra con 'multiply' + máscara 'destination-in' — fuera de alcance
      // de esta primera versión.
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = sprite.tint;
      ctx.fillRect(drawX, drawY, drawW, drawH);
      ctx.globalCompositeOperation = 'source-over';
    }

    ctx.restore();
  }
}

function computeSignature(entries: LayerDrawEntry[]): string {
  // Firma ligera (no un hash criptográfico): suficiente para detectar
  // cambios frame a frame sin comparar objetos completos.
  return entries
    .map((e) => {
      const t = e.transform;
      const s = e.sprite;
      return `${e.entityId}|${t.position.x},${t.position.y}|${t.rotation}|${t.scale.x},${t.scale.y}|${s.textureId}|${s.tint}|${s.opacity}|${s.flipX}|${s.flipY}|${s.visible}`;
    })
    .join(';');
}
