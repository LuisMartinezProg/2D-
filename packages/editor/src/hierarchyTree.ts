import type { World, EntityId } from '@mochigo/ecs';
import { Transform } from '@mochigo/ecs';

export interface HierarchyNode {
  entity: EntityId;
  children: HierarchyNode[];
}

/** Entidades sin Transform, o cuyo parent no está en el propio conjunto
 * (huérfanas tras borrar al padre), se tratan como raíces — nunca se
 * descartan silenciosamente. */
export function buildHierarchyTree(world: World, entities: ReadonlySet<EntityId>): HierarchyNode[] {
  const childrenByParent = new Map<EntityId, EntityId[]>();
  const roots: EntityId[] = [];

  for (const entity of entities) {
    if (!world.isAlive(entity)) continue;
    const transform = world.getComponent(entity, Transform);
    const parent = transform?.parent ?? null;

    if (parent !== null && entities.has(parent) && world.isAlive(parent)) {
      const siblings = childrenByParent.get(parent) ?? [];
      siblings.push(entity);
      childrenByParent.set(parent, siblings);
    } else {
      roots.push(entity);
    }
  }

  const buildNode = (entity: EntityId): HierarchyNode => ({
    entity,
    children: (childrenByParent.get(entity) ?? []).map(buildNode),
  });

  return roots.map(buildNode);
}

/** Recolecta toda la descendencia de una entidad (recursivo) — usado
 * para que eliminar un padre en la Hierarchy elimine también a sus
 * hijos, en vez de dejarlos huérfanos (comportamiento estándar en
 * editores de motores: Unity, Godot). */
export function collectDescendants(world: World, entities: ReadonlySet<EntityId>, root: EntityId): EntityId[] {
  const childrenByParent = new Map<EntityId, EntityId[]>();
  for (const e of entities) {
    const t = world.getComponent(e, Transform);
    if (t?.parent !== null && t?.parent !== undefined) {
      const list = childrenByParent.get(t.parent) ?? [];
      list.push(e);
      childrenByParent.set(t.parent, list);
    }
  }

  const result: EntityId[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const child of childrenByParent.get(current) ?? []) {
      result.push(child);
      stack.push(child);
    }
  }
  return result;
}
