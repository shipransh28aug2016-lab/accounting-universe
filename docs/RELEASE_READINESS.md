# Release Readiness — 2026-11-07

**Verdict: ready for a supervised classroom pilot. Not ready to be called "complete" or "production".** Every syllabus topic now has a lab, a page or a concept card, and everything that is
claimed is tested — but the items under "Not done" matter before a wide release.

## Works and is tested
| Area | Evidence |
|---|---|
| Engine: exact money, journal/ledger/reversal/audit, partnership, company, depreciation, final accounts, ratios, cash flow, and the later calculators | 209 tests; mutation 25/25 + 10/10 |
| Curriculum, 30 practice skills, mastery levels, rescue plan, assignments/tests, teacher report/heat-map | 241 tests |
| Web app: 32 labs/pages incl. Computerised Accounting Simulator, 15 bilingual concept cards, practice (3 modes), progress, teacher, project assistants, offline/PWA | 314 browser checks (desktop + mobile) |
| Tutor proxy | 9 tests against a mock upstream |
| Legacy single-file app still ships | 14/14, 12/12 |

Coverage as shown in the app: Class XI — 18 of 24 topics interactive, 6 theory-only (cards); Class XII — 30 of 30 interactive.

## Not done / not verified (read before releasing)
* **AI tutor is not live.** Code, guard and tests exist (`apps/tutor-proxy`) but it was never run against the real API, is not deployed, and needs your API key and a host (D4). The app works fully without it.
* **No accounts, sync or central teacher view** (D5): teachers work from files students hand over. By design, nothing about minors leaves the device.
* **No CI running** — example workflow in `docs/ci/`. 
* **Board-exam blueprint mock paper** (Class XII: 34 questions, 1/3/4/6-mark mix) is not built; Board *mode* gives single skill questions, not a full paper.
* **Dissolution** is a calculator, not a step-by-step realisation simulation. Animation controls exist only on the ledger page.
* **Directive items deliberately not done:** debenture *redemption* entries (not prescribed in 2026-27, D2); segment reports (listed only as a project aspect).
* **Hinglish** covers concept cards and rule cards only; labs are English.
* **Not verified:** tool-measured contrast/axe, screen readers, Lighthouse, Safari/Firefox, real phones, a teacher's or accountant's review of wording and conventions, classes of 30+ student files.

## Owner decisions
D1 strangler stack (assumed) · D2 omit redemption (assumed) · D3 Option II after Option I (done) · **D4 deploy the tutor proxy and supply a key** · D5 backend/minors' data · D6 repository licence · D7 Class XI sample paper to validate against.

## Data & privacy
Progress is stored on the device (IndexedDB, memory fallback). Nothing is uploaded. The proxy receives only a question, a chapter name and engine figures — no names or progress. No API key exists anywhere in the repository.
