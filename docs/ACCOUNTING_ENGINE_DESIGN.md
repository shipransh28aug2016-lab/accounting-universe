# Accounting Engine Design

Package: `packages/engine` (TypeScript, zero runtime dependencies, no DOM). Status: **v0.1 — Phase 1 core.**
The engine is the single source of truth for balances. The UI, visualisations and the AI tutor read its
results; none of them may write a balance.

## Principles (and where they come from)

| Principle | Implementation | Source |
|---|---|---|
| Exact money | `Money` = integer **paise** in a `bigint`; parse from decimal strings only; no float API exists. A guard test fails the build if `parseFloat`/`toFixed`/`Math.round/floor/ceil` appear in `src/` | Ledgerly ADR-0003 |
| Explicit rounding | Anything non-integral (rates, ratios) goes through `mulRatio(num, den, mode)` with `HALF_UP / HALF_EVEN / DOWN / UP`; negatives round symmetrically | ADR-0003 |
| Immutable journal | Posted entries and lines are `Object.freeze`d; there is no update/delete | ADR-0004 |
| Correction by reversal | `reverse()` posts a linked, equal-and-opposite entry (`reversalOf`); an entry can be reversed once; a reversal cannot be reversed; a reason is mandatory | ADR-0004 |
| No guessing | `ChartOfAccounts` is closed: an unknown account is an error (legacy regex fallback once typed *Depr. Machinery* as an asset) | LedgerLab "one table is the source of truth" |
| Derived state only | Balances, trial balance, equation and T-accounts are computed from the journal on demand — no second copy to drift | Beancount concept |
| Every problem reported | `validateEntry` returns *all* issues with codes (`UNBALANCED`, `NO_DEBIT`, `UNKNOWN_ACCOUNT`, …) so the UI can teach, not just reject | EAS validation-rule idea |
| Deterministic | No clock, no randomness, no I/O. IDs are `JE-000001…` by sequence; dates are supplied `YYYY-MM-DD` strings validated as real calendar dates | — |

## Model

```
Account { id, name, type: ASSET|LIABILITY|CAPITAL|REVENUE|EXPENSE|DRAWINGS }
  normal side: DR for ASSET/EXPENSE/DRAWINGS, CR otherwise (derived, never stored per transaction)
DraftEntry  { date, narration, lines: [{accountId, side, amount: Money}] }
PostedEntry { id, seq, date, narration, lines (frozen), reversalOf? }
Ledger      post() reverse() entries() auditTrail() balance() trialBalance() equation() tAccount()
```

* **Rule enforced on every entry:** Σ debit = Σ credit **exactly** (no tolerance — the legacy 0.005 tolerance is gone), ≥1 debit and ≥1 credit, every amount > 0, no account on both sides.
* **Trial balance:** balance method only (the Class XI syllabus: "balance method only").
* **Equation:** `A = L + C` where `C = Capital + Revenue − Expenses − Drawings` (profit/loss carried into capital).
* **Inventory model:** the starter chart uses the **periodic** treatment prescribed for Class XI journalising
  (Dr Purchases / Cr Sales; closing stock brought in at year end). A perpetual-stock view is a *teaching mode*
  to be added deliberately, and labelled — see audit F-4.
* **Policy vs. engine:** the engine reports a flipped balance honestly (an overdrawn bank is a credit
  balance). "You cannot sell stock you don't have" is a *teaching rule* enforced by the lab above the engine.

## Not yet built (by design, scheduled in the roadmap)

Closing entries and the Trading/P&L/Balance Sheet generator; depreciation (SLM/WDV/disposal); provisions and
reserves; subsidiary books; BRS; suspense-account preparation; partnership/company/analysis/cash-flow calculators;
serialisation (`toJSON`/`fromJSON` with `Money` as strings); the full prescribed chart of accounts.

## Public API stability

v0.x: breaking changes allowed while labs are built; each change is recorded in `CHANGELOG.md`.
