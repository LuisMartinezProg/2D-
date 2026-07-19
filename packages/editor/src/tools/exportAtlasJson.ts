// packages/editor/src/tools/exportAtlasJson.ts
//
// OJO — asunción a verificar: uso {x,y,width,height} planos en vez de la clase
// real Rect de @mochigo/math, porque no tengo su constructor/API exacta en este
// chat (solo sé que Sprite.sourceRect es Rect|null). Quien integre esto contra
// el parser real de @mochigo/assets debería confirmar el shape exacto y convertir
// a Rect si hace falta.

import type { PackResult } from './atlasPacker';

export interface AtlasManifestExport {
  regions: Record<string, { x: number; y: number; width: number; height: number }>;
}

export function exportAtlasJson(result: PackResult): AtlasManifestExport {
  const regions: AtlasManifestExport['regions'] = {};
  for (const r of result.regions) {
    regions[r.name] = { x: r.x, y: r.y, width: r.width, height: r.height };
  }
  return { regions };
}
