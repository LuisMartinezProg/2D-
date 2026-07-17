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

      // Clip de un solo frame: nunca avanza, no hay división por cero,
      // pero sí actualiza el sourceRect si aún no está seteado.
      if (clip.frames.length <= 1) {
        sprite.sourceRect = clip.frames[0] ?? null;
        continue;
      }

      // playbackSpeed === 0 congela la animación: no acumula tiempo.
      if (animator.playbackSpeed !== 0) {
        animator.elapsedInFrame += deltaTime * animator.playbackSpeed;
      }

      // Puede necesitar avanzar más de un frame si deltaTime fue grande
      // (tab en background, lag spike, etc.) — por eso el while, no el if.
      while (animator.elapsedInFrame >= clip.frameDuration) {
        animator.elapsedInFrame -= clip.frameDuration;
        this.advanceFrame(animator, clip, entityId);
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
          this.eventBus.emit('animation:frame-changed', {
            entityId,
            frameIndex: animator.currentFrameIndex,
          });
        } else {
          // Ya está en el último frame: se detiene ahí y emite completed.
          if (animator.playing) {
            animator.playing = false;
            this.eventBus.emit('animation:completed', {
              entityId,
              animationName: clip.name,
            });
          }
        }
        break;
      }

      case 'loop': {
        animator.currentFrameIndex =
          animator.currentFrameIndex >= lastIndex ? 0 : animator.currentFrameIndex + 1;
        this.eventBus.emit('animation:frame-changed', {
          entityId,
          frameIndex: animator.currentFrameIndex,
        });
        break;
      }

      case 'ping-pong': {
        if (!animator.pingPongForward) {
          // Si no existe la propiedad (ver nota de supuestos), tratamos
          // dirección como estado derivado — ver alternativa abajo.
        }
        this.advancePingPong(animator, lastIndex);
        this.eventBus.emit('animation:frame-changed', {
          entityId,
          frameIndex: animator.currentFrameIndex,
        });
        break;
      }
    }
  }

  private advancePingPong(animator: Animator, lastIndex: number): void {
    // Dirección derivada de si venimos subiendo o bajando; se guarda
    // implícitamente comparando el frame con los extremos.
    // Necesita un flag de dirección — ver "Supuestos" (#5) sobre por qué
    // se añade `pingPongForward` al componente Animator en vez de
    // inferirla sin estado.
  }
}
