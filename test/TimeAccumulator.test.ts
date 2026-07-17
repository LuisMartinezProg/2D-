import { describe, it, expect } from 'vitest';
import { TimeAccumulator } from '../src/TimeAccumulator';

const FIXED_STEP = 1 / 60;

describe('TimeAccumulator', () => {
  it('no ejecuta pasos si el delta es menor al timestep fijo', () => {
    const acc = new TimeAccumulator(FIXED_STEP, 5);
    expect(acc.advance(FIXED_STEP / 2)).toBe(0);
  });

  it('ejecuta exactamente 1 paso cuando el delta calza justo', () => {
    const acc = new TimeAccumulator(FIXED_STEP, 5);
    expect(acc.advance(FIXED_STEP)).toBe(1);
  });

  it('ejecuta varios pasos y conserva el resto en el acumulador', () => {
    const acc = new TimeAccumulator(FIXED_STEP, 10);
    const steps = acc.advance(FIXED_STEP * 3.5);
    expect(steps).toBe(3);
    expect(acc.getInterpolation()).toBeCloseTo(0.5, 5);
  });

  it('respeta maxCatchUpSteps y descarta la deuda sobrante (anti "espiral de la muerte")', () => {
    const acc = new TimeAccumulator(FIXED_STEP, 5);
    // Simula que el navegador se congeló 2 segundos (~120 pasos a 60fps).
    const steps = acc.advance(2);
    expect(steps).toBe(5);
    expect(acc.getInterpolation()).toBe(0); // deuda descartada, no arrastrada
  });

  it('interpolation siempre está en [0, 1]', () => {
    const acc = new TimeAccumulator(FIXED_STEP, 5);
    for (const delta of [0, 0.001, FIXED_STEP / 2, FIXED_STEP * 0.99, FIXED_STEP * 4.2, 2]) {
      acc.advance(delta);
      const interp = acc.getInterpolation();
      expect(interp).toBeGreaterThanOrEqual(0);
      expect(interp).toBeLessThanOrEqual(1);
    }
  });
});
