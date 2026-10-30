# Design system — Ash Labs Deutsch

**La web actual es la fuente de verdad visual.** Este sistema no introduce una identidad nueva: nombra lo que ya existe.
Todos los tokens viven en **`src/design/tokens.css`** (se importa primero en `src/main.tsx` y se publica como `/design-tokens.css`).
Los valores se movieron sin cambios desde `styles.css` y `brand.css`; se comprobó que los estilos calculados de `/`, `/jugar`, `/practica` y `/tema/1` son idénticos antes y después.

## Identidad en una línea
Negro lacado · **rojo señal** · **oro** (los colores de Alemania) · papel cálido como tinta. Tipografía Space Grotesk + JetBrains Mono + Doto (pantallas de puntos). Acto II («workshop») invierte el aparato a papel con las mismas variables.

## Dos familias de nombres (ambas válidas, mismos colores)
| Familia | Dónde se usa | Ejemplos |
|---|---|---|
| **Aparato** (históricos) | pantallas de juego: BlackCard, Jenga, boxeo, Road, taller | `--void --body --cap --line --steel --paper --signal --gold --dot --sans --mono --r-key --r-panel` |
| **Marca `--dt-*`** | portada, hub, curso, presentaciones y juegos nuevos | `--dt-black --dt-ink-0..3 --dt-paper --dt-red --dt-gold --dt-muted --dt-display --dt-mono --dt-dot` |

**Regla:** código nuevo usa `--dt-*`; no renombres los históricos (cambiaría pantallas ya validadas). Las coincidencias son: `--signal = --dt-red = #FF3832`, `--gold = --dt-gold = #E9B949`, `--paper = --dt-paper = #F2F1EE`.

## Referencia rápida
- **Color:** fondos `--dt-ink-0…3` (de más oscuro a más claro), texto `--dt-paper`, secundario `--dt-paper-2` / `--dt-muted`, líneas `--dt-hair` / `--dt-hair-2`, acento `--dt-red` (+ `-deep`, `-glow`), premio `--dt-gold` (+ `-deep`, `-glow`). Cofres: `--bronze --silver --gold`; negro = BlackCard.
- **Tipo:** `--dt-t-hero|h1|h2|h3|body|small` (todos `clamp`, fluidos). Titulares y UI: `--dt-display`; metadatos en mayúsculas con tracking: `--dt-mono`; marcadores/puntos: `--dt-dot`.
- **Espaciado:** `--dt-space-1…11` = 4 · 6 · 8 · 10 · 12 · 14 · 16 · 20 · 24 · 32 · 48 px; márgenes de página `--dt-pad`, ancho máximo `--dt-max`, gutter de juego `--gut`.
- **Radios:** `--dt-r-sm 10` · `--dt-r-ctl 12` · `--dt-r-md 16` · `--dt-r-lg 24` · `--dt-r-xl 32` · `--dt-r-pill 999`; teclas del aparato `--r-key`, paneles `--r-panel`.
- **Sombras:** `--dt-shadow-1` (tarjeta), `--dt-shadow-2` (superficie elevada), `--dt-shadow-red` (CTA); tecla con recorrido: `box-shadow: var(--dt-key-shadow)` con `--depth: 3–6px`.
- **Movimiento:** `--dt-ease`, `--dt-spring`, `--dt-ease-in`; duraciones `--dt-fast 160ms`, `--dt-med 420ms`, `--dt-slow 900ms`. Respeta `prefers-reduced-motion`.

## Cómo usarlos
**En la app (React/Vite):** no importes nada; los tokens ya están cargados. Escribe `color: var(--dt-paper); border-radius: var(--dt-r-md);`.

**En una presentación o minijuego independiente (HTML):**
```html
<link rel="stylesheet" href="/design-tokens.css">
<style>body{background:var(--dt-ink-1);color:var(--dt-paper);font-family:var(--dt-display)}</style>
```
Las fuentes (Space Grotesk, JetBrains Mono, Doto) las carga el bundle de la app; un HTML independiente debe incluir sus propios `@font-face` o aceptar el *fallback* del token (`system-ui`, `ui-monospace`).

## Reglas
1. **Ningún hex, `rgba()`, fuente, radio o sombra nuevos fuera de `tokens.css`.** Si falta uno, se añade ahí (PR pequeño) con su motivo.
2. Contraste mínimo AA: `--dt-muted` (#9a9892) pasa 7:1 sobre `--dt-ink-1`; no pongas texto `--dt-red` pequeño sobre `--dt-ink-3`.
3. Un tema = un bloque de sobrescritura de variables (`body[data-theme='workshop']`), nunca valores sueltos en los componentes.
4. Un componente nuevo se diseña con tokens y no depende de `styles.css` (~1 100 líneas, compartido); su CSS vive junto a él (`Componente.css`).

## Deuda conocida (no tocada en este PR, a propósito)
- `editorial.css` sobrescribe `--dt-black` a `#080808` en la portada (el token global es `#0A0A0A`); `intro-v2.css` y `weekly-points.css` repiten hex como `--intro-*`/`--wp-*`. Unificar en un PR visual aparte.
- **Las 8 presentaciones de `public/presentaciones/` usan otra paleta** (claras, `Segoe UI`, teal/navy/coral). No pertenecen a la marca actual. Están fijadas por SHA-256 en `catalogo.json` (y un test lo verifica), así que migrarlas exige regenerar las huellas con `scripts/import-presentations.mjs`. No se tocaron.
- Hay ~385 literales hex en el CSS de `src/` (incluidos los de los propios tokens) (los más repetidos: `#f2f1ee`, `#0a0a0a`, `#e9b949`, `#ff3832`): equivalen a tokens existentes y pueden sustituirse gradualmente.
