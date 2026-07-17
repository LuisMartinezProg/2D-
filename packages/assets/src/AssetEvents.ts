export const AssetEvents = {
  LoadProgress: 'asset:load-progress',
  LoadComplete: 'asset:load-complete',
  LoadError: 'asset:load-error',
} as const;

export interface AssetLoadProgressPayload {
  assetId: string;
  progress: number; // 0 a 1
}

export interface AssetLoadCompletePayload {
  assetId: string;
}

export interface AssetLoadErrorPayload {
  assetId: string;
  error: string;
}
