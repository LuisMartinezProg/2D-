import { describe, it, expect, beforeEach } from 'vitest';
import { World } from '@mochigo/ecs';
import { Sprite } from '@mochigo/renderer';
import type { Rect } from '@mochigo/math';
import { Animator, type AnimationClip } from '../src/Animator';
import { playAnimation, stopAnimation, pauseAnimation } from '../src/controls';

function frame(x: number): Rect {
  return { x, y: 0, width: 16, height: 16 };
}

function makeClip(overrides: Partial<AnimationClip> = {}): AnimationClip {
  return {
    name: 'idle',
    frames: [frame(0), frame(1)],
    frameDuration: 0.1,
    loopMode: 'loop',
    ...overrides,
  };
}

describe('playAnimation / stopAnimation / pauseAnimation', () => {
  let world: World;

  beforeEach(() => {
    world = new World();
  });

  function makeEntity() {
    const entity = world.createEntity();
    const clips = new Map([
      ['idle', makeClip({ name: 'idle' })],
      ['run', makeClip({ name: 'run', frames: [frame(10), frame(11), frame(12)] })],
    ]);
    world.addComponent(entity, Animator, new Animator(clips, null, 0, 0, false, 1));
    world.addComponent(entity, Sprite, new Sprite('atlas', null));
    return entity;
  }

  describe('playAnimation', () => {
    it('activa un clip existente y lo pone a reproducir desde el frame 0', () => {
      const entity = makeEntity();

      playAnimation(world, entity, 'idle');

      const animator = world.getComponent(entity, Animator)!;
      expect(animator.currentClip).toBe('idle');
      expect(animator.currentFrameIndex).toBe(0);
      expect(animator.elapsedInFrame).toBe(0);
      expect(animator.playing).toBe(true);
    });

    it('con restart: false (o sin argumento) sobre el clip ya activo, es un no-op', () => {
      const entity = makeEntity();
      playAnimation(world, entity, 'idle');

      const animator = world.getComponent(entity, Animator)!;
      animator.currentFrameIndex = 1; // simula que ya avanzó
      animator.elapsedInFrame = 0.05;

      playAnimation(world, entity, 'idle', false);

      const after = world.getComponent(entity, Animator)!;
      expect(after.currentFrameIndex).toBe(1); // no se tocó
      expect(after.elapsedInFrame).toBe(0.05); // no se tocó
    });

    it('con restart: true sobre el clip ya activo, sí lo reinicia', () => {
      const entity = makeEntity();
      playAnimation(world, entity, 'idle');

      const animator = world.getComponent(entity, Animator)!;
      animator.currentFrameIndex = 1;
      animator.elapsedInFrame = 0.05;

      playAnimation(world, entity, 'idle', true);

      const after = world.getComponent(entity, Animator)!;
      expect(after.currentFrameIndex).toBe(0);
      expect(after.elapsedInFrame).toBe(0);
    });

    it('cambiar a un clip DISTINTO siempre reinicia, incluso con restart: false', () => {
      const entity = makeEntity();
      playAnimation(world, entity, 'idle');
      world.getComponent(entity, Animator)!.currentFrameIndex = 1;

      playAnimation(world, entity, 'run', false);

      const animator = world.getComponent(entity, Animator)!;
      expect(animator.currentClip).toBe('run');
      expect(animator.currentFrameIndex).toBe(0);
    });

    it('ignora silenciosamente un nombre de clip que no existe', () => {
      const entity = makeEntity();

      expect(() => playAnimation(world, entity, 'no-existe')).not.toThrow();

      const animator = world.getComponent(entity, Animator)!;
      expect(animator.currentClip).toBeNull();
      expect(animator.playing).toBe(false);
    });

    it('no-op seguro si la entidad no tiene Animator', () => {
      const entity = world.createEntity(); // sin componentes

      expect(() => playAnimation(world, entity, 'idle')).not.toThrow();
    });
  });

  describe('stopAnimation', () => {
    it('detiene la reproducción y resetea frame y tiempo', () => {
      const entity = makeEntity();
      playAnimation(world, entity, 'idle');
      const animator = world.getComponent(entity, Animator)!;
      animator.currentFrameIndex = 1;
      animator.elapsedInFrame = 0.03;

      stopAnimation(world, entity);

      const after = world.getComponent(entity, Animator)!;
      expect(after.playing).toBe(false);
      expect(after.currentFrameIndex).toBe(0);
      expect(after.elapsedInFrame).toBe(0);
    });

    it('no-op seguro si la entidad no tiene Animator', () => {
      const entity = world.createEntity();
      expect(() => stopAnimation(world, entity)).not.toThrow();
    });
  });

  describe('pauseAnimation', () => {
    it('detiene la reproducción SIN resetear frame ni tiempo', () => {
      const entity = makeEntity();
      playAnimation(world, entity, 'idle');
      const animator = world.getComponent(entity, Animator)!;
      animator.currentFrameIndex = 1;
      animator.elapsedInFrame = 0.03;

      pauseAnimation(world, entity);

      const after = world.getComponent(entity, Animator)!;
      expect(after.playing).toBe(false);
      expect(after.currentFrameIndex).toBe(1); // se conserva
      expect(after.elapsedInFrame).toBeCloseTo(0.03, 5); // se conserva
    });

    it('reanudar tras pausar continúa desde el frame donde quedó', () => {
      const entity = makeEntity();
      playAnimation(world, entity, 'idle');
      const animator = world.getComponent(entity, Animator)!;
      animator.currentFrameIndex = 1;
      pauseAnimation(world, entity);

      world.getComponent(entity, Animator)!.playing = true; // "reanudar"

      const after = world.getComponent(entity, Animator)!;
      expect(after.currentFrameIndex).toBe(1); // no volvió a 0
    });

    it('no-op seguro si la entidad no tiene Animator', () => {
      const entity = world.createEntity();
      expect(() => pauseAnimation(world, entity)).not.toThrow();
    });
  });
});
