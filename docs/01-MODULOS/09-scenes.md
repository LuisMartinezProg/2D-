# Módulo: Scene Manager

**Paquete**: `@mochigo/scenes` → carpeta `packages/scenes/`
**Depende de**: `@mochigo/ecs`, `@mochigo/assets`, `@mochigo/events`
**Del mapa de arquitectura**: nivel 2 — orquesta la carga de contenido en el ECS

## 1. Responsabilidad exacta

Cargar y descargar "escenas" (niveles, pantallas del juego): definiciones
serializadas en JSON que describen qué entidades existen al empezar la escena, con
qué componentes, y qué assets necesita esa escena. Coordina con Asset Manager (para
cargar el contenido necesario) y con ECS (para poblar el `World` con las entidades
definidas).

## 2. Formato de serialización de escena (JSON)

```json
{
  "name": "nivel-1",
  "manifest": [
    { "id": "characters-atlas", "type": "texture", "path": "characters-atlas.png", "atlasData": "characters-atlas.json" }
  ],
  "entities": [
    {
      "components": {
        "Transform": { "position": { "x": 100, "y": 200 }, "rotation": 0, "scale": { "x": 1, "y": 1 } },
        "Sprite": { "textureId": "characters-atlas", "sourceRect": null, "layer": 1 }
      }
    }
  ]
}
```

Cada entrada dentro de `"components"` usa como clave el `componentName` estático
definido por cada clase de componente (ver `01-ecs.md` sección 3) — esto es lo que
permite que el sistema de serialización sea genérico y no necesite saber de antemano
qué tipos de componentes existen; solo necesita un registro de
`componentName → ComponentClass` para poder reconstruir instancias.

## 3. Interfaz principal

```typescript
// Función de (de)serialización que cada módulo que define componentes debe registrar
type ComponentSerializer<T> = {
  serialize(instance: T): Record<string, unknown>;
  deserialize(data: Record<string, unknown>): T;
};

class SceneManager {
  constructor(world: World, assetManager: AssetManager, eventBus: EventBus);

  // Cada módulo que define componentes (Renderer, Physics, Animation, etc.) debe
  // llamar esto durante su propia inicialización, para que sus componentes puedan
  // guardarse/cargarse en escenas
  registerComponent<T>(componentClass: ComponentClass<T>, serializer: ComponentSerializer<T>): void;

  loadScene(sceneData: SceneDefinition): Promise<void>;
  unloadCurrentScene(): void;
  getCurrentSceneName(): string | null;

  // Sirve para el Editor Visual: exportar el estado actual del World a una definición
  // de escena serializable, para poder guardarla
  serializeCurrentScene(): SceneDefinition;
}

interface SceneDefinition {
  name: string;
  manifest: AssetManifestEntry[];
  entities: Array<{
    components: Record<string, Record<string, unknown>>;
  }>;
}
```

## 4. Orden de operaciones en `loadScene()`

1. Emitir `scene:loading`.
2. Si hay una escena actual cargada, llamar `unloadCurrentScene()` primero (limpiar
   entidades de la escena anterior del `World`, y des-cachear del Asset Manager los
   assets que ya no se necesitan — comparar el manifest de la escena vieja contra la
   nueva para no descargar assets compartidos entre ambas).
3. Cargar el `manifest` de la nueva escena vía `AssetManager.loadManifest()`.
4. Una vez cargados los assets, crear las entidades: para cada entrada en
   `entities`, llamar `World.createEntity()` y luego, para cada componente
   declarado, usar el `deserialize` registrado para esa clase de componente y
   `World.addComponent()`.
5. Emitir `scene:loaded`.

## 5. Eventos

Ya documentados en la tabla central, reproducidos aquí:

| Evento | Payload |
|---|---|
| `scene:loading` | `{ sceneName: string }` |
| `scene:loaded` | `{ sceneName: string }` |
| `scene:unloaded` | `{ sceneName: string }` |

## 6. Checklist de implementación

- [ ] Clase `SceneManager` con la interfaz completa de la sección 3
- [ ] Sistema de registro de serializadores por tipo de componente
      (`registerComponent`), con un registro interno `componentName → ComponentSerializer`
- [ ] `loadScene()` siguiendo exactamente el orden de la sección 4
- [ ] `unloadCurrentScene()` destruye todas las entidades de la escena actual en el
      `World` y descarga (vía `AssetManager.unload`) los assets exclusivos de esa
      escena — nunca los que también use la próxima escena, si aplica
- [ ] `serializeCurrentScene()` recorre todas las entidades vivas del `World` y, para
      cada una, todos sus componentes registrados, produciendo un `SceneDefinition`
      válido según el formato de la sección 2
- [ ] Manejo de error si la definición de escena referencia un `componentName` que no
      fue registrado (debe fallar con un mensaje de error claro indicando qué
      componente falta registrar, no fallar silenciosamente ni con un error genérico)
- [ ] Tests: cargar una escena de ejemplo (como la de la sección 2) puebla el `World`
      con la entidad y componentes esperados
- [ ] Tests: round-trip — serializar una escena cargada y volver a cargarla produce un
      `World` equivalente (mismas entidades con los mismos valores de componentes)
- [ ] Tests: cargar una segunda escena descarga correctamente las entidades de la
      primera
- [ ] Tests: dos escenas consecutivas que comparten un asset en su manifest no lo
      descargan al pasar de una a otra (verificar contando llamadas a
      `AssetManager.unload`)
