import type { Rect } from '@mochigo/math';

export type LoopMode = 'once' | 'loop' | 'ping-pong';

export interface AnimationClip {
  name: string;
  frames: Rect[];
  frameDuration: number; // segundos por frame
  loopMode: LoopMode;
}

export class Animator {
  static readonly componentName = 'Animator';

  constructor(
    public clips: Map<string, AnimationClip>,
    public currentClip: string | null = null,
    public currentFrameIndex: number = 0,
    public elapsedInFrame: number = 0,
    public playing: boolean = false,
    public playbackSpeed: number = 1
  ) {}
}
