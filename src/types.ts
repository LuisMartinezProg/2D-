export interface GameLoopConfig {
  /** En segundos. Default: 1/60 (~16.67ms). */
  fixedTimestep: number;
  /**
   * Límite de pasos fijos por frame real. Si un frame tarda demasiado
   * (pestaña en background, GC largo, dispositivo lento), evita la
   * "espiral de la muerte": sin este límite, cada frame lento generaría
   * más deuda de tiempo, forzando más pasos fijos, haciendo el siguiente
   * frame aún más lento — un bucle que nunca se recupera.
   */
  maxCatchUpSteps: number;
}

export type FixedUpdateCallback = (fixedDelta: number) => void;
export type RenderCallback = (interpolation: number, frameDelta: number) => void;

export const DEFAULT_CONFIG: GameLoopConfig = {
  fixedTimestep: 1 / 60,
  maxCatchUpSteps: 5,
};
