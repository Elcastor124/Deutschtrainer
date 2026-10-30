# Desarrollo paralelo: módulos independientes y reparto

Principio: **un agente = un módulo = una carpeta/archivos propios**. Los archivos compartidos se tocan en PR de una sola línea y los integra una sola persona/agente (el «integrador»), nunca en paralelo.

## Módulos independientes (sin solaparse)
| Módulo | Archivos | Depende de | Riesgo |
|---|---|---|---|
| M1 Banco de preguntas | `server/bank/*.ts` (+ `npm run bank`, `tests/bank.test.ts`) | solo `shared/types.ts` (lectura) | bajo |
| M2 Banco de Boxeo | `server/boxing-bank.ts` | `shared/boxing.ts` (lectura) | bajo |
| M3 Contenido Road (textos/audio) | `server/road-content.ts`, `server/road-audio/` | `shared/road.ts` | bajo |
| M4 Presentaciones | `public/presentaciones/*`, `catalogo.json`, `scripts/import-presentations.mjs` | `design-tokens.css` | bajo (huellas SHA-256) |
| M5 Marca/portada | `src/brand/*`, `views/Landing.tsx`, `Course.tsx`, `TopicOne.tsx` | tokens | medio (visual) |
| M6 Klaus | `src/klaus/*` | solo estado público | bajo |
| M7 Taller | `views/Workshop.tsx` | tokens | bajo |
| M8 Progreso/semana | `server/progress.ts`, `src/progress-client.ts`, `components/WeeklyPoints*` | contrato de `awardPoints` | medio (puntos) |
| M9 Boxeo (UI y reglas) | `shared/boxing.ts`, `server/boxing.ts`, `src/boxing*`, `views/Boxing.tsx`, `components/Boxing*` | M2 | medio |
| M10 Road (UI y reglas) | `shared/road.ts`, `server/road.ts`, `src/road*`, `views/Road.tsx`, `components/RoadActivity.tsx` | M3 | **alto** (examen, seguridad) |
| M11 Juego nuevo | `server/<juego>.ts`, `shared/<juego>.ts`, `src/<juego>*`, `views/<Juego>.tsx` | `GAME_CONTRACTS.md` | según juego |
| M12 Efectos (sonido, partículas) | `src/fx/*` | — | bajo |
| **Núcleo (no paralelizable)** | `server/room.ts`, `server/tasks.ts`, `server/grade.ts`, `server/select.ts`, `shared/rules.ts`, `shared/types.ts`, `components/` de BlackCard/Jenga | todo | **alto** |
| **Puntos de integración** | `server/index.ts`, `src/App.tsx`, `src/catalog.ts`, `package.json`, `src/styles.css`, `src/design/tokens.css` | todos | **serie** |

## Reparto recomendado por modelo
Criterio: cuánto daño hace un error silencioso y cuánto razonamiento necesita.

- **Opus — núcleo y seguridad.** M10 Road, núcleo BlackCard/Jenga (`room.ts`, `tasks.ts`, `grade.ts`), `progress.ts` (puntos), la futura capa de **cuentas/roles** y cualquier cambio en `shared/` o en el contrato de §1 de `GAME_CONTRACTS.md`. Revisa los PR de los demás que toquen servidor. Es también el **integrador** de los puntos de integración.
- **Sonnet — funcionalidades acotadas.** M9 Boxeo, M11 juegos nuevos *dentro de su carpeta*, M5 portada/hub, M7 taller, M6 Klaus, M12 efectos, y rediseños visuales de componentes. Pueden crear archivos nuevos libremente; para enganchar su juego piden al integrador las 3 líneas (ruta en `App.tsx`, manejador en `index.ts`, entrada en `catalog.ts`).
- **Haiku — contenido y mecánica repetitiva.** M1/M2 bancos de preguntas (con `npm run bank` y tests), M3 textos, M4 presentaciones (con regeneración de huellas), sustitución de hex sueltos por tokens (mecánica y verificable con la comparación de estilos calculados), tests de regresión simples. **Sin permiso** sobre servidor de juego, `shared/` ni puntos de integración.

## Reglas de convivencia
1. Rama por módulo: `modulo/<nombre>`; PR pequeños (< 400 líneas), una intención.
2. **Prohibido** editar fuera de los archivos del módulo, salvo la línea de enganche, que se pide al integrador.
3. `src/design/tokens.css` solo cambia añadiendo tokens (nunca modificando valores) y en PR propio.
4. Antes de cada PR: `npm run check && npm test && npm run build` en verde. Los cambios de servidor añaden un test negativo de seguridad.
5. Las presentaciones nunca se editan a mano: se regeneran (si no, falla el test de SHA-256 en `catalogo.json`).
6. Cambios en `shared/*.ts` son contratos: se anuncian y los consume el servidor antes que el cliente.
7. Sin CI hoy: **añadir un workflow que ejecute `check` + `test` + `build`** es la mejora de mayor valor para trabajar en paralelo (propuesta, no incluida en este PR).
