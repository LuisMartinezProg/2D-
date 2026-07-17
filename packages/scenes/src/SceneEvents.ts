export const SceneEvents = {
  Loading: 'scene:loading',
  Loaded: 'scene:loaded',
  Unloaded: 'scene:unloaded',
} as const;

export interface SceneLoadingPayload {
  sceneName: string;
}

export interface SceneLoadedPayload {
  sceneName: string;
}

export interface SceneUnloadedPayload {
  sceneName: string;
}
