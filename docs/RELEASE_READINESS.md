# Release Readiness — 2026-11-07

**Verdict: NOT ready for classroom release as "complete CBSE XI + XII". Ready as a working preview** of the labs listed below.

## Works and tested
| Area | Evidence |
|---|---|
| Engine (exact money, journal/ledger, reversal, audit, TB, equation, partnership, company, analysis, cash flow) | 184 tests, 25/25 mutants killed |
| Curriculum + practice + mastery + teacher report | 185 tests |
| Web app: 18 labs + ledger page, practice (3 modes), progress, teacher import/CSV, offline helper, offline/PWA | 175 browser checks, desktop + mobile |
| Legacy single-file app still ships and still passes | 14/14, 12/12 |

## Not built (do not advertise)
Class XI theory cards (Unit 1), provisions & reserves lab, subsidiary books beyond invoice, project assistants (XI & XII) · Class XII **Option II Computerised Accounting** ·
ESOP / sweat-equity / private-placement concept cards · full Schedule III Balance Sheet / P&L for a company · LLM tutor · accounts, sync, assignments · CI.
The app itself lists unbuilt topics as "Lab not built yet" and the Home page shows the coverage count.

## Not verified
Real devices, Safari/Firefox, screen readers, tool-measured contrast, Lighthouse performance, a professional accountant's review, behaviour with 30+ student files.

## Owner decisions still open (docs/IMPLEMENTATION_ROADMAP.md §3)
D1 strangler stack (assumed), D2 omit redemption (assumed), D3 Option II after Option I (assumed), **D4 AI tutor needs a server proxy**, D5 teacher backend / minors' data, D6 repository licence, D7 Class XI sample paper.

## Data & privacy
All progress is stored on the device (IndexedDB, memory fallback). Nothing is uploaded. The teacher view works only on files students hand over. No API keys exist in the code.
