export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Broad-phase de colisiones (AABB) — usado por Physics. */
export function rectsIntersect(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
