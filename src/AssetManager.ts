/**
 * DEPENDENCIA PENDIENTE: @mochigo/assets figura "no iniciado". Interfaz
 * mínima que Renderer necesita (duck typing) — mismo patrón usado con
 * EcsEventEmitter en @mochigo/ecs antes de que @mochigo/events existiera.
 * Ajustar el import cuando el paquete real esté listo.
 */
export interface AssetManager {
  /** undefined = textura aún no cargada; Layer debe saltearse el sprite sin fallar. */
  getTexture(textureId: string): CanvasImageSource | undefined;
}
