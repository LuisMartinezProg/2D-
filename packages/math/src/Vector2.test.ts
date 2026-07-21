import { describe, it, expect } from 'vitest';
import { Vector2 } from './Vector2';

describe('Vector2', () => {
  it('constructs with x and y', () => {
    const v = new Vector2(3, 4);
    expect(v.x).toBe(3);
    expect(v.y).toBe(4);
  });

  it('zero() returns (0, 0)', () => {
    const v = Vector2.zero();
    expect(v.x).toBe(0);
    expect(v.y).toBe(0);
  });

  it('one() returns (1, 1)', () => {
    const v = Vector2.one();
    expect(v.x).toBe(1);
    expect(v.y).toBe(1);
  });

  it('is immutable: methods never mutate the original instance', () => {
    const v = new Vector2(1, 2);
    v.add(new Vector2(10, 10));
    v.scale(5);
    v.normalize();
    expect(v.x).toBe(1);
    expect(v.y).toBe(2);
  });

  it('add() returns a new instance with summed components', () => {
    const a = new Vector2(1, 2);
    const b = new Vector2(3, 4);
    const result = a.add(b);
    expect(result).not.toBe(a);
    expect(result.x).toBe(4);
    expect(result.y).toBe(6);
  });

  it('subtract() returns componentwise difference', () => {
    const result = new Vector2(5, 5).subtract(new Vector2(2, 1));
    expect(result.x).toBe(3);
    expect(result.y).toBe(4);
  });

  it('scale() multiplies both components by scalar', () => {
    const result = new Vector2(2, -3).scale(2);
    expect(result.x).toBe(4);
    expect(result.y).toBe(-6);
  });

  it('multiply() does componentwise multiplication', () => {
    const result = new Vector2(2, 3).multiply(new Vector2(4, 5));
    expect(result.x).toBe(8);
    expect(result.y).toBe(15);
  });

  it('negate() flips sign of both components', () => {
    const result = new Vector2(3, -4).negate();
    expect(result.x).toBe(-3);
    expect(result.y).toBe(4);
  });

  it('magnitude() computes Euclidean length', () => {
    expect(new Vector2(3, 4).magnitude()).toBe(5);
    expect(Vector2.zero().magnitude()).toBe(0);
  });

  it('magnitudeSquared() avoids the sqrt', () => {
    expect(new Vector2(3, 4).magnitudeSquared()).toBe(25);
  });

  it('normalize() produces a unit vector in the same direction', () => {
    const result = new Vector2(3, 4).normalize();
    expect(result.magnitude()).toBeCloseTo(1);
    expect(result.x).toBeCloseTo(0.6);
    expect(result.y).toBeCloseTo(0.8);
  });

  it('normalize() on zero vector returns zero vector (no divide-by-zero)', () => {
    const result = Vector2.zero().normalize();
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it('dot() computes the dot product', () => {
    expect(new Vector2(1, 2).dot(new Vector2(3, 4))).toBe(11);
  });

  it('dot() of perpendicular vectors is zero', () => {
    expect(new Vector2(1, 0).dot(new Vector2(0, 1))).toBe(0);
  });

  it('distanceTo() computes Euclidean distance between two points', () => {
    expect(new Vector2(0, 0).distanceTo(new Vector2(3, 4))).toBe(5);
  });

  it('distanceSquaredTo() avoids the sqrt', () => {
    expect(new Vector2(0, 0).distanceSquaredTo(new Vector2(3, 4))).toBe(25);
  });

  it('lerp() at t=0 returns the start vector value', () => {
    const result = new Vector2(0, 0).lerp(new Vector2(10, 20), 0);
    expect(result.x).toBe(0);
    expect(result.y).toBe(0);
  });

  it('lerp() at t=1 returns the end vector value', () => {
    const result = new Vector2(0, 0).lerp(new Vector2(10, 20), 1);
    expect(result.x).toBe(10);
    expect(result.y).toBe(20);
  });

  it('lerp() at t=0.5 returns the midpoint', () => {
    const result = new Vector2(0, 0).lerp(new Vector2(10, 20), 0.5);
    expect(result.x).toBe(5);
    expect(result.y).toBe(10);
  });

  it('equals() returns true for same component values', () => {
    expect(new Vector2(1, 2).equals(new Vector2(1, 2))).toBe(true);
  });

  it('equals() returns false when any component differs', () => {
    expect(new Vector2(1, 2).equals(new Vector2(1, 3))).toBe(false);
  });

  it('clone() produces an equal but distinct instance', () => {
    const v = new Vector2(1, 2);
    const c = v.clone();
    expect(c).not.toBe(v);
    expect(c.equals(v)).toBe(true);
  });

  it('toString() formats as Vector2(x, y)', () => {
    expect(new Vector2(1, 2).toString()).toBe('Vector2(1, 2)');
  });
});
