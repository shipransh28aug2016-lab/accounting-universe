# Testing Strategy

## Layers

| Layer | Tool | Where | What it protects |
|---|---|---|---|
| Engine unit + property tests | Vitest | `packages/engine/test` | Money exactness, validation, ledger, reversal, TB, equation |
| Type safety | `tsc --noEmit` (strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) | engine | Misuse of the API |
| Legacy regression / smoke | Playwright (Chromium) | `e2e/*.cjs` | The shipped single-file app: loads clean, 20 screens open, accounting fixes stay fixed |
| Curriculum / practice / progress | Vitest | `packages/curriculum/test` | Syllabus totals, 1,500 seeds per generator, mastery model, teacher report, lab registry vs syllabus |
| Web app browser flows | Playwright (desktop + 390px mobile) | `e2e/web-app.cjs` | Every lab (example, try-it, blank, garbage input, reset), ledger play/step/reverse, practice round-trip, progress export → teacher import, offline, no console errors, label/heading/alt checks |
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

## Current results (run locally 2026-11-07)

* Engine: **209 tests** (9 files); mutation checks **25/25** (`test/mutation-check.py`) and **10/10** on the later calculators (`test/mutation-extras.py`).
* Curriculum: **241 tests** (5 files) incl. 1,500-seed checks of 30 question generators, concept-card integrity, registry-vs-syllabus, rescue / assignment / heat-map logic.
* Tutor proxy: **9 tests** (`node --test`) against a mock upstream — key never returned, output guard, limits, CORS.
* Web: `tsc` clean; `e2e/web-app.cjs` **260/260**; `e2e/web-app-extra.cjs` **54/54** (cards, trainer, CAS end-to-end, project, rescue, assignments, heat-map, Option II, 11 known-value spot checks).
* Legacy: `e2e/legacy-simulator-regression.cjs` 14/14; `e2e/legacy-smoke.cjs` 12/12.
* All of the above in one command: `tools/check-all.sh`.

## Running

```
cd packages/engine && npm install && npm run check
(cd packages/curriculum && npx vitest run)
(cd apps/tutor-proxy && npm test)
(cd apps/web && npm install && npm run build) && NODE_PATH="$(npm root -g)" node e2e/web-app.cjs && node e2e/web-app-extra.cjs
tools/check-all.sh        # everything
NODE_PATH="$(npm root -g)" node e2e/legacy-smoke.cjs                  # needs playwright + chromium
NODE_PATH="$(npm root -g)" node e2e/legacy-simulator-regression.cjs
```

## Known gaps

No CI is *running* (an example workflow is in `docs/ci/`; the token used here cannot create workflow files). No coverage measurement.
Accessibility is checked by hand-written DOM assertions (labels, headings, names, keyboard tabs), **not** by axe or a screen reader;
contrast was designed for WCAG AA but not measured. No Lighthouse run. Chromium only; no real devices. The tutor proxy has never
talked to the live API. Lab result values are verified in the engine tests and by 11 browser spot checks, not for every lab number in the browser.
Concept-card text is original and reviewed by me, not by a teacher.
