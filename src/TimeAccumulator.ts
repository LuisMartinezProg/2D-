/**
 * Acumulador de fixed timestep — algoritmo estándar de la industria
 * ("Fix Your Timestep!", Gaffer On Games). Aislado en su propia clase
 * para poder testearlo sin requestAnimationFrame de por medio.
 */
export class TimeAccumulator {
  private accumulator = 0;

  constructor(
    private readonly fixedTimestep: number,
    private readonly maxCatchUpSteps: number
  ) {}

  /**
   * Dado el tiempo real transcurrido, retorna cuántos pasos fijos hay
   * que ejecutar. Si excede maxCatchUpSteps, DESCARTA el tiempo sobrante
   * en vez de seguir acumulando deuda — decisión deliberada: prioriza
   * estabilidad sobre determinismo estricto cuando el dispositivo no
   * puede seguir el ritmo. Ver checklist sección 5 del spec.
   */
  advance(realDeltaTime: number): number {
    this.accumulator += realDeltaTime;

    const stepsNeeded = Math.floor(this.accumulator / this.fixedTimestep);
    const stepsToRun = Math.min(stepsNeeded, this.maxCatchUpSteps);

    if (stepsNeeded > this.maxCatchUpSteps) {
      // Espiral de la muerte evitada: se descarta la deuda excedente.
      this.accumulator = 0;
    } else {
      this.accumulator -= stepsToRun * this.fixedTimestep;
    }

    return stepsToRun;
  }

  /** Fracción [0, 1] del paso fijo actual aún no consumida — para interpolar el render. */
  getInterpolation(): number {
    return this.accumulator / this.fixedTimestep;
  }

  reset(): void {
    this.accumulator = 0;
  }
}
