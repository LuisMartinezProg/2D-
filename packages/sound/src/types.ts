export type SoundCategory = 'music' | 'sfx';

export interface PlaybackOptions {
  category: SoundCategory;
  loop?: boolean;
  volume?: number; // 0 a 1, relativo al volumen de la categoría
}

/** Estado interno de una reproducción, activa o todavía encolada
 * esperando el desbloqueo del AudioContext. */
export interface PlaybackEntry {
  playbackId: number;
  soundId: string;
  options: PlaybackOptions;
  sourceNode: AudioBufferSourceNode | null; // null mientras está encolada
  categoryGain: GainNode | null;
  stopped: boolean;
}
