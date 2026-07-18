import type { ComponentSchema } from '@mochigo/scripting';
import { Transform } from '@mochigo/ecs';
import { Sprite, Camera } from '@mochigo/renderer';
import { RigidBody, Collider } from '@mochigo/physics';
import { Animator } from '@mochigo/animation';

/**
 * Reutiliza el mismo formato de schema que ScriptComponent (Scripting)
 * también para los componentes "core" del motor — Inspector Panel tiene
 * así un único mecanismo de renderizado, sin distinguir "del motor" vs
 * "del usuario". Decisión propia, no especificada así en la ficha.
 *
 * Quedan FUERA deliberadamente: Sprite.sourceRect y Camera.bounds (tipo
 * Rect, ninguno de los 6 SchemaFieldType lo representa razonablemente;
 * normalmente los controla Animation/gameplay, no se editan a mano) y
 * Animator.clips (Map complejo, necesitaría un editor dedicado fuera de
 * alcance de un Inspector genérico). Limitación conocida, no omisión
 * silenciosa.
 */
export const CoreComponentSchemas = new Map<string, ComponentSchema>([
  [Transform.componentName, {
    position: { type: 'vector2', default: { x: 0, y: 0 } },
    rotation: { type: 'number', default: 0 },
    scale: { type: 'vector2', default: { x: 1, y: 1 } },
    parent: { type: 'entity', default: null, label: 'Parent' },
  }],
  [Sprite.componentName, {
    textureId: { type: 'string', default: '' },
    layer: { type: 'number', default: 0 },
    tint: { type: 'color', default: '#FFFFFF' },
    opacity: { type: 'number', default: 1, min: 0, max: 1 },
    flipX: { type: 'boolean', default: false },
    flipY: { type: 'boolean', default: false },
    visible: { type: 'boolean', default: true },
  }],
  [Camera.componentName, {
    zoom: { type: 'number', default: 1, min: 0.01 },
    followTarget: { type: 'entity', default: null, label: 'Follow Target' },
    followSmoothing: { type: 'number', default: 0, min: 0, max: 1 },
    active: { type: 'boolean', default: true },
  }],
  [RigidBody.componentName, {
    velocity: { type: 'vector2', default: { x: 0, y: 0 } },
    acceleration: { type: 'vector2', default: { x: 0, y: 0 } },
    mass: { type: 'number', default: 1, min: 0 },
    isStatic: { type: 'boolean', default: false },
    gravityScale: { type: 'number', default: 1 },
  }],
  [Collider.componentName, {
    size: { type: 'vector2', default: { x: 10, y: 10 } },
    offset: { type: 'vector2', default: { x: 0, y: 0 } },
    isTrigger: { type: 'boolean', default: false },
  }],
  [Animator.componentName, {
    currentClip: { type: 'string', default: '', label: 'Current Clip' },
    playing: { type: 'boolean', default: false },
    playbackSpeed: { type: 'number', default: 1 },
  }],
]);
