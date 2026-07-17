import type { System, World, EntityId } from '@mochigo/ecs';
import type { EventBus } from '@mochigo/events';
import { Sprite } from '@mochigo/renderer';
import { Animator, type AnimationClip } from './Animator';

export class AnimationSystem implements System {
  readonly name = 'AnimationSystem';

  constructor(private eventBus: EventBus) {}

  update(world: World, deltaTime: number): void {
    const entities = world.query(Animator, Sprite);

    for (const entityId of entities) {
      const animator = world.getComponent(entityId, Animator);
      const sprite = world.getComponent(entityId, Sprite);

      if (!animator || !sprite) continue;
      if (!animator.playing || animator.currentClip === null) continue;

      const clip = animator.clips.get(animator.currentClip);
      if (!clip) continue;

      // Clip de un solo frame: nunca avanza, no hay división por cero.
      if (clip.frames.length <= 1) {
        sprite.sourceRect = clip.frames[0] ?? null;
        continue;
      }

      // playbackSpeed === 0 congela la animación: no acumula tiempo.
      if (animator.playbackSpeed !== 0) {
        animator.elapsedInFrame += deltaTime * animator.playbackSpeed;
      }

      // while, no if: si deltaTime fue grande (lag spike), puede
      // necesitar avanzar más de un frame en un solo update.
      while (animator.elapsedInFrame >= clip.frameDuration) {
        animator.elapsedInFrame -= clip.frameDuration;
        this.advanceFrame(animator, clip, entityId);

        // Si once() acaba de detenerse, no seguimos consumiendo el resto
        // del tiempo acumulado — ya llegamos al final.
        if (!animator.playing) break;
      }

      sprite.sourceRect = clip.frames[animator.currentFrameIndex];
    }
  }

  private advanceFrame(animator: Animator, clip: AnimationClip, entityId: EntityId): void {
    const lastIndex = clip.frames.length - 1;

    switch (clip.loopMode) {
      case 'once': {
        if (animator.currentFrameIndex < lastIndex) {
          animator.currentFrameIndex++;
          this.emitFrameChanged(entityId, animator.currentFrameIndex);
        } else {
          animator.playing = false;
          this.eventBus.emit('animation:completed', {
            entityId,
            animationName: clip.name,
          });
        }
        break;
      }

      case 'loop': {
        animator.currentFrameIndex =
          animator.currentFrameIndex >= lastIndex ? 0 : animator.currentFrameIndex + 1;
        this.emitFrameChanged(entityId, animator.currentFrameIndex);
        break;
      }

      case 'ping-pong': {
        if (animator.pingPongForward) {
          if (animator.currentFrameIndex < lastIndex) {
            animator.currentFrameIndex++;
          } else {
            // Llegó al final: rebota, empieza a retroceder.
            animator.pingPongForward = false;
            animator.currentFrameIndex--;
          }
        } else {
          if (animator.currentFrameIndex > 0) {
            animator.currentFrameIndex--;
          } else {
            // Llegó al inicio: rebota, vuelve a avanzar.
            animator.pingPongForward = true;
            animator.currentFrameIndex++;
          }
        }
        this.emitFrameChanged(entityId, animator.currentFrameIndex);
        break;
      }
    }
  }

  private emitFrameChanged(entityId: EntityId, frameIndex: number): void {
    this.eventBus.emit('animation:frame-changed', { entityId, frameIndex });
  }
}
