import type { World, EntityId } from '@mochigo/ecs';
import { Transform } from '@mochigo/ecs';
import { Vector2 } from '@mochigo/math';
import type { ResolvedTransform } from './types';

export class WorldTransformResolver {
  private frameCache = new Map<EntityId, ResolvedTransform>();

  constructor(private readonly world: World) {}

  resolve(entityId: EntityId): ResolvedTransform {
    const cached = this.frameCache.get(entityId);
    if (cached) return cached;

    const local = this.world.getComponent(entityId, Transform);
    if (!local) {
      const identity: ResolvedTransform = { position: new Vector2(0, 0), rotation: 0, scale: new Vector2(1, 1) };
      this.frameCache.set(entityId, identity);
      return identity;
    }

    const result =
      local.parent === null || !this.world.isAlive(local.parent)
        ? { position: local.position, rotation: local.rotation, scale: local.scale }
        : this.combine(this.resolve(local.parent), local);

    this.frameCache.set(entityId, result);
    return result;
  }

  private combine(parent: ResolvedTransform, local: Transform): ResolvedTransform {
    const cos = Math.cos(parent.rotation);
    const sin = Math.sin(parent.rotation);
    const scaledX = local.position.x * parent.scale.x;
    const scaledY = local.position.y * parent.scale.y;

    return {
      position: new Vector2(
        parent.position.x + (scaledX * cos - scaledY * sin),
        parent.position.y + (scaledX * sin + scaledY * cos)
      ),
      rotation: parent.rotation + local.rotation,
      scale: new Vector2(parent.scale.x * local.scale.x, parent.scale.y * local.scale.y),
    };
  }
}
