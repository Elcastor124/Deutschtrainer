# Deutschtrainer: experiencia del alumno

## Rutas y funcionamiento
- `/`: marca Deutschtrainer, intro breve saltable, escena 3D interactiva cargada de forma diferida, fallback sin WebGL y puntos semanales.
- `/curso`: siete unidades ordenadas, cuatro pasos por clase (presentación, práctica, juego, repaso) y Road to B1. Las marcas de avance son autoevaluación local del dispositivo, no una calificación ni un bloqueo de acceso.
- `/tema/1`: biblioteca compatible con enlaces anteriores; ocho presentaciones y cinco PDF.
- `/practica?temas=dativ,akkusativ`: selección de temas, sesiones de 10/15/25 preguntas, mezcla de preguntas nuevas y errores. Una recarga recupera la sesión; una sesión caducada se sustituye avisando y manteniendo la configuración.
- `/jugar?temas=perfekt`: BlackCard con temas seleccionados.
- `/jenga?temas=perfekt`: sala que arranca directamente en Wort-Jenga. Se mantienen los códigos y las invitaciones `/?sala=CODE`.
- `/profesor`: reservado, sin panel privado ni contraseña publicada. Analítica docente y autenticación no se implementan en esta entrega.

## Puntos y persistencia
`recordResult` registra respuestas reales de práctica y BlackCard, y Jenga registra sus respuestas en `server/tasks.ts`. Cada evento conserva tema, sala y origen. El marcador semanal usa la zona Europe/Madrid y evita otorgar repetidamente los puntos de la misma pregunta el mismo día. `SIGINT` y `SIGTERM` vacían el buffer antes de salir.

Los puntos de Boxen Arena y Road to B1 NO están conectados al perfil general todavía: sus identidades de sala son independientes. No se fusionan por nombres. El avance del curso se guarda en el navegador; los puntos se guardan en DATA_DIR/progress.json. Para conservarlos entre despliegues se requiere almacenamiento persistente real en Render (el blueprint declara un disco en /var/data). No basta con que la API funcione para probar la configuración del disco del servicio existente.

## Pruebas
- `npm run build`
- `npm test -- --config src/hub.vitest.config.ts`
- `npm run e2e` (incluye respuestas reales → API de puntos)
- `node scripts/brand-ui.mjs` (nueve rutas/cuatro resoluciones, intro, fallback WebGL, navegación y avance)
- `node scripts/practice-ui.mjs` (recarga, sesión caducada, variedad, juegos por temas)
- `node scripts/progress-ui.mjs` (respuesta real → widget de portada; admite BASE)
- `node scripts/hub-ui.mjs`
- `node scripts/road-e2e.mjs`
- `node scripts/boxing-e2e.mjs`

Comparar los assets HTML de producción con dist y comprobar las API de progreso y Road después del push. Un push no garantiza que Render haya terminado su despliegue.
