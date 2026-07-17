// ============================================================
// MOCK — @mochigo/events (forma INFERIDA, no tengo 03-event-manager.md)
// ============================================================
// Pub/sub genérico según el patrón descrito en 00-ARQUITECTURA.md
// sección 5, punto 2.
// ============================================================

export type EventHandler<T = unknown> = (payload: T) => void;

export interface EventManager {
  on<T = unknown>(eventName: string, handler: EventHandler<T>): void;
  off<T = unknown>(eventName: string, handler: EventHandler<T>): void;
  emit<T = unknown>(eventName: string, payload: T): void;
}

// Payload del evento que el Renderer escucha (asset:load-complete).
// Shape no documentado todavía, inferido por analogía con asset:load-error.
export interface AssetLoadCompletePayload {
  textureId: string;
}

// Payload que el Renderer emite, tal como está en 04-renderer.md sección 6.
export interface RendererResizedPayload {
  width: number;
  height: number;
}
