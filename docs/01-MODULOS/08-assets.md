# Módulo: Asset Manager

**Paquete**: `@mochigo/assets` → carpeta `packages/assets/`
**Depende de**: `@mochigo/events`
**Del mapa de arquitectura**: nivel 1 — usado por Renderer, Scene Manager, Sound
Manager, Animation

## 1. Responsabilidad exacta

Cargar, cachear y dar acceso a todo el contenido externo del juego: imágenes
(incluyendo atlas de sprites), archivos de sonido, y datos JSON (definiciones de
escena, clips de animación, etc.). Todo acceso es asíncrono (basado en Promises) y
cacheado — pedir el mismo asset dos veces no debe volver a descargarlo.

## 2. Interfaz principal

```typescript
type AssetType = "texture" | "sound" | "json";

interface AssetManifestEntry {
  id: string;         // identificador único usado en todo el motor para referenciar este asset
  type: AssetType;
  path: string;        // ruta relativa al asset
  atlasData?: string;  // solo para type: "texture" con atlas — ruta al JSON de regiones
}

class AssetManager {
  constructor(eventBus: EventBus);

  // Carga un solo asset. Si ya está cacheado, retorna inmediatamente sin re-descargar.
  load(entry: AssetManifestEntry): Promise<void>;

  // Carga un conjunto de assets en paralelo, emitiendo asset:load-progress conforme avanza
  loadManifest(entries: AssetManifestEntry[]): Promise<void>;

  getTexture(id: string): HTMLImageElement | undefined;
  getTextureRegion(id: string, regionName: string): Rect | undefined;  // para atlas
  getSound(id: string): AudioBuffer | undefined;
  getJSON<T = unknown>(id: string): T | undefined;

  isLoaded(id: string): boolean;
  unload(id: string): void;  // libera de caché — usado al descargar una escena
}
```

## 3. Formato de texture atlas (JSON)

Basado en el formato estándar de la industria (compatible con el estilo que produce
TexturePacker en modo "JSON Array", el más comúnmente soportado por motores 2D):

```json
{
  "textureId": "characters-atlas",
  "imagePath": "characters-atlas.png",
  "regions": {
    "furina-idle-0": { "x": 0, "y": 0, "width": 64, "height": 64 },
    "furina-idle-1": { "x": 64, "y": 0, "width": 64, "height": 64 }
  }
}
```

`getTextureRegion(id, regionName)` retorna el `Rect` correspondiente, listo para
usarse directamente como `Sprite.sourceRect` (ver `04-renderer.md` sección 3) o
dentro de un `AnimationClip.frames` (ver `05-animation.md` sección 2).

## 4. Decisión de arquitectura: manifest declarativo, no carga imperativa dispersa

Se investigaron dos patrones: cargar assets uno por uno de forma imperativa desde
distintas partes del código del juego, vs. declarar manifiestos de assets por escena
y cargarlos todos de una vez al entrar a esa escena. Se elige el segundo enfoque
(manifest declarativo) porque:

- Permite mostrar una pantalla de carga con progreso real (`asset:load-progress`)
  antes de que la escena empiece a ejecutarse.
- El Scene Manager puede saber de antemano qué assets necesita cada escena sin tener
  que ejecutar lógica de juego primero.
- Facilita que el Editor Visual muestre qué assets usa cada escena sin tener que
  interpretar código.

## 5. Eventos

Ya documentados en la tabla central, reproducidos aquí:

| Evento | Payload |
|---|---|
| `asset:load-progress` | `{ assetId: string, progress: number }` (0 a 1) |
| `asset:load-complete` | `{ assetId: string }` |
| `asset:load-error` | `{ assetId: string, error: string }` |

## 6. Checklist de implementación

- [ ] Clase `AssetManager` con la interfaz completa de la sección 2
- [ ] Carga de imágenes vía `Image()` + Promise que resuelve en `onload`, rechaza en
      `onerror`
- [ ] Carga de sonido vía `fetch` + `AudioContext.decodeAudioData`
- [ ] Carga de JSON vía `fetch` + `.json()`
- [ ] Parseo del formato de atlas de la sección 3, poblando un mapa de
      `regionName → Rect` accesible vía `getTextureRegion`
- [ ] Caché: una segunda llamada a `load()` con el mismo `id` no dispara una nueva
      petición de red — retorna la promesa ya en curso si está cargando, o resuelve
      inmediato si ya cargó
- [ ] `loadManifest()` carga en paralelo (no secuencial) y emite
      `asset:load-progress` con el progreso acumulado de todo el conjunto, no solo de
      un asset individual
- [ ] Manejo de error: si un asset del manifest falla, `loadManifest()` no debe
      colgarse esperando indefinidamente — debe emitir `asset:load-error` para ese
      asset específico y la decisión de si eso aborta todo el manifest o continúa con
      el resto debe ser configurable (parámetro opcional, default: continuar con el
      resto y reportar todos los errores al final)
- [ ] `unload()` efectivamente libera la referencia para que el recolector de basura
      pueda liberar la memoria (importante en un contexto de celular con RAM limitada)
- [ ] Tests: cargar el mismo asset dos veces solo dispara una carga real (se puede
      verificar contando cuántas veces se invoca el mock de `fetch`/`Image`)
- [ ] Tests: parseo correcto del formato de atlas de ejemplo de la sección 3
- [ ] Tests: `asset:load-error` se emite correctamente y no bloquea el resto del
      manifest
