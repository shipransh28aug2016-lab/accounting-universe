# Accounting Validation Report

Scope: the numbers produced by `packages/engine` and shown by `apps/web`. Date: 2026-11-07. Syllabus: CBSE Accountancy (055) 2026-27,
official PDF SHA-256 `4a87dbd1…2857ecc27`.

## Method
1. **Independent oracles.** Expected values come from the CBSE 2026-27 Class XII marking-scheme worked answers (Q1, 2, 4–7, 9, 11, 12, 14, 18–23, 24, 25A, 26A/B, 27, 31, 33, 34)
   and from hand-worked cases with the arithmetic written in the test. The engine's own output is never the oracle.
2. **Mutation testing.** 25 deliberate bugs (wrong rounding, expenses credit-normal, reversal not flipping sides, tolerance in Dr = Cr,
   missing capital-default, …) — **25/25 caught**.
3. **Property tests** (seeded): random compound entries keep Dr = Cr; reversing all returns every account to zero; allocation always sums exactly.
4. **Generators.** 24 practice generators × 1,500 seeds: answer recomputed, no hint leaks the answer, no distractor equals the answer.
5. **No floating point** in money paths — a source-scanning test forbids `parseFloat`, `toFixed`, `Math.round/floor/ceil` in engine source.

## Syllabus limits enforced (not extended)
No interest on calls in arrears/advance · no debenture-redemption entries (issue with redemption terms only) · no TDS · dissolution: tangible assets
unrealised at book value, intangibles nil · indirect cash-flow method only · current investments = cash equivalents · statement-of-affairs method only (no conversion) ·
depreciation without change of method · trial balance by balance method only · goodwill by three methods only.

## Conventions the engine fixes (stated so a teacher can disagree)
* Forfeiture: within an instalment, receipts are taken to cover face value before premium; Share Forfeited = amount received on face value only.
* Interest on a partner's loan is a charge before appropriation; interest on drawings uses the stated months.
* Insufficient profit: fixed entitlements (salary, interest) are scaled in the ratio of the amounts due (marking scheme Q18).
* Appropriation `netProfit` means profit **before** interest on capital, salary and commission.

## Discrepancy found in the official material
SQP Q31 A: the marking scheme's net-profit-before-tax figures omit the **Wages** row printed in the question. Using all printed rows gives
NPBT 13,00,000 → 29,00,000 (+123.08 %), not 17,00,000 → 35,00,000 (+105.88 %). The engine follows the arithmetic; both are tested and labelled
(`packages/engine/test/analysis.test.ts`). **A teacher should confirm** which the board intends before using the paper in class.

## Earlier logic defects fixed in the legacy app
Goods-sold not reducing stock / not adding margin to P&L; Simulator typing accounts as unknown (F-1); final-accounts boss-fight double counting.
Regression tests: `e2e/legacy-simulator-regression.cjs`.

## What is NOT validated
* Lab outputs were checked in the browser for *rendering and no-error*, and the engine functions behind them are validated; a human accountant has **not** reviewed every
  lab's wording or every printed number. This report is automated verification, not a professional audit.
* Class XI sample paper values were not available as an oracle (decision D7); Class XI is validated by hand-worked cases only.
* Schedule III statement *formats* are modelled for share capital and ratios; full Balance Sheet / P&L presentation of a company is not built.
