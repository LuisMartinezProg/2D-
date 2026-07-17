import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { EventBus } from '@mochigo/events';
import { AssetManager } from '../src/AssetManager';
import { AssetEvents } from '../src/AssetEvents';
import type { AssetManifestEntry } from '../src/types';

/**
 * Mock de HTMLImageElement: la implementación real de Image() en jsdom
 * no dispara onload/onerror automáticamente (no hace fetch real de la
 * imagen). Reemplazamos el constructor global Image para controlar
 * manualmente cuándo "termina" de cargar cada instancia.
 */
class MockImage {
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private _src = '';

  set src(value: string) {
    this._src = value;
    // Se dispara en el próximo microtask, no sincrónico, para imitar el
    // comportamiento asíncrono real de la carga de imágenes.
    queueMicrotask(() => {
      if (this._src.includes('fail')) {
        this.onerror?.();
      } else {
        this.onload?.();
      }
    });
  }
  get src() {
    return this._src;
  }
}

/** Contador global de instancias de MockImage creadas, para verificar caché. */
let imageConstructorCallCount = 0;

describe('AssetManager', () => {
  let eventBus: EventBus;
  let manager: AssetManager;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    imageConstructorCallCount = 0;
    vi.stubGlobal('Image', class extends MockImage {
      constructor() {
        super();
        imageConstructorCallCount++;
      }
    });

    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    vi.stubGlobal('AudioContext', class {
      decodeAudioData(_buffer: ArrayBuffer): Promise<AudioBuffer> {
        return Promise.resolve({ duration: 1, length: 1000 } as AudioBuffer);
      }
    });

    eventBus = new EventBus();
    manager = new AssetManager(eventBus);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── Carga de texturas ────────────────────────────────────

  describe('load(): texturas', () => {
    it('carga una imagen y queda disponible vía getTexture', async () => {
      const entry: AssetManifestEntry = { id: 'hero', type: 'texture', path: 'hero.png' };

      await manager.load(entry);

      expect(manager.getTexture('hero')).toBeDefined();
      expect(manager.isLoaded('hero')).toBe(true);
    });

    it('rechaza la promesa si la imagen falla (onerror) y emite asset:load-error', async () => {
      const errorEvents: any[] = [];
      eventBus.on(AssetEvents.LoadError, (p) => errorEvents.push(p));

      const entry: AssetManifestEntry = { id: 'broken', type: 'texture', path: 'fail.png' };

      await expect(manager.load(entry)).rejects.toThrow();
      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0].assetId).toBe('broken');
      expect(manager.isLoaded('broken')).toBe(false);
    });

    it('emite asset:load-complete cuando la textura termina de cargar', async () => {
      const completeEvents: any[] = [];
      eventBus.on(AssetEvents.LoadComplete, (p) => completeEvents.push(p));

      await manager.load({ id: 'hero', type: 'texture', path: 'hero.png' });

      expect(completeEvents).toEqual([{ assetId: 'hero' }]);
    });
  });

  // ── Caché: el requisito más importante de la ficha ──────

  describe('caché', () => {
    it('cargar el mismo asset dos veces solo dispara una carga real (secuencial)', async () => {
      const entry: AssetManifestEntry = { id: 'hero', type: 'texture', path: 'hero.png' };

      await manager.load(entry);
      await manager.load(entry); // segunda vez, ya cacheado

      expect(imageConstructorCallCount).toBe(1); // Image() solo se construyó una vez
    });

    it('una segunda llamada MIENTRAS la primera sigue en curso reusa la misma promesa', async () => {
      const entry: AssetManifestEntry = { id: 'hero', type: 'texture', path: 'hero.png' };

      const first = manager.load(entry);
      const second = manager.load(entry); // llamada antes de que 'first' resuelva

      await Promise.all([first, second]);

      // Clave: solo debe haberse construido UNA instancia de Image,
      // aunque load() se llamó dos veces antes de que la primera terminara.
      expect(imageConstructorCallCount).toBe(1);
    });

    it('isLoaded refleja false antes de cargar y true después', async () => {
      expect(manager.isLoaded('hero')).toBe(false);

      await manager.load({ id: 'hero', type: 'texture', path: 'hero.png' });

      expect(manager.isLoaded('hero')).toBe(true);
    });

    it('unload() libera el asset: isLoaded vuelve a false y getTexture ya no lo devuelve', async () => {
      await manager.load({ id: 'hero', type: 'texture', path: 'hero.png' });
      expect(manager.isLoaded('hero')).toBe(true);

      manager.unload('hero');

      expect(manager.isLoaded('hero')).toBe(false);
      expect(manager.getTexture('hero')).toBeUndefined();
    });

    it('cargar de nuevo después de unload() sí dispara una nueva carga real', async () => {
      const entry: AssetManifestEntry = { id: 'hero', type: 'texture', path: 'hero.png' };

      await manager.load(entry);
      manager.unload('hero');
      await manager.load(entry);

      expect(imageConstructorCallCount).toBe(2); // dos cargas reales, una por cada load()
    });
  });

  // ── Texture atlas ────────────────────────────────────────

  describe('texture atlas', () => {
    const atlasJSON = {
      textureId: 'characters-atlas',
      imagePath: 'characters-atlas.png',
      regions: {
        'furina-idle-0': { x: 0, y: 0, width: 64, height: 64 },
        'furina-idle-1': { x: 64, y: 0, width: 64, height: 64 },
      },
    };

    beforeEach(() => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(atlasJSON),
      });
    });

    it('parsea el formato de atlas y getTextureRegion devuelve el Rect correcto', async () => {
      const entry: AssetManifestEntry = {
        id: 'characters',
        type: 'texture',
        path: 'characters-atlas.png',
        atlasData: 'characters-atlas.json',
      };

      await manager.load(entry);

      expect(manager.getTextureRegion('characters', 'furina-idle-0')).toEqual({
        x: 0, y: 0, width: 64, height: 64,
      });
      expect(manager.getTextureRegion('characters', 'furina-idle-1')).toEqual({
        x: 64, y: 0, width: 64, height: 64,
      });
    });

    it('getTextureRegion con un regionName inexistente devuelve undefined, no lanza', async () => {
      const entry: AssetManifestEntry = {
        id: 'characters', type: 'texture', path: 'characters-atlas.png', atlasData: 'x.json',
      };
      await manager.load(entry);

      expect(manager.getTextureRegion('characters', 'no-existe')).toBeUndefined();
    });

    it('getTextureRegion sobre una textura SIN atlas devuelve undefined', async () => {
      await manager.load({ id: 'plain', type: 'texture', path: 'plain.png' });

      expect(manager.getTextureRegion('plain', 'cualquier-cosa')).toBeUndefined();
    });

    it('fetchea el JSON del atlas usando la ruta de atlasData, no la de path', async () => {
      const entry: AssetManifestEntry = {
        id: 'characters', type: 'texture', path: 'characters-atlas.png', atlasData: 'my-atlas.json',
      };
      await manager.load(entry);

      expect(fetchMock).toHaveBeenCalledWith('my-atlas.json');
    });
  });

  // ── Carga de sonido ──────────────────────────────────────

  describe('load(): sonido', () => {
    beforeEach(() => {
      fetchMock.mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      });
    });

    it('carga un sonido vía fetch + decodeAudioData y queda disponible vía getSound', async () => {
      await manager.load({ id: 'jump', type: 'sound', path: 'jump.wav' });

      expect(manager.getSound('jump')).toBeDefined();
    });

    it('rechaza y emite asset:load-error si fetch responde ok: false', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 404 });
      const errorEvents: any[] = [];
      eventBus.on(AssetEvents.LoadError, (p) => errorEvents.push(p));

      await expect(manager.load({ id: 'jump', type: 'sound', path: 'missing.wav' }))
        .rejects.toThrow();
      expect(errorEvents).toHaveLength(1);
    });
  });

  // ── Carga de JSON ────────────────────────────────────────

  describe('load(): JSON', () => {
    it('carga JSON arbitrario y queda disponible vía getJSON', async () => {
      const sceneData = { entities: ['player', 'enemy'] };
      fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve(sceneData) });

      await manager.load({ id: 'level1', type: 'json', path: 'level1.json' });

      expect(manager.getJSON('level1')).toEqual(sceneData);
    });

    it('getJSON<T> preserva el tipo genérico en tiempo de compilación (chequeo estructural en runtime)', async () => {
      interface LevelData { entities: string[] }
      fetchMock.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ entities: ['a', 'b'] }),
      });

      await manager.load({ id: 'level1', type: 'json', path: 'level1.json' });
      const data = manager.getJSON<LevelData>('level1');

      expect(data?.entities).toEqual(['a', 'b']);
    });
  });

  // ── getters sobre ids no cargados / tipos incorrectos ────

  describe('getters sobre assets no cargados o de tipo incorrecto', () => {
    it('todos los getters devuelven undefined para un id que nunca se cargó', () => {
      expect(manager.getTexture('nada')).toBeUndefined();
      expect(manager.getTextureRegion('nada', 'x')).toBeUndefined();
      expect(manager.getSound('nada')).toBeUndefined();
      expect(manager.getJSON('nada')).toBeUndefined();
    });

    it('getSound sobre un id que en realidad es una textura devuelve undefined, no lanza', async () => {
      await manager.load({ id: 'hero', type: 'texture', path: 'hero.png' });

      expect(manager.getSound('hero')).toBeUndefined();
    });

    it('getTexture sobre un id que en realidad es JSON devuelve undefined, no lanza', async () => {
      fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
      await manager.load({ id: 'data', type: 'json', path: 'data.json' });

      expect(manager.getTexture('data')).toBeUndefined();
    });
  });

  // ── loadManifest(): paralelo + progreso ──────────────────

  describe('loadManifest(): carga en paralelo y progreso', () => {
    it('carga múltiples assets en paralelo, no secuencial', async () => {
      const entries: AssetManifestEntry[] = [
        { id: 'a', type: 'texture', path: 'a.png' },
        { id: 'b', type: 'texture', path: 'b.png' },
        { id: 'c', type: 'texture', path: 'c.png' },
      ];

      await manager.loadManifest(entries);

      expect(manager.isLoaded('a')).toBe(true);
      expect(manager.isLoaded('b')).toBe(true);
      expect(manager.isLoaded('c')).toBe(true);
      // Las 3 instancias de Image() se construyeron antes de que
      // cualquiera resolviera (todas en el mismo microtask de setup),
      // lo que confirma que no se esperó a 'a' antes de empezar 'b'.
      expect(imageConstructorCallCount).toBe(3);
    });

    it('emite asset:load-progress con progreso acumulado del conjunto completo (0.33, 0.66, 1)', async () => {
      const progressEvents: number[] = [];
      eventBus.on(AssetEvents.LoadProgress, (p: any) => progressEvents.push(p.progress));

      const entries: AssetManifestEntry[] = [
        { id: 'a', type: 'texture', path: 'a.png' },
        { id: 'b', type: 'texture', path: 'b.png' },
        { id: 'c', type: 'texture', path: 'c.png' },
      ];

      await manager.loadManifest(entries);

      expect(progressEvents).toHaveLength(3);
      expect(progressEvents[progressEvents.length - 1]).toBe(1); // termina en 100%
      // No aseveramos el ORDEN exacto de los valores intermedios porque
      // son 3 cargas en paralelo con el mismo microtask de duración -
      // el orden de resolución entre ellas no está garantizado y no
      // debería estarlo. Lo que importa es que hay 3 eventos y el último es 1.
    });

    it('con manifest vacío, resuelve inmediato sin emitir progreso', async () => {
      const progressEvents: any[] = [];
      eventBus.on(AssetEvents.LoadProgress, (p) => progressEvents.push(p));

      await manager.loadManifest([]);

      expect(progressEvents).toHaveLength(0);
    });
  });

  // ── loadManifest(): manejo de errores ────────────────────

  describe('loadManifest(): manejo de errores', () => {
    it('modo default (abortOnError: false/omitido): un asset que falla no bloquea a los demás', async () => {
      const entries: AssetManifestEntry[] = [
        { id: 'good1', type: 'texture', path: 'good1.png' },
        { id: 'bad', type: 'texture', path: 'fail.png' },
        { id: 'good2', type: 'texture', path: 'good2.png' },
      ];

      await manager.loadManifest(entries); // no debe lanzar ni colgarse

      expect(manager.isLoaded('good1')).toBe(true);
      expect(manager.isLoaded('good2')).toBe(true);
      expect(manager.isLoaded('bad')).toBe(false);
    });

    it('modo default: emite asset:load-error para el asset específico que falló', async () => {
      const errorEvents: any[] = [];
      eventBus.on(AssetEvents.LoadError, (p) => errorEvents.push(p));

      await manager.loadManifest([
        { id: 'good', type: 'texture', path: 'good.png' },
        { id: 'bad', type: 'texture', path: 'fail.png' },
      ]);

      expect(errorEvents).toHaveLength(1);
      expect(errorEvents[0].assetId).toBe('bad');
    });

    it('con abortOnError: true, un fallo detiene el manifest y la promesa se rechaza', async () => {
      const entries: AssetManifestEntry[] = [
        { id: 'bad', type: 'texture', path: 'fail.png' },
        { id: 'good', type: 'texture', path: 'good.png' },
      ];

      await expect(manager.loadManifest(entries, true)).rejects.toThrow();
    });

    it('loadManifest() nunca queda colgado indefinidamente ante un fallo (siempre resuelve o rechaza)', async () => {
      const entries: AssetManifestEntry[] = [{ id: 'bad', type: 'texture', path: 'fail.png' }];

      // Si esto colgara, Vitest lo marcaría como timeout - el test en sí
      // ES la aserción: que la promesa efectivamente se asiente.
      await expect(manager.loadManifest(entries)).resolves.toBeUndefined();
    });
  });
});
