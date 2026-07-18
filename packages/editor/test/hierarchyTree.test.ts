import { describe, it, expect } from 'vitest';
import { World, Transform } from '@mochigo/ecs';
import { Vector2 } from '@mochigo/math';
import { buildHierarchyTree, collectDescendants } from '../src/hierarchyTree';

describe('buildHierarchyTree', () => {
  it('entidades sin parent son todas raíces', () => {
    const world = new World();
    const a = world.createEntity();
    const b = world.createEntity();
    world.addComponent(a, Transform, new Transform());
    world.addComponent(b, Transform, new Transform());

    const tree = buildHierarchyTree(world, new Set([a, b]));

    expect(tree).toHaveLength(2);
  });

  it('una entidad con parent aparece como hijo, no como raíz', () => {
    const world = new World();
    const parent = world.createEntity();
    const child = world.createEntity();
    world.addComponent(parent, Transform, new Transform());
    world.addComponent(child, Transform, new Transform(Vector2.zero(), 0, Vector2.one(), parent));

    const tree = buildHierarchyTree(world, new Set([parent, child]));

    expect(tree).toHaveLength(1);
    expect(tree[0].entity).toBe(parent);
    expect(tree[0].children[0].entity).toBe(child);
  });

  it('una entidad cuyo parent no está en el conjunto conocido se trata como raíz (huérfana)', () => {
    const world = new World();
    const missingParentId = 999;
    const child = world.createEntity();
    world.addComponent(child, Transform, new Transform(Vector2.zero(), 0, Vector2.one(), missingParentId));

    const tree = buildHierarchyTree(world, new Set([child]));

    expect(tree).toHaveLength(1);
    expect(tree[0].entity).toBe(child);
  });

  it('jerarquía de tres niveles se anida correctamente', () => {
    const world = new World();
    const grandparent = world.createEntity();
    const parent = world.createEntity();
    const child = world.createEntity();
    world.addComponent(grandparent, Transform, new Transform());
    world.addComponent(parent, Transform, new Transform(Vector2.zero(), 0, Vector2.one(), grandparent));
    world.addComponent(child, Transform, new Transform(Vector2.zero(), 0, Vector2.one(), parent));

    const tree = buildHierarchyTree(world, new Set([grandparent, parent, child]));

    expect(tree[0].children[0].children[0].entity).toBe(child);
  });
});

describe('collectDescendants', () => {
  it('recolecta hijos y nietos de una entidad', () => {
    const world = new World();
    const root = world.createEntity();
    const childA = world.createEntity();
    const childB = world.createEntity();
    const grandchild = world.createEntity();
    world.addComponent(root, Transform, new Transform());
    world.addComponent(childA, Transform, new Transform(Vector2.zero(), 0, Vector2.one(), root));
    world.addComponent(childB, Transform, new Transform(Vector2.zero(), 0, Vector2.one(), root));
    world.addComponent(grandchild, Transform, new Transform(Vector2.zero(), 0, Vector2.one(), childA));

    const descendants = collectDescendants(world, new Set([root, childA, childB, grandchild]), root);

    expect(new Set(descendants)).toEqual(new Set([childA, childB, grandchild]));
  });

  it('una entidad sin hijos devuelve un array vacío', () => {
    const world = new World();
    const lonely = world.createEntity();
    world.addComponent(lonely, Transform, new Transform());

    expect(collectDescendants(world, new Set([lonely]), lonely)).toEqual([]);
  });
});
