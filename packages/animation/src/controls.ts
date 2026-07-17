import type { World, EntityId } from '@mochigo/ecs';
import { Animator } from './Animator';

export function playAnimation(
  world: World,
  entity: EntityId,
  clipName: string,
  restart: boolean = true
): void {
  const animator = world.getComponent(entity, Animator);
  if (!animator) return;
  if (!animator.clips.has(clipName)) return;

  // Ya es el clip activo y no se pidió reinicio explícito: no-op,
  // tal como pide la checklist de la ficha.
  if (animator.currentClip === clipName && animator.playing && !restart) {
    return;
  }

  animator.currentClip = clipName;
  animator.currentFrameIndex = 0;
  animator.elapsedInFrame = 0;
  animator.pingPongForward = true;
  animator.playing = true;
}

export function stopAnimation(world: World, entity: EntityId): void {
  const animator = world.getComponent(entity, Animator);
  if (!animator) return;

  animator.playing = false;
  animator.currentFrameIndex = 0;
  animator.elapsedInFrame = 0;
}

export function pauseAnimation(world: World, entity: EntityId): void {
  const animator = world.getComponent(entity, Animator);
  if (!animator) return;

  animator.playing = false;
  // A diferencia de stop, pause NO resetea frame/tiempo — se reanuda
  // desde donde quedó si algo vuelve a poner playing = true.
}
