# Módulo: Sound Manager

**Paquete**: `@mochigo/sound` → carpeta `packages/sound/`
**Depende de**: `@mochigo/assets`, `@mochigo/events`
**Del mapa de arquitectura**: nivel 2 — consume Asset Manager

## 1. Responsabilidad exacta

Reproducir efectos de sonido y música usando la Web Audio API sobre los
`AudioBuffer` ya cargados por el Asset Manager (ver `08-assets.md`). Maneja
volumen general y por categoría (música vs efectos), y el desbloqueo de audio
requerido por los navegadores móviles (no se puede reproducir audio hasta que haya
una interacción del usuario).

## 2. Interfaz principal

```typescript
type SoundCategory = "music" | "sfx";

interface PlaybackOptions {
  category: SoundCategory;
  loop?: boolean;
  volume?: number;     // 0 a 1, relativo al volumen de la categoría
}

class SoundManager {
  constructor(assetManager: AssetManager, eventBus: EventBus);

  // Requerido en navegadores móviles: debe llamarse desde dentro de un handler de un
  // gesto del usuario (touchstart/click) para desbloquear la reproducción de audio
  unlockAudioContext(): Promise<void>;

  play(soundId: string, options: PlaybackOptions): number;  // retorna un playbackId único
  stop(playbackId: number): void;
  stopAll(category?: SoundCategory): void;

  setCategoryVolume(category: SoundCategory, volume: number): void;  // 0 a 1
  getCategoryVolume(category: SoundCategory): number;

  setMuted(muted: boolean): void;
  isMuted(): boolean;
}
```

## 3. Decisión de arquitectura: desbloqueo explícito de audio

Se investigó el comportamiento estándar de navegadores móviles (iOS Safari, Chrome
Android): el `AudioContext` se crea en estado `suspended` hasta que el usuario
interactúa con la página, y cualquier intento de reproducir audio antes de eso falla
silenciosamente o lanza una excepción según el navegador. Por eso `unlockAudioContext()`
es un método explícito y no algo que el `SoundManager` intente resolver solo — el
motor no puede saber por sí mismo cuándo ocurrió la primera interacción del usuario;
eso debe conectarse desde el juego que se construye con el motor (típicamente en el
primer `input:touch-start` o `input:key-down` recibido, ver `07-input.md`).

## 4. Eventos

Ya documentado en la tabla central:

| Evento | Payload |
|---|---|
| `sound:playback-ended` | `{ soundId: string }` |

Este módulo también **escucha** `input:touch-start` (ver `07-input.md`) como
disparador sugerido, aunque documentado, para llamar automáticamente a
`unlockAudioContext()` la primera vez — sin bloquear si el juego prefiere manejarlo
manualmente.

## 5. Checklist de implementación

- [ ] Clase `SoundManager` con la interfaz completa de la sección 2
- [ ] `unlockAudioContext()` crea/resume el `AudioContext` y reproduce un buffer
      silencioso de duración mínima como truco estándar de desbloqueo, resolviendo la
      promesa cuando el contexto pasa a estado `running`
- [ ] `play()` crea un `AudioBufferSourceNode` conectado a un `GainNode` de categoría
      (música o efectos), que a su vez se conecta al `GainNode` maestro — jerarquía de
      3 niveles: nodo individual → gain de categoría → gain maestro, para que
      `setCategoryVolume` y el volumen maestro/mute afecten correctamente sin
      interferir entre sí
- [ ] `stop()`/`stopAll()` detienen y desconectan los nodos correspondientes
      correctamente (liberar referencias, no dejarlos sonando en segundo plano)
- [ ] `setMuted(true)` silencia todo sin perder el valor de volumen previo (al hacer
      `setMuted(false)`, vuelve al volumen que tenía antes, no a volumen máximo)
- [ ] Emisión de `sound:playback-ended` cuando un sonido no-loop termina de forma
      natural (evento `ended` del `AudioBufferSourceNode`)
- [ ] Manejo de que `play()` llamado antes de `unlockAudioContext()` no rompe el
      juego — debe encolar la reproducción y ejecutarla tan pronto el contexto se
      desbloquee, o al menos fallar de forma silenciosa y documentada, nunca lanzar una
      excepción no capturada
- [ ] Tests: la jerarquía de `GainNode` aplica el volumen combinado correctamente
      (volumen de categoría 0.5 × volumen del sonido individual 0.5 = 0.25 efectivo)
- [ ] Tests: `stopAll("sfx")` detiene solo los sonidos de esa categoría, no la música
      en curso
- [ ] Mock de `AudioContext`/`Web Audio API` para poder testear sin un navegador real
