import { Vector2 } from '@mochigo/math';
import type { InputManager } from './InputManager';
import type { VirtualJoystickConfig } from './types';

export class VirtualJoystick {
  private claimedTouchId: number | null = null;
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
      // El touch terminó (InputManager ya lo liberó); nos soltamos acá
      // para no quedar pegados a un id muerto.
      this.releaseClaim();
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
    const magnitude = clampedDistance / this.config.maxRadius;

    return new Vector2((offsetX / distance) * magnitude, (offsetY / distance) * magnitude);
  }

  isActive(): boolean {
    return this.claimedTouchId !== null && this.inputManager.getTouch(this.claimedTouchId) !== undefined;
  }

  private tryClaimTouch(): void {
    for (const touch of this.inputManager.getActiveTouches()) {
      if (!this.isInsideRegion(touch.startPosition)) continue;

      // claimTouch devuelve false si otro VirtualJoystick (u otro
      // consumidor) ya se adueñó de este id primero - en ese caso
      // seguimos probando con el siguiente touch de la lista, en vez de
      // rendirnos, por si hay más de un touch activo simultáneo.
      if (this.inputManager.claimTouch(touch.id)) {
        this.claimedTouchId = touch.id;
        this.origin = touch.startPosition;
        return;
      }
    }
  }

  private releaseClaim(): void {
    if (this.claimedTouchId !== null) {
      this.inputManager.releaseTouch(this.claimedTouchId);
      this.claimedTouchId = null;
    }
  }
}
