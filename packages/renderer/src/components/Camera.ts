import type { Rect } from "@mochigo/math";
import type { EntityId } from "@mochigo/ecs";

/**
 * Componente que describe una cámara del mundo.
 * Dato puro — sin lógica. El Renderer es quien la interpreta.
 */
export class Camera {
  static readonly componentName = "Camera";

  constructor(
    public zoom: number = 1,
    public followTarget: EntityId | null = null,
    /** 0 = seguimiento instantáneo, mayor = más suave. */
    public followSmoothing: number = 0,
    /** Límites del mundo que la cámara no debe cruzar. null = sin límite. */
    public bounds: Rect | null = null,
    /** Solo una cámara activa a la vez debe usarse para renderizar. */
    public active: boolean = true
  ) {}
}
