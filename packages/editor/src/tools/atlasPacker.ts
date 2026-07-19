// packages/editor/src/tools/atlasPacker.ts
//
// MaxRects "Best Short Side Fit" — mismo algoritmo que TexturePacker/I Love Sprites.
// Decisión v1 (documentada, como el resto del motor): bin de tamaño FIJO. Si algo no
// entra, se reporta en vez de crecer y re-empacar — mismo espíritu que Physics
// quedándose en "solo AABB en v1" por simplicidad.

export interface SpriteToPack {
  name: string; // se vuelve la clave del atlas final
  width: number;
  height: number;
  image: HTMLImageElement | ImageBitmap;
}

export interface PackedRegion {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PackResult {
  regions: PackedRegion[];
  atlasWidth: number;
  atlasHeight: number;
  rejected: string[]; // no entraron en el bin
}

interface FreeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PackOptions {
  maxWidth: number;
  maxHeight: number;
  padding: number; // gutter entre sprites, evita bleeding al escalar/filtrar
  powerOfTwo: boolean; // redondea el atlas final a potencia de 2 (compat. GPU viejo)
}

const DEFAULT_OPTIONS: PackOptions = {
  maxWidth: 2048,
  maxHeight: 2048,
  padding: 2,
  powerOfTwo: false,
};

function nextPowerOfTwo(n: number): number {
  return Math.pow(2, Math.ceil(Math.log2(n)));
}

export function packSprites(
  sprites: SpriteToPack[],
  options: Partial<PackOptions> = {}
): PackResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const pad = opts.padding;

  // Empacar primero los más altos reduce fragmentación (sobrantes angostos/altos
  // son más difíciles de reaprovechar que anchos/bajos)
  const sorted = [...sprites].sort((a, b) => b.height - a.height);

  let freeRects: FreeRect[] = [{ x: 0, y: 0, width: opts.maxWidth, height: opts.maxHeight }];
  const regions: PackedRegion[] = [];
  const rejected: string[] = [];
  let usedWidth = 0;
  let usedHeight = 0;

  for (const sprite of sorted) {
    const w = sprite.width + pad;
    const h = sprite.height + pad;
    const placement = findBestPosition(freeRects, w, h);

    if (!placement) {
      rejected.push(sprite.name);
      continue;
    }

    regions.push({ name: sprite.name, x: placement.x, y: placement.y, width: sprite.width, height: sprite.height });
    usedWidth = Math.max(usedWidth, placement.x + w);
    usedHeight = Math.max(usedHeight, placement.y + h);
    freeRects = splitAndPrune(freeRects, { x: placement.x, y: placement.y, width: w, height: h });
  }

  return {
    regions,
    atlasWidth: opts.powerOfTwo ? nextPowerOfTwo(usedWidth) : usedWidth,
    atlasHeight: opts.powerOfTwo ? nextPowerOfTwo(usedHeight) : usedHeight,
    rejected,
  };
}

function findBestPosition(freeRects: FreeRect[], w: number, h: number): { x: number; y: number } | null {
  let best: { x: number; y: number } | null = null;
  let bestShortSideFit = Infinity;

  for (const rect of freeRects) {
    if (rect.width < w || rect.height < h) continue;
    const shortSideFit = Math.min(rect.width - w, rect.height - h);
    if (shortSideFit < bestShortSideFit) {
      bestShortSideFit = shortSideFit;
      best = { x: rect.x, y: rect.y };
    }
  }
  return best;
}

// Tras colocar un rect, parte cada libre que lo solapaba en hasta 4 sobrantes.
// Nota honesta: pueden quedar libres que se superponen entre sí sin estar
// contenidos uno en otro — es normal en MaxRects, solo cuesta un poco de
// eficiencia de búsqueda, no rompe el empaquetado. Con decenas/cientos de
// sprites (lo típico en un juego 2D) el costo es insignificante.
function splitAndPrune(freeRects: FreeRect[], placed: FreeRect): FreeRect[] {
  const result: FreeRect[] = [];

  for (const rect of freeRects) {
    if (!intersects(rect, placed)) {
      result.push(rect);
      continue;
    }
    if (placed.y > rect.y) result.push({ x: rect.x, y: rect.y, width: rect.width, height: placed.y - rect.y });
    if (placed.y + placed.height < rect.y + rect.height)
      result.push({ x: rect.x, y: placed.y + placed.height, width: rect.width, height: rect.y + rect.height - (placed.y + placed.height) });
    if (placed.x > rect.x) result.push({ x: rect.x, y: rect.y, width: placed.x - rect.x, height: rect.height });
    if (placed.x + placed.width < rect.x + rect.width)
      result.push({ x: placed.x + placed.width, y: rect.y, width: rect.x + rect.width - (placed.x + placed.width), height: rect.height });
  }

  return result.filter((rect, i) => !result.some((other, j) => i !== j && contains(other, rect)));
}

function intersects(a: FreeRect, b: FreeRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function contains(outer: FreeRect, inner: FreeRect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;
}
