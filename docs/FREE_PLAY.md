# Modo libre (práctica sin profesor)

Dos modos independientes sobre el mismo servidor:

| | **Modo profesor** (sin cambios) | **Modo libre** (nuevo) |
|---|---|---|
| Entrada | `/jugar`, `/jenga`, `/boxeo` (profesor), `/road-to-b1`, `/t/…`, `/p/…` | **`/libre`** |
| Quién crea la partida | Profesor (`TEACHER_AUTH`) | Cualquier alumno, con o sin cuenta |
| Quién la controla | Profesor | Nadie: el servidor (plazos, sparring, avance automático) |
| Identidad | token de sala / clave de profesor `dtk_…` | sesión de alumno `dts_…` (opcional) o invitado |
| Endpoints | `/ws` (profesor/alumno), `/api/boxing/*`, `/api/road/*` | `/ws` rol `practice` con `free:true`, **`/api/play/boxing/*`**, `/api/account/*`, `/api/play/catalog|leaderboard` |

Una sala del profesor y una del modo libre **nunca se mezclan**: el código de una no abre la otra por la API contraria (probado en `tests/freeplay-boxing.test.ts`).

## Qué puede hacer un alumno (flujo `/libre`)
1. **Cuenta opcional** (alias + contraseña) o **invitado**. Sin cuenta todo funciona pero *no se guarda nada*.
2. Elegir **juego**: BlackCard, Wort-Jenga, Boxeo. *Deutsch Deck está en el catálogo como «Próximamente»: no existe todavía en el repositorio.*
3. Elegir **nivel**: A1, A2, B1 Training.
4. Elegir **temas** (sin marcar = todos; la interfaz muestra cuántas preguntas hay por tema y nivel).
5. Jugar **en solitario** o en **sala privada por código** con amigos (BlackCard y Wort-Jenga: 2–6 personas; Boxeo: 2).
6. Corrección y explicación en cada respuesta; con cuenta, el servidor guarda resultados.

### Niveles: qué significan de verdad
El banco **no tiene etiquetas CEFR**. El nivel es una *banda de dificultad* del banco existente (`shared/play.ts → LEVEL_DIFFS`):
**A1** = fácil · **A2** = fácil + media · **B1 Training** = media + difícil + especial («Prüfungsfragen», con justificación en el banco). El Boxeo usa su propio banco de casos (145 preguntas, sin niveles): **solo A2**. Si una combinación nivel+temas tiene menos de 5 preguntas se avisa en vez de empezar una sesión vacía.

## Adaptación de cada juego sin profesor
| Juego | Solo | Privado | Cómo funciona sin profesor |
|---|---|---|---|
| **BlackCard** | ✅ | ✅ 2–6 | Solo: el motor de práctica (`Room` en modo `practice`), con repaso espaciado, corrección y explicación; sin objetos (necesitan rivales). Privada: la **sala de clase sin profesor** (ver abajo), dos rondas (`r1`, `r2`) con cofres y objetos y el final. La BlackCard se desbloquea con preguntas «hard»: solo aparece en B1 Training. |
| **Wort-Jenga** | ✅ | ✅ 2–6 | La torre existente (`tasks.ts`): aciertas → quitas 1 pieza; fallas → 2. Sin preguntas orales y sin respuestas «a juzgar». Solo: la actividad cuenta a las 8 preguntas o al caer la torre. Privada: por turnos; quien no saca su pieza en 30 s, el servidor saca por él la más segura; al caer la torre, final. |
| **Boxeo** | ✅ sparring | ✅ 2 jugadores | Mismo motor de combate (`boxing.ts`). El profesor se sustituye por **plazos del servidor** y avance automático. |
| **Deutsch Deck** | — | — | No existe. |

### Reglas del sparring (públicas, sin trampas)
No ve la respuesta ni el movimiento del alumno. Acierta cada pregunta con **60 %** (`FREE_BOXING.botAccuracy`, fijo: lo importante es que el alumno practique, no vencer a una IA). Movimiento si acertó, por orden: vida < 35 y energía ≥ 1 → Defensa · energía ≥ 3 → Crochet (50 %) o Directo · energía 2 → Directo · energía 1 → Jab (70 %) o Esquiva · energía 0 → Defensa. Implementado y probado en `server/boxing-free.ts`.

### Sala privada de BlackCard y Wort-Jenga (sin profesor)
Es la **misma sala de clase** (`Room`, mismo WebSocket, misma pantalla de alumno `/p/CÓDIGO`) con `s.private` y **nadie** tiene su token de profesor:
- Se crea con `POST /api/play/room` (endpoint de **jugador**: cupo del modo libre, nunca `TEACHER_AUTH`). Devuelve el token de *jugador* del anfitrión.
- Se entra por código **solo en el vestíbulo** (máx. 6); con cuenta se muestra el alias; la misma cuenta no ocupa dos plazas.
- **Empieza cuando todos los presentes (mínimo 2) pulsan «Estoy listo».** El anfitrión solo puede **expulsar** a alguien antes de empezar (por si el código llegó a quien no debía).
- El servidor hace lo que hacía el profesor: corrección automática (nunca «revisión»), avance tras la intro (7 s), el resultado (9 s) y el fin de ronda (10 s), o antes si todos votan «Listo para seguir». Las preguntas siguen teniendo su temporizador: nadie bloquea la partida.
- Al terminar, cada **cuenta** registra su actividad (aciertos/total contados por el servidor); los invitados no guardan nada.
- Se cierra a las 2 h sin actividad o a los 10 min de terminar, salvo que haya alguien conectado.

### Sala privada (Boxeo)
El anfitrión crea la sala y comparte el **código de 4 caracteres**; un único amigo se une; **cuando los dos pulsan «Estoy listo» empieza sola**. Sin emparejamiento público, sin chat, sin nombres libres (cuenta → alias; invitado → nombre recortado y sin marcado). La misma cuenta no puede ocupar las dos esquinas. Los plazos del servidor (pregunta 40 s, movimiento 20 s, resultado 12 s) evitan que un rival ausente bloquee la partida.

## Arquitectura
```
shared/play.ts           contrato: juegos, niveles, bandas, temas del boxeo, tipos de resumen/ranking
server/accounts.ts       cuentas de alumno (scrypt, sesiones dts_, alias validado/moderable)  ← accounts.json 0600
server/play-api.ts       HTTP: /api/account/*, /api/play/catalog, /api/play/leaderboard  (+ identify(req))
server/boxing-free.ts    reglas puras del sparring y plazos
server/boxing.ts         motor de combate + rutas /api/play/boxing/* (dispatchFree) — mismas reglas que la clase
server/practice-session.ts  hello `practice` con free:true → cuenta o invitado, nivel, juego (blackcard|jenga)
server/room.ts / tasks.ts   nivel (diffs) en la selección; startSoloJenga; reportActivity (una vez)
server/progress.ts       puntos y estadísticas por cuenta: activity(), tope diario, errores frecuentes, precisión semanal
server/security.ts       Guard: admitFree (solo/privada), límites de registro y acceso
src/views/Libre.tsx      hub · src/views/FreeGame.tsx  partida solitaria · src/views/Boxing.tsx  listo/siguiente
```
**Reutilización:** ninguna lógica de sesión se duplica. BlackCard y Jenga viajan por el WebSocket y la pantalla de alumno ya existentes (`PlayScreen`); el boxeo reutiliza `resolveExchange`/`action`. Los únicos añadidos en motores son: filtro de dificultad en la selección, `startSoloJenga`, el hook `onActivity` y, en boxeo, la fase automática (`settle`) y el sparring.

## Identidad y roles (separadas)
| | Profesor | Alumno |
|---|---|---|
| Credencial | `dtk_<id>.<secreto>` (`npm run teacher`) | `dts_<256 bits>` (sesión tras login) |
| Cabecera / campo | `X-Teacher-Key` / `hello.teacherKey` | `X-Student-Session` / `hello.session` |
| Almacén | `teachers.json` (hash SHA-256 salado) | `accounts.json` (scrypt por cuenta; sesión solo como hash) |
| Alcance | crear/controlar salas de clase | partidas libres propias y su progreso |
Una no vale como la otra (probado en ambos sentidos). Con `TEACHER_AUTH=required` el comportamiento es **fail-closed**: sin ningún profesor registrado no se puede crear ninguna sala de profesor (503) y el modo libre sigue funcionando.

## Progreso educativo (por cuenta)
`GET /api/account/progress` (solo el propio alumno): actividades completadas (juego, nivel, aciertos/total), precisión por tema, **errores frecuentes** (preguntas con ≥ 2 fallos), **evolución semanal de precisión**, racha, puesto (si está en el ranking) y **recomendaciones** (temas < 85 % con ≥ 2 intentos, repaso de errores, sugerencia de subir de nivel con 3 actividades ≥ 85 %).
**Invitados:** perfil `guest_…` transitorio: no se guarda en `state.json` ni en `progress.json`, no puntúa y no tiene código de recuperación (probado leyendo los ficheros tras cerrar el servidor).

### Qué cuenta como aprendizaje (y qué no)
- Puntos solo por **respuestas validadas por el servidor** (+10 acierto / +2 intento, una vez por pregunta y día) y por **actividades completadas**.
- **El tiempo no puntúa**: no hay latido, ni minutos conectados, ni «tiempo en pantalla». Mantener una pestaña abierta no suma nada (probado).
- Actividad completada: ≥ 8 preguntas respondidas y ≥ 40 % de acierto (adivinar al azar no basta). A1 +4 · A2 +6 · B1 +10; máximo **3 actividades recompensadas al día**.
- **Tope diario 200 puntos por cuenta**; lo que excede se guarda con 0 puntos (las estadísticas no se pierden). Los ejercicios fáciles pagan menos y no se repiten el mismo día.
- Medida aproximada: no se mide comprensión real ni se distingue aprender de memorizar.

## Ranking semanal (opcional)
`GET /api/play/leaderboard` → `{ rank, alias, points }` de las cuentas que **lo activaron** (desactivado por defecto) y con **alias aprobado**. Nunca nombres reales, ids, horarios de conexión ni estadísticas. El alumno lo activa/desactiva cuando quiera. Las cuentas **no aparecen** en el ranking antiguo `/api/progress/leaderboard` y `/api/progress/me` rechaza ids `acc_`/`guest_`. Moderación: `AccountStore.setAliasStatus(alias,'blocked')` (el alias desaparece del ranking). El filtro automático de alias es mínimo y no exhaustivo; **no puede garantizar que un alias no sea un nombre real**: por eso el ranking es opcional y las instrucciones lo advierten.

## Límites y expiración
| Qué | Límite | Variable |
|---|---|---|
| Partidas libres solo / privadas por IP y hora | 60 / 20 | `FREE_SOLO_PER_HOUR`, `FREE_PRIVATE_PER_HOUR` |
| Partidas libres por cuenta y hora | 60 | `FREE_PER_ACCOUNT_HOUR` |
| Tope global de partidas libres (boxeo) | 1 500 | `MAX_FREE_ROOMS` |
| Prácticas/solitarios WebSocket por IP y hora | 300 (límite de «práctica») | `PRACTICE_OPEN_PER_HOUR` |
| Registros por IP y hora | 8 | `REGISTER_PER_IP_HOUR` |
| Accesos fallidos por IP / por alias (15 min) | 10 / 6 | `LOGIN_FAILS_PER_IP`, `LOGIN_FAILS_PER_ALIAS` |
| Boxeo libre: sin actividad / terminado | cierre a las 2 h / 10 min | `FREE_BOXING` |
| Práctica/solitario terminado / en curso | cierre a 1 h / 3 días | `room-ttl.ts` |
| Sesión de alumno | 30 días, máx. 5 a la vez | `accounts.ts` |
Una sala con alguien conectado (WebSocket) nunca se descarta; en boxeo la actividad la marca cualquier petición autenticada.

## Cuenta de alumno (`/cuenta`)
Crear una cuenta pide **solo alias y contraseña**. La pantalla:
- sugiere un alias anónimo (animal en alemán + número) para no usar el nombre real;
- muestra los requisitos en vivo (alias y contraseña) y un indicador de fuerza, con botón para ver la contraseña;
- explica el ranking opcional con un interruptor (desactivado por defecto).

Con sesión, la misma página muestra el progreso (puntos, racha, actividades, precisión por tema y semanal, lo que más fallas y recomendaciones) y los ajustes: ranking, **cambiar contraseña** (cierra las demás sesiones), cerrar sesión y eliminar la cuenta con confirmación. La navegación muestra el alias (o «Entrar») en todas las páginas, y el modo libre indica si juegas con cuenta o como invitado.

## La práctica (`/practica`) va por la cuenta
- Con sesión, `/practica` abre la práctica **con la cuenta** (`hello { role:'practice', free:true, session, profile: <este dispositivo> }`): cada respuesta suma a los puntos semanales de la cuenta y, si el alumno lo activó, al ranking. Reanudar tras recargar conserva la cuenta.
- Sin sesión, lo primero que se ve es el acceso (crear cuenta o entrar). Se puede practicar sin cuenta como siempre (perfil del dispositivo), pero se avisa de que **no cuenta para el ranking**.
- **Nada se pierde al pasar a la cuenta:** el historial de repaso del dispositivo (lo fallado en clase o en prácticas anteriores) se suma a la cuenta cada vez que se practica con ella; gana el dato más reciente por pregunta. Solo estadísticas de repaso: **los puntos del dispositivo no se traspasan** (no se puede inflar el ranking reclamando otro dispositivo).
- Una práctica completa (≥ 8 preguntas, ≥ 40 %) cuenta como actividad de nivel A2 (mezcla todas las dificultades).
- La portada (widget de puntos) muestra los puntos y el podio de la cuenta cuando hay sesión.

## Ranking semanal (`/ranking`)
Pestaña propia en la navegación. Solo cuentas que activaron el ranking, solo `{rank, alias, points}`.
- **Podio** del 1.º al 3.º con animación de entrada: suben los bloques (3.º → 2.º → 1.º), caen los avatares, cuentan los puntos, aparece la corona, un foco y confeti para el 1.º. **Animación de salida** al cambiar de semana: el podio se hunde y la lista se desvanece antes de entrar la otra.
- **Esta semana / Semana pasada**, fechas de la semana y **cuenta atrás** hasta el reinicio (lunes 00:00, hora de Madrid, con horario de verano).
- Puestos 4.º–50.º con barra proporcional al líder; tu fila resaltada.
- Tarjeta personal: «Vas N.º de M» si estás en el ranking; tus puntos y un botón «Aparecer en el ranking» si tienes cuenta pero no lo activaste; invitación a entrar si no tienes cuenta.
- «Cómo se suman puntos» con las reglas reales (`FREEPLAY_RULES`, que reflejan `server/progress.ts`).
- Accesibilidad: con «reducir movimiento» no hay animaciones (todo aparece al instante); con los efectos apagados no hay confeti ni foco.
- API: `GET /api/play/leaderboard?week=current|previous&limit=1..50` → `RankingView` (`week`, `range`, `resetsAt`, `players`, `entries` y, solo con sesión, `me` con **tus** puntos y puesto).

## Logros e insignias
20 logros en 4 grupos (aprendizaje, constancia, juegos, ranking), con niveles bronce, plata y oro (`ACHIEVEMENTS` en `shared/play.ts`).
- **Se calculan en el servidor** (`server/achievements.ts`) a partir de los eventos ya validados de la cuenta: no hay nada que el cliente pueda enviar para desbloquearlos ni un almacén aparte. Cada logro tiene su fecha exacta de desbloqueo y su progreso (p. ej. 37/100).
- Logros de ranking (podio, campeón) solo cuentan semanas **cerradas** y en las que la cuenta estaba en el ranking.
- Ninguno premia el tiempo conectado: todos salen de respuestas, actividades completadas, días con práctica o puestos.
- `/cuenta#logros`: grid de insignias (las bloqueadas, en gris con candado y barra de progreso).
- **Aviso global** al desbloquear (en cualquier página): el medallón gira y aterriza, lo cruza un brillo, y se va solo. Se comprueba al cambiar de página, al volver a la pestaña y al terminar una partida. La primera vez que un navegador ve una cuenta solo apunta lo ya conseguido (no avisa de golpe de todo lo antiguo).
- API: `GET /api/account/achievements` (solo con sesión, solo los propios).

## Animaciones al desplazarse
`src/brand/ScrollReveal.tsx`: un único `IntersectionObserver` para toda la web hace aparecer en cascada las piezas de contenido (tarjetas, secciones, insignias, reglas…) al entrar en pantalla, y una barra fina roja→oro arriba indica cuánto llevas de página. No toca las pantallas de juego ni lo que ya tiene su propia animación (portada, podio). Con los efectos apagados o «reducir movimiento», todo visible desde el principio y sin barra; sin JavaScript, también visible.

## Qué NO está hecho (honesto)
- **Deutsch Deck**: el juego no existe.
- El ranking es **opcional y desactivado por defecto** (decisión de privacidad): hasta que cada alumno lo active, no aparece. La página lo pide con un botón.
- **Recuperación de contraseña**: no hay correo; la única vía es darse de baja y crear otra cuenta.
- **Progreso en Boxeo por pregunta**: el banco del boxeo no entra en la adaptación de repaso (`Profile.stats`), solo en estadísticas por tema/errores.
- El **Jenga solitario** se probó en servidor real y que la torre se renderiza en el navegador; la caída de la torre y «Jugar otra vez» no se probaron en navegador. El **Jenga privado** se probó en el motor y contra el servidor; en el navegador solo se recorrió la sala privada de BlackCard.
