/**
 * Mismo criterio que en @mochigo/ecs: nombres con guion, siguiendo la
 * convención "dominio:accion" de 00-ARQUITECTURA.md sección 7. El spec
 * original usa "game:paused" sin guion (son palabras únicas, no aplica).
 */
export const GameLoopEvents = {
  Started: 'game:started',
  Stopped: 'game:stopped',
  Paused: 'game:paused',
  Resumed: 'game:resumed',
} as const;
