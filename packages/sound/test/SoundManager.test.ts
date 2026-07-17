import type { AssetManager } from '@mochigo/assets';
import type { EventBus } from '@mochigo/events';
import { InputEvents } from '@mochigo/input';
import type { SoundCategory, PlaybackOptions, PlaybackEntry } from './types';
import { SoundEvents } from './SoundEvents';

export class SoundManager {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private categoryGains = new Map<SoundCategory, GainNode>();

  private categoryVolumes = new Map<SoundCategory, number>([
    ['music', 1],
    ['sfx', 1],
  ]);

  private muted = false;

  private nextPlaybackId = 1;
  private playbacks = new Map<number, PlaybackEntry>();

  private pendingBeforeUnlock: Array<{ playbackId: number; soundId: string; options: PlaybackOptions }> = [];
  private unlocked = false;

  constructor(
    private readonly assetManager: AssetManager,
    private readonly eventBus: EventBus
  ) {
    this.eventBus.once(InputEvents.TouchStart, () => {
      if (!this.unlocked) {
        this.unlockAudioContext().catch((error) => {
          console.error('[SoundManager] Falló el desbloqueo automático de audio:', error);
        });
      }
    });
  }

  async unlockAudioContext(): Promise<void> {
    if (this.unlocked) return;

    if (!this.audioContext) {
      this.audioContext = new AudioContext();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);

      for (const category of ['music', 'sfx'] as SoundCategory[]) {
        const gain = this.audioContext.createGain();
        gain.gain.value = this.categoryVolumes.get(category) ?? 1;
        gain.connect(this.masterGain);
        this.categoryGains.set(category, gain);
      }
    }

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    const silentBuffer = this.audioContext.createBuffer(1, 1, this.audioContext.sampleRate);
    const silentSource = this.audioContext.createBufferSource();
    silentSource.buffer = silentBuffer;
    silentSource.connect(this.audioContext.destination);
    silentSource.start(0);

    this.unlocked = true;

    const queued = this.pendingBeforeUnlock;
    this.pendingBeforeUnlock = [];
    for (const { playbackId, soundId, options } of queued) {
      this.startPlayback(playbackId, soundId, options);
    }
  }

  play(soundId: string, options: PlaybackOptions): number {
    const playbackId = this.nextPlaybackId++;

    if (!this.unlocked) {
      this.pendingBeforeUnlock.push({ playbackId, soundId, options });
      this.playbacks.set(playbackId, {
        playbackId, soundId, options,
        sourceNode: null, categoryGain: null, stopped: false,
      });
      return playbackId;
    }

    this.startPlayback(playbackId, soundId, options);
    return playbackId;
  }

  stop(playbackId: number): void {
    const entry = this.playbacks.get(playbackId);
    if (!entry || entry.stopped) return;

    entry.stopped = true;

    if (entry.sourceNode) {
      try {
        entry.sourceNode.stop();
      } catch {
        // stop() en un nodo ya finalizado lanza en algunos navegadores;
        // no es un error real, el nodo ya está donde queríamos que esté.
      }
      entry.sourceNode.disconnect();
    } else {
      this.pendingBeforeUnlock = this.pendingBeforeUnlock.filter((p) => p.playbackId !== playbackId);
    }

    this.playbacks.delete(playbackId);
  }

  stopAll(category?: SoundCategory): void {
    const toStop = Array.from(this.playbacks.values()).filter(
      (entry) => category === undefined || entry.options.category === category
    );

    for (const entry of toStop) {
      this.stop(entry.playbackId);
    }
  }

  setCategoryVolume(category: SoundCategory, volume: number): void {
    this.categoryVolumes.set(category, volume);

    const gain = this.categoryGains.get(category);
    if (gain && !this.muted) {
      gain.gain.value = volume;
    }
  }

  getCategoryVolume(category: SoundCategory): number {
    return this.categoryVolumes.get(category) ?? 1;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;

    for (const [category, gain] of this.categoryGains) {
      gain.gain.value = muted ? 0 : (this.categoryVolumes.get(category) ?? 1);
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  private startPlayback(playbackId: number, soundId: string, options: PlaybackOptions): void {
    if (!this.audioContext || !this.masterGain) return;

    const buffer = this.assetManager.getSound(soundId);
    if (!buffer) {
      console.warn(`[SoundManager] play(): no se encontró el sonido "${soundId}" en AssetManager (¿se cargó?).`);
      this.playbacks.delete(playbackId);
      return;
    }

    const categoryGain = this.categoryGains.get(options.category);
    if (!categoryGain) return;

    const sourceNode = this.audioContext.createBufferSource();
    sourceNode.buffer = buffer;
    sourceNode.loop = options.loop ?? false;

    const individualGain = this.audioContext.createGain();
    individualGain.gain.value = options.volume ?? 1;

    sourceNode.connect(individualGain);
    individualGain.connect(categoryGain);

    sourceNode.onended = () => {
      const entry = this.playbacks.get(playbackId);
      if (entry && !entry.stopped) {
        this.eventBus.emit(SoundEvents.PlaybackEnded, { soundId });
        this.playbacks.delete(playbackId);
      }
    };

    this.playbacks.set(playbackId, {
      playbackId, soundId, options,
      sourceNode, categoryGain, stopped: false,
    });

    sourceNode.start(0);
  }
}
