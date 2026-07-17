export const InputEvents = {
  TouchStart: 'input:touch-start',
  TouchMove: 'input:touch-move',
  TouchEnd: 'input:touch-end',
  KeyDown: 'input:key-down',
  KeyUp: 'input:key-up',
} as const;

export interface TouchStartPayload {
  touchId: number;
  position: import('@mochigo/math').Vector2;
}

export interface TouchMovePayload {
  touchId: number;
  position: import('@mochigo/math').Vector2;
  delta: import('@mochigo/math').Vector2;
}

export interface TouchEndPayload {
  touchId: number;
  position: import('@mochigo/math').Vector2;
}

export interface KeyDownPayload {
  key: string;
}

export interface KeyUpPayload {
  key: string;
}
