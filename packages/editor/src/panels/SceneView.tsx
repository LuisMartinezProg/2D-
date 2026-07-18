import React from 'react';
import type { World, EntityId } from '@mochigo/ecs';
import { Transform } from '@mochigo/ecs';
import { Vector2 } from '@mochigo/math';
import { Sprite, type Renderer } from '@mochigo/renderer';
import { MochiGoTheme } from '../theme';

type GizmoMode = 'move' | 'rotate' | 'scale';

interface SceneViewProps {
  world: World;
  renderer: Renderer;
  selectedEntity: EntityId | null;
  onSelect: (entity: EntityId | null) => void;
  onTransformChanged: () => void;
  isInPlayMode: boolean;
}

const DEFAULT_HITBOX_SIZE = 32; // fallback si el Sprite no tiene sourceRect

export function SceneView({ world, renderer, selectedEntity, onSelect, onTransformChanged, isInPlayMode }: SceneViewProps) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
  const [gizmoMode, setGizmoMode] = React.useState<GizmoMode>('move');
  const dragState = React.useRef<{
    mode: GizmoMode; entity: EntityId; startMouse: { x: number; y: number };
    startTransform: { position: { x: number; y: number }; rotation: number; scale: { x: number; y: number } };
  } | null>(null);

  React.useEffect(() => {
    let frameId: number;
    const loop = () => {
      renderer.render(world, 0); // interpolation=0: el editor pide "el estado actual"
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [world, renderer]);

  function getEntityBounds(entity: EntityId) {
    const transform = world.getComponent(entity, Transform);
    const sprite = world.getComponent(entity, Sprite);
    if (!transform || !sprite) return null;
    const width = (sprite.sourceRect?.width ?? DEFAULT_HITBOX_SIZE) * transform.scale.x;
    const height = (sprite.sourceRect?.height ?? DEFAULT_HITBOX_SIZE) * transform.scale.y;
    return { x: transform.position.x - width / 2, y: transform.position.y - height / 2, width, height };
  }

  function pointInBounds(px: number, py: number, b: { x: number; y: number; width: number; height: number }) {
    return px >= b.x && px <= b.x + b.width && py >= b.y && py <= b.y + b.height;
  }

  /**
   * LÍMITE CONOCIDO: convierte pantalla→mundo asumiendo cámara en zoom=1
   * sin offset. Renderer sí resuelve una cámara activa real internamente
   * (resolveActiveCameraView + CameraController), pero esa matemática
   * exacta no está expuesta públicamente ni confirmada con código real
   * de CameraController.ts en este chat. Mientras la cámara activa esté
   * en zoom 1 sin desplazamiento (el caso común al editar), esto funciona
   * correctamente; con zoom/paneo real, clicks y arrastre quedarán
   * desplazados hasta que se replique esa transformación acá.
   */
  function screenToWorld(clientX: number, clientY: number) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (isInPlayMode) return;
    const worldPoint = screenToWorld(e.clientX, e.clientY);

    if (selectedEntity !== null) {
      const bounds = getEntityBounds(selectedEntity);
      const transform = world.getComponent(selectedEntity, Transform);
      if (bounds && transform && pointInBounds(worldPoint.x, worldPoint.y, bounds)) {
        dragState.current = {
          mode: gizmoMode, entity: selectedEntity, startMouse: worldPoint,
          startTransform: {
            position: { x: transform.position.x, y: transform.position.y },
            rotation: transform.rotation,
            scale: { x: transform.scale.x, y: transform.scale.y },
          },
        };
        return;
      }
    }

    let hit: EntityId | null = null;
    for (const entity of world.query([Transform, Sprite])) {
      const bounds = getEntityBounds(entity);
      if (bounds && pointInBounds(worldPoint.x, worldPoint.y, bounds)) hit = entity;
    }
    onSelect(hit);
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!dragState.current) return;
    const { mode, entity, startMouse, startTransform } = dragState.current;
    const worldPoint = screenToWorld(e.clientX, e.clientY);
    const transform = world.getComponent(entity, Transform);
    if (!transform) return;

    const dx = worldPoint.x - startMouse.x;
    const dy = worldPoint.y - startMouse.y;

    if (mode === 'move') {
      transform.position.x = startTransform.position.x + dx;
      transform.position.y = startTransform.position.y + dy;
    } else if (mode === 'rotate') {
      transform.rotation = Math.atan2(worldPoint.y - startTransform.position.y, worldPoint.x - startTransform.position.x);
    } else if (mode === 'scale') {
      const startDist = Math.hypot(startMouse.x - startTransform.position.x, startMouse.y - startTransform.position.y) || 1;
      const currentDist = Math.hypot(worldPoint.x - startTransform.position.x, worldPoint.y - startTransform.position.y);
      const factor = currentDist / startDist;
      transform.scale.x = startTransform.scale.x * factor;
      transform.scale.y = startTransform.scale.y * factor;
    }
    onTransformChanged();
  }

  function handleDrop(e: React.DragEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const textureId = e.dataTransfer.getData('text/mochigo-texture-id');
    if (!textureId) return;
    const worldPoint = screenToWorld(e.clientX, e.clientY);

    const entity = world.createEntity();
    world.addComponent(entity, Transform, new Transform(new Vector2(worldPoint.x, worldPoint.y)));
    world.addComponent(entity, Sprite, new Sprite(textureId));

    onSelect(entity);
    onTransformChanged();
  }

  return (
    <div style={{ position: 'relative', height: '100%', background: MochiGoTheme.skirk.black }}>
      <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 1, display: 'flex', gap: 4 }}>
        {(['move', 'rotate', 'scale'] as GizmoMode[]).map((mode) => (
          <button
            key={mode} onClick={() => setGizmoMode(mode)}
            style={{
              padding: '4px 10px', fontSize: 11, textTransform: 'uppercase',
              background: gizmoMode === mode ? MochiGoTheme.accent : MochiGoTheme.skirk.deep,
              color: gizmoMode === mode ? MochiGoTheme.skirk.black : MochiGoTheme.skirk.light,
              border: `1px solid ${MochiGoTheme.furina.bright}`, cursor: 'pointer',
            }}
          >
            {mode}
          </button>
        ))}
      </div>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
        onMouseUp={() => { dragState.current = null; }} onMouseLeave={() => { dragState.current = null; }}
        onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </div>
  );
}
