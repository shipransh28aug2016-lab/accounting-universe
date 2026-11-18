# Changelog

## Unreleased

### Phase 1 of the professional-site plan: look and message
- **Home** speaks to learners (no "bigint paise"), names one first step per class and Class XII option ("Start here: …"), shows a three-step "how a session works" row, has a door for teachers, and no longer puts decorative 3D shapes behind the text.
- **Labs index**: grouped by syllabus unit, searchable, with a "Class XI / Both classes" filter and a spoken result count; on a phone it is about half the old height (5,300 px, was 10,170).
- **Class map** leads with the topic title; the syllabus code is a quiet tag after it.
- **Icons**: one inline-SVG set (`icons.ts`) replaces emoji on the home, labs, class map, practice, ledger and Crisis screens (the ✓ ✗ marks in feedback text stay).
- **Header**: projector mode moved into a "Display" menu (a labelled switch, closes on Escape or outside click, remembered); the AI Tutor nav item is now "Help" and the page no longer talks about servers, API keys or decisions.
- Fixed on the way: breadcrumb stacked vertically on phones; low-contrast text on the selected class tile.
- Tests: `e2e/web-app-polish.cjs` (54 checks incl. axe and 390/360/320 px); existing tests updated only where the change is intended (nav label, Display menu, labs list needs "Both classes").
- Left in place, now unused: `apps/web/src/experience/heroScene.ts` (deleting it needs your approval).

### Phase 2 of the professional-site plan: one language switch
- The header button now switches the whole app, not just practice: `<html lang>` follows it, and the header, navigation, home page, labs index (incl. unit titles), class map and practice screens are in Devanagari (draft, unreviewed). 113 new strings in the existing EN/HI catalogue (key parity and Devanagari tests extended).
- **One** "Hindi draft, not yet reviewed" notice for the whole app (it used to repeat on every question block).
- Content that has no Hindi version yet (lab names and explanations, syllabus topic titles, non-V1 questions) stays English, is marked `lang="en"` for screen readers, and every page that is not translated (ledger, progress, teacher, labs, help, trainer, cards, projects, simulator) opens with a Hindi "this page is English-only for now" notice.
- Test: `e2e/web-app-lang.cjs` (65 checks): English unchanged, Hindi page chrome has no leftover English words (a text scan that skips only `lang="en"` content), single notice, English-only notices, remembered after reload, no sideways scroll at 390/360/320 px, axe in Hindi, switching back restores the exact English wording.

### GitHub Pages: one workflow, both apps
- `deploy-pages.yml` is now the only Pages workflow: new app at `/`, old single-file app at `/legacy/` (`tools/assemble-site.mjs`). `static.yml` (uploaded the whole repo, including backup files, and raced the app deploy) is removed.
- The service worker never answers `/legacy/`. Test: `e2e/web-app-site.cjs` (11 checks: legacy file byte-identical, no backups published, assembling without a build is refused, `/legacy/` reachable with the worker installed).

### Trial Balance Crisis — gamified what-if challenge (Class XI, clauses XI.2.tb and XI.2.errors)
- New page `#/crisis` (listed under Visual Labs): a month of transactions is posted correctly, one posting in one ledger account is spoiled
  (left out / wrong side / wrong amount) and the trial balance no longer agrees. Five steps: find the difference and the short side → audit the ledger
  accounts against the journal and name the wrong one → name the kind of error → pass the rectifying entry through Suspense → answer a what-if about an
  error the trial balance cannot reveal. Three lives (lost only for a wrong accusation or a wrong entry), XP with a ×1.5 streak, speed bonus, two badges,
  3D balance scale that levels only when the entry is right, English and Hindi (draft). XP and badges stay on the device.
- `packages/curriculum/src/crisis.ts` (scenario by the engine: `Money`, `suspenseFromTrialBalance`, `rectify`), `TB_CRISIS` state machine, 63 UI strings in the EN/HI catalogue.
- Tests: `crisis.test.ts` (13; plain-arithmetic oracles, corruption checks, hand-worked XP), `e2e/web-app-crisis.cjs` (35; the test plays from what is on screen, axe, 390 px).

### Audit of merged `main` (after PRs #6, #8, #9) — defects found and fixed
- `npm ci` failed on `main`: `three` was in `apps/web/package.json` but not in the root lockfile → lockfile regenerated.
- The web build failed on `main`: no types for `three` → `@types/three` added.
- `styles.css` was corrupted by an automatic merge (old palette fragments spliced into the redesign; `lightningcss` rejected it) → rebuilt from the redesign plus the V1 additions.
- The projector-mode button was created but never added to the page, and was white-on-white when shown → inserted into the header and styled.
- The redesign shortened the Class XII Option II explanation (dropped the Spreadsheet Lab) → original wording restored.
- Two axe colour-contrast failures on the gold `.eyebrow` label → darker in light mode; one unused-variable lint error and two unformatted files fixed.

### T0.1 (partial) — repo foundations
- npm workspaces (`packages/*`, `apps/*`) with one root `package-lock.json`; `npm ci && npm run check` works from a fresh checkout (verified in a clean copy: 378 + 222 + 12 tests, web build).
- ESLint 10 + typescript-eslint and Prettier 3 in `tools/lint` (outside the workspaces, see AGENTS.md). ESLint enforces AGENTS rule 1 in engine source (no `parseFloat`, `Math.round`, `toFixed`).
  Existing code was brought to zero lint errors (unused imports, needless escapes, an empty interface, one `let`→`const`; no behaviour change). Prettier runs as a ratchet over a 105-file baseline instead of reformatting the dense existing code.
- `.gitignore` added (`node_modules/`, `dist/`). Owner-approved afterwards: the tracked symlink `packages/curriculum/node_modules` is removed (D9) and `.github/workflows/ci.yml` is added (D12: install, lint, format, typecheck/unit tests, build, all browser suites incl. axe). NOT done: deleting the superseded per-package lockfiles.

### P0 — vertical V1 (Class XI: equation → rules → journal → ledger → trial balance), handoff T0.2–T0.8
- **Learning outcomes (T0.2):** `outcomes.ts` — the 77 official unit learning outcomes transcribed from the 2026-27 PDF, mapped to clauses
  (mapping pending academic review, D11). Shown on each lab's Learn tab. Gap recorded: `XI.3.incomplete` has no official outcome.
- **Legacy bank migration (T0.5):** `tools/extract-legacy-banks.mjs` reads `index.html` (read-only) into `banks/legacy-v1.ts`
  (m1 50, m2 69, m4 49, m5 25, TB 25 + 41, BAL 14). Every item is re-checked by the engine and an independently written account
  classification (`banks/accounts-xi.ts`, 106 names): 0 errors, 5 items held for review (inventory-model mix, F-4), 133 "why" sentences rule-checked.
- **Assessment (T0.3):** six new skills — `eq-impact` (RU), `eq-balance` (AP), `drcr-choose` (RU), `journal-entry` (AP),
  `ledger-balance` (AP), `tb-agree` (AEC); new part kind `CHOICE`; `typology` on every generator (existing 30 tagged AP as a proposal).
- **Feedback (T0.6):** every wrong account option in `drcr-choose`/`journal-entry` gets a rule-based explanation, including
  drawings-as-expense, furniture-as-purchases, personal-vs-nominal and swapped sides.
- **Hindi draft (T0.4):** Devanagari text for every V1 question, EN/HI UI catalogue (`i18n/en.ts`, `i18n/hi.ts`), NCERT-style glossary,
  header toggle saved in the profile, "Hindi draft — not yet reviewed" badge wherever Hindi appears (`HINDI_REVIEWED = false`, D10).
- **More V1 skills:** `ledger-side`, `tb-side` (RU), `journal-error`, `case-ledger` (AEC, linked-part case); Trainer draws on verified migrated scenes; fixed Hinglish card toggle changing the app language.
- **Teacher report by learning outcome (T0.7):** table + CSV on the teacher dashboard.
- **Review + accessibility (T0.8):** `docs/academic-review/` template and five UNSIGNED clause files; axe-core in the new `e2e/web-app-v1.cjs`;
  fixed a colour-contrast failure on `.eyebrow` labels (light theme).

### Added
- `docs/` Phase 0 discovery set (syllabus matrix, app audit, architecture, repository research, roadmap).
- `packages/engine` v0.1: exact `Money`, closed chart of accounts, validated + frozen journal, ledger with
  reversal, audit trail, trial balance, accounting equation, T-account rows. 63 tests.
- `e2e/legacy-smoke.cjs`, `e2e/legacy-simulator-regression.cjs`.
- `packages/engine` v0.2 (184 tests): exact `Fraction`/`allocate`; partnership (appropriation, guarantee, past adjustments,
  goodwill ×3, ratio change, admission, retirement/death, dissolution); company (allotment, calls, forfeiture, re-issue,
  debenture issue, Schedule III share-capital note); depreciation + disposal; BRS, rectification, suspense, statement of
  affairs, petty cash, invoice/GST; final accounts with adjustments; all syllabus ratios; comparative/common-size; indirect cash flow.
- `packages/curriculum` (185 tests): machine-readable syllabus (10 units / 54 topics with official limits), 24 seeded
  question generators whose answers are computed by the engine, hint ladder + distractor-based mistake detection,
  five-level mastery model, teacher class report + CSV (pure functions).
- `apps/web` (Vite + TypeScript, no framework): class selector and 8-item navigation; 18 labs plus the Journal → Ledger →
  Trial Balance page (play / pause / step / reset / speed, reduced-motion aware); Practice (Beginner / Practice / Board);
  My Progress (IndexedDB, export); Teacher dashboard (client-side aggregation of student-exported files); offline helper
  "AI tutor" (no LLM — see ROADMAP D4); service worker + manifest. `e2e/web-app.cjs`: 175 browser checks.

### Fixed (legacy `index.html`)
- **F-1** Simulator ledger accounts were untyped and accounts outside a 9-entry dictionary were mis-signed
  (Debtors −7,000; Purchases −4,000); Simulator balance sheet empty; "balanced" was 0 = 0; shared state bus
  ran on zeros. Types now come from `AcctEngine.classify`; pre-fix sessions are rebuilt from the journal;
  the M1 mirror no longer leaves stale balances.

### Explicit state machines (inventory + refactor, no behaviour removed)
- `Machine` kit in the engine (`machine.ts`: interpreter, `validateSpec`, `reachable`, `toMermaid`); 12 app machines declared as data in
  `packages/curriculum/src/machines.ts`; the ledger's reversal rule is now the `journal-entry` machine (same error texts, new `entryStatus()`).
- UI wired to them: ledger player, practice question, trainer, card checks, lab result, AI ask, CAS voucher + year, async pages, storage, boot/network.
  Everything is readable from the page (`data-machine`/`data-state`, `<html data-app data-net>`, `window.__AU__`).
- One route table replaces the duplicated router/header logic (proved equal to the old behaviour on 29 paths).
- `docs/STATE_MACHINES.md` (generated, test-enforced), `AGENTS.md`, `e2e/web-app-states.cjs`, `e2e/web-app-tutor.cjs`.
- Fixed while doing it: ledger timer kept running after leaving the page; Play dead after the story ended; hints clickable after answering;
  spinner could hang forever on a failed load; no warning when progress could not be saved; a Viewer could start the next year;
  forfeiture accepted with nothing unpaid; proxy limiter never evicted idle clients and its day rollover was untested.

### Completion pass (all syllabus topics now have a lab, a page or a concept card)
- Engine v0.3 (`extras.ts`, 209 tests, 10/10 mutants killed): calls in advance, two-column cash book, subsidiary books with
  GST, provision for doubtful debts / discount, reserve transfer, opening entry, exact loan/EMI schedule, Schedule III totals,
  fixed vs fluctuating capital, revaluation, Partnership Act 1932 default rules.
- Curriculum: 15 bilingual concept cards (English + Hinglish) with self-checks for every theory-only topic; 6 more practice
  skills (30 total); rescue plan; assignments / chapter tests as shareable files; teacher heat-map and remedial list.
- Web: 14 new labs (equation visualiser, cash book, subsidiary books, provisions & reserves, opening entry, partnership
  fundamentals, fixed vs fluctuating capital, revaluation, calls in advance, shares for non-cash consideration,
  Schedule III statements, spreadsheet lab …); Debit & Credit Trainer; Computerised Accounting Simulator (codification,
  validated vouchers, maker–checker, roles, closing / opening entries, backup & restore, persistence); Class XI and XII
  project assistants; rescue plan pages; assignment import; loading states; coverage figures now split interactive /
  cards-only / not built.
- `apps/tutor-proxy`: server-side AI tutor proxy with output guard (replies containing figures not supplied by the engine
  are withheld), cost limits and tests against a mock upstream. NOT tested against the live API; not deployed.
- `docs/ci/github-actions.example.yml`, `tools/check-all.sh`, `e2e/web-app-extra.cjs`.

### Found and fixed while completing it
- CAS "Restore backup" input was removed from the page by the first redraw (file picker unusable).
- Equation tanks always filled to 100% on both sides (no information) → now stacked segments showing composition; empty state added.
- Worked-example question table showed raw codes (`BUY_ASSET`) and collapsed multi-line input; CAS voucher-type menu truncated.

### Found and fixed while debugging the first app version
- "Reset to example" left stale values in fields the example does not define.
- Ledger, Practice pages had no page heading; tutor search box had no label (screen readers).
- Reversal entries printed the credit line before the debit line.
- Journal tables clipped the Credit column at desktop width; cash-flow working-capital rows had ambiguous wording;
  card chips stretched full width.

### Earlier (merged to main)
- Removed injected Cloudflare scripts; M1 goods-sold logic (Stock ↓ by cost, P&L ↑ by margin);
  depreciation lines no longer typed as assets; Final Accounts boss-fight double-count, wrong-line reduction and
  reset persistence; stale home-grid module labels.
