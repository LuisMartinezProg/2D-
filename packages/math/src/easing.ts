export const Easing = {
  linear(t: number): number {
    return t;
  },
  easeInQuad(t: number): number {
    return t * t;
  },
  easeOutQuad(t: number): number {
    return t * (2 - t);
  },
  easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  },
  easeInCubic(t: number): number {
    return t * t * t;
  },
  easeOutCubic(t: number): number {
    const p = t - 1;
    return p * p * p + 1;
  },
  easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
  },
};
