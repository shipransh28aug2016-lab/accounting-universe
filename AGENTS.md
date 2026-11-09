# Guide for AI agents and new contributors

Accounting Universe: CBSE Class XI/XII Accountancy (2026-27), learned by doing. Exact accounting engine → learning logic → web app.

## Map
| Path | What | Check it with |
|---|---|---|
| `packages/engine` | Exact money (`bigint` paise), journal/ledger, every calculator, **the `Machine` kit** | `cd packages/engine && npm run check` |
| `packages/curriculum` | Syllabus data, question generators, mastery, cards, **all state-machine specs** (`src/machines.ts`) | `cd packages/curriculum && npm run check` |
| `apps/web` | Vite + TypeScript, vanilla DOM, no framework. Labs in `src/labs`, pages in `src/pages`, routes in `src/routes.ts` | `cd apps/web && npm run build` |
| `apps/tutor-proxy` | Optional AI tutor server (key stays server-side) | `cd apps/tutor-proxy && npm test` |
| `index.html` (root) | Legacy single-file app, shipped separately — **do not refactor it** | `e2e/legacy-*.cjs` |
| `e2e/` | Playwright scripts (`NODE_PATH="$(npm root -g)" node e2e/<file>.cjs`; build the web app first) | `tools/check-all.sh` runs everything |

## Rules that must not be broken
1. **Money is never a float.** Use `Money`/`Fraction` with an explicit rounding mode; a test forbids `parseFloat/toFixed/Math.round` in engine source.
2. **The engine computes; nothing else does.** The AI tutor only explains figures the engine supplied, and the proxy withholds replies containing other figures.
3. **Syllabus limits are features** (no interest on calls in arrears, no debenture-redemption entries, indirect cash flow only …) — see `docs/CBSE_2026_27_SYLLABUS_MATRIX.md`. Never add topics that are not in the official PDF.
4. **Never claim a feature without a test.** Update `docs/RELEASE_READINESS.md` honestly.
5. No secrets in code. Progress data never leaves the device.

## State machines (read this before touching UI behaviour)
Workflows are declared as data in `packages/curriculum/src/machines.ts` and drawn in **`docs/STATE_MACHINES.md`** (generated). In the UI ask the machine — `machine.can(event)`, `machine.why(event)`, `machine.send(event)` — instead of adding booleans. A refused event returns a human reason; show it.

**Reading state from the running app** (no sleeping needed):
* `<html data-app="booting|ready|failed" data-net="online|offline">`, `<main data-route="…">`, `<article data-tab="learn|example|try">`
* any element with `data-machine="<id>"` carries `data-state="<STATE>"` — e.g. `[data-machine="ledger-player"][data-state="FINISHED"]`, `.question[data-state="SUBMITTED"]`, `.result[data-state="ERROR"]`
* `window.__AU__.machines()` → `[{ id, state, history: [{ event, from, to, ok }] }]` (state names only)
* unavailable-but-clickable buttons have class `unavailable` and the reason in `title` / `data-why`

## Conventions
* Pure logic goes in `packages/*` with Vitest tests that use **independent oracles** (hand-worked numbers or marking-scheme answers), never the engine's own output.
* Every refusal is a sentence a Class XI student can act on.
* New lab = a `Lab` object (fields, example, walkthrough, `compute`) registered in `apps/web/src/labs/index.ts`; the generic browser test exercises it automatically.
* Regenerate docs that are generated: `UPDATE_DOCS=1 npx vitest run test/machines.test.ts` (in `packages/curriculum`).
