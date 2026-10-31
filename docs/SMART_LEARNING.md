# Smart Learning System V1 — Tägliche Mission + Klaus tutor

Todo funciona **sin IA generativa y sin APIs de pago**: reglas pedagógicas, plantillas y repetición espaciada, en el
propio servidor. Coste operativo adicional: **0 €** (CPU despreciable; un fichero JSON más en `DATA_DIR`).

## Arquitectura

```
Respuestas (práctica, juegos, misiones)
        │  ProgressLog.record({ profile, qid, topic, ok, assisted? })      ← fuente ÚNICA de evidencia
        ▼
server/learning.ts ── itemStats()  → memoria por pregunta (Leitner, cajas 0–5)
                   ├─ topicMastery() → dominio por tema, errores aislados / recurrentes
                   ├─ buildMission() → misión del día (pura y determinista)
                   └─ API /api/mission/*  (estado de cada misión en DATA_DIR/learning.json)
server/tutor.ts ───── RULES (banco de explicaciones) + hintFor(q, nivel 1|2|3)
        ▼
UI: /mision (Mission.tsx) · /mi (tarjeta + historial) · Practicar (TutorHint) · Teacher OS (ficha del alumno)
```

* **No se duplica la base de resultados**: la memoria de aprendizaje se *deriva* del registro de progreso que ya
  usaban práctica, juegos y ranking. `learning.json` solo guarda qué preguntas tuvo cada misión, las pistas usadas,
  los intentos y si se completó.
* **Juegos (Boxeo, Jenga, BlackCard, Deutsch Deck)**: la interfaz compartida es `ProgressLog.record({ kind: 'answer', qid, topic, ok })`.
  Cualquier motor que ya registre respuestas (práctica y boxeo lo hacen) alimenta automáticamente las misiones.
  Para marcar un acierto conseguido con ayuda basta con añadir `assisted: true`. No hace falta tocar los motores.

## Memoria por pregunta (repetición espaciada)

* Solo cuenta la **primera respuesta de cada pregunta por día** (hora de Madrid): repetir una pregunta 20 veces no
  infla el dominio.
* Acierto independiente → +1 caja. Acierto **con ayuda** (pista de Klaus o segundo intento) → no sube (máx. caja 2).
  Fallo → caja 0 y se apunta un *lapso*.
* Próximo repaso = último intento + `INTERVAL_DAYS[caja]` = 0, 1, 3, 7, 14, 30 días.
* Error **aislado** = 1 lapso en 30 días. **Recurrente** = ≥ 2 lapsos de la misma pregunta o ≥ 3 fallos del tema en 30 días.
* Dominio de un tema = media de cajas / 5. Estado: «a reforzar» (< 30 % o recurrente), «en progreso», «fuerte» (≥ 60 %).

**¿FSRS?** Se valoró. FSRS necesita calificaciones de recuerdo (again/hard/good/easy) y bastante historial por ítem
para ajustar sus parámetros; con preguntas de opción múltiple y pocos repasos por alumno, un Leitner con intervalos
fijos es más estable, explicable y verificable. La estructura (eventos con `qid`, `ok`, `assisted`, fecha) permite
migrar a FSRS más adelante sin cambiar los datos.

## Algoritmo de la misión diaria (5 ejercicios, solo opción múltiple)

Determinista por `(alumno, día)` — la misma entrada produce la misma misión; se genera una vez al día y se guarda.

1. **2 × Repaso**: preguntas acertadas antes cuyo intervalo venció (las más atrasadas primero, temas distintos si se puede).
   Sin historial: base del nivel (empezando por *Sich vorstellen*).
2. **1 × Error**: el fallo más reciente (los recurrentes primero). Si esa pregunta ya salió hoy, otra del mismo tema.
3. **1 × Consolidación**: el tema del nivel con menos dominio que aún no esté en la misión (los no vistos cuentan como 0).
4. **1 × Vocabulario**: Wortschatz / Alltag / Sich vorstellen, fácil.

Temas permitidos = temas del nivel (A1/A2/B1, ver `LEVEL_TOPICS`) ∪ temas que el alumno ya ha practicado. Nunca
Leseverstehen (necesita un texto delante) ni preguntas «special». El nivel lo asigna el profesor en Teacher OS
(por defecto A1).

## Klaus tutor (pistas progresivas)

| Nivel | Qué da | Cuándo |
|---|---|---|
| 1 · Pista | orienta sin revelar la respuesta | tras el primer fallo (automática, desactivable) o a petición |
| 2 · Regla | la regla con un ejemplo distinto | a petición, después de la pista 1 |
| 3 · Solución razonada | respuesta + `explain` del banco + regla | solo tras fallar o tras pedir las pistas 1 y 2 |

* `RULES` (server/tutor.ts): cada regla tiene tema, nivel, detector de contexto (p. ej. «mit ___» → dativo),
  tipo de error, pista, explicación y ejemplo correcto/incorrecto. Temas: Präsens, Modalverben, Perfekt, Akkusativ,
  Dativ, Präpositionen, Possessivartikel, Nebensätze, Satzbau, Trennbare Verben, Wortschatz, Alltag, Adjektive,
  Imperativ y Sich vorstellen.
* Si no hay regla para la pregunta (p. ej. Leseverstehen), Klaus lo dice («todavía no tengo una pista específica»)
  y en el nivel 3 usa solo la explicación verificada del banco. No se genera texto nuevo.
* `tutorProvider` es el punto de extensión para un LLM local o una API **opcional**; está a `null` (desactivado).
* En **Practicar** Klaus da niveles 1 y 2 bajo demanda (`/api/tutor/hint`); la solución sigue saliendo en la corrección.

## Evidencia y anti-duplicados

* La misión registra la **primera** respuesta de cada pregunta; si después aciertas, se registra como `assisted`.
  Revelar la solución nunca cuenta como acierto. Un acierto con ayuda puntúa como intento (+2), no como acierto.
* Opción ya probada → 409. Pregunta cerrada → 409. Completar es idempotente (una sola sesión registrada).
* Invitados: misión genérica en memoria, nada se guarda ni se atribuye a ninguna cuenta.

## Datos almacenados (mínimos)

`DATA_DIR/learning.json`: por cuenta, sus misiones (id, día, nivel, preguntas, intentos, pistas, final, fecha de
completado). Máx. 120 misiones por cuenta. Se borra con la cuenta. Las respuestas siguen en `progress.json`
(retención 180 días). Ningún dato sale del servidor (salvo la copia opcional en Supabase si está configurada).

## Privacidad y permisos

* Cada endpoint identifica al alumno por su cookie; la misión de otro alumno responde 404 y el historial exige sesión.
* El profesor ve en Teacher OS (ficha del alumno) misiones completadas, dominio por tema y errores recurrentes.
* Nada de esto aparece en el ranking. Las pistas automáticas de Klaus se desactivan desde la propia misión.

## Pruebas

* `tests/learning.test.ts`: memoria Leitner, generación por nivel, prioridad de errores, repaso espaciado, pistas
  progresivas, reglas vs. banco, persistencia, anti-duplicados, seguridad entre alumnos, invitados y ausencia de red.
* `scripts/mission-e2e.mjs`: navegador real (escritorio y móvil): misión → fallo → pista de Klaus → acierto con ayuda
  → final → historial en /mi.

## Pendiente (V2)

* Otros tipos de pregunta (escribir, ordenar) en la misión: el motor ya lo admite, falta la UI y la corrección parcial.
* Marcar `assisted` en los juegos que permiten segundo intento (BlackCard/Second Chance).
* Ajustar los intervalos con datos reales de uso; valorar FSRS cuando haya historial suficiente.
* Más reglas contextuales (Perfekt con verbos de movimiento concretos, Adjektivdeklination).
