// ============================================================
// MOCK — @mochigo/assets (forma INFERIDA, no tengo esa ficha)
// ============================================================
// El Renderer solo necesita pedir la textura ya cargada dado un
// textureId, y saber si todavía no está lista.
//
// Si tienes la ficha real de Asset Manager o sabes que la forma es
// otra, avísame y ajusto esto y todo lo que lo use.
// ============================================================

export interface AssetManager {
  getTexture(textureId: string): CanvasImageSource | undefined;
  isLoaded(textureId: string): boolean;
}
