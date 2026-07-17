export const SoundEvents = {
  PlaybackEnded: 'sound:playback-ended',
} as const;

export interface SoundPlaybackEndedPayload {
  soundId: string;
}
