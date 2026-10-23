# DEUTSCH TRAINER // BLACKCARD

Quiz multijugador de alemán A1–A2 para una clase de **2 horas**. El profesor proyecta su pantalla y dos (o hasta ocho) alumnos juegan desde su ordenador, Chromebook o móvil. El servidor lleva los puntos, los cofres, los objetos y la corrección.

La clase tiene dos actos:

- **Acto I, el juego (71 min):** lectura, vocabulario, gramática y frases, con cofres, cartas y la BlackCard.
- **Acto II, después del juego (49 min):** reescritura graciosa, escenas de rol con tarjetas secretas, escritura con palabras dadas, escritura libre y Wort-Jenga.

Incluye además un **modo práctica** para casa, que empieza por lo que cada alumno falló en clase.

## Biblioteca para alumnos y Tema 1

La portada `/` es el hub de estudio. `/tema/1` reúne el itinerario de **vocabulario, Nebensätze, Perfekt y Dativ**. Los alumnos pueden abrir cada presentación interactiva en su propia pestaña y volver al catálogo sin perderlo.

- **8 presentaciones HTML actuales** en `public/presentaciones/`; las copias antiguas y los scripts de generación no se publican como lecciones.
- **5 PDF de clase** acompañan a sus presentaciones. Cuatro son los PDF ya existentes; Mission Stadt incluye su exportación actualizada y el apéndice de soluciones.
- `/practica?tema=1` abre la práctica del Tema 1: conserva el banco preparado, los filtros por contenido y el historial de errores.
- `/tema/1/taller` adapta las consignas originales a práctica individual: reescritura de las seis lecturas, historias con palabras dadas, escritura libre y ensayo de escenas. Guarda borradores y autoevaluaciones localmente; no finge corregir el alemán. Wort-Jenga sigue siendo una actividad de sala.
- `/jugar` conserva el acceso del profesor y de los alumnos a las salas de clase.
- Comparte la raíz de tu despliegue o añade `/tema/1`. Para nuevos alumnos, empieza por **Brücke A1** y sigue el orden recomendado del hub.

Las presentaciones son archivos independientes; sus ejercicios y soluciones están dentro de cada HTML. **No son exámenes seguros**. La práctica interactiva y las salas siguen necesitando el servidor Node/WebSocket; subir el código a GitHub no equivale a desplegar ese servidor.

Para actualizar las copias desde la carpeta local original y el remaster de Downloads:

```bash
node scripts/import-presentations.mjs
npm run build
```

`catalogo.json` documenta los títulos, rutas y huellas SHA-256 de los HTML publicados. No contiene puntuaciones, alumnos ni datos de las salas.

## Puesta en marcha

Requisitos: **Node.js 22.18 o superior** (el servidor ejecuta TypeScript directamente).

```bash
cd blackcard
npm install
npm run build      # compila el cliente en dist/
npm start          # servidor en http://localhost:4747
```

Al arrancar, la consola muestra la dirección para los alumnos de la misma wifi, por ejemplo `http://192.168.1.22:4747`. El lobby del profesor también la muestra, y pulsando el código de sala del HUD se copia el enlace.

- La primera vez, Windows pedirá permiso del cortafuegos para Node: marca **redes privadas**.
- Si los alumnos no están en la misma red, usa la URL pública (ver «Compartir mediante URL»).
- Otro puerto: `PORT=5000 npm start`. En PowerShell: `$env:PORT=5000; npm start`.

### En clase

1. **Profesor:** abre la web, pulsa **Crear sala** y proyecta esa pantalla.
2. **Alumnos:** abren la misma dirección, escriben el código de 4 letras y su nombre. También pueden usar el enlace directo `/p/CÓDIGO`.
3. **Avanzar:** pulsa **Espacio** o el botón grande de los controles. El secuenciador de arriba muestra los 14 bloques y su tiempo; pulsando un bloque se salta a él.

En el proyector las respuestas se **muestran**, pero no se pulsan: cada alumno responde en su dispositivo. Un piloto por alumno se enciende cuando ha respondido.

Si un alumno recarga la página o pierde la wifi, vuelve como el mismo jugador y con sus puntos. Si se reinicia el servidor, la sala se recupera de `data/state.json`.

### Compartir mediante URL (fuera de la red local)

| Opción | Cómo |
|---|---|
| **Render** (recomendado) | Sube la carpeta a GitHub. En Render: *New → Blueprint* → elige el repositorio. Usa `render.yaml` (plan *starter* con disco persistente). En el plan gratuito funciona, pero se duerme tras 15 minutos sin uso y borra los datos (salas, historial de práctica). |
| **Docker** (Fly.io, Railway, VPS) | `docker build -t blackcard . && docker run -p 4747:4747 -v blackcard-data:/data blackcard` |
| **Túnel rápido desde tu portátil** | Con `npm start` en marcha: `npx cloudflared tunnel --url http://localhost:4747` |

El servidor necesita WebSockets (las tres opciones los admiten). Variables: `PORT`, `DATA_DIR` (carpeta de persistencia).

### Práctica en casa

`/practica`: 15 preguntas sin tiempo, con explicación tras cada respuesta.

- Prioriza las preguntas falladas y vuelve a poner cada fallo unas preguntas después (repaso deliberado).
- En el mismo navegador de clase, el historial se reconoce solo.
- En otro ordenador, el alumno escribe su **código de alumno**, que aparece al final de la clase.

## Boxen Arena · combate final de Akkusativ

`/boxeo` es la actividad **Repaso de Dativ y Akkusativ**, accesible directamente desde la portada y Tema 1. Funciona para **profesor y dos jugadores**, también enlazada desde el final de **Mission Stadt**. No reemplaza el quiz BlackCard. Las partidas nuevas seleccionan solo ejercicios de Akkusativ, Dativ, preposiciones, pronombres y Wo/Wohin (30 ejercicios disponibles, 12 intercambios por partida), sin mezclar Perfekt ni Nebensätze.

**Si la página no abre:** no ejecutes el HTML suelto como servidor del juego. Arranca `npm start` y abre la web en `http://localhost:4747/`; pulsa **Jugar al repaso de casos**. En un despliegue público, el enlace `/boxeo` usa el mismo servidor de la web. Sin un servidor Node activo, GitHub por sí solo no ejecuta el combate.

1. Arranca la aplicación como siempre (`npm run build && npm start`).
2. Abre Mission Stadt desde la biblioteca y pulsa **Abrir combate**, o entra directamente en `/boxeo`.
3. El profesor crea sala. Los alumnos abren el enlace compartido y entran con nombre y código; no se crean cuentas ni contraseñas.
4. El profesor empieza. Ambos reciben la misma pregunta; se espera a los dos sin premiar la velocidad.
5. Acertar desbloquea una acción: jab, directo, crochet, defensa o esquiva. Fallar obliga a recuperar y ver la explicación. Las acciones elegidas permanecen ocultas al rival hasta resolverlas.
6. El profesor controla la siguiente pregunta, pausa, reanudación y cierre de respuestas pendientes.

**Reglas:** 100 puntos de salud, energía limitada y 12 intercambios como máximo. El jab causa 8 de daño y no lo evita la esquiva; el directo causa 12 y el crochet 16, pero ambos pueden esquivarse. Defender bloquea el 75 % del daño. El daño es simultáneo: no importa quién pulse primero. Al acabarse el combate gana quien tenga más salud; los aciertos desempatan. No hay violencia gráfica.

El servidor calcula daños, aciertos, energía y estados, y guarda las salas de boxeo en `DATA_DIR/boxing.json`. Los clientes consultan el estado con autenticación cada 650 ms: no hay sincronización mediante `localStorage`. Este último solo guarda la sesión propia para recuperar al recargar. La conexión entre ordenadores exige que todos puedan alcanzar el mismo servidor; `localhost` solo sirve en el propio ordenador. En una wifi escolar puede haber aislamiento entre dispositivos.

Mission Stadt está programada para **75 minutos en total**: título 0–1, calentamiento de seis preguntas 1–6, explicación y práctica de Akkusativ/Dativ 6–51, detectives de casos 51–56, laboratorio de frases (Präsens→Perfekt y weil) 56–62, boxeo 62–74 y cierre 74–75. No hay entrevista ni redacción libre. Son 22 diapositivas, 33 preguntas autocorregibles, 6 preguntas de calentamiento y 6 transformaciones guiadas; el PDF incluye todas las soluciones. La versión anterior se conserva localmente en `../akkusativ_75min_entrevista.html`.

**Web pública:** `https://deutschtrainer-cg76.onrender.com/boxeo`. La versión descargada de la presentación usa ese servidor por defecto; al abrirla desde una web usa el mismo origen de esa web. Para verificar la sala pública con tres clientes: `BOXING_BASE=https://deutschtrainer-cg76.onrender.com node scripts/boxing-ui.mjs`.

Pruebas: `npm test`, `node scripts/boxing-e2e.mjs`, `npm run build && node scripts/boxing-ui.mjs` (tres contextos de navegador reales).

## Plan de clase (120 min)

| | Bloque | Min | Contenido |
|---|---|---:|---|
| **Acto I** | Leseverstehen | 10 | Una de **6 lecturas** originales (120–150 palabras), la que estos alumnos vieron hace más tiempo. Las palabras subrayadas se traducen al tocarlas. 4 min de lectura y 6 preguntas. |
| | Calentamiento | 7 | Vocabulario fácil; reaparecen palabras de la lectura. |
| | Vocabulary Rush | 12 | Vocabulario, números, horas, días y diálogos. |
| | Grammar Arena | 12 | Perfekt, Dativ, Akkusativ/kein, Präsens, separables, Nebensätze, modales, posesivos, preposiciones, imperativo y comparativo. |
| | Satzbau Challenge | 9 | Ordenar fichas, construir frases, Fehlerjagd. |
| | Mixed Challenge | 9 | Todo mezclado, con un reto especial de +15. |
| | BlackCard Championship | 7 | Solo preguntas difíciles justificadas: la BlackCard está permitida. |
| | Siegerehrung | 5 | Podio, un «Kassenbon» (ticket de caja en alemán) por alumno y repaso de los errores más frecuentes. |
| **Acto II** | Mach es lustiger! | 11 | Cada alumno recibe 8 palabras aprendidas distintas y reescribe la lectura para que sea graciosa. Después la lee en voz alta como si fuera el protagonista. ★ por palabra usada. |
| | Szenen | 8 | Escena de rol (banco, urgencias, Berlín o la mejor excusa) con tarjetas secretas: cada alumno tiene 3 objetivos que solo él ve. El profesor marca los cumplidos (★). |
| | Schreibwerkstatt | 10 | Una historia de al menos 40 palabras con 6 palabras dadas, distintas para cada alumno. La app marca en directo las que ya se han usado. |
| | Freies Schreiben | 8 | Escritura libre sobre una consigna elegida entre tres. Dan ★: 30, 50 y 80 palabras, y usar Perfekt, un Nebensatz, el Dativ y conectores de orden. |
| | Wort-Jenga | 10 | Torre 3D de 15 pisos con palabras alemanas. Por turnos se responde una pregunta: bien = quitar 1 pieza, mal o sin respuesta = 2. Quien la derriba pierde y los demás ganan ★★★. |
| | Feierabend | 2 | Resumen del día: podio de estrellas y tickets. |

Los puntos del juego deciden quién gana el Acto I. Las **estrellas** (★) son la puntuación del Acto II.

## Puntos, cofres y objetos

Fácil **+2** · Media **+5** · Difícil **+10** · Reto especial **+15**. Las puntuaciones nunca bajan de 0.

### Cofres

Los objetos llegan dentro de cofres. El contenido lo decide el servidor al ganarlos, y el alumno lo descubre al abrirlo con tres golpes. El proyector muestra qué sale.

| Cofre | Cómo se gana | Contiene |
|---|---|---|
| Bronce | Al empezar la primera ronda con objetos · 3 aciertos seguidos · fin de ronda | Un objeto |
| Plata | Acertar la **Truhenfrage** de la ronda · fin de ronda si vas último | Un objeto y +2 puntos |
| Oro | Acertar un reto especial | THIEF, DOUBLE XP o SABOTAGE y +5 puntos |
| Negro | Acertar una **Prüfungsfrage** | La **BlackCard** (nunca por azar) |

### Objetos

| Objeto | Efecto | Condiciones |
|---|---|---|
| **BLACKCARD** | +10 si aciertas, −10 si fallas | Solo en preguntas difíciles marcadas ◆, que muestran por qué son difíciles. Se activa antes de responder y se quema al resolverse. |
| **THIEF** | Roba hasta 5 puntos | Solo si el ladrón acierta esa pregunta; nunca más de lo que tenga el rival. La pantalla del rival entra en «punto de mira». |
| **SHIELD** | Bloquea 1 robo o sabotaje | Se puede activar como reacción, incluso después de responder. Mientras dura, un marco de luz rodea la pantalla. Caduca al final de la ronda. |
| **DOUBLE XP** | ×2 a los puntos de la pregunta | No multiplica bonus ni robos. |
| **SABOTAGE** | El siguiente acierto del rival vale la mitad | No quita puntos ya ganados. La pantalla del rival sufre interferencias. Caduca al final de la ronda. |
| **SECOND CHANCE** | Segundo intento a mitad de puntos | No vale en Richtig/Falsch, en retos especiales ni con BlackCard. |
| **WILDCARD** | Eliges entre dos categorías para la siguiente pregunta | No en la última pregunta de la ronda. |

**Equilibrio**

- Como máximo 3 objetos en la mano; si llega un cuarto, el alumno decide cuál descartar.
- **1 objeto por pregunta** (el escudo es la única excepción) y siempre antes de responder.
- Ningún objeto después de la corrección.
- El profesor puede pausar todos los objetos o uno concreto, regalar objetos o cofres, sumar o restar puntos y anular una pregunta (los objetos usados se devuelven).

## Teclas

| Tecla | Acción |
|---|---|
| **D** | Diccionario alemán–español (bloqueado para los alumnos mientras la pregunta está abierta) |
| **P** | Marcador global |
| **L** | Efectos: alto / bajo (modo ligero para Chromebooks lentos) |
| **M** | Sonido |
| **F** | Pantalla completa |
| **1–4** | Elegir opción (alumnos) |
| **Espacio** | Siguiente (profesor) |
| **C** | Cerrar la pregunta y corregir |
| **S** | Pausa / continuar |
| **+** | 15 segundos más |
| **V** (mantener) | Ver la solución sin proyectarla |
| **H** | Ocultar los controles |

## Contenido

El banco tiene **unas 2400 preguntas** en 7 formatos: elegir, escribir, rellenar huecos, ordenar fichas arrastrando, Fehlerjagd, relacionar y construir frases. Están organizadas por tema, dificultad y fuente, y cada pregunta muestra su fuente:

- *Auf der Bank*, *weil, obwohl, deshalb + Perfekt*, *Im Krankenhaus* y *Unterwegs (Dativ + Perfekt)*: los cuatro PDF de la carpeta. Son capturas de los HTML del mismo nombre; el texto se extrajo de esos HTML.
- *Brücke A1* (`index.html`) y *Sprache in Bewegung* (`deutsch-trainer-120.html`).
- *Lectura de clase*: 6 textos originales escritos para esta app.
- *A1 general*: contenido nuevo de nivel A1–A2 que **no** sale de ningún archivo:
  - unas 240 palabras de comida, ropa, casa, tiempo, ocio, profesiones y ciudad;
  - modales, posesivos, preposiciones, imperativo y comparativo;
  - horas, números y días;
  - 85 preguntas difíciles, retos especiales y Prüfungsfragen escritas a mano.

**Sin repetir entre partidas:** el servidor recuerda qué preguntas ha visto cada alumno (en clase y en práctica) y elige primero las que no ha visto nunca, y después las que vio hace más tiempo. Con el banco actual, el Final Boss da para unas 14 partidas sin repetir y las rondas normales para más de 15. Las lecturas rotan entre las 6. `npm run bank` muestra el detalle.

Las respuestas abiertas aceptan variantes válidas, como otro orden de palabras correcto o *ae/oe/ue/ss* en lugar de *ä/ö/ü/ß* (con aviso). Las respuestas dudosas pasan a **revisión del profesor**. En los huecos de gramática no hay tolerancia: *dem* ≠ *den*.

Las soluciones solo existen en el servidor (`server/bank/`): el navegador del alumno nunca las recibe. Tampoco recibe el contenido de los cofres antes de abrirlos ni las tarjetas secretas de los demás.

## Estructura

```
shared/   tipos, reglas (puntos, cofres, objetos, plan de 120 min), vocabulario, lecturas, actividades
server/   index.ts (HTTP + WebSocket), room.ts (motor), tasks.ts (actividades y Jenga), grade.ts (corrección),
          select.ts (selección sin repetir), store.ts (persistencia JSON), bank/ (preguntas)
src/      cliente React: views/ (Inicio, Profesor, Alumno, Práctica), components/ (preguntas, cartas, cofres,
          actividades, torre Jenga), fx/ (partículas, sonido, «juice», BlackCard 3D con Three.js bajo demanda)
tests/    pruebas unitarias (vitest)
scripts/  e2e.mjs · ui.mjs · tour.mjs · overflow.mjs · bankstats.mjs · cdp.mjs (navegador headless)
```

## Desarrollo y pruebas

```bash
npm run dev       # servidor con recarga + Vite en http://localhost:5173
npm test          # 60 pruebas: motor, objetos, cofres, actividades, Jenga, banco (cada solución modelo se corrige como correcta)
npm run e2e       # servidor real + profesor + 2 alumnos por WebSocket
npm run build && npm run ui      # 3 navegadores (proyector, Chromebook, móvil táctil) pulsando cada botón
npm run tour      # recorrido visual por todas las pantallas (capturas en ./shots/tour)
npm run overflow  # muchas preguntas en un móvil de 390 px: avisa si algo desborda
npm run bank      # tamaño del banco por bloque y partidas sin repetir
```
