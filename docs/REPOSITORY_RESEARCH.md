# Repository Research (Phase 0)

Method: shallow, blob-filtered clones of the default branch; read README, root file tree, licence text,
and specific files named below. **Depth is limited**: this is architecture reconnaissance, not a full
source audit. No third-party code was executed, copied, or vendored. Licences were read from the
`LICENSE`/`COPYING` file in each repo root (verified, not assumed).

## Summary

| # | Repository | Licence (verified) | Stack | Code reuse permitted? | Use as |
|---|---|---|---|---|---|
| 1 | `carolynf2/Educational_Accounting_Simulator` | **No licence file** at root | Vanilla HTML/JS | **No** (all rights reserved by default) | Learning-design reference only |
| 2 | `aleksfet/LedgerLab` | **No licence file** at root | Vanilla JS + Node `assert` tests | **No** | Structure/testing-pattern reference only |
| 3 | `ildrm/ledgerly-international-accounting-platform` | **MIT** (© 2026 Shahin ILDEREMI) | NestJS, Next.js, PostgreSQL, Drizzle, Vitest | Yes with notice — but little portable | Architecture decisions (ADRs) |
| 4 | `Gnucash/gnucash` | **GPL v2 or v3** | C/C++ | **No** (copyleft; would encumber this app) | Behavioural reference |
| 5 | `beancount/beancount` | **GPL v2** (`COPYING`) | Python | **No** | Validation-concept reference |
| 6 | `ledger/ledger` | **BSD-style** (John Wiegley; 3-clause text, confirm full wording before any reuse) | C++ | Possible with notice, but not useful here | Concept reference |
| 7 | `frappe/erpnext` | **GPL v3** | Python/Frappe | **No** | Workflow reference |

Where there is no licence, or the licence is copyleft, treat as **ideas only**: re-derive independently,
write new code, do not paste or transliterate.

## Per-repository findings

### 1. Educational_Accounting_Simulator — learning design
Files: `js/{transaction-engine,journal-system,ledger-manager,statements-builder,progress-tracker,document-manager,storage-manager,company-data}.js`.
Worth adopting (as concepts): a **virtual-company scenario spine** (three business types, ~30 days of
transactions) driving every step from source document → journal → ledger → TB → statements;
a `JournalSystem` with named validation rules (≥2 lines, debit/credit mutual exclusivity per row);
a `ProgressTracker` with skill mastery across ~15 concepts, achievements and *mistake-pattern
analysis*. Weakness to avoid: logic is entangled with DOM event binding (`bindEvents` in the same class as the rules).

### 2. LedgerLab — separation of logic from UI, and tests
Files: `journal-entry.js`, `depreciation.js`, `bank-reconciliation.js`, `cash-flow.js`, `income-statement.js`, `tests/*.test.js`.
Worth adopting: each calculator is a **pure module with no DOM** exporting an API, unit-tested in Node
with built-in `assert`; a single chart-of-accounts table is the source of truth for type and normal
side ("direction derived, never re-typed per transaction"); straight-line schedule with **final-year
true-up** so book value lands exactly on salvage. **Do not copy its money model**: it uses
`Math.round(v*100)/100` on binary floats — the exact pattern the directive forbids.

### 3. Ledgerly — the right principles
Read in full: `docs/adr/0003-exact-money.md` ("never use binary floating point"; amounts exact decimal,
rounding mode explicit, tests beyond JS safe-integer range) and `0004-immutable-ledger.md` ("posted
journals are immutable; correct errors with linked equal-and-opposite journals; reversal reasons/dates
first-class"). Also: modular monolith, tenancy, a feature-matrix doc tracking what is *verified*.
Adopt the **principles**; reject the infrastructure (Docker/Postgres/NestJS is unwarranted for an offline classroom tool).

### 4–6. GnuCash, Beancount, Ledger — correctness vocabulary
Not read at source depth. From structure/READMEs: account hierarchy, multi-split transactions, and
Beancount's separation of *parse → validate → report* with explicit balance assertions. Take the
idea of **balance assertions** (a student states "Cash should be ₹X now", the engine checks) as a
teaching device; GPL forbids reusing their code.

### 7. ERPNext — realistic scenarios
Not read at source depth. Useful only as a checklist for believable flows (purchase invoice → payment
entry → GL). GPL v3: ideas only. Caution: ERPNext's perpetual-inventory/GST machinery is far beyond the CBSE scope and must not leak into exam mode.

## Decisions taken from this research

1. **Exact money**: integer minor units (paise) in a `Money` type; explicit rounding policy; property tests. (Ledgerly ADR-0003)
2. **Immutable journal + reversal entries**, never edit/delete; correction = linked opposite entry. (ADR-0004)
3. **Pure, DOM-free calculators** with Node tests for every lab. (LedgerLab pattern)
4. **One chart of accounts** as the only classification source. (LedgerLab, GnuCash)
5. **Scenario spine** for the business simulator and **mistake-pattern tracking** for remediation. (EAS)
6. **Balance assertions** as a pedagogical device. (Beancount concept)
7. No code is copied from any repository.

## Risks

* Two reference repos have no licence → do not reuse code.
* Three are GPL → cannot be linked or copied into a non-GPL product.
* Reference repos' accounting scope (perpetual inventory, multi-currency, GST/VAT, IFRS) exceeds
  CBSE; importing their treatments would violate "prescribed topics only".
