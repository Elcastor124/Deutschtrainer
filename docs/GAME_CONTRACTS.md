# Contratos para juegos y componentes visuales

Derivados de lo que **ya** hace el código (Boxeo es el patrón más limpio; BlackCard/Jenga/Road siguen variantes). Un juego nuevo debe ser **un módulo cerrado** que se engancha en tres puntos (ruta, manejador HTTP/WS, entrada en el catálogo) y no edita nada más.

## 1. Contrato de servidor (lógica autoritativa)

Un archivo `server/<juego>.ts` que exporta `create<Juego>Handler({ dataDir }) → (req, res) => boolean` y se monta una línea en `server/index.ts` (como `createBoxingHandler`). Devuelve `true` solo si la ruta empieza por `/api/<juego>/`.

```ts
// shared/<juego>.ts — único acuerdo cliente↔servidor (sin lógica, sin imports de server/ ni src/)
export type Phase = 'lobby' | 'question' | 'result' | 'finished';       // máquina de estados explícita
export type Action = { type: 'start' | 'next' | 'pause' | 'resume' }     // intenciones, nunca resultados
                   | { type: 'answer'; questionId: string; answer: number };
export interface View { code: string; phase: Phase; role: 'teacher' | 'player'; me?: string; /* … redactado por rol */ }
export interface Welcome { code: string; token: string; role: 'teacher' | 'player'; pid?: string }
```

Rutas mínimas: `POST create` (devuelve token de profesor) · `POST join` (token de alumno) · `GET state?code=` (autenticado) · `POST action {code, action}`.

**Invariantes obligatorias** (ver `SECURITY_AUDIT.md`):
1. `Authorization: Bearer <token>` → rol. Sin token válido, 401. Códigos de sala: validados con regex antes de buscar.
2. Cada acción comprueba **rol** (403), **fase** (409), **propiedad/turno** y **rango/tipo** de entradas (400), en ese orden.
3. El cliente solo envía intenciones. Puntuación, daño, orden de turnos, aleatoriedad y corrección se calculan en el servidor.
4. `view(room, who)` redacta por rol: soluciones y tokens ajenos jamás en la vista del alumno.
5. Puntos para el ranking semanal: **solo** `awardPoints(profile, '<fuente>', 0..50, room)` de `server/progress.ts`. Añadir la fuente a `ProgressSource`.
6. Persistencia: `DATA_DIR/<juego>.json`, escritura atómica (tmp + rename, modo `0o600`), lectura tolerante a fichero corrupto.
7. Cuerpo ≤ 32 KB, nombres recortados, máximo de jugadores, errores con `ApiError(status, mensaje en español)`; un fallo nunca tumba el proceso.
8. Determinismo testable: el azar y el reloj se inyectan (`rand`, `now`) o se aíslan para tests.
9. **Test obligatorio:** ciclo feliz + un test negativo por acción privilegiada («un alumno intenta X → rechazado, estado intacto»).

## 2. Contrato de cliente

```
src/<juego>-client.ts     fetch/WS + hook: useX(code) → { view, error, act(action) } ; única capa que habla con la red
src/views/<Juego>.tsx     pantalla de ruta: lobby → partida → final; recibe todo del hook
src/components/<Juego>*.tsx   piezas visuales puras (props → JSX), sin red
src/<juego>.css           estilos propios, solo tokens
```
- La vista es una **función del `View` del servidor** (sin copiar reglas al cliente). El cliente puede animar de forma optimista pero se corrige con el siguiente `state`.
- Sondeo o WS con reconexión; recargar la página restablece al jugador con su token (`localStorage`).
- Accesible por teclado, `prefers-reduced-motion` respetado, uso en móvil (≥ 360 px) y en proyector (≥ 1280 px, texto grande).
- Pantalla del profesor = pantalla de proyección salvo que haya motivo para un rol `projector` de solo lectura (como Road).

## 3. Contrato de componente visual

Un componente de presentación/juego:
1. **Props tipadas y serializables** (datos + callbacks `onX`); sin acceso a red, `localStorage` ni reloj global (recibe `now`/`serverNow` por props).
2. **Solo design tokens** (`--dt-*`). Cero hex, fuentes o sombras nuevas. Estilos junto al componente.
3. **Estados explícitos** `idle | active | correct | wrong | disabled | loading`, expuestos con `data-state="…"` (los tests y la accesibilidad se apoyan en eso).
4. Tamaño fluido (`clamp`/`rem`), sin anchos fijos en px para texto; contenedor responde con `min-width: 0`.
5. Sin efectos secundarios al importar el módulo; animación solo vía `transform`/`opacity`.
6. Se prueba con Vitest (render por análisis o lógica pura) y, si es visual, con un script `*-ui.mjs` de captura.
7. Presentaciones HTML autónomas: `<link rel="stylesheet" href="/design-tokens.css">`, sin servidor, sin datos de alumnos; se publican con `scripts/import-presentations.mjs` (actualiza `catalogo.json`).

## 4. Contrato de «lógica de juego» pura (recomendado para lo nuevo)
Separar reglas de transporte: `reduce(state, action, ctx) → { state, effects } | Error`, sin I/O, con `ctx = { now, rand }`. El manejador HTTP/WS solo autentica, llama a `reduce`, persiste y emite la vista. Es lo que ya hacen `Room` (clase con `Deps`) y `boxing.ts`; en juegos nuevos hazlo desde el principio para poder probar sin red.

## 5. Estado actual frente al contrato (deuda a tener presente)
- BlackCard/Jenga comparten `Room`/`tasks.ts` (acoplados por diseño): un juego **nuevo** no debe añadirse como `TaskKind` sin revisión del integrador.
- Road y Boxeo cumplen 1–9; los clientes de ambos aún no exponen un hook uniforme (cada uno tiene su forma): al tocarlos, converger a `useX`.
