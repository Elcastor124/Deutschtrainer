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
| Pata SVG (`[data-klaus-paw]`, `.klaus-rig`, `[data-klaus-signature]`) | Figura dibujada por el motor Canvas (`[data-klaus-engine=canvas]`); el SVG queda como respaldo. | port de skins (`cfc08d3`) |

## Qué se cambió y qué no

- Se cambiaron **solo selectores y el paso «Continuar»**; ninguna comprobación se eliminó ni se relajó. Donde el contrato cambió, la prueba comprueba el contrato nuevo (p. ej. tras Continuar se retoma la misma pregunta y desaparece el selector).
- Único cambio de código: `data-practice-form` en el formulario de `Practice.tsx`, un gancho estable para pruebas que sobrevivirá al rediseño del selector de temas.
- La comprobación de «firma canónica de Klaus» en `klaus-hidden-browser.mjs` ahora mide tinta en el lienzo (antes buscaba un nodo SVG).

## Pendiente (fuera de este alcance)

- `scripts/hub-ui.mjs` y `scripts/road-ui.mjs` siguen desfasados (ver diagnóstico previo: 8 enlaces frente a 10 del catálogo; la sala está en `/road-to-b1/level-1`).
- Cuando se aplique el rediseño del selector de temas, los selectores `.tp-tile` deberán actualizarse de nuevo; `data-practice-form` no debe cambiar.
