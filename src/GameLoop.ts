import type { World } from '@mochigo/ecs';
import type { GameLoopConfig, FixedUpdateCallback, RenderCallback } from './types';
import { DEFAULT_CONFIG } from './types';
import { GameLoopEvents } from './events';
import { TimeAccumulator } from './TimeAccumulator';

/**
 * DEPENDENCIA PENDIENTE: @mochigo/events figura "no iniciado". Se tipa
 * mínimamente aquí (duck typing) para no bloquear el módulo — coordinar
 * con ese paquete cuando exista, igual que se hizo con EcsEventEmitter
 * en @mochigo/ecs.
 */
export interface EventBus {
  emit(eventName: string, payload: unknown): void;
}

export class GameLoop {
  private readonly config: GameLoopConfig;
  private readonly accumulator: TimeAccumulator;
  private fixedUpdateCallbacks: FixedUpdateCallback[] = [];
  private renderCallbacks: RenderCallback[] = [];

  private running = false;
  private paused = false;
  private rafHandle: number | null = null;
  private lastFrameTime: number | null = null;

  constructor(
    private readonly world: World,
    private readonly eventBus: EventBus,
    config?: Partial<GameLoopConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.accumulator = new TimeAccumulator(this.config.fixedTimestep, this.config.maxCatchUpSteps);
  }

  onFixedUpdate(callback: FixedUpdateCallback): void {
    this.fixedUpdateCallbacks.push(callback);
  }

  onRender(callback: RenderCallback): void {
    this.renderCallbacks.push(callback);
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.paused = false;
    this.lastFrameTime = null;
    this.accumulator.reset();
    this.eventBus.emit(GameLoopEvents.Started, {});
    this.rafHandle = requestAnimationFrame(this.tick);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.rafHandle !== null) {
      cancelAnimationFrame(this.rafHandle);
      this.rafHandle = null;
    }
    this.eventBus.emit(GameLoopEvents.Stopped, {});
  }

  /** Solo detiene onFixedUpdate — onRender sigue corriendo (requisito checklist punto 4). */
  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.eventBus.emit(GameLoopEvents.Paused, {});
  }

  resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.eventBus.emit(GameLoopEvents.Resumed, {});
  }

  isRunning(): boolean {
    return this.running;
  }

  isPaused(): boolean {
    return this.paused;
  }

  /**
   * Núcleo del loop. Arrow function para conservar `this` al pasarla
   * como callback de requestAnimationFrame.
   */
  private tick = (currentTime: number): void => {
    if (!this.running) return;

    const frameDelta = this.lastFrameTime === null ? 0 : (currentTime - this.lastFrameTime) / 1000;
    this.lastFrameTime = currentTime;

    if (!this.paused) {
      const stepsToRun = this.accumulator.advance(frameDelta);
      for (let i = 0; i < stepsToRun; i++) {
        this.world.update(this.config.fixedTimestep);
        for (const callback of this.fixedUpdateCallbacks) {
          callback(this.config.fixedTimestep);
        }
      }
    }

    const interpolation = this.paused ? 1 : this.accumulator.getInterpolation();
    for (const callback of this.renderCallbacks) {
      callback(interpolation, frameDelta);
    }

    this.rafHandle = requestAnimationFrame(this.tick);
  };
}
