# Klaus + nueva identidad: versión para aprobación

No se ha hecho commit, push ni despliegue. Se conserva la versión pública anterior mientras el usuario revisa vídeos.

## Contenido

- Logo vectorial basado en el dibujo: silueta A, D como cuaderno, T como lápiz horizontal. `src/brand/logo-mark.ts` es su geometría reutilizable.
- Intro cinematográfica de 6200 ms: trazado, ensamblaje, hojas doradas, firma y apertura. Puede saltarse inmediatamente con clic/Escape, restaura foco y respeta movimiento reducido. Botón Repetir intro en el pie de portada.
- Klaus conserva la geometría canónica del renderer suministrado. Original, Professor, Feuer y Royal son reacciones temporales, no una tienda o promesa de recompensas.
- Práctica real: saludo, pensar, acierto, apoyo al fallar, hitos 3/5/10 y fin. Comentarios rotativos locales, sin API de IA. Sonido opcional apagado por defecto, ocultar y movimiento mínimo persistidos.
- `/preview/klaus` es un laboratorio explícitamente etiquetado; no crea sesiones ni altera puntos. Se carga aparte.

## Vídeos

Grabaciones reales de Edge aislado con servidor local y datos temporales, sin alumnos de producción. Se entregan MP4 H.264 sin audio. Las respuestas de prueba se envían automáticamente al servidor real; no se sustituye su corrección ni se inyectan snapshots falsos en las grabaciones. Claves del banco solo en el proceso de grabación, nunca en el bundle.

- `shots/klaus-approval/after/intro.mp4`: entrada y portada, 1366×768.
- `shots/klaus-approval/practice/practice.mp4`: sesión real, rachas 3/5/10, fallo y final, 1366×900.
- `shots/klaus-approval/showcase/showcase.mp4`: laboratorio de reacciones etiquetado, 1100×700.
- Cada carpeta contiene `capture.json`; la práctica contiene `practice-events.json` con estados observados.

Reproducir con un Python que tenga Playwright, Edge instalado y ffmpeg en PATH:

```
python scripts/record-brand-preview.py --scenario intro --output shots/klaus-approval/after
python scripts/record-brand-preview.py --scenario practice --height 900 --output shots/klaus-approval/practice
python scripts/record-brand-preview.py --scenario showcase --width 1100 --height 700 --output shots/klaus-approval/showcase
```

## Verificación ejecutada por el integrador

- Build: correcto.
- Suite principal: 272 tests correctos.
- Configuración hub (incluye parte de los anteriores): 289 tests correctos. No sumar ambas cifras.
- `tests/klaus-browser.mjs`: 37 comprobaciones correctas en Edge, con rachas autoritativas, recarga sin repetir reacción, preferencias, audio opt-in, teclado y 320/390px.
- `scripts/intro-v2-ui.mjs`: correcto, siete capturas, foco/Escape, replay, reduced-motion vivo, una vez por pestaña. Duración observada 6169 ms y salto 52 ms.
- `scripts/brand-ui.mjs`: correcto, nueve rutas y cuatro tamaños, sin overflow ni errores; contrato actualizado de 2.4 a 6.2 segundos.
- E2E BlackCard: correcto.
- Hub UI y taller UI: correctos. El taller usa Enter nativo y espera selección para no confundir scroll en curso con una activación fallida.
- `scripts/practice-ui.mjs`: correcto de extremo a extremo tras acotar el formulario de inicio a `form.home` y activar Siguiente mediante Enter nativo para evitar la carrera con smooth-scroll. Cuatro sesiones de 10, sin solapamiento consecutivo, recarga, sala caducada, BlackCard por temas y Jenga por temas verificados.

## Cierre de la revisión independiente

Se corrigieron los dos P2 reproducidos por el revisor con pruebas RED → GREEN:

- Navegar (incluido Atrás o solo cambios de query) cancela la intro y limpia bloqueo, inert, foco atrapado y temporizadores. `node scripts/intro-navigation-ui.mjs`: tres escenarios correctos, overlay/lock ausentes, inert y timers a cero, misma sesión del documento.
- Ocultar Klaus consume la reacción visual activa y las recibidas mientras está oculto. Al mostrar queda en reposo, sin repetir sonido; el siguiente resultado real sí celebra. `node tests/klaus-hidden-browser.mjs`: ambos escenarios correctos.

El integrador volvió a ejecutar ambos scripts en Edge, build, 272 tests principales y 289 en configuración hub: todo correcto. Los vídeos anteriores siguen mostrando el diseño vigente; estas correcciones afectan únicamente navegación y ocultar/mostrar.

No se han cambiado backend, bancos de preguntas, Road ni Boxen para esta entrega. Solo queda el visto bueno visual del usuario antes de publicar; no se ha hecho commit, push ni despliegue.
