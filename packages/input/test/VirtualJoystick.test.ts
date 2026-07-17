import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventBus } from '@mochigo/events';
import { InputManager } from '../src/InputManager';
import { VirtualJoystick } from '../src/VirtualJoystick';
import type { VirtualJoystickConfig } from '../src/types';

function makeTouchEvent(
  type: 'touchstart' | 'touchmove' | 'touchend',
  touches: Array<{ identifier: number; clientX: number; clientY: number }>
): TouchEvent {
  const event = new Event(type, { cancelable: true });
  return Object.assign(event, { changedTouches: touches }) as unknown as TouchEvent;
}

describe('VirtualJoystick', () => {
  let target: HTMLElement;
  let eventBus: EventBus;
  let manager: InputManager;

  const leftRegion: VirtualJoystickConfig = {
    region: { x: 0, y: 0, width: 200, height: 600 },
    deadZone: 0.1,
    maxRadius: 50,
  };

  const rightRegion: VirtualJoystickConfig = {
    region: { x: 600, y: 0, width: 200, height: 600 },
    deadZone: 0.1,
    maxRadius: 50,
  };

  beforeEach(() => {
    target = document.createElement('div');
    document.body.appendChild(target);
    target.getBoundingClientRect = vi.fn(() => ({
      left: 0, top: 0, right: 800, bottom: 600,
      width: 800, height: 600, x: 0, y: 0, toJSON: () => {},
    }));
    Object.defineProperty(window, 'ontouchstart', { value: () => {}, configurable: true });
    eventBus = new EventBus();
    manager = new InputManager(target, eventBus);
  });

  afterEach(() => {
    manager.destroy();
    document.body.removeChild(target);
    // @ts-expect-error - limpieza del mock de soporte táctil
    delete window.ontouchstart;
  });

  it('touch dentro de la región activa el joystick', () => {
    const joystick = new VirtualJoystick(leftRegion, manager);

    target.dispatchEvent(makeTouchEvent('touchstart', [{ identifier: 1, clientX: 100, clientY: 300 }]));
    joystick.getDirection(); // fuerza el intento de reclamo

    expect(joystick.isActive()).toBe(true);
  });

  it('touch fuera de la región lo ignora (no lo activa)', () => {
    const joystick = new VirtualJoystick(leftRegion, manager);

    // 700 está en la región derecha, no en leftRegion (0-200)
    target.dispatchEvent(makeTouchEvent('touchstart', [{ identifier: 1, clientX: 700, clientY: 300 }]));
    joystick.getDirection();

    expect(joystick.isActive()).toBe(false);
    expect(joystick.getDirection()).toEqual({ x: 0, y: 0 });
  });

  it('un segundo touch mientras el primero sigue activo no lo "roba"', () => {
    const joystick = new VirtualJoystick(leftRegion, manager);

    target.dispatchEvent(makeTouchEvent('touchstart', [{ identifier: 1, clientX: 100, clientY: 300 }]));
    joystick.getDirection();
    expect(joystick.isActive()).toBe(true);

    // Segundo touch, también dentro de la MISMA región.
    target.dispatchEvent(makeTouchEvent('touchstart', [{ identifier: 2, clientX: 110, clientY: 310 }]));
    joystick.getDirection();

    // El joystick sigue atado al touch 1, el original, no se lo robó el 2.
    expect(manager.getTouch(1)).toBeDefined();
  });

  it('dos joysticks distintos no se roban touches entre sí (regiones separadas)', () => {
    const leftStick = new VirtualJoystick(leftRegion, manager);
    const rightStick = new VirtualJoystick(rightRegion, manager);

    target.dispatchEvent(makeTouchEvent('touchstart', [
      { identifier: 1, clientX: 100, clientY: 300 }, // dentro de leftRegion
      { identifier: 2, clientX: 700, clientY: 300 }, // dentro de rightRegion
    ]));

    leftStick.getDirection();
    rightStick.getDirection();

    expect(leftStick.isActive()).toBe(true);
    expect(rightStick.isActive()).toBe(true);
  });

  it('al soltar el touch, isActive vuelve a false y libera el reclamo', () => {
    const joystick = new VirtualJoystick(leftRegion, manager);

    target.dispatchEvent(makeTouchEvent('touchstart', [{ identifier: 1, clientX: 100, clientY: 300 }]));
    joystick.getDirection();
    expect(joystick.isActive()).toBe(true);

    target.dispatchEvent(makeTouchEvent('touchend', [{ identifier: 1, clientX: 100, clientY: 300 }]));
    joystick.getDirection(); // fuerza a notar que el touch ya no existe

    expect(joystick.isActive()).toBe(false);
    expect(manager.claimTouch(1)).toBe(true); // el id quedó libre de verdad
  });

  it('getDirection respeta la deadZone: dentro de ella devuelve Vector2.zero()', () => {
    const joystick = new VirtualJoystick(leftRegion, manager);

    target.dispatchEvent(makeTouchEvent('touchstart', [{ identifier: 1, clientX: 100, clientY: 300 }]));
    // deadZone 0.1 * maxRadius 50 = 5px. Nos movemos solo 2px: sigue dentro.
    target.dispatchEvent(makeTouchEvent('touchmove', [{ identifier: 1, clientX: 102, clientY: 300 }]));

    expect(joystick.getDirection()).toEqual({ x: 0, y: 0 });
  });

  it('getDirection fuera de la deadZone devuelve dirección normalizada proporcional', () => {
    const joystick = new VirtualJoystick(leftRegion, manager);

    target.dispatchEvent(makeTouchEvent('touchstart', [{ identifier: 1, clientX: 100, clientY: 300 }]));
    // Nos movemos 25px a la derecha (mitad de maxRadius=50): magnitud ~0.5
    target.dispatchEvent(makeTouchEvent('touchmove', [{ identifier: 1, clientX: 125, clientY: 300 }]));

    const dir = joystick.getDirection();
    expect(dir.x).toBeCloseTo(0.5, 1);
    expect(dir.y).toBeCloseTo(0, 5);
  });

  it('getDirection se clampea a magnitud 1 más allá de maxRadius', () => {
    const joystick = new VirtualJoystick(leftRegion, manager);

    target.dispatchEvent(makeTouchEvent('touchstart', [{ identifier: 1, clientX: 100, clientY: 300 }]));
    // Nos movemos 200px, muy por encima de maxRadius=50.
    target.dispatchEvent(makeTouchEvent('touchmove', [{ identifier: 1, clientX: 300, clientY: 300 }]));

    const dir = joystick.getDirection();
    const magnitude = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
    expect(magnitude).toBeCloseTo(1, 1);
  });

  it('isActive es false antes de cualquier touch', () => {
    const joystick = new VirtualJoystick(leftRegion, manager);
    expect(joystick.isActive()).toBe(false);
  });
});
