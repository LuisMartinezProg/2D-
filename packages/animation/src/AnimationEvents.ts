export const AnimationEvents = {
  FrameChanged: 'animation:frame-changed',
  Completed: 'animation:completed',
} as const;

export interface AnimationFrameChangedPayload {
  entityId: number; // EntityId — ajustar el import si EntityId no es un alias de number
  frameIndex: number;
}

export interface AnimationCompletedPayload {
  entityId: number;
  animationName: string;
}
