# Deutschtrainer — pulido cinematográfico y gamefeel

Estado: publicación autorizada por el usuario el 26 de octubre de 2026. Base anterior: `73bf824`. La salida a producción se verifica por coincidencia de assets y smoke de APIs; un push por sí solo no acredita el despliegue.

## Dirección

- Negro tinta, papel cálido, rojo señal y oro. Se conserva el símbolo canónico cuaderno/lápiz/A y el Klaus aprobado, dentro del ejercicio.
- La entrada concentra energía hacia el centro mediante trazos vectoriales. Mantiene la duración nominal de 6200 ms, Salto/Escape inmediato y limpieza al navegar; no se repite al cambiar de página.
- La portada utiliza Barlow Condensed 600/700 autoalojada para titulares, Space Grotesk para lectura y JetBrains Mono para instrumentos. Los textos se presentan por palabras/líneas, sin sustituir contenido legible por caracteres aleatorios.
- El fondo es un shader original de pigmento rojo/oro sobre tinta, de un triángulo y sin texturas. Solo corresponde a la portada; las preguntas y los exámenes no reciben un bucle decorativo de GPU.
- Las tarjetas y acciones tienen respuestas breves al foco, al pulsar y al pasar el puntero. El desplazamiento magnético está acotado; no se secuestra el scroll.
- En práctica, una tira pequeña muestra preguntas completadas/aciertos reales. El feedback está en el propio ejercicio y lo dispara el observador autoritativo y deduplicado de Klaus; no se añaden XP ni recompensas inventadas. Se retira la antigua celebración de clase que cubría el ejercicio con confeti/flash/glitch.
- Un control «Efectos» persistente permite pausar la ambientación, transiciones y movimiento. La preferencia de accesibilidad del sistema no se puede anular. La práctica no se reinicia al cambiar este ajuste.
- El HUD del juego queda debajo de la navegación, con altura real medida por ResizeObserver; no se superponen al desplazarse.

## Referencias consultadas

- MDN, WebGL best practices: https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices — presupuesto de backbuffer, pocas llamadas y liberación explícita de recursos.
- MDN, Web Animations API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Animations_API — ciclo de vida/cancelación y controles de movimiento.
- Google Fonts, Barlow Condensed: https://fonts.google.com/specimen/Barlow+Condensed — familia editorial autoalojada mediante Fontsource; sin peticiones de fuentes a un CDN al abrir la web.
- Codrops, Decorative WebGL Backgrounds y catálogo de tipografía: consultado en resultados de búsqueda como referencia de dirección visual. La página de artículo devolvió 403; no se presenta como contenido íntegramente leído ni se ha copiado su código.

## Verificación ejecutada

- `npm run build`: exit 0; TypeScript + Vite, 114 módulos.
- `npm test -- --config src/hub.vitest.config.ts --maxWorkers=2 --reporter=json --outputFile=shots/polish-final/final-tests.json`: 325/325, cero fallos y cero pendientes. Incluye la suite principal; no se suman conteos duplicados.
- `npm run e2e`: exit 0, sala de clase/tres clientes, puntuaciones, cartas, actividades, reconexión, reinicio y práctica.
- `scripts/gamefeel-header-ui.mjs`: RED real con HUD top=0 bajo nav bottom=69; GREEN con HUD top=69.
- `scripts/visual-polish-ui.py`: exit 0, 46 comprobaciones reales en Edge, tamaños 1366/1024/390/320; tipografía, overflow, navegación, práctica real con racha 3, progresión, ausencia de remount, pausar/reanudar sin replay, restauración de sesión, reduced-motion y fallback sin WebGL. Artefactos: `shots/visual-polish/`.
- Pruebas nuevas del progreso/feedback: RED→GREEN, sin predecir resultados ni sumar puntos en el cliente.
- Se adaptó la prueba SSR del titular para comprobar el texto del h1, no exigir que sus palabras animadas compartan un único nodo HTML. No se eliminó la aserción del contenido.
- El primer lanzamiento masivamente paralelo saturó el entorno y produjo timeouts. La verificación de arriba se repitió con dos workers sin aumentar timeouts. Las dos regresiones reales de la primera integración (selector CSS inválido y elegibilidad de reduced-motion en el harness) se corrigieron y sus tests focalizados pasaron.

## Cierre de integración

- Regresiones reales de navegador: `intro-v2-ui`, `intro-navigation-ui`, `page-transition-ui`, `klaus-embedded-browser`, `klaus-hidden-browser`, `practice-ui`, `hub-ui` y `workshop-ui` terminaron encadenadas con exit 0.
- `tests/klaus-global-effects-browser.mjs`: RED confirmó que Enter sobre el control de navegación avanzaba la pregunta y que pausar/reanudar repetía una celebración. GREEN en los dos escenarios (pausa durante celebración y respuesta con efectos pausados): conserva la corrección/progreso, muestra reposo sin burst y el siguiente resultado auténtico vuelve a reaccionar. Se conserva la activación nativa de controles.
- Se reforzó el contraste de los trazos convergentes para que no fueran una animación presente solo en el DOM. `scripts/intro-energy-ui.mjs`: capturas reales pausadas a 600/950/1300 ms; la versión final supera la comprobación de visibilidad fuera del emblema (748/1444/871 píxeles rojos/dorados sobre el umbral de luminancia de la prueba). Es una comprobación visual específica, no una métrica de rendimiento.
- La primera revisión independiente identificó dos P2, ambos corregidos por un contexto distinto: distancias GLSL al cuadrado por multiplicación y cancelación explícita/limpieza de BlackCard mediante AbortSignal. El integrador repitió `scripts/blackcard-cancellation-ui.mjs`: 13/13 escenarios Edge pasaron, sin draws posteriores a pausa/desmontaje y sin recursos tardíos al cancelar imports/fuentes. `scripts/ambient-ui.mjs` también pasó con fallback, accesibilidad, storage entre pestañas y liberación de GPU.
- El intento de segunda revisión independiente quedó bloqueado por HTTP 429; no se presenta como una aprobación. Se cerró la verificación con las pruebas reales y revisión directa de las correcciones.
- `tests/editorial-browser.mjs` pasó en 320/390/768/1024/1366: fuente cargada, canvas visible, sin overflow, teclado y señal táctil correctos.

Vídeos reales grabados sin errores de JavaScript, H.264/yuv420p y faststart: `06 - Intro cinematográfica y nueva portada.mp4` (1366×768), `07 - Intro y portada móvil.mp4` (390×844, emulación) y `08 - Gamefeel y Klaus en práctica real.mp4` (1366×768). Manifiesto local con hashes: `shots/polish-final/approval-manifest.json`. No se ha probado Safari ni un teléfono físico.

El usuario sustituyó la espera de visto bueno por autorización explícita de publicar la revisión existente. Sin ampliaciones de alcance ni nuevas funcionalidades de profesor.