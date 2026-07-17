import type { AssetManager } from '@mochigo/assets';
import type { EventBus } from '@mochigo/events';
import { InputEvents } from '@mochigo/input';
import type { SoundCategory, PlaybackOptions, PlaybackEntry } from './types';
import { SoundEvents } from './SoundEvents';

export class SoundManager {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private categoryGains = new Map<SoundCategory, GainNode>();

  // Volumen "recordado" por categoría, independiente del GainNode real -
  // así setMuted(false) puede restaurar el valor exacto de antes, sin
  // tener que leerlo de vuelta del nodo (los AudioParam no siempre
  // reportan el valor con la precisión con la que se seteó).
  private categoryVolumes = new Map<SoundCategory, number>([
    ['music', 1],
    ['sfx', 1],
  ]);

  private muted = false;

  private nextPlaybackId = 1;
  private playbacks = new Map<number, PlaybackEntry>();

  // Reproducciones pedidas ANTES del desbloqueo: se ejecutan en orden
  // apenas unlockAudioContext() resuelve.
  private pendingBeforeUnlock: Array<{ playbackId: number; soundId: string; options: PlaybackOptions }> = [];
  private unlocked = false;

  constructor(
    private readonly assetManager: AssetManager,
    private readonly eventBus: EventBus
  ) {
    // Checklist / sección 4: escuchar input:touch-start como disparador
    // sugerido para el desbloqueo automático, sin bloquear si el juego
    // prefiere llamar unlockAudioContext() manualmente por su cuenta.
    this.eventBus.once(InputEvents.TouchStart, () => {
      if (!this.unlocked) {
        this.unlockAudioContext().catch((error) => {
          console.error('[SoundManager] Falló el desbloqueo automático de audio:', error);
        });
      }
    });
  }

  async unlockAudioContext(): Promise<void> {
    if (this.unlocked) return; // ya desbloqueado, no-op seguro

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

    // Truco estándar de desbloqueo: reproducir un buffer silencioso de
    // duración mínima. En muchos navegadores móviles, resume() por sí
    // solo no es suficiente sin que además ocurra una reproducción real
    // dentro del mismo gesto del usuario.
    const silentBuffer = this.audioContext.createBuffer(1, 1, this.audioContext.sampleRate);
    const silentSource = this.audioContext.createBufferSource();
    silentSource.buffer = silentBuffer;
    silentSource.connect(this.audioContext.destination);
    silentSource.start(0);

    this.unlocked = true;

    // Ejecutar todo lo que se había encolado, en el mismo orden en que se pidió.
    const queued = this.pendingBeforeUnlock;
    this.pendingBeforeUnlock = [];
    for (const { playbackId, soundId, options } of queued) {
      this.startPlayback(playbackId, soundId, options);
    }
  }

  play(soundId: string, options: PlaybackOptions): number {
    const playbackId = this.nextPlaybackId++;

    if (!this.unlocked) {
      // Encolar: se ejecutará apenas unlockAudioContext() resuelva.
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
      // Todavía encolado, nunca llegó a sonar: quitarlo de la cola para
      // que no arranque cuando se desbloquee más tarde.
      this.pendingBeforeUnlock = this.pendingBeforeUnlock.filter((p) => p.playbackId !== playbackId);
    }

    this.playbacks.delete(playbackId);
  }

  stopAll(category?: SoundCategory): void {
    // Copiamos las entradas antes de iterar porque stop() modifica
    // this.playbacks durante el propio recorrido (mismo motivo que el
    // slice() del EventBus real: evita desalinear un for...of sobre una
    // colección que se está mutando en el mismo ciclo).
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
    // Si está muted, el GainNode real se mantiene en 0 (ver setMuted) -
    // el valor "recordado" en categoryVolumes ya quedó actualizado para
    // cuando se desmutee.
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

  // ── Interno ──────────────────────────────────────────────

  private startPlayback(playbackId: number, soundId: string, options: PlaybackOptions): void {
    if (!this.audioContext || !this.masterGain) return; // no debería pasar tras unlock, defensivo

    const buffer = this.assetManager.getSound(soundId);
    if (!buffer) {
      console.warn(`[SoundManager] play(): no se encontró el sonido "${soundId}" en AssetManager (¿se cargó?).`);
      this.playbacks.delete(playbackId);
      return;
    }

    const categoryGain = this.categoryGains.get(options.category);
    if (!categoryGain) return; // categoría desconocida, defensivo

    // Jerarquía de 3 niveles (checklist): nodo individual -> gain de
    // categoría -> gain maestro.
    const sourceNode = this.audioContext.createBufferSource();
    sourceNode.buffer = buffer;
    sourceNode.loop = options.loop ?? false;

    const individualGain = this.audioContext.createGain();
    individualGain.gain.value = options.volume ?? 1;

    sourceNode.connect(individualGain);
    individualGain.connect(categoryGain);
    // categoryGain -> masterGain ya está conectado desde unlockAudioContext().

    sourceNode.onended = () => {
      // loop: true nunca dispara 'ended' de forma natural (solo al
      // detenerse manualmente vía stop(), que ya limpia el registro por
      // su cuenta) - emitimos el evento solo si no fue un stop() manual
      // anticipado, para no emitir playback-ended de un sonido que el
      // propio juego decidió cortar.
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
