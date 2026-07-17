import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventBus } from '@mochigo/events';
import { InputManager } from '../src/InputManager';
import { InputEvents } from '../src/InputEvents';

/**
 * jsdom no implementa TouchEvent/Touch de forma nativa. Construimos un
 * Event real (para que .type sea correcto y dispatchEvent lo enrute al
 * listener adecuado) y le agregamos encima las propiedades que
 * InputManager realmente lee: changedTouches y preventDefault.
 */
function makeTouchEvent(
  type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel',
  touches: Array<{ identifier: number; clientX: number; clientY: number }>
): TouchEvent {
  const event = new Event(type, { cancelable: true });
  return Object.assign(event, {
    changedTouches: touches,
  }) as unknown as TouchEvent;
}

describe('InputManager', () => {
  let target: HTMLElement;
  let eventBus: EventBus;
  let manager: InputManager;

  beforeEach(() => {
    target = document.createElement('div');
    document.body.appendChild(target);
    target.getBoundingClientRect = vi.fn(() => ({
      left: 0, top: 0, right: 800, bottom: 600,
      width: 800, height: 600, x: 0, y: 0, toJSON: () => {},
    }));
    eventBus = new EventBus();
  });

  afterEach(() => {
    manager?.destroy();
    document.body.removeChild(target);
  });

  describe('teclado: isKeyDown / isKeyPressed / isKeyReleased', () => {
    beforeEach(() => {
      manager = new InputManager(target, eventBus);
    });

    it('isKeyDown es true mientras la tecla se mantiene presionada', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
      expect(manager.isKeyDown('a')).toBe(true);

      manager.update();
      expect(manager.isKeyDown('a')).toBe(true);
    });

    it('isKeyPressed es true SOLO en el frame exacto de la presión, false después', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
      expect(manager.isKeyPressed('a')).toBe(true);

      manager.update();
      expect(manager.isKeyPressed('a')).toBe(false);

      manager.update();
      expect(manager.isKeyPressed('a')).toBe(false);
    });

    it('isKeyReleased es true SOLO en el frame exacto de soltar, false después', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
      manager.update();
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a' }));

      expect(manager.isKeyReleased('a')).toBe(true);
      expect(manager.isKeyDown('a')).toBe(false);

      manager.update();
      expect(manager.isKeyReleased('a')).toBe(false);
    });

    it('ignora keydown repetidos del sistema operativo (e.repeat) para isKeyPressed', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }));
      manager.update();

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', repeat: true }));

      expect(manager.isKeyPressed('a')).toBe(false);
      expect(manager.isKeyDown('a')).toBe(true);
    });

    it('emite input:key-down e input:key-up con el payload correcto', () => {
      const downEvents: any[] = [];
      const upEvents: any[] = [];
      eventBus.on(InputEvents.KeyDown, (p) => downEvents.push(p));
      eventBus.on(InputEvents.KeyUp, (p) => upEvents.push(p));

      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));

      expect(downEvents).toEqual([{ key: 'Enter' }]);
      expect(upEvents).toEqual([{ key: 'Enter' }]);
    });

    it('trackea múltiples teclas simultáneas de forma independiente', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'w' }));
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));

      expect(manager.isKeyDown('w')).toBe(true);
      expect(manager.isKeyDown('d')).toBe(true);
      expect(manager.isKeyDown('s')).toBe(false);

      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'w' }));
      expect(manager.isKeyDown('w')).toBe(false);
      expect(manager.isKeyDown('d')).toBe(true);
    });
  });

  describe('mouse (dispositivo CON soporte táctil real: sin síntesis)', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'ontouchstart', { value: () => {}, configurable: true });
      manager = new InputManager(target, eventBus);
    });

    afterEach(() => {
      // @ts-expect-error - limpieza del mock de soporte táctil
      delete window.ontouchstart;
    });

    it('isMouseButtonDown refleja el estado del botón', () => {
      target.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
      expect(manager.isMouseButtonDown(0)).toBe(true);

      target.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));
      expect(manager.isMouseButtonDown(0)).toBe(false);
    });

    it('getMousePosition se actualiza con mousemove', () => {
      target.dispatchEvent(new MouseEvent('mousemove', { offsetX: 100, offsetY: 50 } as any));
      const pos = manager.getMousePosition();
      expect(pos.x).toBe(100);
      expect(pos.y).toBe(50);
    });

    it('NO sintetiza eventos touch cuando el dispositivo ya tiene soporte táctil real', () => {
      const touchEvents: any[] = [];
      eventBus.on(InputEvents.TouchStart, (p) => touchEvents.push(p));

      target.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));

      expect(touchEvents).toHaveLength(0);
      expect(manager.getActiveTouches()).toHaveLength(0);
    });
  });

  describe('síntesis de touch desde mouse (dispositivo SIN soporte táctil)', () => {
    beforeEach(() => {
      manager = new InputManager(target, eventBus);
    });

    it('mousedown sintetiza input:touch-start con id: 0', () => {
      const touchEvents: any[] = [];
      eventBus.on(InputEvents.TouchStart, (p) => touchEvents.push(p));

      target.dispatchEvent(new MouseEvent('mousedown', { button: 0, offsetX: 10, offsetY: 20 } as any));

      expect(touchEvents).toHaveLength(1);
      expect(touchEvents[0].touchId).toBe(0);
      expect(manager.getTouch(0)).toBeDefined();
    });

    it('mousemove con botón presionado sintetiza input:touch-move con delta correcto', () => {
      target.dispatchEvent(new MouseEvent('mousedown', { button: 0, offsetX: 10, offsetY: 10 } as any));

      const moveEvents: any[] = [];
      eventBus.on(InputEvents.TouchMove, (p) => moveEvents.push(p));

      target.dispatchEvent(new MouseEvent('mousemove', { offsetX: 15, offsetY: 12 } as any));

      expect(moveEvents).toHaveLength(1);
      expect(moveEvents[0].delta).toEqual({ x: 5, y: 2 });
    });

    it('mousemove SIN botón presionado no sintetiza touch-move', () => {
      const moveEvents: any[] = [];
      eventBus.on(InputEvents.TouchMove, (p) => moveEvents.push(p));

      target.dispatchEvent(new MouseEvent('mousemove', { offsetX: 15, offsetY: 12 } as any));

      expect(moveEvents).toHaveLength(0);
    });

    it('mouseup sintetiza input:touch-end y limpia el touch activo', () => {
      target.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));
      expect(manager.getActiveTouches()).toHaveLength(1);

      const endEvents: any[] = [];
      eventBus.on(InputEvents.TouchEnd, (p) => endEvents.push(p));

      target.dispatchEvent(new MouseEvent('mouseup', { button: 0 }));

      expect(endEvents).toHaveLength(1);
      expect(manager.getActiveTouches()).toHaveLength(0);
    });

    it('isMouseButtonDown sigue funcionando en paralelo a la síntesis (no se "apaga")', () => {
      target.dispatchEvent(new MouseEvent('mousedown', { button: 0 }));

      expect(manager.isMouseButtonDown(0)).toBe(true);
      expect(manager.getTouch(0)).toBeDefined();
    });
  });

  describe('touch real: getActiveTouches / getTouch / multi-touch', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'ontouchstart', { value: () => {}, configurable: true });
      manager = new InputManager(target, eventBus);
    });

    afterEach(() => {
      // @ts-expect-error - limpieza del mock de soporte táctil
      delete window.ontouchstart;
    });

    it('touchstart agrega un touch a getActiveTouches con su id real y emite input:touch-start', () => {
      const startEvents: any[] = [];
      eventBus.on(InputEvents.TouchStart, (p) => startEvents.push(p));

      target.dispatchEvent(makeTouchEvent('touchstart', [{ identifier: 5, clientX: 100, clientY: 200 }]));

      const touches = manager.getActiveTouches();
      expect(touches).toHaveLength(1);
      expect(touches[0].id).toBe(5);
      expect(touches[0].position).toEqual({ x: 100, y: 200 });
      expect(startEvents).toEqual([{ touchId: 5, position: { x: 100, y: 200 } }]);
    });

    it('multi-touch: dos dedos simultáneos se trackean con ids independientes', () => {
      target.dispatchEvent(makeTouchEvent('touchstart', [
        { identifier: 1, clientX: 50, clientY: 50 },
        { identifier: 2, clientX: 200, clientY: 200 },
      ]));

      expect(manager.getActiveTouches()).toHaveLength(2);
      expect(manager.getTouch(1)).toBeDefined();
      expect(manager.getTouch(2)).toBeDefined();
      expect(manager.getTouch(1)!.position).toEqual({ x: 50, y: 50 });
      expect(manager.getTouch(2)!.position).toEqual({ x: 200, y: 200 });
    });

    it('touchmove actualiza position y delta SOLO del touch correspondiente', () => {
      target.dispatchEvent(makeTouchEvent('touchstart', [
        { identifier: 1, clientX: 50, clientY: 50 },
        { identifier: 2, clientX: 200, clientY: 200 },
      ]));

      target.dispatchEvent(makeTouchEvent('touchmove', [{ identifier: 1, clientX: 60, clientY: 55 }]));

      const touch1 = manager.getTouch(1)!;
      const touch2 = manager.getTouch(2)!;
      expect(touch1.position).toEqual({ x: 60, y: 55 });
      expect(touch1.delta).toEqual({ x: 10, y: 5 });
      expect(touch2.position).toEqual({ x: 200, y: 200 }); // sin cambios
      expect(touch2.delta).toEqual({ x: 0, y: 0 });
    });

    it('touchmove de un id no reconocido se ignora sin lanzar error', () => {
      expect(() => {
        target.dispatchEvent(makeTouchEvent('touchmove', [{ identifier: 999, clientX: 1, clientY: 1 }]));
      }).not.toThrow();
      expect(manager.getActiveTouches()).toHaveLength(0);
    });

    it('touchend elimina el touch de getActiveTouches y emite input:touch-end', () => {
      target.dispatchEvent(makeTouchEvent('touchstart', [{ identifier: 7, clientX: 10, clientY: 10 }]));

      const endEvents: any[] = [];
      eventBus.on(InputEvents.TouchEnd, (p) => endEvents.push(p));

      target.dispatchEvent(makeTouchEvent('touchend', [{ identifier: 7, clientX: 10, clientY: 10 }]));

      expect(endEvents).toEqual([{ touchId: 7, position: { x: 10, y: 10 } }]);
      expect(manager.getActiveTouches()).toHaveLength(0);
      expect(manager.getTouch(7)).toBeUndefined();
    });

    it('touchcancel se comporta exactamente igual que touchend (sin touches fantasma)', () => {
      target.dispatchEvent(makeTouchEvent('touchstart', [{ identifier: 3, clientX: 0, clientY: 0 }]));
      expect(manager.getActiveTouches()).toHaveLength(1);

      const endEvents: any[] = [];
      eventBus.on(InputEvents.TouchEnd, (p) => endEvents.push(p));

      target.dispatchEvent(makeTouchEvent('touchcancel', [{ identifier: 3, clientX: 0, clientY: 0 }]));

      expect(endEvents).toHaveLength(1); // mismo evento que touchend
      expect(manager.getActiveTouches()).toHaveLength(0);
    });

    it('llama preventDefault en touchstart/move/end/cancel para bloquear scroll/zoom nativo', () => {
      const startEvent = makeTouchEvent('touchstart', [{ identifier: 1, clientX: 0, clientY: 0 }]);
      const preventDefaultSpy = vi.spyOn(startEvent, 'preventDefault');
      target.dispatchEvent(startEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('reclamo exclusivo de touch: claimTouch / releaseTouch', () => {
    beforeEach(() => {
      Object.defineProperty(window, 'ontouchstart', { value: () => {}, configurable: true });
      manager = new InputManager(target, eventBus);
    });

    afterEach(() => {
      // @ts-expect-error - limpieza del mock de soporte táctil
      delete window.ontouchstart;
    });

    it('claimTouch devuelve true la primera vez, false si ya estaba reclamado', () => {
      expect(manager.claimTouch(1)).toBe(true);
      expect(manager.claimTouch(1)).toBe(false); // ya tomado
    });

    it('releaseTouch libera el id para que pueda reclamarse de nuevo', () => {
      manager.claimTouch(1);
      manager.releaseTouch(1);
      expect(manager.claimTouch(1)).toBe(true);
    });

    it('releaseTouch es no-op seguro si el id nunca fue reclamado', () => {
      expect(() => manager.releaseTouch(999)).not.toThrow();
    });

    it('touchend/touchcancel liberan automáticamente el reclamo del id', () => {
      target.dispatchEvent(makeTouchEvent('touchstart', [{ identifier: 4, clientX: 0, clientY: 0 }]));
      manager.claimTouch(4);
      expect(manager.claimTouch(4)).toBe(false); // confirmamos que estaba tomado

      target.dispatchEvent(makeTouchEvent('touchend', [{ identifier: 4, clientX: 0, clientY: 0 }]));

      expect(manager.claimTouch(4)).toBe(true); // se liberó solo, sin llamar releaseTouch
    });
  });

  describe('update()', () => {
    beforeEach(() => {
      manager = new InputManager(target, eventBus);
    });

    it('limpia isKeyPressed/isKeyReleased pero preserva isKeyDown', () => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
      manager.update();

      expect(manager.isKeyPressed('x')).toBe(false);
      expect(manager.isKeyDown('x')).toBe(true);
    });

    it('resetea el delta de touches activos a cero', () => {
      target.dispatchEvent(new MouseEvent('mousedown', { button: 0, offsetX: 0, offsetY: 0 } as any));
      target.dispatchEvent(new MouseEvent('mousemove', { offsetX: 5, offsetY: 5 } as any));

      expect(manager.getTouch(0)!.delta).toEqual({ x: 5, y: 5 });

      manager.update();

      expect(manager.getTouch(0)!.delta).toEqual({ x: 0, y: 0 });
    });
  });
});
