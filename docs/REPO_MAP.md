# Mapa del repositorio

Monolito TypeScript sin base de datos: **cliente React 19 + Vite** (`src/`), **servidor Node ≥ 22.18 que ejecuta TS directamente** (`server/`, sin paso de compilación) y tipos compartidos (`shared/`). Una sola dependencia de runtime (`ws`). No se ha reescrito ninguna parte de la arquitectura: funciona y está probada.

```
server/            Servidor (HTTP estático + WebSocket + APIs REST de juegos)
  index.ts         Arranque, WS de BlackCard/Jenga/práctica, montaje de manejadores HTTP, estáticos
  static.ts        Resolución segura de rutas estáticas + cabeceras
  accounts.ts play-api.ts boxing-free.ts   Modo libre: cuentas de alumno, API de jugador, sparring (ver docs/FREE_PLAY.md)
  security.ts limits.ts   Guard: límites de creación/intentos, IP real (TRUST_PROXY), modo TEACHER_AUTH
  teacher-auth.ts  Claves de profesor respaldadas por el servidor (hash salado) · scripts/teacher-admin.mjs
  room-ttl.ts instance-lock.ts   Caducidad de salas por inactividad · una instancia por DATA_DIR
  room.ts          ★ Máquina de estados de la sala BlackCard: fases, respuestas, objetos, cofres, vista por rol
  tasks.ts         Acto II: rol, escena, palabras, escritura libre, Wort-Jenga (torre, turnos, puntuación)
  grade.ts select.ts  Corrección de preguntas; selección anti-repetición y práctica adaptativa
  bank/            Banco de preguntas (2 391 únicas) por tema; index.ts lo carga y valida
  boxing.ts boxing-bank.ts   Minijuego Boxeo: API REST + banco (2 jugadores + profesor)
  road.ts road-content.ts road-audio/   Road to B1: examen guiado (profesor/alumno/proyector) + audio pregenerado
  progress.ts      Registro de eventos y puntos semanales; ranking; modelo predictivo del profesor (sin ruta)
  store.ts         Persistencia JSON (state.json: salas + perfiles)
  practice-session.ts  Abrir/reanudar práctica individual
shared/            Contratos cliente↔servidor (solo sintaxis borrable): types, rules (PLAN, ITEMS, CHESTS), boxing, road, activities, reading, vocab
src/
  main.tsx App.tsx Router por regex sobre location.pathname (sin librería de rutas)
  design/tokens.css  ★ Design tokens (fuente única) (nuevo)
  styles.css       Aparato de juego (~1 100 líneas, compartido ⚠ zona caliente)
  net.ts           Cliente WS (reconexión, acks) · boxing-client.ts / road-client.ts / progress-client.ts: clientes HTTP
  views/           Una pantalla por ruta: Landing, Course, TopicOne, Practice, Workshop, GameSetup, Teacher, Player, Boxing, Road
  components/      Piezas del juego: Question, Chest, Inventory, Hud, Overlays, Screens, Tasks, Jenga, BoxingRing, Reading, Leaderboard…
  brand/           Identidad web: logo, intro cinemática, hero 3D, campo ambiente, transiciones, efectos (+ CSS propio)
  klaus/           Mascota Klaus (README propio; solo lee el estado público)
  fx/              Partículas, sonido, «juice», animación de la BlackCard 3D
  course.ts catalog.ts   Itinerario del curso y catálogo de presentaciones
public/presentaciones/   8 presentaciones HTML autónomas + 5 PDF; catalogo.json con SHA-256 (un test las protege)
tests/             Vitest (48 ficheros en `tests/` + 3 en `src/`, 336 tests) + scripts de navegador *.mjs (Playwright/CDP)
scripts/           E2E (`e2e`, `tour`, `ui`…), estadísticas del banco, importadores
docs/              Notas por módulo (progress, road-to-b1, klaus, rediseño…) + los documentos de esta auditoría
```

## Rutas del cliente (`src/App.tsx`)
`/` Landing · `/libre` (modo libre) · `/libre/jugar` · `/curso` · `/tema/1` · `/tema/1/taller` · `/practica` · `/jugar` y `/jenga` (GameSetup) · `/t/CÓDIGO` (profesor) · `/p/CÓDIGO` (alumno) · `/boxeo` · `/road-to-b1` · `/profesor` (próximamente) · `/preview/klaus`.

## Sesiones multijugador (tres transportes distintos)
| Juego | Transporte | Estado | Auth |
|---|---|---|---|
| BlackCard, Wort-Jenga, Acto II, práctica | **WebSocket** `/ws`, el servidor emite `state` completo por rol tras cada acción | `Room` en memoria → `state.json` (debounce 300 ms) | `teacherToken` / token de jugador en `hello` |
| Boxeo | REST `/api/boxing/*`, sondeo | `boxing.json` | `Authorization: Bearer` (profesor / boxeador) |
| Road to B1 | REST `/api/road/*`, sondeo + audio con permisos de un solo uso | `road.json` | Bearer (profesor / proyector / alumno) |

**Vistas:** *profesor* (`Teacher.tsx`, controla todo y recibe soluciones), *alumno* (`Player.tsx`, `Practice.tsx`, vista redactada) y *proyector*: en BlackCard/Jenga/Boxeo **el proyector es la pantalla del profesor** (no hay rol distinto); solo Road tiene un rol `projector` de solo lectura con token propio.

## Minijuegos
- **BlackCard** — `room.ts` + `shared/rules.ts` (PLAN de 14 bloques, objetos, cofres) · UI en `components/` (`Question`, `Inventory`, `Chest`, `Overlays`, `Screens`) y `fx/blackcard3d.ts`.
- **Wort-Jenga** — lógica y puntuación en `tasks.ts` (`jengaPull`, torre, riesgo) · UI `components/Jenga.tsx`/`Tasks.tsx`.
- **Boxeo** — autocontenido: `shared/boxing.ts`, `server/boxing*.ts`, `src/boxing-client.ts`, `views/Boxing.tsx`, `components/Boxing*.tsx`, `boxing.css`. **Es el patrón de referencia** para juegos nuevos.
- **Road to B1** — `shared/road.ts`, `server/road*.ts`, `road-client.ts`, `views/Road.tsx`, `components/RoadActivity.tsx`, `road.css`.

## Persistencia, auth y despliegue
- Todo en `DATA_DIR` (por defecto `./data`): `state.json`, `progress.json`, `boxing.json`, `road.json`. Escritura atómica (tmp + rename). Sin base de datos.
- **No hay cuentas.** Identidad = token de sala (aleatorio, en `localStorage`) + `profile` (UUID de dispositivo) + «código de alumno» de 6 caracteres. Ver `SECURITY_AUDIT.md`.
- Despliegue: `Dockerfile` (node 22.19-alpine, `npm ci && npm run build`, sirve `dist/`), `render.yaml` (Render con disco de 1 GB). Health: `/api/health`. Se necesita WebSocket y un solo proceso (el estado vive en memoria: **no escalar horizontalmente**).

## Calidad: qué se ejecuta
`npm test` (Vitest: lógica, servidor real por WS, UI por análisis estático) · `npm run check` (tsc estricto) · `npm run build` · `npm run e2e` (servidor real, 100 % verde) · `npm run bank` (estadísticas del banco) · scripts `*-ui.mjs` y `tests/*-browser.mjs` (Chromium; manuales). No hay CI configurado (`.github/` no existe).

## Zonas calientes (alto riesgo de conflicto entre agentes)
`server/index.ts` (montaje de manejadores) · `src/App.tsx` (rutas) · `shared/types.ts` · `src/styles.css` · `package.json` · `server/room.ts` (913 líneas, núcleo de reglas). Ver `PARALLEL_DEVELOPMENT.md`.
