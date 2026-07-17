import type { Rect } from '@mochigo/math';
import { rectsIntersect } from '@mochigo/math';
import type { EntityId } from '@mochigo/ecs';

interface QuadtreeEntry {
  entityId: EntityId;
  bounds: Rect;
}

/**
 * Se reconstruye completo por paso fijo (sección 3 de la ficha: "lo
 * suficientemente barato de reconstruir para las escalas objetivo de
 * este motor"), no incremental. Esto simplifica mucho la implementación:
 * no hay que manejar remove() ni reubicación de nodos existentes.
 */
export class Quadtree {
  private root: QuadtreeNode;

  constructor(
    bounds: Rect,
    private readonly maxDepth: number,
    private readonly maxEntitiesPerNode: number
  ) {
    this.root = new QuadtreeNode(bounds, 0, maxDepth, maxEntitiesPerNode);
  }

  insert(entityId: EntityId, bounds: Rect): void {
    this.root.insert({ entityId, bounds });
  }

  /** Devuelve candidatos cercanos a `bounds` — puede incluir falsos positivos
   * (nodos vecinos), es responsabilidad del narrow phase filtrar con precisión. */
  query(bounds: Rect): EntityId[] {
    const results: QuadtreeEntry[] = [];
    this.root.query(bounds, results);
    return results.map((r) => r.entityId);
  }
}

class QuadtreeNode {
  private entries: QuadtreeEntry[] = [];
  private children: QuadtreeNode[] | null = null;

  constructor(
    private readonly bounds: Rect,
    private readonly depth: number,
    private readonly maxDepth: number,
    private readonly maxEntitiesPerNode: number
  ) {}

  insert(entry: QuadtreeEntry): void {
    if (this.children) {
      // Ya subdividido: insertar en el/los hijo(s) cuyo bounds intersecta.
      // Un AABB puede cruzar el límite entre cuadrantes, así que puede
      // insertarse en más de un hijo - preferible a partir la entidad,
      // el costo de duplicar la referencia es mínimo.
      for (const child of this.children) {
        if (rectsIntersect(child.bounds, entry.bounds)) {
          child.insert(entry);
        }
      }
      return;
    }

    this.entries.push(entry);

    if (this.entries.length > this.maxEntitiesPerNode && this.depth < this.maxDepth) {
      this.subdivide();
    }
  }

  query(area: Rect, results: QuadtreeEntry[]): void {
    if (!rectsIntersect(this.bounds, area)) return;

    if (this.children) {
      for (const child of this.children) {
        child.query(area, results);
      }
      return;
    }

    for (const entry of this.entries) {
      if (rectsIntersect(entry.bounds, area)) {
        results.push(entry);
      }
    }
  }

  private subdivide(): void {
    const { x, y, width, height } = this.bounds;
    const halfW = width / 2;
    const halfH = height / 2;

    this.children = [
      new QuadtreeNode({ x, y, width: halfW, height: halfH }, this.depth + 1, this.maxDepth, this.maxEntitiesPerNode),
      new QuadtreeNode({ x: x + halfW, y, width: halfW, height: halfH }, this.depth + 1, this.maxDepth, this.maxEntitiesPerNode),
      new QuadtreeNode({ x, y: y + halfH, width: halfW, height: halfH }, this.depth + 1, this.maxDepth, this.maxEntitiesPerNode),
      new QuadtreeNode({ x: x + halfW, y: y + halfH, width: halfW, height: halfH }, this.depth + 1, this.maxDepth, this.maxEntitiesPerNode),
    ];

    // Redistribuir las entradas ya acumuladas hacia los hijos recién creados.
    const existing = this.entries;
    this.entries = [];
    for (const entry of existing) {
      this.insert(entry);
    }
  }
}
