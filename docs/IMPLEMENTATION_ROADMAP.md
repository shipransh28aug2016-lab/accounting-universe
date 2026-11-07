# Implementation Roadmap

Status: **Phase 0 complete (this document).** Inputs: `EXISTING_APP_AUDIT.md`,
`EXISTING_ARCHITECTURE.md`, `CBSE_2026_27_SYLLABUS_MATRIX.md`, `REPOSITORY_RESEARCH.md`.

## 0. Honest scale statement

The directive describes a product on the order of 40+ labs (18 Class XI, ~25 Class XII), a shared
engine, an AI tutor, a teacher platform and an offline-sync layer. That is a **multi-month program**,
not something to be declared done in one sitting. The rule "never claim a feature complete without
testing it" means progress will be reported per *tested* lab, with the syllabus matrix as the scoreboard.
The order below puts correctness and foundations first so later labs are cheap and trustworthy.

## 1. Architecture decision (recommended)

**Strangler pattern; do not rewrite.** Keep `index.html` shippable as the "Classic" Class XI app.
Grow a new TypeScript workspace beside it; migrate one module at a time once its engine-backed
replacement passes tests; retire a legacy screen only after parity.

```
/                         legacy index.html (unchanged except defect fixes)
/packages/engine          pure TS accounting engine — zero DOM, zero deps   ← build first
/packages/curriculum      typed syllabus config + clause IDs (from the matrix)
/packages/content         scenario banks extracted from legacy as JSON
/apps/web                 Vite + TS UI (class selector, labs, progress)
/docs  /e2e
```

Smallest effective stack: **TypeScript, Vite, Vitest, Playwright**, a lightweight component layer
(Preact or React), plain SVG for visuals (no chart library until a lab proves it needs one),
IndexedDB via a thin wrapper, a service worker for offline. No Tailwind/D3/React Flow until required.

## 2. Engine design constraints (from research + directive)

* `Money` = integer paise (`bigint`/safe integer), explicit rounding policy; no floats anywhere in the engine.
* Chart of accounts is the single classification source; `classify` never regex-guesses (unknown ⇒ error, not "Expense").
* `JournalEntry` has an ID, date, narration, lines; **Σ Dr = Σ Cr exactly**; posted entries are frozen.
* Corrections are **linked reversal entries**; full audit trail.
* Ledger, trial balance (balance method only for XI), Trading/P&L/BS generated *from the ledger*,
  never from hard-coded rows. Independent oracle tests (hand-worked textbook/marking-scheme answers),
  because "TB balances" is necessary but not sufficient.
* AI tutor receives engine **results**; it can never write balances.

## 2.1 Phases

| Phase | Deliverable | Exit criteria |
|---|---|---|
| **0 Discovery** | These docs | ✅ Done |
| **1 Foundation** (✅ engine, F-1; ❌ CI) | `packages/engine` (Money, accounts, journal, ledger, TB, reversal, audit) with Vitest suite; fix legacy F-1; CI; extract content JSON; offline/persistence skeleton | All engine tests green; legacy defect F-1 fixed with regression test; no regression in legacy navigation sweep |
| **2 Class XI** (✅ 18 topics interactive; ✅ 6 theory topics as concept cards; ❌ no interactive vouchers workbench) | Close the gaps in the matrix, highest marks first: subsidiary books + petty cash (U2, 44 marks), ledger/T-accounts, depreciation (SLM/WDV/disposal), provisions & reserves, suspense/rectification, adjustments lab, incomplete records, theory cards (U1), project assistant | Each clause in §2 of the matrix = ✅ with a test citing it |
| **3 XII Partnership** (✅ 6 labs: appropriation/guarantee/past adjustments, goodwill, ratio change, admission, retirement/death, dissolution) | 9 labs per directive Part 7A with working notes + journals; exclusions honoured | Oracle tests from S3 marking-scheme style answers |
| **4 XII Companies** (✅ shares lifecycle, calls in advance, shares for non-cash consideration, debenture issue; redemption omitted by design D2) | Share issue (over/under-subscription, calls, forfeiture, re-issue), debenture *issue with redemption terms*, Schedule III disclosure | As above; **no** redemption journals in exam mode |
| **5 XII Analysis + Cash Flow** (✅ Schedule III, ratios, comparative/common-size, cash flow; ✅ Option II: CAS simulator + spreadsheet lab; ❌ segment reports) | Comparative/common-size/ratios with interpretation; indirect cash-flow per AS 3; Option II computerised-accounting route | Route is a per-student choice |
| **6 AI tutor** (🟡 offline helper in the app; ✅ proxy code + guard + tests, NOT deployed or live-tested — D4) | Grounded explanations, Hindi/Hinglish, hints-not-answers | Works only through the engine; app fully usable without it |
| **7 Teacher** (✅ file-based class report, heat-map, remedial list, assignments & chapter tests, CSV; ❌ accounts / sync — D5) | Class progress, error heatmap, assignments, exports | Privacy model signed off (see D5) |
| **8 Validation** (🟡 see ACCOUNTING_VALIDATION_REPORT.md and RELEASE_READINESS.md) | Curriculum audit, accounting audit, a11y, perf, offline, regression, release report | `RELEASE_READINESS.md` |

## 3. Decisions needed from the owner

| # | Decision | Recommendation | Why it matters |
|---|---|---|---|
| D1 | Approve the strangler architecture and TS/Vite/Vitest/Playwright stack | Yes | Everything else depends on a testable engine; the current single file cannot host it |
| D2 | **Debenture redemption**: ship as *"Beyond syllabus"* enrichment, or omit | Omit for now | Not prescribed (matrix §5); directive rule 9 forbids it in exam mode |
| D3 | Class XII **Option II (Computerised Accounting)**: build now or after Option I | After Option I | Distinct, large; Part A + Option I covers the common route |
| D4 | **AI tutor key handling**: needs a small server-side proxy (static hosting cannot hold secrets). Which host? | Cloudflare Worker or similar | Directive forbids browser-side keys. The Cloudflare connector in this workspace is unauthenticated, so I cannot set it up without you authorising it |
| D5 | **Teacher dashboard & sync need accounts and a backend**, and students are minors. Who is the data controller, and is parental consent handled by the school? | Decide before Phase 7; until then keep all data on-device | India's DPDP Act 2023 treats under-18 data specially; "privacy-conscious identifiers" alone is not a legal basis |
| D6 | Licence for this repo | Add an explicit one | Currently none; affects any future reuse and contributions |
| D7 | Class XI independent freshness proof: if you can share the 2026-27 Class XI sample paper, I will close that gap | — | Matrix §1 caveat |

## 4. Risks

1. **Scope vs. correctness** — the main risk is shipping many labs with unverified treatments. Mitigation: oracle tests + clause-cited tests + the matrix as gate.
2. **Syllabus drift** — CBSE republishes files with stale headers (observed here). Mitigation: store SHA-256 of source PDFs; re-verify before each phase.
3. **No NCERT text offline** — exam-style ordering/format details need NCERT/marking-scheme confirmation before release.
4. **Offline + sync + privacy** conflict unless D5 is settled; default to local-only until then.
5. **Legacy fragility** — monkey-patched globals; touch minimally and only with regression probes.

## 5. Immediate next steps (Phase 1)

1. `packages/engine` with `Money`, `Account`, `JournalEntry`, `Ledger`, `TrialBalance`, reversal, audit + tests.
2. Fix legacy F-1 (`simPost` type resolution) with a Playwright regression test.
3. Add CI (syntax + engine tests + legacy navigation sweep); delete nothing without owner approval (backup HTMLs, stale `test*.js`).
