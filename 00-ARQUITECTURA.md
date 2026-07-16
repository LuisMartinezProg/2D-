# MochiGo Engine — Arquitectura General

> **Este documento es de lectura obligatoria antes de trabajar en cualquier módulo.**
> Si estás en un chat nuevo trabajando en un módulo específico, lee este archivo completo
> y luego el archivo de tu módulo en `01-MODULOS/`. No empieces a escribir código sin
> haber leído ambos.

## 1. Qué es este proyecto

Motor de juegos 2D, corriendo en navegador (web), escrito en **TypeScript**, pensado
para poder probarse desde celular (Canvas/WebGL, sin dependencias nativas). Es
"completo": incluye editor visual, sistema de assets, y scripting para lógica de juego
del usuario final.

## 2. Stack tecnológico (fijo, no cambiar sin discutirlo en este documento)

| Área | Decisión |
|---|---|
| Lenguaje | TypeScript (strict mode) |
| Runtime | Navegador (ES2022+) |
| Renderizado | Canvas 2D API como base; WebGL como backend opcional acelerado (ver módulo Renderer) |
| Build | Vite |
| Gestor de paquetes | npm, estructura de **monorepo** (npm workspaces) |
| Testing | Vitest |
| Repo | GitHub, un solo repositorio con múltiples paquetes internos |

## 3. Patrón arquitectónico central: ECS (Entity Component System)

Todo el motor gira alrededor de un ECS. Esto es la decisión más importante del proyecto
y todos los módulos deben respetarla:

- **Entity**: solo un ID numérico. No contiene datos ni lógica.
- **Component**: contenedor de datos puro (sin métodos, sin lógica). Ej: `Position`,
  `Sprite`, `Velocity`.
- **System**: contiene la lógica. Cada frame, recorre las entidades que tienen cierta
  combinación de componentes y opera sobre sus datos.

Implementación elegida: **sparse set** (no archetype-based). Motivo: más simple de
implementar correctamente, suficiente rendimiento para un motor 2D orientado a juegos
indie/hobby, y permite añadir/quitar componentes en caliente sin reestructurar tablas.
Cada tipo de componente vive en su propio array indexado por sparse set, usando el ID
de la entidad como clave.

Ver ficha completa en `01-MODULOS/01-ecs.md`.

## 4. Mapa de módulos y dependencias

```
                         ┌─────────────────┐
                         │   Math Library   │  (sin dependencias — todos dependen de esta)
                         └────────┬─────────┘
                                  │
                         ┌────────▼─────────┐
                         │       ECS         │  (núcleo — todo lo demás se conecta aquí)
                         └────────┬─────────┘
                                  │
              ┌───────────────────┼───────────────────┐
              │                   │                   │
     ┌────────▼────────┐ ┌────────▼────────┐ ┌────────▼────────┐
     │   Event Manager   │ │   Game Loop      │ │  Scene Manager   │
     └────────┬────────┘ └────────┬────────┘ └────────┬────────┘
              │                   │                   │
   ┌──────────┼──────────┬────────┴────────┬──────────┼──────────┐
   │          │          │                 │          │          │
┌──▼──┐  ┌────▼───┐ ┌────▼────┐    ┌───────▼──┐  ┌────▼────┐ ┌───▼────┐
│Input │  │Renderer│ │ Physics/ │    │  Asset   │  │  Sound   │ │Scripting│
│Manager│ │+Camera │ │Collisions│    │ Manager  │  │ Manager  │ │ System  │
└──────┘  └────┬───┘ └─────────┘    └────┬─────┘  └─────────┘ └───┬────┘
               │                          │                        │
        ┌──────▼──────┐            ┌──────▼──────┐          ┌──────▼──────┐
        │  Animation   │            │   Storage/   │          │Editor Visual │
        │    System    │            │    Save      │          │              │
        └─────────────┘            └─────────────┘          └─────────────┘
```

Regla de dependencia: **un módulo solo puede depender de los módulos que están arriba
de él en este mapa (o al mismo nivel, comunicándose vía Event Manager), nunca de uno
que está más abajo.** Esto evita dependencias circulares entre paquetes del monorepo.

## 5. Cómo se comunican los módulos entre sí

Dos mecanismos, no mezclar:

1. **Comunicación directa (llamada a función/método)**: solo permitida en la dirección
   de dependencia del mapa de arriba. Ej: el Renderer puede leer directamente
   componentes `Position` y `Sprite` del ECS porque ECS está "arriba" en el mapa.

2. **Comunicación por eventos (Event Manager, patrón pub/sub)**: obligatoria para
   cualquier comunicación entre módulos que están al mismo nivel o que irían "hacia
   abajo" en el mapa. Ej: cuando Physics detecta una colisión, no llama directamente a
   Scripting — emite un evento `collision:enter` y Scripting se suscribe a ese evento
   si le interesa.

Todo evento del motor debe registrarse en `01-MODULOS/03-event-manager.md`, en la
tabla de eventos estándar, con su nombre exacto, payload (forma de los datos) y qué
módulos lo emiten/escuchan. Si tu módulo necesita un evento nuevo, agrégalo a esa
tabla como parte de tu trabajo — no lo inventes sobre la marcha sin documentarlo.

## 6. Estructura de carpetas del repositorio (monorepo)

```
mochigo-engine/
├── packages/
│   ├── math/                 → Módulo Math Library
│   ├── ecs/                  → Módulo ECS
│   ├── events/               → Módulo Event Manager
│   ├── core/                 → Game Loop + integración general
│   ├── renderer/             → Renderer + Camera Manager
│   ├── animation/            → Animation System
│   ├── physics/              → Physics/Collisions
│   ├── input/                → Input Manager
│   ├── scenes/                → Scene Manager
│   ├── assets/                → Asset Manager
│   ├── sound/                 → Sound Manager
│   ├── scripting/             → Scripting System
│   ├── storage/               → Storage/Save System
│   └── editor/                 → Editor Visual (consume todos los demás paquetes)
├── apps/
│   └── playground/            → app mínima para probar el motor mientras se construye
├── docs/
│   ├── 00-ARQUITECTURA.md     → este archivo
│   └── 01-MODULOS/            → una ficha .md por módulo
└── package.json                → workspaces root
```

Cada paquete en `packages/` es un paquete npm independiente dentro del monorepo
(`@mochigo/nombre-paquete`), con su propio `package.json`, y declara explícitamente
de qué otros paquetes de `@mochigo/*` depende — esa lista de dependencias debe
coincidir con el mapa de la sección 4.

## 7. Convención de nombres de eventos

`dominio:accion`, todo en minúsculas, en inglés (el código y nombres técnicos del
proyecto van en inglés; la documentación puede ir en español). Ejemplos:
`collision:enter`, `collision:exit`, `scene:loaded`, `asset:load-error`,
`input:touch-start`.

## 8. Flujo de trabajo para dividir el trabajo entre chats

1. Este documento (`00-ARQUITECTURA.md`) y la ficha del módulo correspondiente en
   `01-MODULOS/` se le pasan completos a un chat nuevo antes de pedirle que trabaje.
2. Un chat trabaja **un solo módulo a la vez**, dentro de su carpeta en `packages/`.
   No debe modificar código de otro paquete — si necesita algo de otro módulo que no
   existe todavía, lo deja anotado como pendiente/mock y sigue.
3. Cuando termina la checklist completa de su ficha, hace commit/push a una rama
   propia del módulo (`feature/nombre-modulo`) y se marca como listo para
   integración.
4. La integración entre ramas (resolver conflictos, verificar que las interfaces
   entre módulos calzan) se hace en un chat aparte, dedicado solo a integración, que
   sí tiene permiso de tocar más de un paquete.

## 9. Estado del proyecto

Esta sección se actualiza a mano conforme avanza el proyecto — cada módulo indica su
estado: `no iniciado` / `en progreso` / `listo para integración` / `integrado`.

| Módulo | Estado |
|---|---|
| Math Library | no iniciado |
| ECS | no iniciado |
| Event Manager | no iniciado |
| Game Loop | no iniciado |
| Renderer + Camera | no iniciado |
| Animation System | no iniciado |
| Physics/Collisions | no iniciado |
| Input Manager | no iniciado |
| Scene Manager | no iniciado |
| Asset Manager | no iniciado |
| Sound Manager | no iniciado |
| Scripting System | no iniciado |
| Storage/Save | no iniciado |
| Editor Visual | no iniciado |
