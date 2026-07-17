import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@mochigo/math', () => {
  class Vector2 {
    constructor(public x: number, public y: number) {}
    static zero() { return new Vector2(0, 0); }
    static one() { return new Vector2(1, 1); }
  }
  return { Vector2 };
});

import { Vector2 } from '@mochigo/math';
import { CameraController, clampToBounds } from '../src/CameraController';

describe('clampToBounds (lógica pura de límites)', () => {
  it('sin bounds, retorna la posición sin cambios', () => {
    const pos = new Vector2(500, 500);
    expect(clampToBounds(pos, null, 800, 600, 1)).toEqual(pos);
  });

  it('limita la posición para que el viewport no cruce los bounds', () => {
    const bounds = { x: 0, y: 0, width: 1000, height: 1000 };
    const clamped = clampToBounds(new Vector2(-100, -100), bounds, 800, 600, 1);
    expect(clamped.x).toBeCloseTo(400, 5); // medio-viewport a zoom 1
    expect(clamped.y).toBeCloseTo(300, 5);
  });

  it('zoom mayor reduce el medio-viewport, permite acercarse más al borde', () => {
    const bounds = { x: 0, y: 0, width: 1000, height: 1000 };
    const clamped = clampToBounds(new Vector2(10, 10), bounds, 800, 600, 2);
    expect(clamped.x).toBeCloseTo(200, 5);
    expect(clamped.y).toBeCloseTo(150, 5);
  });

  it('bounds más chico que el viewport: centra en vez de invertir el rango', () => {
    const bounds = { x: 0, y: 0, width: 100, height: 100 };
    const clamped = clampToBounds(new Vector2(9999, 9999), bounds, 800, 600, 1);
    expect(clamped.x).toBeCloseTo(50, 5);
    expect(clamped.y).toBeCloseTo(50, 5);
  });
});

describe('CameraController — suavizado', () => {
  afterEach(() => vi.restoreAllMocks());

  it('followSmoothing = 0 salta instantáneamente a la posición deseada', () => {
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const controller = new CameraController();
    const result = controller.computeViewPosition(new Vector2(100, 0), 0, null, 800, 600, 1);
    expect(result.x).toBe(100);
  });

  it('followSmoothing > 0 se acerca gradualmente, no de un salto', () => {
    const controller = new CameraController();
    vi.spyOn(performance, 'now').mockReturnValue(0);
    controller.computeViewPosition(new Vector2(0, 0), 1, null, 800, 600, 1);

    vi.spyOn(performance, 'now').mockReturnValue(100);
    const result = controller.computeViewPosition(new Vector2(100, 0), 1, null, 800, 600, 1);

    expect(result.x).toBeGreaterThan(0);
    expect(result.x).toBeLessThan(100);
  });

  it('con suficiente tiempo transcurrido, converge a la posición deseada', () => {
    const controller = new CameraController();
    vi.spyOn(performance, 'now').mockReturnValue(0);
    controller.computeViewPosition(new Vector2(0, 0), 0.1, null, 800, 600, 1);

    vi.spyOn(performance, 'now').mockReturnValue(5000);
    const result = controller.computeViewPosition(new Vector2(100, 0), 0.1, null, 800, 600, 1);

    expect(result.x).toBeCloseTo(100, 1);
  });

  it('reset() limpia el estado, el siguiente cómputo salta directo', () => {
    const controller = new CameraController();
    vi.spyOn(performance, 'now').mockReturnValue(0);
    controller.computeViewPosition(new Vector2(0, 0), 1, null, 800, 600, 1);
    controller.reset();

    vi.spyOn(performance, 'now').mockReturnValue(100);
    const result = controller.computeViewPosition(new Vector2(500, 0), 1, null, 800, 600, 1);
    expect(result.x).toBe(500);
  });
});
