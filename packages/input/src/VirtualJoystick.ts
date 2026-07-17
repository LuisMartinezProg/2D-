import { Vector2 } from '@mochigo/math';
import type { InputManager } from './InputManager';
import type { VirtualJoystickConfig } from './types';

/**
 * Reclama un touch id apenas empieza dentro de su región, e ignora todo
 * lo demás hasta que ese id se libera - así múltiples joysticks/botones
 * pueden coexistir en pantalla sin robarse touches entre sí (ficha,
 * sección 3).
 */
export class VirtualJoystick {
  private claimedTouchId: number | null = null;

  // Se congela en el momento de reclamar el touch: el "centro" del
  // joystick es donde el dedo TOCÓ primero, no el centro fijo de la
  // región - así el joystick puede aparecer donde el jugador puso el
  // dedo dentro de esa zona, el patrón estándar en móviles.
  private origin: Vector2 = Vector2.zero();

  constructor(
    private readonly config: VirtualJoystickConfig,
    private readonly inputManager: InputManager
  ) {}

  getDirection(): Vector2 {
    if (this.claimedTouchId === null) {
      this.tryClaimTouch();
    }

    if (this.claimedTouchId === null) {
      return Vector2.zero();
    }

    const touch = this.inputManager.getTouch(this.claimedTouchId);
    if (!touch) {
      // El touch terminó pero todavía no procesamos el release; nos
      // soltamos acá para no quedar "pegados" a un id muerto.
      this.claimedTouchId = null;
      return Vector2.zero();
    }

    const offsetX = touch.position.x - this.origin.x;
    const offsetY = touch.position.y - this.origin.y;
    const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);

    const deadZonePixels = this.config.deadZone * this.config.maxRadius;
    if (distance < deadZonePixels) {
      return Vector2.zero();
    }

    const clampedDistance = Math.min(distance, this.config.maxRadius);
    const magnitude = clampedDistance / this.config.maxRadius; // 0 a 1

    // Dirección normalizada * magnitud proporcional a qué tan lejos del
    // centro está el dedo (no un vector unitario puro): así un toque
    // apenas fuera de la deadZone da una dirección "débil", no un salto
    // brusco a magnitud 1.
    return new Vector2((offsetX / distance) * magnitude, (offsetY / distance) * magnitude);
  }

  isActive(): boolean {
    return this.claimedTouchId !== null && this.inputManager.getTouch(this.claimedTouchId) !== undefined;
  }

  private tryClaimTouch(): void {
    for (const touch of this.inputManager.getActiveTouches()) {
      if (this.isAlreadyClaimedElsewhere(touch.id)) continue;
      if (this.isInsideRegion(touch.startPosition)) {
        this.claimedTouchId = touch.id;
        this.origin = touch.startPosition;
        return;
      }
    }
  }

  private isAlreadyClaimedElsewhere(touchId: number): boolean {
    // Nota de diseño: esta clase no tiene forma de saber si OTRO
    // VirtualJoystick ya reclamó este id, porque cada instancia solo ve
    // InputManager (fuente de verdad de touches activos), no a sus
    // hermanas. Ver comentario extendido más abajo.
    return false;
  }

  private isInsideRegion(position: Vector2): boolean {
    const r = this.config.region;
    return (
      position.x >= r.x &&
      position.x <= r.x + r.width &&
      position.y >= r.y &&
      position.y <= r.y + r.height
    );
  }
}
