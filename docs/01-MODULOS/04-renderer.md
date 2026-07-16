# Módulo: Renderer + Camera Manager

**Paquete**: `@mochigo/renderer` → carpeta `packages/renderer/`
**Depende de**: `@mochigo/math`, `@mochigo/ecs`, `@mochigo/assets` (para texturas)
**Del mapa de arquitectura**: nivel 2 — consume ECS y Assets, es consumido por Animation

## 1. Responsabilidad exacta

Dibujar en pantalla el estado actual del `World`: recorrer las entidades con
componentes `Transform` + `Sprite`, resolver su transformación mundial (incluyendo
jerarquías padre-hijo), y dibujarlas en el canvas respetando orden de capas (layers) y
la cámara activa. Incluye el manejo de la cámara (viewport, zoom, seguimiento).

## 2. Decisión de arquitectura: Canvas 2D como base, con capas offscreen

Se investigaron los enfoques estándar (Canvas 2D inmediato vs motores con scene graph
tipo PixiJS/WebGL). Decisión para la primera versión del motor:

- **Canvas 2D API** (`CanvasRenderingContext2D`) como backend de dibujo, no WebGL
  directo. Motivo: es universalmente soportado, no requiere manejar shaders a mano, y
  es más que suficiente para la escala de juegos 2D indie/hobby a la que apunta este
  motor. Un backend WebGL queda como posible extensión futura detrás de la misma
  interfaz `Renderer` (ver sección 5), sin comprometerse a implementarlo ahora.
- **Sistema de capas con canvas offscreen por capa**: cada `Layer` tiene su propio
  `OffscreenCanvas` (o canvas oculto si `OffscreenCanvas` no está disponible en el
  navegador). Solo se vuelve a dibujar una capa si algo dentro de ella cambió
  ("dirty flag" por capa), y el canvas final visible compone las capas encima una de
  otra en el orden correcto. Esto evita redibujar el fondo estático en cada frame
  solo porque un personaje se movió en la capa de encima.
- **Batching por textura**: al dibujar sprites, agrupar los draw calls por textura de
  origen (evitar cambiar de textura constantemente), ya que cambiar de textura tiene
  costo incluso en Canvas 2D.

## 3. Componentes ECS que este módulo define

```typescript
class Sprite {
  static readonly componentName = "Sprite";
  constructor(
    public textureId: string,        // referencia al Asset Manager, no la imagen directamente
    public sourceRect: Rect | null = null,  // región del atlas a usar; null = imagen completa
    public layer: number = 0,        // capa de renderizado, mayor = más "encima"
    public tint: string = "#FFFFFF", // color de tinte, blanco = sin tinte
    public opacity: number = 1,      // 0 a 1
    public flipX: boolean = false,
    public flipY: boolean = false,
    public visible: boolean = true
  ) {}
}

class Camera {
  static readonly componentName = "Camera";
  constructor(
    public zoom: number = 1,
    public followTarget: EntityId | null = null,
    public followSmoothing: number = 0,  // 0 = seguimiento instantáneo, mayor = más suave
    public bounds: Rect | null = null,   // límites del mundo que la cámara no debe cruzar; null = sin límite
    public active: boolean = true        // solo una cámara activa a la vez debe usarse para renderizar
  ) {}
}
```

## 4. Interfaz del Renderer

```typescript
interface RendererConfig {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  backgroundColor: string;
  pixelArt: boolean;  // si es true, desactiva el suavizado (imageSmoothingEnabled = false)
}

class Renderer {
  constructor(config: RendererConfig, assetManager: AssetManager);

  // Se llama en cada onRender del Game Loop
  render(world: World, interpolation: number): void;

  // Gestión de capas
  createLayer(name: string, order: number): void;
  removeLayer(name: string): void;
  setLayerVisible(name: string, visible: boolean): void;

  resize(width: number, height: number): void;
}
```

## 5. Cálculo de la transformación mundial (world transform)

Como se definió en `01-ecs.md` sección 6, `Transform.parent` almacena solo el dato —
este módulo es responsable de resolverlo. Al renderizar una entidad con `parent` no
nulo, la transformación final a usar es la multiplicación de la matriz local de la
entidad por la transformación mundial ya resuelta de su padre (recursivo hacia la
raíz). Esto debe implementarse con **memoización dentro del mismo frame**: si dos
hermanos comparten un padre, la transformación mundial del padre se calcula una sola
vez por frame, no una vez por cada hijo.

## 6. Eventos

| Evento | Payload | Cuándo se emite |
|---|---|---|
| `renderer:resized` | `{ width: number, height: number }` | al llamar `resize()` |

Este módulo mayormente **escucha** eventos de otros (`asset:load-complete` para saber
cuándo una textura referenciada por un `Sprite` ya está lista) más que emitirlos.

## 7. Checklist de implementación

- [ ] Componentes `Sprite` y `Camera` tal como están especificados en la sección 3
- [ ] Clase `Renderer` con la interfaz de la sección 4
- [ ] Sistema de capas con canvas offscreen y dirty-flag por capa, según sección 2
- [ ] Batching por textura al dibujar sprites de la misma capa
- [ ] Resolución de jerarquía padre-hijo con memoización por frame, según sección 5
- [ ] Aplicación correcta de la cámara activa: traslación según posición del target
      seguido (con `followSmoothing` si aplica), zoom, y clamping a `bounds` si están
      definidos
- [ ] Manejo de `flipX`/`flipY`/`tint`/`opacity` al dibujar cada sprite
- [ ] Modo `pixelArt` desactiva el suavizado de imagen correctamente
- [ ] Tests: dado un World con una jerarquía de 3 niveles de Transform padre-hijo,
      verificar que la posición mundial final calculada es la esperada
- [ ] Tests: verificar que una capa con `visible: false` no se dibuja
- [ ] Tests de la cámara: zoom afecta la escala de lo dibujado, `bounds` efectivamente
      limita el desplazamiento
- [ ] Documentar en el README cómo se agregaría en el futuro un backend WebGL detrás
      de esta misma interfaz `Renderer`, sin implementarlo todavía
