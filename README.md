# DEUTSCH TRAINER // BLACKCARD

Quiz multijugador de alemán A1–A2 para una clase de **105 minutos**: el profesor proyecta su pantalla, dos (o hasta ocho) alumnos juegan desde su ordenador, Chromebook o móvil, y el servidor lleva los puntos, los objetos y la corrección. Incluye un **modo práctica** para casa que empieza por lo que cada alumno falló en clase.

## Puesta en marcha

Requisitos: **Node.js 22.18 o superior** (el servidor ejecuta TypeScript directamente).

```bash
cd blackcard
npm install
npm run build      # compila el cliente en dist/
npm start          # servidor en http://localhost:4747
```

Al arrancar, la consola muestra la dirección para los alumnos de la misma wifi, por ejemplo `http://192.168.1.22:4747`. El lobby del profesor también la muestra junto al código de sala.

- La primera vez, Windows pedirá permiso del cortafuegos para Node: marca **redes privadas**.
- Si la red del centro aísla los dispositivos entre sí (pasa en muchas wifis escolares), usa una de las opciones de URL pública de abajo.
- Otro puerto: `PORT=5000 npm start`. En PowerShell: `$env:PORT=5000; npm start`.

### En clase

1. **Profesor:** abre `http://localhost:4747` → **Crear sala**. Proyecta esa pantalla.
2. **Alumnos:** abren la dirección que aparece en el lobby, escriben el código de 4 letras y su nombre (o usan el enlace directo `/p/CÓDIGO`).
3. Pulsa **Espacio** para avanzar. El secuenciador superior marca los 8 bloques y su tiempo; también se puede saltar a cualquier bloque haciendo clic en él.

Si un alumno recarga la página o pierde la wifi, vuelve a entrar como el mismo jugador y con su puntuación. Si se reinicia el servidor, la sala se recupera de `data/state.json`.

### Compartir mediante URL (fuera de la red local)

| Opción | Cómo |
|---|---|
| **Render** (recomendado) | Sube la carpeta a un repositorio de GitHub → en Render, *New → Blueprint* → elige el repo. Usa `render.yaml` (plan *starter* con disco persistente). En el plan gratuito funciona, pero los datos se pierden cuando el servicio se duerme. |
| **Docker** (Fly.io, Railway, VPS) | `docker build -t blackcard . && docker run -p 4747:4747 -v blackcard-data:/data blackcard` |
| **Túnel rápido desde tu portátil** | Con `npm start` en marcha: `npx cloudflared tunnel --url http://localhost:4747` → te da una URL `https://….trycloudflare.com` válida mientras el túnel esté abierto. |

El servidor necesita WebSockets (los tres admiten). Variables: `PORT`, `DATA_DIR` (carpeta de persistencia).

### Práctica en casa

`/practica`: 15 preguntas sin tiempo, con explicación tras cada respuesta. Prioriza las preguntas falladas y vuelve a poner cada fallo unas preguntas después (repaso deliberado). En el mismo navegador de clase el historial se reconoce solo. En otro ordenador, el alumno escribe su **código de alumno**, que aparece al final de la clase.

## Plan de clase (105 min)

| Bloque | Min | Contenido |
|---|---:|---|
| Leseverstehen | 10 | Texto original «Ein verrückter Samstag» (136 palabras), palabras subrayadas con traducción al tocarlas, 4 min de lectura y 6 preguntas de comprensión |
| Calentamiento | 10 | Vocabulario fácil; al menos 4 palabras de la lectura reaparecen |
| Vocabulary Rush | 20 | Vocabulario de todas las presentaciones, números, horas, colores y diálogos |
| Grammar Arena | 20 | Perfekt, Dativ, Akkusativ/kein, Präsens, verbos separables, Nebensätze |
| Satzbau Challenge | 15 | Ordenar fichas, construir frases, Fehlerjagd |
| Mixed Challenge | 15 | Todo mezclado, con un reto especial de +15 |
| BlackCard Championship | 10 | Solo preguntas difíciles justificadas: la BlackCard está permitida |
| Resultados | 5 | Podio, estadísticas y repaso de las preguntas más falladas |

Cada bloque empieza con una explicación breve. Cada pregunta termina con la solución, una explicación y el desglose de puntos.

## Puntos y objetos

Fácil **+2** · Media **+5** · Difícil **+10** · Reto especial **+15**. Las puntuaciones nunca bajan de 0.

| Objeto | Efecto | Condiciones |
|---|---|---|
| **BLACKCARD** | +10 si aciertas, −10 si fallas | Solo en preguntas difíciles marcadas ◆, que muestran por qué son difíciles. Se activa antes de responder y se quema al resolverse. **Se desbloquea acertando una Prüfungsfrage**, nunca por azar. |
| **THIEF** | Roba hasta 5 puntos | Solo si el ladrón acierta esa pregunta; nunca más de lo que tenga el rival. |
| **SHIELD** | Bloquea 1 robo o sabotaje | Se puede activar como reacción, incluso después de responder. Caduca al final de la ronda. |
| **DOUBLE XP** | ×2 a los puntos de la pregunta | No multiplica bonus ni robos. |
| **SABOTAGE** | El siguiente acierto del rival vale la mitad | No quita puntos ya ganados. Caduca al final de la ronda. |
| **SECOND CHANCE** | Segundo intento a mitad de puntos | No vale en Richtig/Falsch, en retos especiales ni con BlackCard. |
| **WILDCARD** | Eliges entre dos categorías para la siguiente pregunta | No en la última pregunta de la ronda. |

**Equilibrio**

- Inventario de 3 como máximo; si llega un cuarto objeto, el alumno decide qué descartar.
- **1 objeto por pregunta** (el escudo es la única excepción) y siempre antes de responder.
- Ningún objeto después de la corrección.
- Todos reciben 1 objeto al empezar la primera ronda con objetos y otro al acabar cada ronda. Los sorteos usan una «bolsa» por alumno, para que todos reciban una mezcla parecida.
- 3 aciertos seguidos = objeto extra.
- El profesor puede pausar todos los objetos o uno concreto, regalar objetos, sumar o restar puntos y anular una pregunta (los objetos usados se devuelven).

## Teclas

| Tecla | Acción |
|---|---|
| **D** | Diccionario alemán–español (bloqueado para los alumnos mientras la pregunta está abierta) |
| **P** | Marcador global |
| **L** | Modo ligero (menos efectos y BlackCard sin WebGL, para Chromebooks lentos) |
| **M** | Sonido |
| **F** | Pantalla completa |
| **1–4** | Elegir opción (alumnos) |
| **Espacio** | Siguiente (profesor) |
| **C** | Cerrar la pregunta y corregir |
| **S** | Pausa / continuar |
| **+** | 15 segundos más |
| **V** (mantener) | Ver la solución sin proyectarla |
| **H** | Ocultar los controles (modo proyector) |

## Contenido y fuentes

El banco tiene **939 preguntas** en 7 formatos: elegir, escribir, rellenar huecos, ordenar fichas arrastrando, Fehlerjagd, relacionar y construir frases. Están organizadas por tema, dificultad y presentación de origen (visible en cada pregunta):

- *Auf der Bank* · *weil, obwohl, deshalb + Perfekt* · *Im Krankenhaus* · *Unterwegs (Dativ + Perfekt)*: los cuatro PDF de la carpeta. Son capturas de los HTML del mismo nombre; el texto se extrajo de esos HTML y se comprobó contra los PDF.
- *Brücke A1* (`index.html`) y *Sprache in Bewegung* (`deutsch-trainer-120.html`): colores, horas, kein/keinen, verbos separables y conjugaciones.
- *Lectura*: texto nuevo escrito para esta clase.
- *A1 general*: tres preguntas nuevas que no salen de ningún archivo.

Las respuestas abiertas aceptan variantes válidas, como otro orden de palabras correcto o escribir *ae/oe/ue/ss* en lugar de *ä/ö/ü/ß* (con aviso). Las mayúsculas y la puntuación también se aceptan con aviso. Las respuestas dudosas (una errata, el mismo vocabulario en otro orden) pasan a **revisión del profesor** antes de corregir. En los huecos de gramática no hay tolerancia: *dem* ≠ *den*.

Las soluciones solo existen en el servidor (`server/bank/`): el navegador del alumno nunca las recibe.

## Estructura

```
shared/   tipos, reglas (puntos, objetos, plan), vocabulario, lectura  → cliente + servidor
server/   index.ts (HTTP + WebSocket), room.ts (motor autoritativo), grade.ts (corrección),
          select.ts (selección sin repeticiones), store.ts (persistencia JSON), bank/ (preguntas)
src/      cliente React: views/ (Inicio, Profesor, Alumno, Práctica), components/, fx/ (partículas,
          sonido, BlackCard 3D con Three.js cargado bajo demanda)
tests/    pruebas unitarias del motor y del banco (vitest)
scripts/  e2e.mjs (servidor real + 3 clientes) · ui.mjs (3 navegadores Edge headless) · dev.mjs
```

## Desarrollo y pruebas

```bash
npm run dev     # servidor con recarga + Vite en http://localhost:5173
npm test        # 41 pruebas: motor, objetos, banco (cada solución modelo se corrige como correcta)
npm run e2e     # servidor real + profesor + 2 alumnos por WebSocket: sincronización, objetos,
                # dobles usos, reconexión, reinicio del servidor, práctica
npm run build && npm run ui   # 3 navegadores (proyector 1920×1080, Chromebook 1366×768, móvil 390×844)
                              # jugando desde la interfaz; guarda capturas en ./shots
```
