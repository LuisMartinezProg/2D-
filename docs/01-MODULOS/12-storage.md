# Módulo: Storage / Save System

**Paquete**: `@mochigo/storage` → carpeta `packages/storage/`
**Depende de**: nada (deliberadamente aislado — ver sección 2)
**Del mapa de arquitectura**: nivel 1 — usado por Scripting típicamente, para guardar
progreso del juego

## 1. Responsabilidad exacta

Guardar y recuperar datos persistentes del juego (progreso, configuración,
puntuaciones) entre sesiones, usando `localStorage` del navegador como backend en la
v1. Provee una capa de abstracción simple para que el resto del motor (y sobre todo
el código de gameplay del usuario final, vía Scripting) no dependa directamente de la
API de `localStorage`.

## 2. Decisión de arquitectura: sin dependencias de otros módulos del motor

Este módulo se mantiene deliberadamente sin depender de ECS, Events, ni ningún otro
paquete del motor. Motivo: guardar/cargar datos es una operación que conceptualmente
no tiene nada que ver con el ciclo de frame del juego ni con el ECS — es
infraestructura de persistencia pura, similar a Math Library en cuanto a su nivel de
aislamiento. Esto también facilita testearlo sin necesitar mockear el resto del
motor.

## 3. Interfaz principal

```typescript
class StorageManager {
  constructor(namespace: string);  // prefijo para evitar colisiones si hay más de un
                                     // juego construido con este motor corriendo en el
                                     // mismo dominio/origen

  save<T>(key: string, data: T): void;
  load<T>(key: string): T | undefined;
  remove(key: string): void;
  clear(): void;  // borra todo lo guardado bajo este namespace, no todo localStorage
  has(key: string): boolean;
}
```

## 4. Decisiones de diseño importantes

- **Namespace obligatorio en el constructor**: todas las claves internas se
  almacenan como `` `${namespace}:${key}` `` en `localStorage`. Esto evita que dos
  juegos distintos construidos con este motor, si terminan sirviéndose desde el mismo
  origen (por ejemplo, en un portal de juegos), pisen los datos guardados el uno del
  otro.
- **Serialización JSON automática**: `save`/`load` serializan/deserializan a JSON
  internamente — quien use este módulo trabaja con objetos de TypeScript normales,
  nunca con strings.
- **Manejo de cuota excedida**: `localStorage` tiene un límite de tamaño (varía por
  navegador, típicamente 5-10MB). `save()` debe capturar el error de cuota excedida
  (`QuotaExceededError`) y no dejar que se propague como una excepción no manejada
  que rompa el juego — debe retornar o exponer de alguna forma clara que el guardado
  falló (a definir la forma exacta durante la implementación: puede ser un valor de
  retorno booleano, o un evento si se decide que vale la pena depender de
  `@mochigo/events` solo para esto — evaluar costo/beneficio en el momento).

## 5. Checklist de implementación

- [ ] Clase `StorageManager` con la interfaz completa de la sección 3
- [ ] Namespacing de claves según sección 4
- [ ] Serialización/deserialización JSON automática y transparente
- [ ] Manejo de `QuotaExceededError` sin excepción no capturada, según sección 4
- [ ] `load()` sobre una clave que no existe retorna `undefined`, no lanza excepción
      ni retorna `null`
- [ ] `load()` sobre datos corruptos (JSON inválido, por ejemplo si algo externo tocó
      el `localStorage` directamente) debe manejarse sin excepción no capturada —
      tratarlo igual que "no existe" (retornar `undefined`) es una opción válida,
      documentar la decisión tomada
- [ ] `clear()` borra únicamente las claves bajo el namespace de esta instancia, sin
      tocar otras claves de `localStorage` que puedan pertenecer a otro namespace u
      otro uso del navegador
- [ ] Tests: guardar y cargar un objeto complejo (anidado, con arrays) produce un
      resultado equivalente
- [ ] Tests: dos instancias de `StorageManager` con distinto namespace no interfieren
      entre sí aunque usen la misma clave interna
- [ ] Tests: simular `QuotaExceededError` (se puede mockear `localStorage.setItem`
      para que lance ese error) y verificar el manejo correcto
- [ ] Tests: `clear()` no borra claves de otro namespace presentes en el mismo
      `localStorage`
