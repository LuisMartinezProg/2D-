import type { Rect } from '@mochigo/math';

export type AssetType = 'texture' | 'sound' | 'json';

export interface AssetManifestEntry {
  id: string;
  type: AssetType;
  path: string;
  atlasData?: string;
}

export interface AtlasFile {
  textureId: string;
  imagePath: string;
  regions: Record<string, Rect>;
}

/** Estado interno de un asset en caché. Nunca se expone tal cual afuera. */
interface CachedAssetBase {
  id: string;
}

export interface CachedTexture extends CachedAssetBase {
  kind: 'texture';
  image: HTMLImageElement;
  regions?: Record<string, Rect>; // presente solo si el asset tenía atlas
}

export interface CachedSound extends CachedAssetBase {
  kind: 'sound';
  buffer: AudioBuffer;
}

export interface CachedJSON extends CachedAssetBase {
  kind: 'json';
  data: unknown;
}

export type CachedAsset = CachedTexture | CachedSound | CachedJSON;
