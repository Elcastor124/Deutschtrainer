# Road to B1 — Level 1

## Uso en clase

1. En la portada o en la navegación superior, abre **Road to B1** y **Level 1 — Die erste Prüfung**.
2. El profesor crea una sesión; los alumnos entran con su nombre y el código compartido.
3. El panel del profesor es privado. Abre la **vista de proyección** en otra pestaña del mismo navegador y proyecta esa pestaña, no el panel con respuestas individuales.
4. Cambia manualmente entre Einführung, Lesen, Korrektur, Diktat, Hören y Ergebnisse. Los 105 minutos son una recomendación, no un cierre automático.
5. Autoriza la corrección por separado para lectura, dictado y audición. Publicar una corrección sella el trabajo original, incluso si después vuelves a ocultar las soluciones. Solo se pueden reabrir entregas antes de exponer soluciones o entrar en Ergebnisse; para otro intento evaluable crea otra sesión. La revisión del profesor no modifica el texto original del alumno.
6. Corrige el dictado con la rúbrica de diez elementos. Hasta su revisión, el resultado total se indica como pendiente; nunca se inventa una nota definitiva.

## Duración y evaluación

| Bloque | Duración |
|---|---:|
| Einführung | 5 min |
| Leseverstehen | 50 min |
| Korrektur | 8 min |
| Diktat | 15 min |
| Hörverstehen | 22 min |
| Ergebnisse | 5 min |

Lectura: 30 preguntas (6/6/7/7/4). Audición: cinco grabaciones, dos preguntas cada una. Dictado: diez elementos revisados por el profesor. Total: **50 puntos**, equivalencia sobre diez y porcentaje. Los ejemplos no puntúan. Es un simulacro pedagógico original adaptado a A1–A2, **no un examen oficial ni una certificación Goethe**.

## Arquitectura y límites

- El cliente React se integra en las rutas de la aplicación y reutiliza navegación, componentes y estilos de la plataforma.
- `shared/road.ts`: contratos versionados de nivel, preguntas, roles, resultados y acciones; sin claves ni guiones.
- `server/road-content.ts`: contenido original, soluciones y guiones, exclusivamente del servidor.
- `server/road.ts`: sesiones reales con credenciales por rol, sincronización mediante consultas autenticadas y persistencia atómica en `DATA_DIR/road.json`.
- `src/views/Road.tsx`, `src/road-client.ts`, `src/road.css`: alumno, profesor y proyección, con reconexión y recuperación de sesión.
- `server/road-audio/`: audios pregenerados privados y manifiesto de procedencia. No se generan voces durante la clase ni se necesita una cuenta de voz por alumno.

Las sesiones siguen el modelo de la plataforma: código y nombre, no cuentas escolares verificadas. Conservar la sesión del navegador permite recuperar el trabajo; no se vinculan resultados privados entre dispositivos a partir de un nombre o un identificador que cualquiera pudiera copiar. El disco persistente configurado en Render es necesario para conservar las salas ante reinicios; un despliegue sin disco persistente no garantiza esa conservación.

Las dos escuchas se contabilizan en el servidor mediante intentos lógicos recuperables. Una respuesta perdida o una descarga interrumpida conserva el intento pendiente: volver a cargar el mismo audio no consume otra escucha. El cliente confirma el inicio real y guarda las confirmaciones pendientes si cae la conexión. En el panel privado, el profesor puede autorizar una escucha adicional a un alumno concreto. Pausar mientras el archivo está cargando impide su reproducción posterior hasta que se reanude explícitamente.

Los reproductores no ofrecen barra de búsqueda y los audios se entregan mediante permisos temporales de un solo uso, sin el token principal en la URL. Esto no es DRM: un usuario que graba o conserva el sonido puede repetirlo por fuera de la interfaz. La actividad es pedagógica, no un sistema de vigilancia de exámenes.

## Verificación reproducible

```bash
npm run build
npm test
npm test -- --config src/hub.vitest.config.ts
node scripts/road-e2e.mjs
node scripts/road-ui.mjs
node scripts/road-audio-failure-ui.mjs
node scripts/road-layout.mjs
node scripts/boxing-e2e.mjs
node scripts/hub-ui.mjs
node scripts/workshop-ui.mjs
npm run e2e
```

`road-ui.mjs` abre cuatro contextos reales de Edge/Chromium (profesor, dos alumnos, proyección), con clics, teclado en los selectores, móvil táctil, reproducción y decodificación real de los cinco audios, segunda escucha, dictado completo/fragmentado, caída de red y recuperación del borrador, bloqueo/pausa, entrega y revisión de 50/50. La velocidad del audio se acelera únicamente en ese navegador de prueba para no esperar la duración completa de cada grabación; el producto no altera su velocidad.

## Añadir niveles

El contenido del nivel se modela mediante `RoadLevel` y `RoadSecret`: identificador, versión, partes, textos, tipos de pregunta, claves, calendario, rúbrica y audios. El motor de sesiones, las pantallas de lectura/asociación/audición/dictado y la evaluación se reutilizan. Un nuevo nivel requiere su contenido, registro en el servidor y audios; no duplicar el motor ni publicar las soluciones en el bundle del navegador.
