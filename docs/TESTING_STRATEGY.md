# Testing Strategy

## Layers

| Layer | Tool | Where | What it protects |
|---|---|---|---|
| Engine unit + property tests | Vitest | `packages/engine/test` | Money exactness, validation, ledger, reversal, TB, equation |
| Type safety | `tsc --noEmit` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) | engine | Misuse of the API |
| Legacy regression / smoke | Playwright (Chromium) | `e2e/*.cjs` | The shipped single-file app: loads clean, 20 screens open, accounting fixes stay fixed |
| (planned) Lab-level browser flows | Playwright | `e2e/` | Each new lab end-to-end |
| (planned) Accessibility / offline / perf | axe, service-worker tests, Lighthouse | Phase 8 | Directive Part 13 |

## Rules we hold ourselves to

1. **Independent oracles.** Expected values are worked out by hand (textbook / marking-scheme style) and
   written into the test with the arithmetic in a comment. Reading them back from the engine proves nothing.
   "Trial balance balances" is never the only assertion.
2. **Tests must be able to fail.** Each new suite is checked against the broken behaviour (or a mutant). Evidence so far:
   * `legacy-simulator-regression`: **12 of 14 checks fail on the pre-fix code**, all 14 pass now.
   * Engine mutation check — each of these deliberate breakages is caught: 1-paisa tolerance in Dr=Cr (3 tests fail),
     expenses made credit-normal (6), reversal without side flip (2), `HALF_UP` rounding down (4), drawings not reducing
     capital (2), entries not frozen (1).
3. **Cite the clause.** Syllabus-bound labs name the matrix row they implement (`CBSE_2026_27_SYLLABUS_MATRIX.md`).
4. **Property tests are seeded** (reproducible). Current: 300 random compound entries in paise; books balance after
   every post; reversing all 300 returns every account to exactly zero.
5. **No float in money paths** — enforced by a source-scanning guard test.

## Current results (run locally 2026-11-06)

* Engine: `npm run check` in `packages/engine` → typecheck clean, **63 tests passed** (3 files).
* Legacy: `e2e/legacy-simulator-regression.cjs` 14/14; `e2e/legacy-smoke.cjs` 12/12.

## Running

```
cd packages/engine && npm install && npm run check
NODE_PATH="$(npm root -g)" node e2e/legacy-smoke.cjs                  # needs playwright + chromium
NODE_PATH="$(npm root -g)" node e2e/legacy-simulator-regression.cjs
```

## Known gaps

No CI yet (a GitHub Actions workflow needs a token with `workflow` scope — owner decision). No coverage
measurement. No tests for any Phase 2+ lab because none exist yet. `docs/ACCOUNTING_VALIDATION_REPORT.md`
is created when the first syllabus-bound lab ships.
