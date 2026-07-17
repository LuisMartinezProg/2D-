import type { Rect } from "@mochigo/math";

/**
 * Componente que describe cómo dibujar una entidad en pantalla.
 * Dato puro — sin lógica. El Renderer es quien la interpreta.
 */
export class Sprite {
  static readonly componentName = "Sprite";

  constructor(
    /** Referencia al Asset Manager, no la imagen directamente. */
    public textureId: string,
    /** Región del atlas a usar. null = imagen completa. */
    public sourceRect: Rect | null = null,
    /** Capa de renderizado. Mayor = más "encima". */
    public layer: number = 0,
    /** Color de tinte. Blanco = sin tinte. */
    public tint: string = "#FFFFFF",
    /** Opacidad, de 0 a 1. */
    public opacity: number = 1,
    public flipX: boolean = false,
    public flipY: boolean = false,
    public visible: boolean = true
  ) {}
}
