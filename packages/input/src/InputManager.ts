import { Vector2 } from '@mochigo/math';
import { EventBus } from '@mochigo/events';
import type { TouchPoint } from './types';
import { InputEvents } from './InputEvents';

/**
 * Detección de soporte táctil real del dispositivo (no del navegador -
 * un desktop con Chrome DevTools en modo touch simulation también podría
 * reportar 'ontouchstart' in window, pero eso es aceptable: si el propio
 * navegador dice que soporta touch, confiamos en esa señal).
 */
function deviceSupportsTouch(): boolean {
  return typeof window !== 'undefined' && 'ontouchstart' in window;
}

export class InputManager {
  private keysDown = new Set<string>();
  private keysPressedThisFrame = new Set<string>();
  private keysReleasedThisFrame = new Set<string>();

  private mouseButtonsDown = new Set<number>();
  private mousePosition = new Vector2(0, 0);

  private activeTouches = new Map<number, TouchPoint>();

  // true si este dispositivo NO soporta touch nativo, y por lo tanto el
  // mouse debe sintetizar eventos touch (ver sección 4 de la ficha).
  private readonly syntheticTouchFromMouse: boolean;

  // id fijo reservado para el touch sintetizado desde mouse, según la
  // ficha ("mousedown -> input:touch-start con id: 0"). Si el dispositivo
  // SÍ tiene touch real, este id nunca se usa para evitar colisión con
  // ids reales del sistema operativo.
  private static readonly SYNTHETIC_TOUCH_ID = 0;

  // ── Reclamo exclusivo de touch (usado por VirtualJoystick u otros
  // consumidores que necesiten "dueño único" de un touch id) ──
  private claimedTouchIds = new Set<number>();

  constructor(
    private readonly targetElement: HTMLElement,
    private readonly eventBus: EventBus
  ) {
    this.syntheticTouchFromMouse = !deviceSupportsTouch();
    this.registerListeners();
  }

  // ── Teclado ──────────────────────────────────────────────

  isKeyDown(key: string): boolean {
    return this.keysDown.has(key);
  }

  isKeyPressed(key: string): boolean {
    return this.keysPressedThisFrame.has(key);
  }

  isKeyReleased(key: string): boolean {
    return this.keysReleasedThisFrame.has(key);
  }

  // ── Mouse ────────────────────────────────────────────────

  getMousePosition(): Vector2 {
    return this.mousePosition;
  }

  isMouseButtonDown(button: number): boolean {
    return this.mouseButtonsDown.has(button);
  }

  // ── Touch ────────────────────────────────────────────────

  getActiveTouches(): TouchPoint[] {
    return Array.from(this.activeTouches.values());
  }

  getTouch(id: number): TouchPoint | undefined {
    return this.activeTouches.get(id);
  }

  /** true si logró reclamarlo (no estaba tomado); false si ya era de otro. */
  claimTouch(id: number): boolean {
    if (this.claimedTouchIds.has(id)) return false;
    this.claimedTouchIds.add(id);
    return true;
  }

  /** No-op seguro si el id no estaba reclamado. */
  releaseTouch(id: number): void {
    this.claimedTouchIds.delete(id);
  }

  // ── Ciclo de frame ───────────────────────────────────────

  /**
   * Limpia los sets "solo este frame" y los deltas de touch acumulados.
   * Debe llamarse una sola vez por frame (ficha: "típicamente desde
   * onFixedUpdate del Game Loop"), DESPUÉS de que el código de gameplay
   * ya leyó isKeyPressed/isKeyReleased/delta de este frame — si se
   * llama antes, esas lecturas siempre darán false/zero.
   */
  update(): void {
    this.keysPressedThisFrame.clear();
    this.keysReleasedThisFrame.clear();

    for (const touch of this.activeTouches.values()) {
      touch.delta = Vector2.zero();
    }
  }

  /** Libera listeners del DOM. Llamar al destruir el InputManager. */
  destroy(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    this.targetElement.removeEventListener('mousedown', this.handleMouseDown);
    this.targetElement.removeEventListener('mousemove', this.handleMouseMove);
    this.targetElement.removeEventListener('mouseup', this.handleMouseUp);
    this.targetElement.removeEventListener('touchstart', this.handleTouchStart);
    this.targetElement.removeEventListener('touchmove', this.handleTouchMove);
    this.targetElement.removeEventListener('touchend', this.handleTouchEnd);
    this.targetElement.removeEventListener('touchcancel', this.handleTouchCancel);
  }

  // ── Registro de listeners ───────────────────────────────

  private registerListeners(): void {
    // Nota: keydown/keyup se registran en window, no en targetElement,
    // porque un HTMLElement arbitrario (ej. un <canvas>) no recibe foco
    // de teclado a menos que tenga tabindex explícito - atar el juego a
    // ese requisito sería una sorpresa desagradable para quien use el motor.
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);

    this.targetElement.addEventListener('mousedown', this.handleMouseDown);
    this.targetElement.addEventListener('mousemove', this.handleMouseMove);
    this.targetElement.addEventListener('mouseup', this.handleMouseUp);

    this.targetElement.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    this.targetElement.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.targetElement.addEventListener('touchend', this.handleTouchEnd, { passive: false });
    this.targetElement.addEventListener('touchcancel', this.handleTouchCancel, { passive: false });
  }

  // ── Handlers de teclado ──────────────────────────────────

  private handleKeyDown = (e: KeyboardEvent): void => {
    // e.repeat: el navegador dispara keydown repetidamente mientras se
    // mantiene la tecla. Sin este filtro, isKeyPressed() (que debe ser
    // true SOLO en el frame exacto de la presión inicial) daría true en
    // cada repetición del sistema operativo, no solo la primera vez.
    if (e.repeat) return;

    this.keysDown.add(e.key);
    this.keysPressedThisFrame.add(e.key);
    this.eventBus.emit(InputEvents.KeyDown, { key: e.key });
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    this.keysDown.delete(e.key);
    this.keysReleasedThisFrame.add(e.key);
    this.eventBus.emit(InputEvents.KeyUp, { key: e.key });
  };

  // ── Handlers de mouse (+ síntesis de touch si aplica) ────

  private handleMouseDown = (e: MouseEvent): void => {
    this.mouseButtonsDown.add(e.button);
    this.mousePosition = new Vector2(e.offsetX, e.offsetY);

    if (this.syntheticTouchFromMouse) {
      this.startSyntheticTouch(this.mousePosition);
    }
  };

  private handleMouseMove = (e: MouseEvent): void => {
    this.mousePosition = new Vector2(e.offsetX, e.offsetY);

    // Solo sintetiza touch-move si el botón sigue presionado, igual que
    // un touch real solo se mueve mientras el dedo sigue en pantalla.
    if (this.syntheticTouchFromMouse && this.mouseButtonsDown.size > 0) {
      this.moveSyntheticTouch(this.mousePosition);
    }
  };

  private handleMouseUp = (e: MouseEvent): void => {
    this.mouseButtonsDown.delete(e.button);

    if (this.syntheticTouchFromMouse) {
      this.endSyntheticTouch();
    }
  };

  private startSyntheticTouch(position: Vector2): void {
    const id = InputManager.SYNTHETIC_TOUCH_ID;
    const touch: TouchPoint = {
      id,
      position,
      startPosition: position,
      delta: Vector2.zero(),
    };
    this.activeTouches.set(id, touch);
    this.eventBus.emit(InputEvents.TouchStart, { touchId: id, position });
  }

  private moveSyntheticTouch(position: Vector2): void {
    const id = InputManager.SYNTHETIC_TOUCH_ID;
    const touch = this.activeTouches.get(id);
    if (!touch) return;

    const delta = new Vector2(position.x - touch.position.x, position.y - touch.position.y);
    touch.position = position;
    touch.delta = delta;
    this.eventBus.emit(InputEvents.TouchMove, { touchId: id, position, delta });
  }

  private endSyntheticTouch(): void {
    const id = InputManager.SYNTHETIC_TOUCH_ID;
    const touch = this.activeTouches.get(id);
    if (!touch) return;

    this.activeTouches.delete(id);
    this.claimedTouchIds.delete(id);
    this.eventBus.emit(InputEvents.TouchEnd, { touchId: id, position: touch.position });
  }

  // ── Handlers de touch real ───────────────────────────────

  private handleTouchStart = (e: TouchEvent): void => {
    e.preventDefault(); // evita scroll/zoom del navegador (checklist)

    const rect = this.targetElement.getBoundingClientRect();
    for (const t of Array.from(e.changedTouches)) {
      const position = new Vector2(t.clientX - rect.left, t.clientY - rect.top);
      const touch: TouchPoint = {
        id: t.identifier,
        position,
        startPosition: position,
        delta: Vector2.zero(),
      };
      this.activeTouches.set(t.identifier, touch);
      this.eventBus.emit(InputEvents.TouchStart, { touchId: t.identifier, position });
    }
  };

  private handleTouchMove = (e: TouchEvent): void => {
    e.preventDefault();

    const rect = this.targetElement.getBoundingClientRect();
    for (const t of Array.from(e.changedTouches)) {
      const existing = this.activeTouches.get(t.identifier);
      if (!existing) continue; // touch que no reconocemos, lo ignoramos

      const position = new Vector2(t.clientX - rect.left, t.clientY - rect.top);
      const delta = new Vector2(
        position.x - existing.position.x,
        position.y - existing.position.y
      );
      existing.position = position;
      existing.delta = delta;
      this.eventBus.emit(InputEvents.TouchMove, {
        touchId: t.identifier,
        position,
        delta,
      });
    }
  };

  private handleTouchEnd = (e: TouchEvent): void => {
    e.preventDefault();
    this.releaseTouches(e.changedTouches);
  };

  private handleTouchCancel = (e: TouchEvent): void => {
    // Checklist: touchcancel debe tratarse igual que touchend, para no
    // dejar touches "fantasma" activos (ej: el SO interrumpe el touch
    // con una notificación entrante).
    e.preventDefault();
    this.releaseTouches(e.changedTouches);
  };

  private releaseTouches(touchList: TouchList): void {
    for (const t of Array.from(touchList)) {
      const existing = this.activeTouches.get(t.identifier);
      if (!existing) continue;

      this.activeTouches.delete(t.identifier);
      this.claimedTouchIds.delete(t.identifier);
      this.eventBus.emit(InputEvents.TouchEnd, {
        touchId: t.identifier,
        position: existing.position,
      });
    }
  }
}
