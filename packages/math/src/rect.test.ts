import { describe, it, expect } from 'vitest';
import { Rect, rectsIntersect } from './Rect';
import { Vector2 } from './Vector2';

describe('Rect', () => {
  it('constructs with x, y, width, height', () => {
    const r = new Rect(1, 2, 10, 20);
    expect(r.x).toBe(1);
    expect(r.y).toBe(2);
    expect(r.width).toBe(10);
    expect(r.height).toBe(20);
  });

  it('zero() returns a degenerate rect at origin', () => {
    const r = Rect.zero();
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
    expect(r.width).toBe(0);
    expect(r.height).toBe(0);
  });

  it('fromCenter() builds a rect centered on the given point', () => {
    const r = Rect.fromCenter(new Vector2(10, 10), 4, 6);
    expect(r.x).toBe(8);
    expect(r.y).toBe(7);
    expect(r.width).toBe(4);
    expect(r.height).toBe(6);
  });

  it('is immutable: methods never mutate the original instance', () => {
    const r = new Rect(0, 0, 10, 10);
    r.translate(new Vector2(5, 5));
    expect(r.x).toBe(0);
    expect(r.y).toBe(0);
  });

  it('left/right/top/bottom getters match x/y/width/height', () => {
    const r = new Rect(2, 3, 10, 20);
    expect(r.left).toBe(2);
    expect(r.right).toBe(12);
    expect(r.top).toBe(3);
    expect(r.bottom).toBe(23);
  });

  it('center getter returns the midpoint as a Vector2', () => {
    const r = new Rect(0, 0, 10, 20);
    const c = r.center;
    expect(c.x).toBe(5);
    expect(c.y).toBe(10);
  });

  it('position getter returns (x, y) as a Vector2', () => {
    const r = new Rect(3, 4, 10, 20);
    const p = r.position;
    expect(p.x).toBe(3);
    expect(p.y).toBe(4);
  });

  it('size getter returns (width, height) as a Vector2', () => {
    const r = new Rect(0, 0, 10, 20);
    const s = r.size;
    expect(s.x).toBe(10);
    expect(s.y).toBe(20);
  });

  it('contains() is true for a point strictly inside', () => {
    const r = new Rect(0, 0, 10, 10);
    expect(r.contains(new Vector2(5, 5))).toBe(true);
  });

  it('contains() is true for a point exactly on the boundary', () => {
    const r = new Rect(0, 0, 10, 10);
    expect(r.contains(new Vector2(0, 0))).toBe(true);
    expect(r.contains(new Vector2(10, 10))).toBe(true);
  });

  it('contains() is false for a point outside', () => {
    const r = new Rect(0, 0, 10, 10);
    expect(r.contains(new Vector2(-1, 5))).toBe(false);
    expect(r.contains(new Vector2(11, 5))).toBe(false);
  });

  it('translate() shifts x/y by the offset, keeps width/height', () => {
    const r = new Rect(1, 1, 10, 10).translate(new Vector2(5, -2));
    expect(r.x).toBe(6);
    expect(r.y).toBe(-1);
    expect(r.width).toBe(10);
    expect(r.height).toBe(10);
  });

  it('equals() returns true for identical rects', () => {
    expect(new Rect(1, 2, 3, 4).equals(new Rect(1, 2, 3, 4))).toBe(true);
  });

  it('equals() returns false if any field differs', () => {
    expect(new Rect(1, 2, 3, 4).equals(new Rect(1, 2, 3, 5))).toBe(false);
  });

  it('clone() produces an equal but distinct instance', () => {
    const r = new Rect(1, 2, 3, 4);
    const c = r.clone();
    expect(c).not.toBe(r);
    expect(c.equals(r)).toBe(true);
  });

  it('toString() formats as Rect(x, y, width, height)', () => {
    expect(new Rect(1, 2, 3, 4).toString()).toBe('Rect(1, 2, 3, 4)');
  });
});

describe('rectsIntersect / Rect.intersects', () => {
  it('detects clear overlap', () => {
    const a = new Rect(0, 0, 10, 10);
    const b = new Rect(5, 5, 10, 10);
    expect(rectsIntersect(a, b)).toBe(true);
    expect(a.intersects(b)).toBe(true);
  });

  it('detects clear separation on the x axis', () => {
    const a = new Rect(0, 0, 10, 10);
    const b = new Rect(20, 0, 10, 10);
    expect(rectsIntersect(a, b)).toBe(false);
  });

  it('detects clear separation on the y axis', () => {
    const a = new Rect(0, 0, 10, 10);
    const b = new Rect(0, 20, 10, 10);
    expect(rectsIntersect(a, b)).toBe(false);
  });

  it('EDGE CASE: rects that only touch at an edge do NOT count as intersecting', () => {
    // Right edge of a (x=10) meets left edge of b (x=10) exactly.
    const a = new Rect(0, 0, 10, 10);
    const b = new Rect(10, 0, 10, 10);
    expect(rectsIntersect(a, b)).toBe(false);
  });

  it('EDGE CASE: rects that only touch at a single corner do NOT count as intersecting', () => {
    const a = new Rect(0, 0, 10, 10);
    const b = new Rect(10, 10, 10, 10);
    expect(rectsIntersect(a, b)).toBe(false);
  });

  it('EDGE CASE: one rect fully containing another counts as intersecting', () => {
    const outer = new Rect(0, 0, 20, 20);
    const inner = new Rect(5, 5, 2, 2);
    expect(rectsIntersect(outer, inner)).toBe(true);
    expect(rectsIntersect(inner, outer)).toBe(true);
  });

  it('EDGE CASE: identical rects intersect', () => {
    const a = new Rect(0, 0, 10, 10);
    const b = new Rect(0, 0, 10, 10);
    expect(rectsIntersect(a, b)).toBe(true);
  });

  it('EDGE CASE: zero-area rect does not intersect anything, including itself', () => {
    const point = new Rect(5, 5, 0, 0);
    const area = new Rect(0, 0, 10, 10);
    expect(rectsIntersect(point, area)).toBe(false);
    expect(rectsIntersect(point, point)).toBe(false);
  });

  it('is symmetric: order of arguments does not change the result', () => {
    const a = new Rect(0, 0, 10, 10);
    const b = new Rect(5, 5, 10, 10);
    expect(rectsIntersect(a, b)).toBe(rectsIntersect(b, a));
  });
});
