# Changelog

## Unreleased

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
