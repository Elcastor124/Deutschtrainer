# Klaus practice companion

## Canonical source and intentional scope

The user's supplied Python/PySide6 renderer was parsed with Python `ast`, then the effective functions were read (rather than guessing from a filename or the skin names):

- `_fit_signature_rect`: 1.20 width / height ratio.
- `_ear_points`: left `(20,35) → (31,8) → (42,35)`, right `(58,35) → (69,8) → (80,35)`.
- `_paint_signature_lines`: separated curved cheeks, caret eyes centered at 36.5 / 63.5, central dot at `(50,62.5)`, and the unchanged `> W <` signature. The face uses paths, not font characters or a replacement cat silhouette.
- `compute_pose` / `_periodic_blink`: subtle breathing, ear flick, gentle tilted thinking, finite hops, 4.9-second blink cadence with a 4.10–4.34-second blink window.
- `_paint_behavior_overlay`: genuine contoured waving foreleg, closed paw, four toe beans, central pad, quiet motion echo. Right-hand canvas padding keeps the canonical paw at `(124,83)` unclipped.
- `_fg_professor`: exact glasses rectangles/bridge and small academic cap.
- `_fg_royal`: crown path and gems. The heavy velvet collar / XP medallion is deliberately omitted so the canonical W stays visible and no currency/reward is implied.
- Fire is a restrained two-flame reaction, not a port of the complete original fire background. All skin changes are temporary visual reactions, not unlocks or purchases.

## Authoritative events

`Practice.tsx` passes its existing `useNet` snapshot into `KlausCompanion`; Player / Net / shared transport are unchanged. Only the public player's `reveal.results[me.id].status`, `players[].streak`, question occurrence, practice completion count and final phase are consumed. No server bank, solutions, inferred correctness or point grants enter production mascot code.

`KlausEvents` baselines the first snapshot, including resumed reveal/final screens; its session key includes room, player and startedAt, and result identity includes question occurrence + completion count, not only bank qid. A completion high-water mark rejects stale results. New polling objects cannot replay effects. Review repeats remain distinct. Milestones trigger only at actual streaks 3 / 5 / 10.

A result reaction expires after 5.2 seconds without extending its timer on polls. New questions immediately show the appropriate non-result pose. Local deterministic comment decks rotate only on semantic changes / events, never on clock or network refreshes. There is no LLM or extra network service.

## Controls and layout

Ordinary document flow only: no fixed mascot, modal, focus trap, answer obstruction or keyboard shortcuts. `KlausPracticeStage` discovers Player's existing `.player` once the connected view mounts and portals the companion into its free right column; the target remains stable across result snapshots, and neither Player nor its answer controls are remounted. Desktop line art is large and unboxed alongside the question. At 900px and below, the compact sidekick follows the answer area in normal flow. The question loses no vertical room to a banner. Preferences start collapsed in native `details` / `summary`; Enter and Space do not bubble to Player's advance handler, and Escape closes the disclosure and restores summary focus. Native buttons stop Enter/Space bubbling into Player's global advance handler. `bc:klaus:settings:v1` stores `{ hidden, muted, still }`, with muted=true by default. Storage failures fall back safely. System reduced motion cannot be overridden and CSS also honors the game's existing low-effects attribute. Hidden companions consume events without replay on show. Sound is a quiet local WebAudio chime, explicitly opt-in and independent from game sound; it never starts automatically on page load.

## Preview and QA hooks

Parent can mount the default export from `src/klaus/KlausShowcase.tsx` on an internal route. The preview labels its demonstration nature, offers all nine reactions, shares preferences and never constructs `Net` or changes gameplay. Clicking a state again rotates the comment and replays that preview only.

- `[data-klaus-panel]`: `data-klaus-state`, `data-klaus-event`, `data-klaus-muted`, `data-klaus-reduced`.
- States: `waving`, `idle`, `thinking`, `correct`, `support`, `streak3`, `streak5`, `streak10`, `complete`, or `hidden`.
- `[data-klaus-figure]`: `data-klaus-skin` (`original`, `professor`, `fire`, `royal`) and `data-klaus-motion` (`full`, `reduced`).
- `[data-klaus-comment]`, `[data-klaus-streak="N"]`, `[data-klaus-signature]`, `[data-klaus-paw]`, `[data-klaus-toe]`, `[data-klaus-pad]`, `[data-klaus-crown]`, `[data-klaus-burst]`.
- `[data-klaus-control="mute|motion|hide"]`; muted control is an ARIA switch checked when sound is enabled.
- `[data-klaus-showcase]`, `[data-klaus-demo="STATE"]`.

Run `npm run build`, `npm test`, `npm test -- --config src/hub.vitest.config.ts`, and `node --disable-warning=ExperimentalWarning tests/klaus-browser.mjs` (local temporary server + isolated real Edge contexts). Browser bank lookup exists only in the Node-side test, never in the client. The browser test uses fully specified CDP Enter events (virtual key 13 + carriage-return text); `scripts/cdp.mjs`'s bare `key('Enter')` does not activate a native focused button. Real practice smooth scrolling can race synthetic pointer clicks immediately after direct WebSocket submissions, so progression uses the app's documented native Enter shortcut. Screenshots are ignored under `shots/klaus-ui/`.

For embedded layout, run `node --disable-warning=ExperimentalWarning tests/klaus-embedded-browser.mjs`. This starts a genuine isolated practice at 1366×768, 1024×768, 390×844 and 320×740; checks right-column placement, question fold, mobile flow/overflow, collapsed preferences, Escape focus restoration and stable Player/Shell DOM through a real server result. Screenshots and geometry evidence are in `shots/klaus-embedded/`. Existing Klaus browser suites open the preferences disclosure before interacting with its control hooks.
