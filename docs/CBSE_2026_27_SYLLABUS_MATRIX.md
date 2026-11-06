# CBSE 2026-27 Accountancy (055) — Syllabus Traceability Matrix

Status: **Phase 0 deliverable.** Every statement below is traceable to an official CBSE document
(§1). Where this matrix differs from the product directive's topic checklist, the official
document wins and the difference is listed in §5.

## 1. Sources and provenance

| # | Document | URL | SHA-256 | Role |
|---|----------|-----|---------|------|
| S1 | Accountancy (055) Class XI–XII curriculum, 16 pp | `https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart2/Accountancy_SecP2_2026-27.pdf` | `4a87dbd1…ae857ecc27` | **Authority for scope** |
| S2 | Class XII Sample Question Paper 2026-27 | `…/web_material/SQP/ClassXII_2026_27/Accountancy-SQP.pdf` | `35298fb8…ec16bb17` | Independent freshness proof + exam style |
| S3 | Class XII Marking Scheme 2026-27 | `…/web_material/SQP/ClassXII_2026_27/Accountancy-MS.pdf` | `a56accd3…fe307b` | Expected treatments |
| S4 | Circular Acad-14/2026 dated 01.04.2026 | `…/web_material/Circulars/2026/14_Circular_2026.pdf` | `66c967cc…d8ad` | Release of 2026-27 curriculum |
| S5 | Curriculum index page | `https://cbseacademic.nic.in/curriculum_2027.html` | — | Confirms S1 is the listed 2026-27 Accountancy file |

All downloaded 2026-11-06. TLS was verified end-to-end (see §6 for the one trust-store caveat).

**Independent corroboration of S1:** the project owner supplied their own copy of S1 during the
session (`Accountancy_SecP2_2026-27_1.pdf`). It is **byte-identical** to the downloaded file (same
SHA-256 `4a87dbd1…ae857ecc27`, 16 pp, same creation/modification metadata; extracted text diff = 0 lines).
S1 therefore does not depend on the trust decision described in §6. S2–S5 were fetched through that
same session and are only as strong as it; they are mutually consistent and consistent with S1.

### Freshness verification (header-trap check)

S1 prints **both** "(2025-26)" and "(2026-27)" in its headings, and its PDF metadata shows
*created Mar 2025, modified 13 Mar 2026* — i.e. an edited carry-over of last year's file. The header
alone therefore proves nothing. Currency was established by convergence of independent documents:

* S4 (dated 01.04.2026) names `curriculum_2027.html` as the home of the 2026-27 curriculum; S5 lists
  S1 for Accountancy.
* S2 is internally dated to the session ("w.e.f. 1st April 2026", balance sheets at "31st March 2026").
* **Marks reconcile exactly** between S1 and S2. Part A (Q1–26): 16×1 + 4×3 + 2×4 + 4×6 = **60**.
  Part B (Q27–34): 4×1 + 2×3 + 1×4 + 1×6 = **20**. Total **80**, matching S1 (36+24 / 12+8 or 20).
* S2 confirms the S1 structure: Part A compulsory; Part B has two options.

**Class XI caveat.** S1 is a single file covering XI and XII, so XI is confirmed by the same
convergence, but **no independently dated Class XI paper was found** (guessed URLs returned 404; the
directive supplied only the Class XII page). Class XI scope is therefore *confirmed by S1+S4+S5, not
by a XI-specific paper*. Re-check when a XI sample paper is published.

## 2. Class XI — Theory 80 + Project 20

| Unit | Marks |
|------|------:|
| 1 Theoretical Framework | 12 |
| 2 Accounting Process | 44 |
| 3 Financial Statements of Sole Proprietorship | 24 |
| Part C Project Work (any **one** of three) | 20 |

Typology: Remembering/Understanding 32 (40%), Applying 24 (30%), Analysing/Evaluating/Creating 24 (30%).

Legend — *App now*: ✅ present · 🟡 partial · ❌ absent (legacy `index.html`, see EXISTING_APP_AUDIT).

### Unit 1 — Theoretical Framework (12)

| Topic (S1, verbatim scope) | Limits | App now |
|---|---|---|
| Introduction: concept, meaning, source of information, objectives, advantages, limitations, types of information; users and needs; qualitative characteristics; role in business | — | ❌ (tutor keyword replies only) |
| Basic terms: Entity, Business Transaction, Capital, Drawings, Liabilities (non-current/current), Assets (non-current/current), Expenditure (capital/revenue), Expense, Revenue, Income, Profit, Gain, Loss, Purchase, Sales, Goods, Stock, Debtor, Creditor, Voucher, Discount (trade/cash) | — | 🟡 (hover glossary for ~11 terms) |
| Theory base: GAAP (concept); concepts — Business Entity, Money Measurement, Going Concern, Accounting Period, Cost, Dual Aspect, Revenue Recognition, Matching, Full Disclosure, Consistency, Conservatism, Materiality, Objectivity | — | 🟡 (appear incidentally in Virtual Client quiz) |
| System of accounting; cash vs accrual basis | — | ❌ |
| Accounting Standards: applicability of AS and Ind AS | — | ❌ |
| GST: characteristics and advantages | Theory here; *calculation* appears in Unit 2 | ❌ |

### Unit 2 — Accounting Process (44)

| Topic | Limits (official) | App now |
|---|---|---|
| Source documents & vouchers; preparation of vouchers | — | 🟡 (m13 matches doc↔transaction; no voucher preparation) |
| Accounting equation approach; rules of Dr/Cr | — | ✅ (m1, m2, m3, m4, m5) |
| Journal | — | 🟡 (m6/m7; no GST, no trade discount) |
| Cash Book: **simple, with bank column, petty cash book** | — | 🟡 (single + double column in m10; **no petty cash**) |
| Purchases book, Sales book, Purchases return book, Sales return book, Journal proper | "Including trade discount, freight and cartage expenses for simple GST calculation" | ❌ |
| Ledger: format, posting from journal and subsidiary books, balancing | — | 🟡 (data model exists; **broken**, see audit F-1; no T-account UI) |
| Bank Reconciliation Statement: need and preparation | — | 🟡 (m18; 2 reason types only) |
| Depreciation: meaning, features, need, causes, factors; depletion and amortisation; **SLM** and **WDV**; differences and advantages; recording (charge to asset a/c; provision for depreciation / accumulated depreciation a/c); **treatment of disposal of asset** | "Excluding change of method" | ❌ |
| Provisions, Reserves, difference; types: revenue, capital, general, specific, secret; capital vs revenue reserve | — | ❌ |
| Trial balance: objectives, meaning, preparation | **"Balance method only"** | 🟡 (m11 classifies Dr/Cr; does not derive from ledger) |
| Errors: omission, commission, principle, compensating; effect on TB; rectification (i) not affecting TB (ii) affecting TB; **suspense account** | — | 🟡 (m14, 6 cases; no suspense-account preparation) |

### Unit 3 — Financial Statements of Sole Proprietorship (24)

| Topic | Limits | App now |
|---|---|---|
| Meaning, objectives, importance; revenue vs capital receipts; revenue vs capital expenditure; **deferred revenue expenditure**; **opening journal entry** | — | ❌ |
| Trading and P&L account: gross, operating, net profit; preparation | — | 🟡 (m12 drag-classify only) |
| Balance sheet: need, grouping and marshalling; preparation | — | 🟡 |
| Adjustments: closing stock, outstanding expenses, prepaid expenses, accrued income, income received in advance, depreciation, bad debts, provision for doubtful debts, **provision for discount on debtors**, abnormal loss, **goods taken for personal use / staff welfare**, **interest on capital**, **managers' commission** | — | 🟡 (5 hard-coded "boss fight" cases) |
| Incomplete records: features, reasons, limitations; profit/loss by **Statement of Affairs** | "Excluding conversion method" | ❌ |

### Part C — Project (any one): (1) source documents & vouchers; (2) BRS from cash book + pass book with 20–25 transactions; (3) comprehensive sole-proprietorship project (journal → ledger → TB → final accounts, with pie/bar charts, may include simple GST). — ❌

## 3. Class XII — Theory 80 + Project/Practical 20

| Part | Unit | Marks |
|---|---|------:|
| A (compulsory for all) | Accounting for Partnership Firms | 36 |
| A | Accounting for Companies | 24 |
| B **Option I** | Analysis of Financial Statements | 12 |
| B **Option I** | Cash Flow Statement | 8 |
| B **Option II** | Computerised Accounting (replaces both Option-I units) | 20 |
| C | Project (Option I): file 12 + viva 8 — **or** Practical (Option II): file 12 + viva 8 | 20 |

> **Official inconsistency to note.** The rationale paragraph says Computerised Accounting is optional
> "to Company Accounts and Analysis of Financial Statements", but the marks table **and** the Sample
> Paper (S2: "Part A is compulsory… Part B has two options") show it replaces only **Part B**.
> Company Accounts therefore stays compulsory. S1's unit numbering is also inconsistent (marks table
> says Unit 2 = Companies; body text says Unit-3; Analysis is "Unit 3" in the table, "Unit 4" in the body).
> This product uses the **marks-table / SQP structure**.

### Class XII Part A — Partnership (36)

| Topic | Limits (official) | Target lab |
|---|---|---|
| Features; Partnership Deed; **Indian Partnership Act 1932 provisions when no deed** | "Interest on partner's loan is a charge against profits" | Fundamentals |
| Fixed vs fluctuating capital | — | Capital lab |
| P&L Appropriation a/c: division of profit; **guarantee of profits** | — | Appropriation lab |
| **Past adjustments** (interest on capital, interest on drawings, salary, profit-sharing ratio) | — | Appropriation lab |
| Goodwill: meaning, nature, factors, need; methods: **average profit, super profit, capitalisation** (only these three); adjusted through capital/current accounts | — | Goodwill lab |
| Change in PSR among existing partners: sacrificing/gaining ratio; revaluation; treatment of reserves, accumulated profits/losses; revaluation a/c and balance sheet | — | PSR-change lab |
| Admission: effect on PSR; goodwill **per AS 26**; revaluation; reserves, accumulated profits/losses; capital adjustment; capital & current a/c; balance sheet | — | Admission lab |
| Retirement and death: PSR; goodwill (AS 26); revaluation; reserves; capital adjustment; balance sheet; **retiring partner's loan a/c**; **deceased partner's share of profit to date of death; deceased partner's capital a/c and executor's a/c** | — | Retirement / Death labs |
| Dissolution: meaning, types; settlement — **realisation a/c**, capital a/cs, cash/bank a/c | **Excluding** piecemeal distribution, sale to a company, insolvency of partner(s). Unrealised **tangible** assets ⇒ book value; unrealised **intangible** ⇒ nil; if a partner bears realisation expenses, payment must be stated | Dissolution lab |

### Class XII Part A — Companies (24)

| Topic | Limits (official) | Target lab |
|---|---|---|
| Features and types of companies; share & share capital: nature, types | — | Fundamentals |
| Issue and allotment of equity and preference shares; public subscription — **over- and under-subscription**; issue at par and premium; **calls in advance and arrears (excluding interest)**; issue for consideration other than cash | **Interest on calls in arrears/advance excluded** | Share-issue labs |
| Private placement; ESOP; sweat equity (concepts) | Concept only | Concept cards |
| Forfeiture and re-issue of shares | — | Forfeiture lab |
| Disclosure of share capital in balance sheet (Schedule III, Part I) | — | Disclosure lab |
| Debentures: meaning, types; issue at par / premium / discount; for consideration other than cash; **issue with terms of redemption**; collateral security (concept + presentation); interest on debentures; writing off discount/loss on issue | **TDS excluded.** Discount/loss on issue written off in the year of allotment from Securities Premium Reserve (if any) then Statement of P&L as finance cost (AS 16) | Debenture lab |

### Class XII Part B Option I — Analysis (12) + Cash Flow (8)

| Topic | Limits (official) | Target lab |
|---|---|---|
| Company financial statements in Schedule III format; headings/sub-headings | Exceptional items, extraordinary items, discontinued operations **excluded** | Statement reader |
| Tools: comparative, common-size, ratio analysis, cash-flow analysis | — | Builders |
| **Liquidity**: current, quick. **Solvency**: debt-equity, total-assets-to-debt, proprietary, interest coverage, debt-to-capital-employed. **Activity**: inventory, trade-receivables, trade-payables, fixed-asset, net-asset, working-capital turnover. **Profitability**: gross profit, operating, operating profit, net profit, return on investment | Net profit ratio on **both** pre-tax and post-tax profit | Ratio lab |
| Cash flow: meaning, objectives, benefits, cash & cash equivalents, classification, preparation per AS 3 (Revised) | **Indirect method only.** Adjustments: depreciation/amortisation, profit/loss on sale of assets incl. investments, dividend (final & interim), tax. Bank overdraft & cash credit = short-term borrowings. Current investments = marketable securities unless stated. Prior-year proposed dividend given effect (AS-4); current-year's not accounted until declared | Cash-flow lab |
| Project (any two aspects): comparative/common-size; ratios; segment reports; cash flow | — | Project assistant |

### Class XII Part B Option II — Computerised Accounting (20)

Overview of CAS (features, structure, packages: generic/specific/tailored); electronic-spreadsheet
applications (BRS, asset accounting, loan schedule, ratio analysis; charts); using a CAS
(installation, codification & hierarchy of heads, data entry/validation/verification, adjusting,
closing and opening entries, balance sheet and P&L, security). Practical work: file 12 + viva 8.
Existing `m16` ("Tally-style") is a partial start for this option only.

## 4. Question-paper design (S1, S2)

Class XII (S2): 34 questions, 3 h, 80 marks. 1-mark ×20, 3-mark ×6, 4-mark ×3, 6-mark ×5. Internal
choice in two 3-mark, two 4-mark, two 6-mark questions. Typology weighting 40/30/30 as for Class XI.
The Board Exam mode must reproduce this blueprint, not invent one.

## 5. Reconciliation with the product directive

**Directive items that need narrowing or correction**

| Directive item | Official position | Decision |
|---|---|---|
| "Redemption of Debentures" lab | **Accounting for redemption is not prescribed.** S1 covers *issue of debentures with terms of redemption* and only "state the meaning of redemption". S2/S3 test "Premium on redemption of debentures A/c" **booked at issue**, not redemption entries | Implement *issue with redemption terms*. **Do not** ship redemption journals in exam mode (directive rule 9). Optional enrichment only, if the owner wants it, clearly labelled "Beyond syllabus" |
| "Calls in arrears / advance" | "(excluding interest)" | Exclude interest from exam mode |
| "GST concepts" | Accounting treatment of GST is *confined to Class XI*; XI needs characteristics/advantages + simple GST calculation (trade discount, freight, cartage) | No GST accounting in any Class XII mode |
| Interest on capital / drawings, salary, commission to partners | Not itemised as headings in S1; appear under P&L Appropriation and "past adjustments"; S2/S3 contain interest-on-drawings, salary and commission items | Implement as part of Appropriation/Past-adjustments. Cross-check wording against the NCERT chapter before finalising |
| Dissolution "realise assets, loans, expenses" | Explicit **exclusions**: piecemeal, sale to company, insolvency | Honour exclusions; implement the tangible-book-value / intangible-nil rule |
| "Alternative curriculum branch" | Replaces **Part B only**; Part A (incl. Companies) stays compulsory | Model as a per-student route choice, not additive |
| Goodwill | Three methods only; AS 26 treatment | No hidden-goodwill method |
| Class XI Trial Balance | "Balance method only" | No totals-method TB |
| Class XI Depreciation | "Excluding change of method" | No change-of-method content |
| Class XI Incomplete Records | "Excluding conversion method" | Statement of Affairs only |

**Official items the directive omitted (must be implemented or consciously deferred)**

Petty cash book · purchases / sales / purchases-return / sales-return books and journal proper ·
depletion & amortisation · asset-disposal account · provision vs reserve and the five reserve types ·
opening journal entry · deferred revenue expenditure · provision for discount on debtors · interest on
capital and managers' commission as final-accounts adjustments · goods taken for personal use / staff
welfare · ESOP, sweat equity, private placement · shares issued for consideration other than cash ·
Schedule III disclosure of share capital · debentures as collateral security · discount/loss on issue
of debentures write-off rule · executor's account · retiring partner's loan account · Indian
Partnership Act 1932 default provisions · segment reports (project) · Class XI project options.

## 6. Verification limits and trust note

* `cbseacademic.nic.in` was blocked by the session egress policy; the owner approved adding that one
  host. Its certificate chain ends at eMudhra's **emSign Root CA – G1**, absent from this container's
  trust store. The root was trusted **only in a scratch bundle used for these downloads**, after
  confirming its SHA-256 `40:F6:AF:03:46:A9:9A:A1:CD:1D:55:5A:4E:9C:CE:62:C7:F9:63:46:03:EE:40:66:15:83:3D:C8:C8:D0:03:67`
  matches the published value for that root and that the leaf chains to it. Verification was never disabled.
  That match was made against the author's recollection of the published fingerprint. For S1 this is now
  moot (owner's copy is byte-identical, §1). For S2–S5 please confirm the fingerprint against the
  Mozilla/eMudhra root listing if that provenance matters to you.
* No NCERT textbook was available offline; exam-mode treatments beyond what S1–S3 state (e.g. exact
  appropriation ordering, pro-rata mechanics) must be validated against NCERT/marking-scheme worked
  examples before release. Each module's tests will cite the clause it implements.
* The Class XI-specific freshness proof is outstanding (§1).
