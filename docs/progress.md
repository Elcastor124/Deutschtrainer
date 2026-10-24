# Progreso y puntos semanales

Módulo: `server/progress.ts` (servidor), `src/progress-client.ts` + `src/components/WeeklyPoints.tsx` (alumno).
Persistencia: `DATA_DIR/progress.json` (`{version:1, events:[…]}`), escritura atómica (tmp + rename) con debounce de 1 s;
se conservan los últimos **180 días** (y como máximo 200 000 eventos). Un fichero corrupto se ignora (se empieza vacío).

## Modelo de datos (append-only)

```ts
interface ProgressEvent {
  at: number;            // epoch ms (servidor)
  profile: string;       // id de perfil del dispositivo (/^[\w-]{8,64}$/)
  kind: 'answer' | 'session' | 'game';
  source: 'practice' | 'class' | 'jenga' | 'boxing' | 'road';
  qid?: string; topic?: string; ok?: boolean;   // obligatorios qid+ok si kind = 'answer'
  points: number;        // calculado por el servidor, nunca por el cliente
  bonus?: number;        // parte de points que es bonus diario
  room?: string;         // código de sala → permite agrupar por clase
}
```

Los eventos nunca se editan: todo (puntos, rachas, precisión, sesiones, predicción) se deriva del log.

## Reglas de puntos

| Regla | Puntos |
|---|---|
| Respuesta correcta | +10 |
| Intento fallido | +2 |
| Primera respuesta del día (Madrid) | +5 bonus |
| … con racha de 3+ días seguidos | +10 bonus (en vez de +5) |
| Juego/sesión (`award`, boxeo/Road/Jenga) | 0–50 por evento, decidido por el servidor |

**Anti-farming:** una misma pregunta (`qid`) da puntos de acierto una sola vez por día de Madrid y puntos de intento
una sola vez por día. Las repeticiones se registran (cuentan para estadísticas) pero suman 0. Al día siguiente vuelve a puntuar
(repaso espaciado).

**Semana:** ISO-8601, lunes 00:00 → domingo 23:59:59 **hora de Europe/Madrid** (CET/CEST gestionado con `Intl`).
**Racha:** días consecutivos con algún evento; sigue viva hoy si ayer hubo actividad.

## API de alumno (pública)

`GET /api/progress/me?profile=<id>` → 200 / 400 (id inválido) / 405

```json
{ "known": true, "name": "Ana", "code": "ANA123", "week": "2026-W43", "weekPoints": 137,
  "rank": 2, "players": 3, "streak": 4,
  "history": [{ "week": "2026-W36", "points": 0 }, "… 8 semanas, la última es la actual"],
  "topics": [{ "topic": "Dativ", "attempts": 4, "correct": 1, "accuracy": 0.25 }],
  "recommended": ["Dativ"] }
```

Solo devuelve el resumen del id pedido (el id es el secreto del dispositivo; el código de 6 letras ya se le muestra al propio alumno).
`recommended` = temas con ≥ 2 intentos y < 85 % de acierto, del peor al mejor, máx. 3.

`GET /api/progress/leaderboard` → `{ "week": "2026-W43", "entries": [{ "rank": 1, "name": "Ben", "points": 150 }] }`
Top 10 de la semana, solo nombre visible + puntos (empates comparten puesto). Nunca ids ni códigos.

Otras rutas bajo `/api/progress/*` → 404; métodos distintos de GET/HEAD → 405.

## Modo profesor (diseño; NO expuesto todavía)

Implementado como funciones puras y testeadas en `server/progress.ts`, sin ruta:

- `groupSessions(events)` → sesiones por **sala + día de Madrid** (`{day, room, sources, answers, correct, accuracy, points, topics}`).
  Eventos sin sala = práctica libre de ese día.
- `predictNext(events)` (eventos de **un** alumno) → predicción transparente para la próxima clase:
  - `predictedAccuracy`: media móvil exponencial (α = 0.5) de la precisión por sesión.
  - `riskTopics`: EMA por tema; riesgo si < 0.60 con ≥ 2 intentos (peor primero).
  - `participation.trend`: pendiente de respuestas/sesión (últimas 4) relativa a la media; ±15 % → `up`/`down`.
  - `participation.expectedAnswers`: EMA de respuestas/sesión + media pendiente.
  - `confidence`: `low` (< 2 sesiones o < 10 respuestas), `high` (≥ 4 sesiones y ≥ 30 respuestas), si no `medium`.

Rutas futuras propuestas (todas tras sesión de profesor):

| Ruta | Respuesta |
|---|---|
| `POST /api/teacher/login` `{password}` | 204 + cookie `dt_teacher` (HttpOnly, Secure, SameSite=Strict, 8 h) |
| `POST /api/teacher/logout` | 204, invalida la sesión |
| `GET /api/teacher/students` | `[{profile, name, code, weekPoints, streak, lastSeen}]` |
| `GET /api/teacher/students/:profile` | sesiones (`groupSessions`), tendencia de precisión, `topics`, `predictNext` |
| `GET /api/teacher/classes?room=…` | por sesión de clase: alumnos, precisión, participación |

### Autenticación del profesor (plan)

- La contraseña **nunca** va en el bundle del cliente ni en el repo en claro. Se configura con una variable de entorno
  `TEACHER_PASSWORD_HASH` = `scrypt$N$r$p$salt_b64$hash_b64` (generada con un script local `scripts/teacher-hash.mjs`).
- Login: `crypto.scrypt` + `timingSafeEqual`; limitar intentos (p. ej. 5/min por IP) con retardo.
- Sesión: token aleatorio de 32 bytes en memoria/`DATA_DIR` (solo su hash SHA-256 guardado), cookie HttpOnly; nada en `localStorage`.
- Las rutas de profesor devuelven 401 sin cookie válida; la pestaña Profesor del frontend solo muestra el formulario
  hasta que `GET /api/teacher/me` responda 200.

### Límites de identidad

El perfil es un id aleatorio por dispositivo (+ código para continuar en otro). No es una cuenta verificada:
el profesor debe ver nombres como «autodeclarados» y poder fusionar perfiles manualmente; nunca fusionar por nombre automáticamente.
