# Expectativas obsoletas de pruebas de navegador (diagnóstico de `/practica`)

Resultado del diagnóstico: **no había ningún error funcional en `/practica`**. Las pruebas esperaban una interfaz anterior a dos commits de la propia web.
Comprobado con una sonda en navegador real: `?temas=` preselecciona, iniciar práctica, responder, recargar a mitad, «Continuar» y retomar la MISMA pregunta funcionan, sin errores de consola.

## Causas (con su origen)

| Esperaba la prueba | Contrato vigente | Origen |
|---|---|---|
| `form.home` / `form` con `input.field` en `/practica` | El formulario es `form.panel.stack` (ahora con `data-practice-form`). | `c247036` (selector de temas en tarjetas) |
| Recargar a mitad **retoma sola** la sesión | Se muestra el selector y la oferta «Continuar»; no reanuda sola. | `f733e28` («selector de temas primero, sin autoarranque») |
| Temas como `.chips .btn[aria-pressed]` | Tarjetas `.tp-tile[aria-pressed]` (`TopicPicker`). | `c247036` |
| `/jugar` y `/jenga`: `.home-card`, `.home-title`, `.chips` | `section[aria-labelledby=gs-teacher]`, `form[aria-labelledby=gs-student]`, `.setup-head h1`, `.tp-tile`. | `c247036` |
| Enlace de menú `/road-to-b1` y ancla `/#juegos` | «Exámenes» (`/examenes`) y «Juegos» (`/juegos`, página propia). | cambio de navegación local (`f9ef2f0`) |
| `/#juegos` en la portada (captura de `brand-ui`) | La portada ya no tiene la sección de juegos; ahora captura `#route-title` («De «Hallo» al examen»). Los juegos están en `/juegos`. | navegación local (`f9ef2f0`) |
| Pata SVG (`[data-klaus-paw]`, `.klaus-rig`, `[data-klaus-signature]`) | Figura dibujada por el motor Canvas (`[data-klaus-engine=canvas]`); el SVG queda como respaldo. | port de skins (`cfc08d3`) |

## Qué se cambió y qué no

- Se cambiaron **solo selectores y el paso «Continuar»**; ninguna comprobación se eliminó ni se relajó. Donde el contrato cambió, la prueba comprueba el contrato nuevo (p. ej. tras Continuar se retoma la misma pregunta y desaparece el selector).
- Único cambio de código: `data-practice-form` en el formulario de `Practice.tsx`, un gancho estable para pruebas que sobrevivirá al rediseño del selector de temas.
- La comprobación de «firma canónica de Klaus» en `klaus-hidden-browser.mjs` ahora mide tinta en el lienzo (antes buscaba un nodo SVG).

## Pendiente (fuera de este alcance)

- `scripts/hub-ui.mjs` y `scripts/road-ui.mjs` siguen desfasados (ver diagnóstico previo: 8 enlaces frente a 10 del catálogo; la sala está en `/road-to-b1/level-1`).
- Cuando se aplique el rediseño del selector de temas, los selectores `.tp-tile` deberán actualizarse de nuevo; `data-practice-form` no debe cambiar.

## Rediseño visual (rama visual-overhaul)

- `scripts/practice-ui.mjs` pulsaba el primer `[role=radio]` de la página para elegir «10 preguntas». El nuevo selector de `/practica` pone antes el control de **Nivel** (A1/A2/Todos, B1–C2 «Próximamente»), así que ese clic elegía «Todos» y la sesión salía con 15 preguntas (el tamaño guardado). La función no cambió: «10» sigue existiendo y funciona. La prueba ahora pulsa dentro del grupo con nombre accesible «Preguntas por sesión».
- `src/hub.test.ts` exige el texto «Todo el banco» en `/practica`; se mantiene en la cabecera nueva (no se cambió la prueba).
- `tests/klaus-hidden-browser.mjs` falló de forma intermitente con el rediseño (y nunca en HEAD): el formulario nuevo es más alto, al empezar la página seguía desplazada y el panel de Klaus se movía ~70 px después de medirlo. Era un fallo real (la partida aparecía a media página). Corregido en `Practice.tsx`: al empezar o continuar se vuelve arriba al instante. La prueba no se tocó.
- `tests/editorial-browser.mjs` no arranca servidor propio: necesita `EDITORIAL_BASE` (por defecto 127.0.0.1:5178). Contra el build de producción (`npm run build` + `server/index.ts` en un puerto y `EDITORIAL_BASE` apuntando a él) pasa 2/2, igual que HEAD. Contra Vite en modo desarrollo falla también en HEAD (línea 69), así que con el servidor de desarrollo no sirve como señal.

## Redet, clases nuevas y motion entre pestañas

- `tests/klasse-browser.mjs` pulsaba la **primera** lección de `/unterricht`. Con el banco nuevo (14 lecciones más, ordenadas A1 → A2) la primera ya no es `akk-01`; la prueba elige ahora `.kx-lesson[data-lesson="akk-01"]` explícitamente. El flujo comprobado es el mismo.
- Las lecciones nuevas (`server/ai/lesson-bank-a1.ts`, `lesson-bank-a2.ts`) llevan `verified: false` y se marcan «Borrador» en la lista hasta que el profesor las revise. Sus ejercicios de escucha se filtran solos mientras no exista el audio (misma regla que `akk-01`).
- `tests/klasse-lessons.test.ts` valida todo el banco (ids únicos, respuestas dentro de rango, huecos, pares, `ruleId` existentes, sin escucha sin texto, refuerzo).
- `tests/redet-browser.mjs` (nuevo): `/hablar` en modo práctica (sin IA): menú único, alta, escenario A2 bloqueado en A1, corrección «Ich habe 15 Jahre» → «Ich bin 15 Jahre alt», resumen, móvil sin desborde, consola limpia.

## Pata de Klaus y pantallas de acceso

- `tests/klaus-figure.test.ts` fijaba la ruta exacta del brazo antiguo (`M-3.3 1C-3.5 -8 -3 -18 -2.4 -28`), que dibujaba la pata en x=124 % del marco de la cara: flotaba separada de Klaus. El usuario pidió acercarla y rehacerla. La prueba conserva la intención (pata cerrada, 4 dedos `data-klaus-toe`, almohadilla `data-klaus-pad`) y ahora comprueba el contorno nuevo que nace bajo la mejilla (`translate(90.5 73.5)`). El motor Canvas (`public/klaus/klaus-renderer.js`, `_paint_behavior_overlay`) usa la misma geometría.
- Las pantallas sin sesión de `/hablar`, `/escribir` y `/unterricht` usan `src/klaus/KlausGate.tsx`; conservan las clases `.rd-gate`, `.kw-gate` y `.kx-gate` que buscan las pruebas.

## Modo libre, teoría, nav «… mit Klaus» y Tablón

- `tests/redet-browser.mjs`: antes esperaba «lista de 7 situaciones». La conversación libre ahora tiene su propio bloque
  (temas + «En blanco») y no se repite en la lista, para que cada botón lleve a un sitio distinto. La prueba pasa a pedir
  ≥ 6 situaciones guiadas, comprueba que «Conversación libre» no está en la lista y añade el recorrido del modo libre.
  El escenario `libre` del servidor no cambia.
- Navegación: «Hablar» → «Redet mit Klaus», «Escribir» → «Schreibt mit Klaus» (mismas rutas `/hablar` y `/escribir`) y
  nueva entrada «Tablón» (`/tablon`). Con 10 entradas la barra no cabe a 1366–1440 px: el menú desplegable pasa de
  ≤ 1360 px a ≤ 1440 px (brand.css y account.css). Ninguna prueba dependía del corte anterior.
- Tablón: `server/tablon.ts` + `tests/tablon.test.ts` + `tests/tablon-browser.mjs`. Solo cuentas de alumno con al menos una
  actividad (progreso, misiones, juegos o algo con Klaus: un borrador guardado o una conversación con mensajes) pueden abrir
  peticiones y apoyar. El autor nunca se muestra a otros alumnos. Retirar una petición no devuelve el cupo diario.
- Teoría: `GET /api/klaus/teoria` es pública y solo devuelve actividades de teoría, tabla y comparación (prueba en
  `tests/klaus-free.test.ts`). El resto de `/api/klaus/*` sigue exigiendo cuenta.

## Klaus solo para Plus (asignado desde Teacher OS)

- Regla del producto: Schreibt, Redet y Unterricht mit Klaus solo para cuentas Plus; el profesor asigna Plus en Teacher OS
  (`POST /api/teacher/students/:id { plan: 'plus' | 'free' }`). La teoría (`/api/klaus/teoria`) sigue pública y
  `/api/klaus/status` responde a cualquier cuenta para que la web pueda enseñar la pantalla «Klaus es parte de Plus».
- Expectativas obsoletas actualizadas (no se han borrado comprobaciones):
  - `tests/klaus-ai.test.ts`: el arnés da Plus a los alumnos (`user(alias, plan = 'plus')`) y, para conservar las
    pruebas de agotamiento de cuota, usa los límites pequeños (los de Free) también para Plus. El estado pasa de
    `plan: 'free'` a `plan: 'plus'`. Nueva prueba: una cuenta Free recibe 403 `code: 'plus'` en todas las rutas de Klaus.
  - `tests/klaus-free.test.ts`: la cuenta del arnés es Plus.
  - Pruebas de navegador (`klaus-writing`, `redet`, `klasse`, `tablon`): el servidor de prueba arranca con una
    contraseña de profesor aleatoria y `KLAUS_LIMITS_PLUS` pequeño (`tests/helpers/plus-browser.mjs`); Plus se da por
    Teacher OS, el camino real. `klaus-writing` y `klasse` comprueban antes que sin Plus sale la pantalla de Plus.
  - `klaus-writing`: «plan Free con 3 revisiones/día» pasa a «plan Plus (límites de prueba: 3 revisiones/día)».

## Conversación sin bloqueos, modo voz y límites nuevos

- Bug corregido: al agotar la cuota diaria (3 en Free / 25 en Plus) el campo de Redet quedaba «Conversación cerrada» y
  Schreibt bloqueaba «Revisar». Ahora la cuota cuenta solo mensajes CON IA; al agotarse (o si la IA gratis está
  saturada) Klaus sigue en modo práctica (motor local: guion + correcciones por reglas), sin límite. Sin IA real no se
  descuenta nada. En modo práctica el guion ya no repite la despedida: sigue con preguntas abiertas.
- Límites Plus: text 25→80, voiceSeconds 600→1800, ttsChars 12000→40000, klasseSessions 5→20, klasseAsks 30→40.
  Turnos por conversación 40→100. El techo real de la IA gratis es de OpenRouter: 50 peticiones/día por clave
  (2 claves = 100/día en total), comprobado en GET /api/v1/key (`free_model_daily_requests`).
- Expectativas obsoletas actualizadas:
  - `tests/klaus-ai.test.ts`: «la 4.ª revisión → 402» pasa a «la 4.ª revisión → 200 en modo práctica (`limited: true`)»
    con un proveedor marcado como real; y sin IA real no se descuenta cuota.
  - `tests/klaus-writing-browser.mjs`: «3 revisiones y el botón se desactiva» pasa a «5 revisiones seguidas y el botón
    sigue activo; modo básico: revisiones sin límite».
- Modo voz (Redet): `src/klaus/voice.ts` usa SpeechRecognition del navegador (de-DE) + la voz alemana del navegador.
  `tests/redet-voice-browser.mjs` lo prueba con un reconocedor simulado (Edge headless no tiene micrófono): prueba el
  bucle de la app, NO el reconocimiento real de voz.

## Plan Free: límites de curso y práctica, pestaña Plus y Lektion 1 sin Repaso

- Regla del producto: con plan Free, cada día 2 Lektionen NUEVAS (abrir sus diapositivas; las ya abiertas se releen
  siempre) y 2 prácticas nuevas en /practica (reanudar no cuenta; los juegos de /libre no cuentan). Sin cuenta, ni
  diapositivas ni práctica. Plus y profesor: sin límite. Lo decide el servidor (`server/free-access.ts`,
  `DATA_DIR/free-access.json`); las diapositivas bloqueadas redirigen a `/registro` o a `/plus?motivo=diapos`.
- Pestaña «Solicita tu suscripción Plus» (`src/components/PlusOffer.tsx`) con el número +34 611 778 791 (WhatsApp/llamar)
  en Redet, Schreibt, Unterricht, el curso, la práctica y la página `/plus`.
- Lektion 1 (Brücke A1) ya no tiene etapa de Repaso (`noReviewStep`): su presentación de repaso pasa a «Ver».
- Expectativas obsoletas actualizadas:
  - `tests/course.test.ts`: Lektion 1 = Ver → Practicar (antes Ver → Practicar → Repaso); progreso 1/2 (antes 1/3).
  - `src/hub.test.ts` y `tests/klaus-practice.test.ts`: /practica ya no tiene campo «Tu nombre» (practicar exige cuenta).
  - `tests/freeplay-server.test.ts`, `tests/hardening.test.ts`, `tests/server-ws.test.ts` arrancan con
    `DT_FREE_LIMITS=0`: prueban el /practica antiguo por dispositivo, códigos de alumno y reconexión, no el plan Free.
    Los límites se prueban en `tests/teacher-os.test.ts` («plan Free fuera de Klaus…») y `tests/plus-offer-browser.mjs`.
  - Pruebas de navegador que practicaban escribiendo un nombre (`klaus-browser`, `klaus-embedded-browser`,
    `klaus-global-effects-browser`, `klaus-hidden-browser`, `scripts/page-transition-ui`, `gamefeel-header-ui`,
    `practice-ui`, `progress-ui`, `overflow`): ahora crean una cuenta de prueba con Plus
    (`studentPlus` en `tests/helpers/plus-browser.mjs`, por Teacher OS). `page-transition-ui` comprueba la conservación
    de DOM/foco con el interruptor «Repasar sobre todo mis fallos» en vez del campo de nombre; `progress-ui` lee los
    puntos de `/api/account/progress` (con cuenta, el progreso es de la cuenta); `klaus-browser` espera a que se vaya
    el aviso de logro «primera respuesta» (solo sale con cuenta) antes de pulsar «Ocultar a Klaus».

## Plus mes a mes (Bizum manual), prueba de 3 días y aviso diario

- `server/plus-billing.ts` (fichero nuevo `plus-billing.json`, sincronizado como el resto de `*.json`): fecha de fin de Plus,
  pagos y prueba. Con fecha manda la fecha (al llegar vuelve a Free solo); sin fecha, el plan guardado de antes
  (las cuentas a las que ya se activó Plus a mano siguen igual, sin caducar).
- Teacher OS: «Pago recibido · +1 mes» (`POST /api/teacher/students/:id { payment: 'received' | 'undo' }`) suma 1 mes
  desde hoy o desde el fin actual; «Quitar Plus» lo corta ya; «Activar Plus sin fecha» = comportamiento anterior.
  `GET /api/teacher/plus`: suscriptores, ingreso mensual (pagando × 12,50 €), cobrado en el mes, caducan en 5 días
  y cuentas Free que chocaron hoy con el límite (candidatos a Plus).
- Alumno: `GET /api/plus/me`, `POST /api/plus/trial` (3 días, una vez por cuenta, 409 si se repite o ya tiene Plus).
- Aviso diario solo dentro de la web (`GET /api/daily` + `src/components/DailyNudge.tsx`): racha, misión, repasos
  pendientes, cupo Free y Plus que caduca. «Cerrar» lo oculta hasta el día siguiente. Sin push ni email.
- La tarjeta Plus ya no dice «Solicitar Plus»: botón «Escribir por WhatsApp» + instrucciones de Bizum (concepto = alias).
- Pruebas: `tests/plus-billing.test.ts`, caso nuevo en `tests/teacher-os.test.ts`, `tests/plus-month-browser.mjs`.
- `plus-teacher-browser`: la tarjeta se llama ahora «Plan · Plus» y el botón Activar/Quitar está en su propia fila;
  la prueba comprueba `[data-plan]` y `[data-plan-toggle]` por separado (mismo contrato: activar y quitar Plus).
- El aviso diario solo sale en portadas (`/`, `/mi`, `/curso`, `/juegos`, `/examenes`, `/ranking`, `/tablon`): en la
  práctica tapaba los controles de Klaus (lo detectó `klaus-embedded-browser`).
