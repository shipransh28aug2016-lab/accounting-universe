# Existing App Audit (Phase 0)

Scope: repository state at commit `5157ddd` (main). Method: static inspection plus headless-browser
probes (Playwright/Chromium). Findings marked **[measured]** were reproduced; others are from reading code.

## 1. What exists

| Item | Fact |
|------|------|
| Product | "Accounting Universe" — Class XI Accountancy simulator, gamified |
| Shape | **One file**, `index.html`: 6,371 lines / 351 KB = ~43 KB CSS + ~234 KB inline JS + markup |
| Framework / build | None. Vanilla JS, no `package.json`, no bundler, no TypeScript, no CI |
| External dependencies | **None** (no `<script src>`, no CDN, no fonts) — genuinely self-contained |
| Screens | 19 `<section class="screen">` toggled by `go(id)` (no router, no deep links) |
| Handlers | 61 inline `onclick=` attributes plus many `.onclick =` assignments |
| State | Ad-hoc globals: `S` (xp/level/combo/badges), `M1_ACCTS`, `SIM`, `JBP`, `FA_ITEMS`, `m13`, `m14`, `B`, `g` … |
| Persistence | `sessionStorage` only: simulator journal/ledger and last screen. **XP, level, badges, quiz progress are in memory and lost on reload.** No `localStorage`, no IndexedDB, no service worker |
| Visualisation | Hand-rolled CSS "tanks" and DOM tables. No chart/SVG library. No T-account view |
| Tests | **None that run.** `test.js` fails to parse (`Unexpected token '}'`); `test_init.js` fails (`M9_ACCOUNTS` redeclared); `check_syntax.js` is UTF-16 and checks the broken `test.js`. These are stale extracts of an older script, not a test suite |
| Repo clutter | Six full backup copies of the app (~1.5 MB) committed beside `index.html` |
| Accessibility | 7 `aria-*` attributes, 1 `role=`, **0** `prefers-reduced-motion` handling; viewport meta present |
| Class XII content | **None** |

## 2. Class XI module inventory

| Nav / id | Module | Nature | Syllabus unit |
|---|---|---|---|
| m1 | Live Equation | Account-balance model; 50 transaction templates | U2 equation |
| m2 | Transaction Lab | 70 drag-to-Dr/Cr scenes with equation delta | U2 rules |
| m3 | ALERE Wheel | Dr/Cr reflex game | U2 rules |
| m4 | Drag-Drop Lab | ~50 journal scenes | U2 journal |
| m5 | Equation Game | MCQ impact quiz | U2 equation |
| m6 | Journal Builder Pro | Free-form multi-line entry via `AcctEngine` | U2 journal |
| m7 | Simulator | Posts to ledger, "unified state bus" | U2 ledger |
| m8 | CFO Simulator | Four sliders, WC and D/E KPIs | *(enrichment)* |
| m9 | Memory Hack Zone | Mnemonics + timed game | U2 rules |
| m10 | Cash Book Lab | 30 transactions, single/double column | U2 cash book |
| m11 | Trial Balance Builder | Classify Dr/Cr; balanced by a computed plug | U2 TB |
| m12 | Final Accounts | Drag items into Trading/P&L/BS + 5-crisis "boss fight" | U3 |
| m13 | Source Documents | Match transaction↔document | U2 vouchers |
| m14 | Rectification | 6 reversing-entry cases | U2 errors |
| m15 | Virtual Client | 25 conceptual MCQ cases | mixed |
| m16 | Tally-style | Computerised-accounting UI | **XII Option II only** |
| m17 | Cheat Sheet | Static reference | — |
| m18 | BRS Detective | Generated cash-book/pass-book recon, 2 reason types | U2 BRS |

Content quality of the *scenario banks* is good: in earlier audits every Cash Book, Rectification,
Virtual Client and BRS item was checked against standard CBSE Class XI treatment and found correct.
The weaknesses are **architectural**, not in the question content.

## 3. Defect register

Severity: **S1** wrong results presented as correct · **S2** feature unusable/misleading · **S3** quality/debt.

| ID | Sev | Finding |
|----|-----|---------|
| F-1 | **S1** | **[measured] — FIXED in Phase 1.** The Simulator (m7) ledger was broken. `simPost()` read a type from `x.t`, which no caller supplies, and signed lines from a 9-entry dictionary, so (a) every account had `type: undefined`; (b) accounts outside the dictionary got the **wrong sign** — after a ₹7,000 credit sale Debtors showed **−7,000**, and Purchases **−4,000**; (c) the Simulator's own Balance Sheet was empty and "Balanced ✓" compared 0 with 0 — a deliberately corrupted ledger still read "Balanced ✓"; (d) the shared state bus (`AUState`, the "A=C+L" pill, M1/What-If sync) was computed from zeros. Fix: types resolved from `AcctEngine.classify`; one `simApplyLine`; pre-fix sessions rebuilt from the journal; M1 mirror clears stale balances. Regression: `e2e/legacy-simulator-regression.cjs` — **12 of 14 checks fail on the old code, all pass now** |
| F-2 | **S1** | **[measured]** Money is JS binary float. Posting 0.1 + 0.2 + earlier 50,000 + 8,000 − 2,000 yields Cash `56000.299999999996`. `AcctEngine.validate` tolerates `0.005`, which masks drift instead of preventing it |
| F-3 | S2 | **[measured]** No reversal API, no transaction IDs (only a sequence `n`), journal array is mutable (`Object.isFrozen` false), no audit trail |
| F-4 | S2 | Two accounting models coexist and disagree: m1 is a **perpetual** model (Stock account); m6/m7 are **periodic** (Purchases/Sales, no Stock). Both are valid CBSE treatments but nothing tells the student which is in force |
| F-5 | S2 | m1 mirror (`bus.on("state")`) writes *total assets* into `M1_ACCTS.Cash` and *total liabilities* into `Creditors`, silently overwriting the student's own detailed balances |
| F-6 | S2 | Progress is not persisted: reload loses XP, level, badges, scores. Makes "My Progress", teacher analytics and weak-student pathways impossible as-is |
| F-7 | S2 | "Offline-first" is claimed in the UI but there is no service worker or IndexedDB. It works offline only when opened from `file://` |
| F-8 | S3 | Dead code: `TB_ITEMS`/`tbInit`/`m11Check`/`m11Reset` target DOM ids that do not exist; hidden `#m12_bal` ("Dr/Cr Balances") has no navigation entry |
| F-9 | S3 | Final Accounts boss-fight data is hard-coded (`FA_ADJUSTMENTS`), not computed by an engine; the Balance Sheet "tie-out" is only as good as the hand-entered numbers |
| F-10 | S3 | Every module keeps its own state and its own copy of account classification. `AcctEngine` exists but only m6/m7 route through it |
| F-11 | S3 | Heavy reliance on `innerHTML` with string-built markup; low a11y (focus order, labels, live regions) |
| F-12 | S3 | Hindi/Hinglish: none in UI; tutor is a regex keyword table (`AI_KNOWLEDGE_BASE`), not a tutor |

Already fixed earlier this project: injected Cloudflare scripts; goods-sold stock/P&L logic in m1;
depreciation lines mis-typed as assets; boss-fight double-count and reset persistence; stale home-grid labels.

## 4. Syllabus coverage summary (detail in `CBSE_2026_27_SYLLABUS_MATRIX.md`)

Roughly: **Rules of Dr/Cr and basic journalising are strong; everything from ledger onward is thin.**
Absent entirely: Unit 1 theory, subsidiary books, petty cash, depreciation (SLM/WDV/disposal),
provisions & reserves, suspense-account preparation, financial-statement adjustments lab, incomplete
records, GST, project support. Class XII: 0%.

## 5. Preserve list (do not break)

* All 18 screens' current behaviour and the scenario banks (they are accurate, reusable data).
* Zero-dependency, single-file offline use — keep a "lite" entry point working while the new platform grows.
* Look and feel: the dark "neon" theme is consistent but is the main UI/UX weakness (see roadmap §UI).
