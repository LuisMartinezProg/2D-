export const RendererEvents = {
  Resized: 'renderer:resized',
} as const;

export interface RendererResizedPayload {
  width: number;
  height: number;
}
