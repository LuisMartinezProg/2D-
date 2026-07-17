import type { System, World, EntityId } from '@mochigo/ecs';
import { EventBus } from '@mochigo/events';
import { Sprite } from '@mochigo/renderer';
import { Animator, type AnimationClip } from './Animator';
import { AnimationEvents } from './AnimationEvents';

export class AnimationSystem implements System {
  readonly name = 'AnimationSystem';

  constructor(private eventBus: EventBus) {}

  update(world: World, deltaTime: number): void {
    const results = world.query([Animator, Sprite]);

    for (const entityId of results) {
      const animator = world.getComponent(entityId, Animator);
      const sprite = world.getComponent(entityId, Sprite);

      if (!animator || !sprite) continue;
      if (!animator.playing || animator.currentClip === null) continue;

      const clip = animator.clips.get(animator.currentClip);
      if (!clip) continue;

      if (clip.frames.length <= 1) {
        sprite.sourceRect = clip.frames[0] ?? null;
        continue;
      }

      if (animator.playbackSpeed !== 0) {
        animator.elapsedInFrame += deltaTime * animator.playbackSpeed;
      }

      while (animator.elapsedInFrame >= clip.frameDuration) {
        animator.elapsedInFrame -= clip.frameDuration;
        this.advanceFrame(animator, clip, entityId);
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
          this.eventBus.emit(AnimationEvents.Completed, {
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
            animator.pingPongForward = false;
            animator.currentFrameIndex--;
          }
        } else {
          if (animator.currentFrameIndex > 0) {
            animator.currentFrameIndex--;
          } else {
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
    this.eventBus.emit(AnimationEvents.FrameChanged, { entityId, frameIndex });
  }
}
