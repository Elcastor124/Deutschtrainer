# Auditoría de seguridad — base antes de añadir cuentas

Alcance: `server/` (HTTP + WebSocket), `shared/`, despliegue (`Dockerfile`, `render.yaml`). Método: lectura completa de los puntos de entrada y pruebas de caja negra contra un servidor real (`tests/security.test.ts`).

## Veredicto sobre la pregunta clave
**Un alumno NO puede ejecutar operaciones exclusivas del profesor ni modificar arbitrariamente puntuaciones.** Comprobado en código y con test:

| Superficie | Cómo se protege | Verificado |
|---|---|---|
| Acciones de profesor (WS `ctl`: bloques, puntos, regalos de objetos/cofres, expulsar, juzgar, tareas, pausa, tiempo) | `handleMsg` rechaza `ctl` si `c.role !== 'teacher'`; el rol lo fija el servidor en `hello` y solo se concede con `teacherToken` (128 bits, aleatorio) | test: 14 acciones enviadas por un alumno → todas `ok:false`, puntuaciones/objetos/fase intactos |
| Entrar como profesor | `room.s.teacherToken !== m.token` → error fatal. Los tokens de alumnos no valen | test: sin token, vacío, inventado, de alumno → rechazado |
| Puntuaciones | Solo el servidor suma: `Room.answer` corrige con `grade()`; `points` (±50) solo vía `ctl`; el cliente nunca envía puntos | revisión + test |
| Inventario / cofres | `useItem` valida con `checkUse` (posesión, fase, objetivo); `openChest` solo cofres propios; contenido de cada cofre decidido al crearlo | revisión + test |
| Preguntas / soluciones | El alumno recibe `publicView` (sin respuesta); `view().teacher` (soluciones, inventarios ajenos) solo para el profesor | test: sin `teacher` ni token en la vista del alumno |
| Estado del juego | Transiciones (`next`, `skip`, `lock`…) solo profesor; `answer` exige `qid` activo y no final | revisión + test |
| Road to B1 y Boxeo (HTTP) | Bearer token por rol (profesor/proyector/alumno); `teacherActions` y comprobaciones 403 por acción; puntos de juego acotados a 0–50 por el servidor | revisión |
| Puntos semanales | `ProgressLog.record` calcula los puntos en el servidor; anti-farming por pregunta/día | `tests/progress.test.ts` |
| Tamaños | WS `maxPayload` 16 KB; cuerpos HTTP ≤ 32 KB (boxeo); textos recortados (`MAX_TEXT`, 300/60 chars en respuestas) | revisión |

## Hallazgos y estado

| # | Sev. | Hallazgo | Estado |
|---|---|---|---|
| S1 | **Alta** | **DoS sin autenticación:** `GET /%E0%A4%A` lanzaba `URIError` en `decodeURIComponent` dentro del listener HTTP y **terminaba el proceso Node**, tirando todas las salas en curso. Reproducido. | **Corregido** — `server/static.ts` (`resolveStatic`) + `try/catch` alrededor del listener; devuelve 400/500 |
| S2 | Baja | Comprobación de ruta estática con `startsWith(DIST)`: un directorio hermano con el mismo prefijo (`dist-x`) pasaba. Sin exposición real hoy (no existe), pero frágil. | **Corregido** — `path.relative`; cubierto por test |
| S3 | Baja | Fichero de estado `state.json` (contiene tokens de profesor y alumnos) se escribía con permisos por defecto (0644). | **Corregido** — modo 0600, como `progress.json`/`boxing.json` |
| S4 | Baja | Sin cabeceras `X-Content-Type-Options`/`Referrer-Policy` en estáticos. | **Corregido** (sin CSP a propósito: las presentaciones llevan `<script>` en línea) |
| S5 | Baja | Error de lectura de stream estático sin manejador (podía emitir `error` no capturado). | **Corregido** |
| S6 | Media | **Sin límite de creación de salas ni de conexiones.** Cualquiera puede crear salas ilimitadas (WS `create`, `POST /api/road/create`, `/api/boxing/create`): memoria y disco crecen; las salas de Road/Boxeo no caducan (las de BlackCard caducan a los 14 días). | Abierto — requiere decisión de producto (límites por IP, TTL). Recomendado antes de exponer públicamente |
| S7 | Media | **Código de alumno de 6 caracteres** (`profileCode`, ~10⁹ combinaciones) permite recuperar el historial y puntos semanales de un perfil, sin límite de intentos. Es por diseño (sin cuentas), pero no apto como credencial. | Abierto — con cuentas, sustituir por login; mientras, limitar intentos por conexión |
| S8 | Baja | `hello` acepta `profile` del cliente: quien conozca el id (UUID privado en su localStorage) adopta ese perfil. Los ids no se exponen en ninguna API (el ranking solo da nombre+puntos). | Aceptado hasta tener cuentas |
| S9 | Baja | Arranque: `JSON.parse` sin `try/catch` de `road.json`/`boxing.json` (`server/road.ts:48`, `server/boxing.ts:74`). Un fichero corrupto impide arrancar. La escritura es atómica, así que es improbable. | Abierto — arreglo de una línea, queda fuera del PR por pertenecer a módulos de juego |
| S10 | Baja | Comparación de tokens con `===` (no en tiempo constante). Con 128 bits aleatorios no es explotable en la práctica. | Aceptado; usar `timingSafeEqual` al introducir cuentas |
| S11 | Info | Sin comprobación de `Origin` en el WebSocket. No hay cookies ni credenciales ambientales (tokens en `localStorage` enviados en el mensaje), así que no hay CSWSH efectivo. | Aceptado |
| S12 | Info | Cualquiera puede crearse como «profesor» de una sala **nueva**: no hay cuentas. Es el modelo actual; **antes de añadir cuentas** el rol profesor debe pasar a credencial real. | Diseño pendiente |
| S13 | Info | Las presentaciones son HTML estáticos con soluciones dentro («No son exámenes seguros», README). | Documentado |

## Reglas para el código nuevo (obligatorias en revisión)
1. **El cliente nunca envía puntos, resultados ni estado.** Envía intenciones (`answer`, `move`, `pull`); el servidor valida rol, fase, propiedad y límites y calcula el efecto.
2. Todo endpoint que muta estado: autentica → comprueba rol → comprueba fase/propiedad → valida y acota entradas → aplica → responde. En ese orden.
3. Puntos de juego externos solo por `awardPoints()` (0–50 por evento). Nunca escribir en `progress.json` desde otro sitio.
4. Las vistas se construyen **por rol** (`view(room, who)`); las soluciones y los tokens ajenos no entran en la vista del alumno.
5. Un error en un manejador no puede tumbar el proceso: HTTP lo protege `serve()`, WS lo protege `handle()`.
6. Cada endpoint nuevo trae test negativo («un alumno intenta X → rechazado y estado intacto») siguiendo `tests/security.test.ts`.
