import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameLoop } from '../src/GameLoop';
import { World } from '@mochigo/ecs';

/**
 * Mock manual de requestAnimationFrame/cancelAnimationFrame: se dispara
 * solo al llamar advanceFrame(), controlando el timestamp exactamente
 * (checklist punto: "Mock de requestAnimationFrame para testear sin
 * navegador real").
 */
function mockRaf() {
  let pendingCallback: FrameRequestCallback | null = null;
  let handleCounter = 0;

  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    pendingCallback = cb;
    return ++handleCounter;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    pendingCallback = null;
  });

  return {
    advanceFrame(timestamp: number) {
      const cb = pendingCallback;
      pendingCallback = null;
      cb?.(timestamp);
    },
  };
}

describe('GameLoop', () => {
  let raf: ReturnType<typeof mockRaf>;

  beforeEach(() => { raf = mockRaf(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('start() emite game:started y arranca el loop', () => {
    const emit = vi.fn();
    const loop = new GameLoop(new World(), { emit });
    loop.start();
    expect(emit).toHaveBeenCalledWith('game:started', {});
    expect(loop.isRunning()).toBe(true);
  });

  it('stop() emite game:stopped y detiene el loop', () => {
    const emit = vi.fn();
    const loop = new GameLoop(new World(), { emit });
    loop.start();
    loop.stop();
    expect(emit).toHaveBeenCalledWith('game:stopped', {});
    expect(loop.isRunning()).toBe(false);
  });

  it('pause() detiene onFixedUpdate pero onRender sigue corriendo', () => {
    const world = new World();
    const loop = new GameLoop(world, { emit: vi.fn() }, { fixedTimestep: 1 / 60, maxCatchUpSteps: 5 });
    const fixedUpdate = vi.fn();
    const render = vi.fn();
    loop.onFixedUpdate(fixedUpdate);
    loop.onRender(render);

    loop.start();
    raf.advanceFrame(0);       // primer frame: establece lastFrameTime, sin delta real
    raf.advanceFrame(1000 / 60); // segundo frame: 1 paso fijo

    loop.pause();
    fixedUpdate.mockClear();
    render.mockClear();

    raf.advanceFrame(2000 / 60);
    expect(fixedUpdate).not.toHaveBeenCalled();
    expect(render).toHaveBeenCalledTimes(1);
  });

  it('resume() reanuda onFixedUpdate', () => {
    const loop = new GameLoop(new World(), { emit: vi.fn() });
    const fixedUpdate = vi.fn();
    loop.onFixedUpdate(fixedUpdate);

    loop.start();
    loop.pause();
    loop.resume();
    fixedUpdate.mockClear();

    raf.advanceFrame(0);
    raf.advanceFrame(1000 / 60);
    expect(fixedUpdate).toHaveBeenCalled();
  });

  it('con un delta grande simulado (freeze de 2s), respeta maxCatchUpSteps sin exceder', () => {
    const loop = new GameLoop(new World(), { emit: vi.fn() }, { fixedTimestep: 1 / 60, maxCatchUpSteps: 5 });
    const fixedUpdate = vi.fn();
    loop.onFixedUpdate(fixedUpdate);

    loop.start();
    raf.advanceFrame(0);      // establece lastFrameTime = 0
    raf.advanceFrame(2000);   // 2 segundos después → freeze simulado

    expect(fixedUpdate).toHaveBeenCalledTimes(5); // maxCatchUpSteps, no ~120
  });

  it('interpolation pasado a onRender siempre está en [0, 1]', () => {
    const loop = new GameLoop(new World(), { emit: vi.fn() });
    const render = vi.fn();
    loop.onRender(render);

    loop.start();
    for (const t of [0, 16.67, 33.34, 100, 250, 2000]) {
      raf.advanceFrame(t);
    }

    for (const call of render.mock.calls) {
      const [interpolation] = call;
      expect(interpolation).toBeGreaterThanOrEqual(0);
      expect(interpolation).toBeLessThanOrEqual(1);
    }
  });
});
