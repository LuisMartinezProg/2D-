import type { EventBus } from '@mochigo/events';
import type { Rect } from '@mochigo/math';
import type { AssetManifestEntry, AtlasFile, CachedAsset } from './types';
import { AssetEvents } from './AssetEvents';

/**
 * AudioContext compartido para decodeAudioData. Se crea perezosamente
 * (no en el constructor) porque algunos navegadores exigen que el
 * AudioContext se cree/reanude tras una interacción del usuario -
 * crearlo antes de tiempo puede dejarlo en estado "suspended" sin
 * romper nada, pero es más prolijo crearlo cuando realmente hace falta.
 */
let sharedAudioContext: AudioContext | null = null;
function getAudioContext(): AudioContext {
  if (!sharedAudioContext) {
    sharedAudioContext = new AudioContext();
  }
  return sharedAudioContext;
}

export class AssetManager {
  private cache = new Map<string, CachedAsset>();

  // Promesas de cargas EN CURSO, separadas del caché de resultados ya
  // resueltos - esto es lo que permite que una segunda llamada a load()
  // con el mismo id, mientras la primera todavía no terminó, devuelva
  // la MISMA promesa en vez de disparar una segunda descarga.
  private inFlight = new Map<string, Promise<void>>();

  constructor(private readonly eventBus: EventBus) {}

  load(entry: AssetManifestEntry): Promise<void> {
    if (this.cache.has(entry.id)) {
      return Promise.resolve(); // ya cargado, resuelve inmediato
    }

    const existing = this.inFlight.get(entry.id);
    if (existing) {
      return existing; // ya está cargando, reusa la misma promesa
    }

    const promise = this.loadEntry(entry)
      .then(() => {
        this.eventBus.emit(AssetEvents.LoadComplete, { assetId: entry.id });
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        this.eventBus.emit(AssetEvents.LoadError, { assetId: entry.id, error: message });
        throw error; // se re-lanza: quien llamó a load() directamente debe enterarse
      })
      .finally(() => {
        this.inFlight.delete(entry.id);
      });

    this.inFlight.set(entry.id, promise);
    return promise;
  }

  async loadManifest(entries: AssetManifestEntry[], abortOnError: boolean = false): Promise<void> {
    const total = entries.length;
    if (total === 0) return;

    let completedCount = 0;
    const errors: Array<{ assetId: string; error: unknown }> = [];

    const reportProgress = () => {
      completedCount++;
      this.eventBus.emit(AssetEvents.LoadProgress, {
        assetId: '*', // progreso del conjunto completo, no de un asset individual
        progress: completedCount / total,
      });
    };

    if (abortOnError) {
      // Promise.all: el primer rechazo corta todo de inmediato. load()
      // ya emitió asset:load-error antes de rechazar, así que el
      // llamador se entera de cuál falló por el evento aunque acá
      // solo propaguemos el error genérico.
      await Promise.all(
        entries.map((entry) => this.load(entry).then(reportProgress))
      );
      return;
    }

    // Modo default: ninguna carga individual debe interrumpir a las demás.
    // allSettled en vez de all - cada promesa se resuelve pase lo que
    // pase, y recién al final decidimos si hay que informar errores.
    const results = await Promise.allSettled(
      entries.map((entry) => this.load(entry).then(reportProgress))
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      const entry = entries[i];
      if (result && result.status === 'rejected' && entry) {
        errors.push({ assetId: entry.id, error: result.reason });
      }
    }

    // No relanzamos: el contrato de este modo es "continuar con el resto
    // y reportar todos los errores al final" - asset:load-error ya se
    // emitió individualmente por cada uno dentro de load(), así que el
    // llamador que escucha ese evento ya tiene todo lo que necesita.
    // No hace falta relanzar acá y romper la promesa del manifest entero
    // por errores que el llamador ya pudo haber manejado vía eventos.
  }

  getTexture(id: string): HTMLImageElement | undefined {
    const cached = this.cache.get(id);
    return cached?.kind === 'texture' ? cached.image : undefined;
  }

  getTextureRegion(id: string, regionName: string): Rect | undefined {
    const cached = this.cache.get(id);
    if (cached?.kind !== 'texture') return undefined;
    if (!cached.regions) return undefined;
    return cached.regions[regionName];
  }

  getSound(id: string): AudioBuffer | undefined {
    const cached = this.cache.get(id);
    return cached?.kind === 'sound' ? cached.buffer : undefined;
  }

  getJSON<T = unknown>(id: string): T | undefined {
    const cached = this.cache.get(id);
    return cached?.kind === 'json' ? (cached.data as T) : undefined;
  }

  isLoaded(id: string): boolean {
    return this.cache.has(id);
  }

  unload(id: string): void {
    // delete es suficiente para que el GC pueda liberar la memoria: no
    // queda ninguna otra referencia fuerte al HTMLImageElement/AudioBuffer
    // una vez que se borra del Map (checklist: importante en celular
    // con RAM limitada).
    this.cache.delete(id);
  }

  // ── Carga por tipo ───────────────────────────────────────

  private async loadEntry(entry: AssetManifestEntry): Promise<void> {
    switch (entry.type) {
      case 'texture':
        await this.loadTexture(entry);
        break;
      case 'sound':
        await this.loadSound(entry);
        break;
      case 'json':
        await this.loadJSON(entry);
        break;
    }
  }

  private async loadTexture(entry: AssetManifestEntry): Promise<void> {
    const image = await this.loadImage(entry.path);

    let regions: Record<string, Rect> | undefined;
    if (entry.atlasData) {
      const atlas = await this.fetchJSON<AtlasFile>(entry.atlasData);
      regions = atlas.regions;
    }

    if (regions) {
      this.cache.set(entry.id, { kind: 'texture', id: entry.id, image, regions });
    } else {
      this.cache.set(entry.id, { kind: 'texture', id: entry.id, image });
    }
  }

  private loadImage(path: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`No se pudo cargar la imagen: ${path}`));
      img.src = path;
    });
  }

  private async loadSound(entry: AssetManifestEntry): Promise<void> {
    const response = await fetch(entry.path);
    if (!response.ok) {
      throw new Error(`No se pudo descargar el sonido (${response.status}): ${entry.path}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = await getAudioContext().decodeAudioData(arrayBuffer);

    this.cache.set(entry.id, { kind: 'sound', id: entry.id, buffer });
  }

  private async loadJSON(entry: AssetManifestEntry): Promise<void> {
    const data = await this.fetchJSON<unknown>(entry.path);
    this.cache.set(entry.id, { kind: 'json', id: entry.id, data });
  }

  private async fetchJSON<T>(path: string): Promise<T> {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`No se pudo descargar JSON (${response.status}): ${path}`);
    }
    return response.json() as Promise<T>;
  }
}
