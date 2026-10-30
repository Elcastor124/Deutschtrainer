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
| S6 | Media | **Creación ilimitada de salas** y salas de Road/Boxeo sin caducidad. | **Corregido (fase 2)** — ver «Fase 2». Pruebas: `tests/hardening.test.ts` §1, `tests/room-expiry.test.ts`, `tests/limits.test.ts` |
| S7 | Media | **Código de alumno de 6 caracteres** (≈2³⁰) sin límite de intentos. | **Mitigado (fase 2)**: intentos limitados por IP y en global, códigos nuevos de 8 caracteres (≈2⁴⁰). Sigue siendo un secreto compartible *por diseño*, no una credencial: ver evaluación en «Fase 2». Pruebas: `hardening.test.ts` §2 |
| S8 | Baja | `hello` acepta `profile` del cliente: quien conozca el id (UUID privado en su localStorage) adopta ese perfil. Los ids no se exponen en ninguna API (el ranking solo da nombre+puntos). | Aceptado hasta tener cuentas |
| S9 | Baja | Arranque: `JSON.parse` sin `try/catch` de `road.json`/`boxing.json` (`server/road.ts:48`, `server/boxing.ts:74`). | **Abierto aquí — asignado a Haiku** (trabajo independiente). No tocado en la fase 2 para evitar conflicto; ver «Coordinación» |
| S10 | Baja | Comparación de tokens de sala con `===` (no en tiempo constante). Con 128–256 bits aleatorios no es explotable. | Aceptado para tokens de sala. Las **claves de profesor nuevas** sí se comparan con `timingSafeEqual` |
| S11 | Info | Sin comprobación de `Origin` en el WebSocket. No hay cookies ni credenciales ambientales (tokens en `localStorage` enviados en el mensaje), así que no hay CSWSH efectivo. | Aceptado |
| S12 | Info | No hay cuentas: cualquiera puede crearse como «profesor» de una sala **nueva**. | **Transición preparada (fase 2)**: credenciales de profesor respaldadas por el servidor, opcionales por defecto. **Sigue abierto** hasta pasar a `TEACHER_AUTH=required` tras validar la migración (ver «Fase 2»). Pruebas: `teacher-auth.test.ts`, `hardening.test.ts` §3 |
| S13 | Info | Las presentaciones son HTML estáticos con soluciones dentro («No son exámenes seguros», README). | Documentado |

## Reglas para el código nuevo (obligatorias en revisión)
1. **El cliente nunca envía puntos, resultados ni estado.** Envía intenciones (`answer`, `move`, `pull`); el servidor valida rol, fase, propiedad y límites y calcula el efecto.
2. Todo endpoint que muta estado: autentica → comprueba rol → comprueba fase/propiedad → valida y acota entradas → aplica → responde. En ese orden.
3. Puntos de juego externos solo por `awardPoints()` (0–50 por evento). Nunca escribir en `progress.json` desde otro sitio.
4. Las vistas se construyen **por rol** (`view(room, who)`); las soluciones y los tokens ajenos no entran en la vista del alumno.
5. Un error en un manejador no puede tumbar el proceso: HTTP lo protege `serve()`, WS lo protege `handle()`.
6. Cada endpoint nuevo trae test negativo («un alumno intenta X → rechazado y estado intacto») siguiendo `tests/security.test.ts`.

---

# Fase 2 — cierre de vulnerabilidades pendientes

Alcance: S6, S7, S12 (+ endurecimiento relacionado). Sin cambios en las mecánicas de los juegos ni en el protocolo de sesión de los alumnos. Cada afirmación de «corregido» está respaldada por una prueba; se comprobó además que las 12 pruebas de `tests/hardening.test.ts` que demuestran los fallos **fallan contra el código de la fase 1** y pasan ahora (las 6 restantes son de compatibilidad y pasan en ambos).

## 1 · Creación de salas (S6) — corregido
| Control | Valor por defecto | Variable | Efecto |
|---|---|---|---|
| Salas creadas por IP y hora (BlackCard, Road, Boxeo) | 30 | `ROOM_CREATE_PER_HOUR` | 429 / error fatal con «Espera N» |
| Tope de salas | 300 clase · 300 Road · 300 Boxeo · 3 000 prácticas | `MAX_CLASS_ROOMS`, `MAX_ROAD_ROOMS`, `MAX_BOXING_ROOMS`, `MAX_PRACTICE_ROOMS` | 503 |
| Prácticas abiertas por IP y hora | 300 | `PRACTICE_OPEN_PER_HOUR` | un colegio comparte IP: umbral alto; **reanudar con token no crea sala ni gasta cupo** |
| Códigos de sala inexistentes por IP / 10 min | 120 | `ROOM_MISS_PER_10MIN` | frena el escaneo de códigos (4 caracteres = ~10⁶) |
| Conexiones WebSocket por IP | 200 | `MAX_WS_PER_IP` | cierra con 1013 |
| Mensajes WS por conexión | ráfaga 40, 20/s | — | `Demasiado rápido`; cada acción válida provoca un broadcast a toda la sala |
| Consultas `/api/progress/*` por IP y minuto | 120 | `PROGRESS_PER_MIN` | 429 |

**Unirse a una sala no se limita por creación**: un colegio entero detrás de una IP entra sin problema (probado con 8 alumnos y límite de creación = 1).

**IP del cliente.** Sin `TRUST_PROXY` se ignora `X-Forwarded-For` (probado: rotar la cabecera no esquiva el límite). Con `TRUST_PROXY=n` se usa la entrada *n* desde la derecha, la que añade nuestro proxy (la de la izquierda la falsifica el cliente; probado). `render.yaml` fija `TRUST_PROXY=1`. **Debe verificarse en el despliegue real**: si hay un CDN delante de Render, el salto de la derecha podría ser el CDN y todos los clientes compartirían cupo (fallo seguro —solo más estricto—, pero habría que subir a `TRUST_PROXY=2`).

## 2 · Código de alumno (S7) — mitigado, con evaluación
**¿Da el código de 6 caracteres la privacidad necesaria? No como credencial; sí como identificador pseudónimo si se limitan los intentos.** Alfabeto de 32 símbolos → 2³⁰ ≈ 10⁹ códigos. Lo que protege el código es un historial de práctica (aciertos por pregunta/tema), puntos semanales y el nombre elegido (≤16 caracteres); no hay datos personales ni forma de alterar la puntuación de otro (el servidor corrige y otorga los puntos). Sin límite, el espacio era barrible por WebSocket; con el límite, no.
- **Intentos:** 8 fallos / 15 min por IP y 200 / hora en global (`CODE_FAILS_PER_IP`, `CODE_FAILS_GLOBAL_PER_HOUR`). Con el bloqueo activo ni el código correcto se acepta desde esa IP, y el mensaje lo explica; **entrar sin código sigue funcionando**. Un atacante distribuido está acotado por el tope global: 200 intentos/hora contra ~10⁹ (6 caracteres) ⇒ ≈2·10⁻⁷ por hora para un perfil concreto.
- **Códigos nuevos de 8 caracteres** (≈10¹², `PROFILE_CODE_LEN`). Los de 6 ya emitidos siguen valiendo (no se rompe a nadie); la casilla del formulario admite 8.
- **Contrapartida:** el bloqueo global puede ser usado para impedir *temporalmente* la recuperación por código (nunca el juego). Aceptado; es preferible a permitir la fuerza bruta.
- **Pendiente real:** cuando haya cuentas con datos personales, la recuperación debe pasar a login (S12); el código quedará como atajo de baja confianza.

## 3 · Caducidad de Road y Boxeo (S6) — corregido
- Cada sala guarda `lastActive`, que **solo** actualiza una petición **autenticada** (sondeos del proyector/alumno incluidos). Probado: una partida con tráfico no caduca nunca; peticiones con token falso **no** mantienen viva una sala.
- TTL de **24 h** sin actividad (`ROAD_ROOM_TTL_HOURS`, `BOXING_ROOM_TTL_HOURS`), barrido cada 10 min y al arrancar. Al borrar una sala de Road se liberan sus permisos de audio.
- **Compatibilidad:** las salas guardadas por la versión anterior (sin `lastActive`) reciben un TTL completo de gracia en el primer barrido; actualizar el servidor nunca borra una partida en curso (probado). La eliminación se persiste (probado con reinicio).
- BlackCard/Jenga: también se limpian en tiempo de ejecución (antes solo al reiniciar): 14 días de inactividad y **sin ningún cliente conectado**; prácticas: 3 días. Una sala con alguien conectado nunca se descarta (probado).

## 4 · Autenticación del profesor (S12) — transición preparada
Mecanismo: claves de 256 bits generadas **por el servidor** (`npm run teacher -- add "Nombre"`), mostradas una sola vez; en disco solo un hash SHA-256 salado (`DATA_DIR/teachers.json`, 0600), comparación en tiempo constante, formato `dtk_<id>.<secreto>`. Sin contraseñas ni claves en el código ni en variables de entorno. Revocación inmediata (`revoke <id>`) sin reiniciar el servidor (probado).

Modos (`TEACHER_AUTH`):
| Modo | Crear sala sin clave | Crear con clave | Notas |
|---|---|---|---|
| `optional` (**por defecto**) | permitido (se cuenta como *legacy* en `/api/health → teacherAuth.legacyRoomCreates`) | la sala queda ligada al profesor (`owner`) | clave inválida → 401 (no se degrada en silencio) |
| `required` | **401** | permitido | **fail-closed (fase 3):** sin ningún profesor registrado, o con `teachers.json` ilegible, **503** y nadie crea salas de profesor hasta registrar uno (antes caía a `optional`) |
| `off` | permitido | clave ignorada | **rollback inmediato** |

No cambia nunca: alumnos (no necesitan credencial), práctica, y la entrada a salas ya creadas con el token de sala. Con credencial, el profesor además **recupera su sala sin el token** (otro ordenador, `localStorage` borrado); otro profesor, un alumno o una clave falsa no pueden (probado). Intentos fallidos: 10 / 15 min por IP.

**Plan de migración recomendado:** (1) desplegar en `optional`; (2) `npm run teacher -- add` para cada profesor y guardar la clave en su navegador (`localStorage.setItem('dt:teacher-key', '<clave>')`; el cliente la envía sola en WebSocket y en `X-Teacher-Key` de Road/Boxeo); (3) vigilar `/api/health`: cuando `legacyRoomCreates` deje de crecer durante un periodo de clases completo, (4) pasar a `required`. Si algo falla: `TEACHER_AUTH=off`.
**Pendiente:** no hay pantalla para introducir la clave (se pone por `localStorage`) y la sesión de profesor sigue basándose en el token de sala una vez creada; ambos se resolverán con la interfaz de cuentas.

## 5 · Varios procesos o instancias
La app **no es multi-instancia**: salas, sesiones y temporizadores viven en la memoria de un proceso y los ficheros en `DATA_DIR` los sobrescribe cada proceso. Por tanto los límites y la caducidad son por proceso *a propósito*; compartirlos entre instancias no tendría sentido porque las salas tampoco se comparten. Para que esto no sea una suposición silenciosa:
- `server/instance-lock.ts`: cerradura con latido en `DATA_DIR/.server.lock`. Un segundo proceso sobre el mismo directorio **no arranca** (código 1 y mensaje); un reinicio normal libera la cerradura (SIGTERM/SIGINT) y una cerradura de un proceso caído caduca a los 30 s. Probado en los tres casos.
- `render.yaml` fija `numInstances: 1`.
- Escalar horizontalmente exigiría mover el estado a un almacén compartido (p. ej. Redis/Postgres) y los limitadores a ese almacén: **no se ha introducido ningún servicio externo** y no se justifica con la carga de una clase.

## Recuperación de sesión (comprobada)
Alumno: corte de red → reconecta con su token, mismo `pid` y puntos. Servidor reiniciado → alumno y profesor siguen entrando con sus tokens (estado guardado en SIGTERM). Práctica: reanudar con token no consume cupo de creación. Alumnos y profesor con credencial: probado en `hardening.test.ts` §3–§4.

## Coordinación con el trabajo de Haiku
Haiku trabaja en GitHub Actions y en los `JSON.parse` de arranque. **No se tocó `.github/` ni esas dos líneas.** Archivos compartidos en los que esta fase añade cambios (posibles conflictos de fusión, todos pequeños y en líneas distintas a los `JSON.parse`): `server/road.ts` (firma de `createRoadHandler`, interfaz `Room`, `auth`, ruta `create`, cierre del archivo) y `server/boxing.ts` (ídem). Si Haiku mueve la carga de `road.json`/`boxing.json` a un helper, basta con conservar los parámetros nuevos de la fábrica (`guard`, `now`, `ttlMs`) y `Object.assign(handler, { sweep })`. `package.json`: se añadió el script `teacher`. Los tests nuevos (`limits`, `teacher-auth`, `room-expiry`, `hardening`) deben incluirse en el flujo de CI que Haiku defina.

## Estado de todas las vulnerabilidades tras la fase 2
| # | Estado |
|---|---|
| S1–S5 | Corregidas (fase 1) |
| S6 | **Corregida** |
| S7 | **Mitigada** (riesgo residual documentado) |
| S8 | Aceptada hasta tener cuentas |
| S9 | **Abierta** (Haiku) |
| S10 | Aceptada para tokens de sala; claves nuevas en tiempo constante |
| S11 | Aceptada |
| S12 | **Transición preparada; abierta hasta activar `required`** |
| S13 | Documentada |

### Riesgos residuales conocidos
- Límites por IP: tras un NAT/proxy mal configurado todos los clientes comparten cupo (se falla hacia lo estricto; ajustar `TRUST_PROXY`). Los límites viven en memoria y se reinician con el proceso.
- Un atacante con muchas IP puede crear hasta el tope de salas (300) y bloquear temporalmente la creación a los demás hasta que caduquen (24 h Road/Boxeo; BlackCard 14 días sin clientes). `TEACHER_AUTH=required` lo elimina para quien no tenga clave.
- Sin CSP y las presentaciones llevan soluciones en el HTML (S13).

---

# Fase 3 — modo libre (práctica sin profesor)

Diseño y límites funcionales en `docs/FREE_PLAY.md`. Aquí, solo lo relevante para seguridad. Cada afirmación va con su prueba.

## Superficie nueva
| Endpoint | Quién | Qué puede hacer |
|---|---|---|
| WS `hello {role:'practice', free:true}` | alumno o invitado | Crear *su* práctica/solitario (BlackCard, Jenga). Rol `practice`: **no** puede enviar `ctl`. |
| `POST /api/play/boxing/solo\|create\|join`, `GET state`, `POST action` | alumno o invitado | Partidas de boxeo libres. Solo con token de luchador de *esa* sala. |
| `/api/account/register\|login\|logout\|me\|settings\|progress\|delete` | alumno | Su cuenta y su progreso. |
| `GET /api/play/catalog`, `/api/play/leaderboard` | público | Catálogo; ranking solo de alias que lo activaron. |

## Garantías comprobadas
| Garantía | Prueba |
|---|---|
| Un alumno no puede usar el modo libre para obtener permisos de profesor: ninguna acción de profesor (pausar, reanudar, revelar, reiniciar, empezar, `ctl` de puntos/objetos/bloques) vale en una partida libre | `freeplay-boxing` (403 ×5), `freeplay-server` (`ctl` rechazado, puntuación intacta) |
| Las APIs de profesor y de jugador están aisladas: el código/token de una sala de un tipo no abre la del otro | `freeplay-boxing` «las APIs están aisladas» |
| Identidades separadas en ambos sentidos: una sesión `dts_` no es clave de profesor (HTTP y WS) y una clave `dtk_` no es sesión de alumno | `freeplay-accounts`, `freeplay-boxing`, `freeplay-server` |
| `TEACHER_AUTH=required` es **fail-closed** (503 sin profesores registrados; `teachers.json` ilegible también cierra) y no afecta al modo libre ni a las clases en curso | `teacher-auth`, `freeplay-boxing`, `freeplay-server`, navegador |
| Los puntos los calcula el servidor: el cliente no envía puntos ni resultados; tope diario 200 por cuenta, ≥ 8 preguntas y ≥ 40 % para una actividad, 3 actividades recompensadas/día; el tiempo conectado no puntúa | `freeplay-progress` |
| Invitados: nada se persiste (ni perfil, ni eventos, ni puntos) | `freeplay-server` (lee `state.json`/`progress.json` tras cerrar) |
| Un cliente no puede adoptar el perfil de una cuenta ni de un invitado diciendo su id (`acc_`/`guest_` reservados) y las APIs antiguas de progreso lo rechazan | `freeplay-server`, `freeplay-progress` |
| Contraseñas con scrypt y sal por cuenta; sesiones y contraseñas nunca en claro en disco (`accounts.json` 0600); mismo mensaje para alias inexistente y contraseña errónea | `freeplay-accounts` |
| Fuerza bruta: bloqueo por cuenta (6/15 min) y por IP (10/15 min); registro limitado por IP | `freeplay-accounts` |
| Creación de partidas libres limitada por IP, por cuenta y global, sin consumir el cupo de salas de profesor | `freeplay-boxing` |
| Partidas abandonadas se cierran (boxeo libre 2 h / 10 min tras terminar; práctica terminada 1 h; una sala con alguien conectado nunca) | `freeplay-boxing`, `limits` |
| Reconexión: estado recuperable con el token, también tras reiniciar el servidor, sin duplicar puntos | `freeplay-boxing`, `freeplay-server` |
| El ranking es opcional (desactivado por defecto), solo alias aprobados y solo `{rank, alias, points}`; las cuentas no salen en el ranking antiguo | `freeplay-accounts`, `freeplay-progress` |
| Clases tradicionales sin cambios (profesor crea sala, alumno entra, `/practica` antiguo con código de dispositivo) | `freeplay-server`, los tests previos, `e2e`, `road-e2e`, `boxing-e2e` |

## Hallazgos nuevos y riesgos residuales (abiertos)
| # | Sev. | Detalle |
|---|---|---|
| S14 | Media | **Sin recuperación de contraseña** (no hay correo ni servicio externo). Quien la pierda pierde la cuenta. Decisión de producto pendiente. |
| S15 | Media | **scrypt es CPU**: muchos *logins correctos* o registros simultáneos pueden saturar el hilo de trabajo; los fallos están limitados por IP/alias y los registros por IP, pero no hay límite global de scrypt concurrente. |
| S16 | Media | **Alias**: el filtro es mínimo y no puede impedir que alguien use un nombre real. Mitigación: ranking opcional, instrucciones, bloqueo manual (`setAliasStatus`). No hay interfaz de moderación (solo método de servidor). |
| S17 | Baja | Los límites por IP siguen siendo por proceso y dependen de `TRUST_PROXY` correcto (ver fase 2). Los invitados de WebSocket (BlackCard/Jenga solitario) comparten el cupo de «prácticas» por IP, no el de partidas libres por cuenta. |
| S18 | Baja | Un anfitrión de sala privada ve el nombre de su rival (alias o nombre de invitado recortado). Es el comportamiento esperado de una partida con código; no hay chat ni mensajes libres. |
| S19 | Info | `S12` (profesor) sigue abierto hasta activar `TEACHER_AUTH=required` en producción con profesores registrados. |
| S20 | Info | No se implementaron salas privadas de BlackCard/Wort-Jenga ni Deutsch Deck (ver `FREE_PLAY.md`): no hay superficie de ataque asociada todavía. |
