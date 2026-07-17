import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '@mochigo/ecs';
import { EventBus } from '@mochigo/events';
import { Sprite } from '@mochigo/renderer';
import type { Rect } from '@mochigo/math';
import { Animator, type AnimationClip } from '../src/Animator';
import { AnimationSystem } from '../src/AnimationSystem';
import { AnimationEvents } from '../src/AnimationEvents';
import { playAnimation, stopAnimation, pauseAnimation } from '../src/controls';

// Helper: rects distinguibles solo por su x, para poder aserts legibles
// del tipo "el frame activo es el rect con x=2" en vez de comparar objetos.
function frame(x: number): Rect {
  return { x, y: 0, width: 16, height: 16 };
}

function makeClip(overrides: Partial<AnimationClip> = {}): AnimationClip {
  return {
    name: 'test-clip',
    frames: [frame(0), frame(1), frame(2)],
    frameDuration: 0.1,
    loopMode: 'loop',
    ...overrides,
  };
}

describe('AnimationSystem', () => {
  let world: World;
  let eventBus: EventBus;
  let system: AnimationSystem;

  beforeEach(() => {
    world = new World();
    eventBus = new EventBus();
    system = new AnimationSystem(eventBus);
    world.addSystem(system);
  });

  function makeAnimatedEntity(clip: AnimationClip, clipName = 'test-clip') {
    const entity = world.createEntity();
    const clips = new Map([[clipName, clip]]);
    world.addComponent(entity, Animator, new Animator(clips, clipName, 0, 0, true, 1));
    world.addComponent(entity, Sprite, new Sprite('atlas', null));
    return entity;
  }

  describe('loopMode: "once"', () => {
    it('avanza frame por frame hasta el último y se detiene ahí', () => {
      const entity = makeAnimatedEntity(makeClip({ loopMode: 'once' }));

      world.update(0.1); // frame 0 -> 1
      expect(world.getComponent(entity, Animator)!.currentFrameIndex).toBe(1);

      world.update(0.1); // frame 1 -> 2 (último)
      const animator = world.getComponent(entity, Animator)!;
      expect(animator.currentFrameIndex).toBe(2);
      expect(animator.playing).toBe(true); // todavía no completó, recién llegó

      world.update(0.1); // ya en el último: se detiene, no hay frame 3
      const finalState = world.getComponent(entity, Animator)!;
      expect(finalState.currentFrameIndex).toBe(2); // se queda ahí
      expect(finalState.playing).toBe(false);
    });

    it('emite animation:completed exactamente una vez al llegar al final', () => {
      const entity = makeAnimatedEntity(makeClip({ loopMode: 'once' }));
      const completedEvents: any[] = [];
      eventBus.on(AnimationEvents.Completed, (payload) => completedEvents.push(payload));

      world.update(0.1);
      world.update(0.1);
      world.update(0.1); // acá completa
      world.update(0.1); // ya no está playing: no debe volver a emitir

      expect(completedEvents).toHaveLength(1);
      expect(completedEvents[0]).toEqual({ entityId: entity, animationName: 'test-clip' });
    });

    it('caso borde: clip de un solo frame nunca avanza ni completa', () => {
      const entity = makeAnimatedEntity(
        makeClip({ loopMode: 'once', frames: [frame(0)] })
      );
      const completedEvents: any[] = [];
      eventBus.on(AnimationEvents.Completed, (p) => completedEvents.push(p));

      world.update(0.1);
      world.update(1.0); // deltaTime grande, no debería importar

      const animator = world.getComponent(entity, Animator)!;
      expect(animator.currentFrameIndex).toBe(0);
      expect(animator.playing).toBe(true); // nunca "completa": nunca avanzó
      expect(completedEvents).toHaveLength(0);

      const sprite = world.getComponent(entity, Sprite)!;
      expect(sprite.sourceRect).toEqual(frame(0)); // sourceRect sí se setea
    });
  });

  describe('loopMode: "loop"', () => {
    it('vuelve al frame 0 después del último y sigue indefinidamente', () => {
      const entity = makeAnimatedEntity(makeClip({ loopMode: 'loop' }));

      world.update(0.1); // 0 -> 1
      world.update(0.1); // 1 -> 2
      world.update(0.1); // 2 -> 0 (loop)
      expect(world.getComponent(entity, Animator)!.currentFrameIndex).toBe(0);

      world.update(0.1); // 0 -> 1 de nuevo, no se traba
      expect(world.getComponent(entity, Animator)!.currentFrameIndex).toBe(1);
    });

    it('nunca emite animation:completed', () => {
      const entity = makeAnimatedEntity(makeClip({ loopMode: 'loop' }));
      const completedEvents: any[] = [];
      eventBus.on(AnimationEvents.Completed, (p) => completedEvents.push(p));

      for (let i = 0; i < 10; i++) world.update(0.1);

      expect(completedEvents).toHaveLength(0);
    });

    it('caso borde: clip de un solo frame en loop se queda quieto sin trabarse', () => {
      const entity = makeAnimatedEntity(
        makeClip({ loopMode: 'loop', frames: [frame(5)] })
      );

      world.update(0.1);
      world.update(0.1);

      const animator = world.getComponent(entity, Animator)!;
      expect(animator.currentFrameIndex).toBe(0);
      const sprite = world.getComponent(entity, Sprite)!;
      expect(sprite.sourceRect).toEqual(frame(5));
    });
  });

  describe('loopMode: "ping-pong"', () => {
    it('avanza hasta el final, rebota, y retrocede hasta el frame 0', () => {
      const entity = makeAnimatedEntity(makeClip({ loopMode: 'ping-pong' }));
      const indices: number[] = [];
      const readIndex = () => world.getComponent(entity, Animator)!.currentFrameIndex;

      for (let i = 0; i < 6; i++) {
        world.update(0.1);
        indices.push(readIndex());
      }

      // frames: 0(inicio) -> 1 -> 2(tope, rebota) -> 1 -> 0(rebota) -> 1 -> 2
      expect(indices).toEqual([1, 2, 1, 0, 1, 2]);
    });

    it('nunca emite animation:completed, ni siquiera al tocar los extremos', () => {
      const entity = makeAnimatedEntity(makeClip({ loopMode: 'ping-pong' }));
      const completedEvents: any[] = [];
      eventBus.on(AnimationEvents.Completed, (p) => completedEvents.push(p));

      for (let i = 0; i < 20; i++) world.update(0.1); // varios rebotes de sobra

      expect(completedEvents).toHaveLength(0);
    });

    it('caso borde: clip de un solo frame en ping-pong no intenta rebotar', () => {
      const entity = makeAnimatedEntity(
        makeClip({ loopMode: 'ping-pong', frames: [frame(9)] })
      );

      expect(() => {
        world.update(0.1);
        world.update(0.1);
      }).not.toThrow();

      expect(world.getComponent(entity, Animator)!.currentFrameIndex).toBe(0);
    });

    it('playAnimation resetea pingPongForward a true al reiniciar', () => {
      const entity = makeAnimatedEntity(makeClip({ loopMode: 'ping-pong' }));

      // Lo llevamos a mitad del rebote de retroceso.
      world.update(0.1); // -> 1, forward
      world.update(0.1); // -> 2, rebota a forward=false
      world.update(0.1); // -> 1, forward=false

      expect(world.getComponent(entity, Animator)!.pingPongForward).toBe(false);

      playAnimation(world, entity, 'test-clip', true);

      const animator = world.getComponent(entity, Animator)!;
      expect(animator.pingPongForward).toBe(true);
      expect(animator.currentFrameIndex).toBe(0);
    });
  });

  describe('emisión de animation:frame-changed', () => {
    it('se emite cada vez que currentFrameIndex cambia, con el payload correcto', () => {
      const entity = makeAnimatedEntity(makeClip({ loopMode: 'loop' }));
      const frameChanges: any[] = [];
      eventBus.on(AnimationEvents.FrameChanged, (p) => frameChanges.push(p));

      world.update(0.1);
      world.update(0.1);

      expect(frameChanges).toEqual([
        { entityId: entity, frameIndex: 1 },
        { entityId: entity, frameIndex: 2 },
      ]);
    });

    it('NO se emite si todavía no pasó frameDuration', () => {
      const entity = makeAnimatedEntity(makeClip({ loopMode: 'loop', frameDuration: 1.0 }));
      const frameChanges: any[] = [];
      eventBus.on(AnimationEvents.FrameChanged, (p) => frameChanges.push(p));

      world.update(0.1); // muy poco, no llega a 1.0

      expect(frameChanges).toHaveLength(0);
    });
  });

  describe('cambio de clip a mitad de animación', () => {
    it('reinicia currentFrameIndex y elapsedInFrame al cambiar de clip', () => {
      const entity = world.createEntity();
      const clipA = makeClip({ name: 'A', frameDuration: 0.1 });
      const clipB = makeClip({ name: 'B', frames: [frame(10), frame(11)], frameDuration: 0.5 });
      const clips = new Map([['A', clipA], ['B', clipB]]);
      world.addComponent(entity, Animator, new Animator(clips, 'A', 0, 0, true, 1));
      world.addComponent(entity, Sprite, new Sprite('atlas', null));

      world.update(0.1); // avanza A a frame 1
      world.update(0.05); // acumula elapsedInFrame parcial

      let animator = world.getComponent(entity, Animator)!;
      expect(animator.currentFrameIndex).toBe(1);
      expect(animator.elapsedInFrame).toBeGreaterThan(0);

      playAnimation(world, entity, 'B');

      animator = world.getComponent(entity, Animator)!;
      expect(animator.currentClip).toBe('B');
      expect(animator.currentFrameIndex).toBe(0);
      expect(animator.elapsedInFrame).toBe(0);
    });
  });

  describe('playbackSpeed', () => {
    it('con playbackSpeed = 2, avanza los frames al doble de velocidad', () => {
      const entity = makeAnimatedEntity(makeClip({ loopMode: 'loop', frameDuration: 0.1 }));
      world.getComponent(entity, Animator)!.playbackSpeed = 2;

      world.update(0.05); // 0.05 * 2 = 0.1 efectivo -> avanza un frame completo

      expect(world.getComponent(entity, Animator)!.currentFrameIndex).toBe(1);
    });

    it('con playbackSpeed = 0, la animación se congela sin dividir por cero', () => {
      const entity = makeAnimatedEntity(makeClip({ loopMode: 'loop', frameDuration: 0.1 }));
      world.getComponent(entity, Animator)!.playbackSpeed = 0;

      expect(() => {
        world.update(0.1);
        world.update(1.0);
        world.update(100);
      }).not.toThrow();

      const animator = world.getComponent(entity, Animator)!;
      expect(animator.currentFrameIndex).toBe(0);
      expect(animator.elapsedInFrame).toBe(0);
      expect(Number.isFinite(animator.elapsedInFrame)).toBe(true);
    });
  });

  describe('deltaTime grande (lag spike)', () => {
    it('avanza múltiples frames en un solo update si el tiempo acumulado lo amerita', () => {
      const entity = makeAnimatedEntity(makeClip({ loopMode: 'loop', frameDuration: 0.1 }));

      world.update(0.35); // deberían pasar 3 frames completos: 0->1->2->0, sobra 0.05

      const animator = world.getComponent(entity, Animator)!;
      expect(animator.currentFrameIndex).toBe(0);
      expect(animator.elapsedInFrame).toBeCloseTo(0.05, 5);
    });

    it('en modo "once", un deltaTime enorme no sigue consumiendo tiempo tras completar', () => {
      const entity = makeAnimatedEntity(makeClip({ loopMode: 'once', frameDuration: 0.1 }));

      world.update(10); // tiempo absurdo, de sobra para completar

      const animator = world.getComponent(entity, Animator)!;
      expect(animator.currentFrameIndex).toBe(2); // último frame, no más
      expect(animator.playing).toBe(false);
    });
  });

  describe('entidades sin Animator o sin Sprite', () => {
    it('ignora entidades con Animator pero sin Sprite', () => {
      const entity = world.createEntity();
      const clips = new Map([['test-clip', makeClip()]]);
      world.addComponent(entity, Animator, new Animator(clips, 'test-clip', 0, 0, true, 1));
      // sin Sprite

      expect(() => world.update(0.1)).not.toThrow();
    });

    it('no afecta entidades con Sprite pero sin Animator', () => {
      const entity = world.createEntity();
      world.addComponent(entity, Sprite, new Sprite('atlas', frame(3)));

      world.update(0.1);

      expect(world.getComponent(entity, Sprite)!.sourceRect).toEqual(frame(3));
    });

    it('no hace nada si Animator.playing es false', () => {
      const entity = makeAnimatedEntity(makeClip());
      world.getComponent(entity, Animator)!.playing = false;

      world.update(0.1);

      expect(world.getComponent(entity, Animator)!.currentFrameIndex).toBe(0);
    });

    it('no hace nada si currentClip es null', () => {
      const entity = world.createEntity();
      world.addComponent(entity, Animator, new Animator(new Map(), null, 0, 0, true, 1));
      world.addComponent(entity, Sprite, new Sprite('atlas', null));

      expect(() => world.update(0.1)).not.toThrow();
    });
  });
});
