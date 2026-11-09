/**
 * CBSE 2026-27 Accountancy (055) — machine-readable syllabus.
 * Source of truth: docs/CBSE_2026_27_SYLLABUS_MATRIX.md, built from the official PDF
 * (SHA-256 4a87dbd15758e42c2aa454d83708299a04b6fc12896392b13d12b9ae857ecc27). Do not add topics that are not in it.
 */
export type ClassLevel = 'XI' | 'XII';
export type Route = 'COMMON' | 'OPTION_I_ANALYSIS' | 'OPTION_II_COMPUTERISED';

export interface Unit { readonly id: string; readonly cls: ClassLevel; readonly title: string; readonly marks: number; readonly route: Route; }
export interface Clause {
  readonly id: string;
  readonly unit: string;
  readonly title: string;
  /** Official limit that applies to this clause ("excluding…"), shown to students so scope is never exceeded. */
  readonly limit?: string;
}

export const SOURCE = {
  document: 'Accountancy (Subject Code 055) Class XI–XII, 2026-27',
  url: 'https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart2/Accountancy_SecP2_2026-27.pdf',
  sha256: '4a87dbd15758e42c2aa454d83708299a04b6fc12896392b13d12b9ae857ecc27',
} as const;

export const UNITS: readonly Unit[] = [
  { id: 'XI.1', cls: 'XI', title: 'Theoretical Framework', marks: 12, route: 'COMMON' },
  { id: 'XI.2', cls: 'XI', title: 'Accounting Process', marks: 44, route: 'COMMON' },
  { id: 'XI.3', cls: 'XI', title: 'Financial Statements of Sole Proprietorship', marks: 24, route: 'COMMON' },
  { id: 'XI.P', cls: 'XI', title: 'Project Work', marks: 20, route: 'COMMON' },
  { id: 'XII.1', cls: 'XII', title: 'Accounting for Partnership Firms', marks: 36, route: 'COMMON' },
  { id: 'XII.2', cls: 'XII', title: 'Accounting for Companies', marks: 24, route: 'COMMON' },
  { id: 'XII.3', cls: 'XII', title: 'Analysis of Financial Statements', marks: 12, route: 'OPTION_I_ANALYSIS' },
  { id: 'XII.4', cls: 'XII', title: 'Cash Flow Statement', marks: 8, route: 'OPTION_I_ANALYSIS' },
  { id: 'XII.C', cls: 'XII', title: 'Computerised Accounting', marks: 20, route: 'OPTION_II_COMPUTERISED' },
  { id: 'XII.P', cls: 'XII', title: 'Project / Practical Work', marks: 20, route: 'COMMON' },
];

const c = (id: string, unit: string, title: string, limit?: string): Clause => (limit ? { id, unit, title, limit } : { id, unit, title });

export const CLAUSES: readonly Clause[] = [
  // ── Class XI · Unit 1
  c('XI.1.intro', 'XI.1', 'Introduction to accounting: meaning, objectives, users, qualitative characteristics'),
  c('XI.1.terms', 'XI.1', 'Basic accounting terms (assets, liabilities, capital, drawings, expenditure, discount …)'),
  c('XI.1.concepts', 'XI.1', 'Theory base: GAAP and the accounting concepts'),
  c('XI.1.basis', 'XI.1', 'Cash and accrual basis of accounting'),
  c('XI.1.standards', 'XI.1', 'Accounting standards: AS and Ind AS (applicability)'),
  c('XI.1.gst', 'XI.1', 'GST: characteristics and advantages'),
  // ── Class XI · Unit 2
  c('XI.2.vouchers', 'XI.2', 'Source documents and vouchers'),
  c('XI.2.equation', 'XI.2', 'Accounting equation approach: meaning and analysis'),
  c('XI.2.rules', 'XI.2', 'Rules of debit and credit'),
  c('XI.2.journal', 'XI.2', 'Journal (book of original entry)'),
  c('XI.2.cashbook', 'XI.2', 'Cash book: simple, with bank column, petty cash book'),
  c('XI.2.subsidiary', 'XI.2', 'Purchases, sales, purchases-return, sales-return books and journal proper', 'Including trade discount, freight and cartage for simple GST calculation'),
  c('XI.2.ledger', 'XI.2', 'Ledger: format, posting, balancing'),
  c('XI.2.brs', 'XI.2', 'Bank reconciliation statement'),
  c('XI.2.depreciation', 'XI.2', 'Depreciation: SLM and WDV, recording, disposal of an asset', 'Excluding change of method'),
  c('XI.2.provisions', 'XI.2', 'Provisions and reserves; types of reserves'),
  c('XI.2.tb', 'XI.2', 'Trial balance', 'Balance method only'),
  c('XI.2.errors', 'XI.2', 'Errors, rectification and suspense account'),
  // ── Class XI · Unit 3
  c('XI.3.concepts', 'XI.3', 'Financial statements: meaning; capital and revenue items; deferred revenue expenditure; opening entry'),
  c('XI.3.trading-pl', 'XI.3', 'Trading and Profit & Loss account: gross, operating and net profit'),
  c('XI.3.balance-sheet', 'XI.3', 'Balance sheet: grouping and marshalling'),
  c('XI.3.adjustments', 'XI.3', 'Adjustments: closing stock, outstanding/prepaid, accrued/advance income, depreciation, bad debts, provisions, abnormal loss, personal use, interest on capital, manager\'s commission'),
  c('XI.3.incomplete', 'XI.3', 'Incomplete records: statement of affairs method', 'Excluding the conversion method'),
  // ── Class XI · Project
  c('XI.P.project', 'XI.P', 'Project: vouchers / BRS / comprehensive sole-proprietorship project (any one)'),
  // ── Class XII · Unit 1 Partnership
  c('XII.1.fundamentals', 'XII.1', 'Partnership: features, deed, Indian Partnership Act 1932 default provisions'),
  c('XII.1.capital', 'XII.1', 'Fixed vs fluctuating capital accounts'),
  c('XII.1.appropriation', 'XII.1', 'P&L appropriation account: interest, salary, commission, division of profit'),
  c('XII.1.guarantee', 'XII.1', 'Guarantee of profits'),
  c('XII.1.past-adjustments', 'XII.1', 'Past adjustments (interest on capital/drawings, salary, profit-sharing ratio)'),
  c('XII.1.goodwill', 'XII.1', 'Goodwill: nature, factors, valuation by average profit, super profit and capitalisation', 'Only these three methods'),
  c('XII.1.ratio-change', 'XII.1', 'Change in profit-sharing ratio: sacrificing and gaining ratio, revaluation, reserves'),
  c('XII.1.admission', 'XII.1', 'Admission of a partner (goodwill per AS 26, revaluation, capital adjustment)'),
  c('XII.1.retirement', 'XII.1', 'Retirement of a partner; loan account of the retiring partner'),
  c('XII.1.death', 'XII.1', 'Death of a partner; share of profit to date of death; executor\'s account'),
  c('XII.1.dissolution', 'XII.1', 'Dissolution: realisation account and settlement', 'Excluding piecemeal distribution, sale to a company and insolvency of partners'),
  // ── Class XII · Unit 2 Companies
  c('XII.2.fundamentals', 'XII.2', 'Features and types of companies; share and share capital'),
  c('XII.2.issue', 'XII.2', 'Issue and allotment of shares: over/under-subscription, par and premium', 'Calls in advance and arrears exclude interest'),
  c('XII.2.forfeiture', 'XII.2', 'Forfeiture and re-issue of shares'),
  c('XII.2.concepts', 'XII.2', 'Private placement, ESOP, sweat equity; shares for consideration other than cash'),
  c('XII.2.disclosure', 'XII.2', 'Disclosure of share capital in the balance sheet (Schedule III)'),
  c('XII.2.debentures', 'XII.2', 'Debentures: issue at par/premium/discount, with terms of redemption, collateral security, interest', 'TDS excluded; redemption accounting is not prescribed'),
  // ── Class XII · Unit 3 Analysis (Option I)
  c('XII.3.statements', 'XII.3', 'Company financial statements in Schedule III format', 'Exceptional/extraordinary items and discontinued operations excluded'),
  c('XII.3.comparative', 'XII.3', 'Comparative statements'),
  c('XII.3.common-size', 'XII.3', 'Common-size statements'),
  c('XII.3.liquidity', 'XII.3', 'Liquidity ratios: current and quick'),
  c('XII.3.solvency', 'XII.3', 'Solvency ratios: debt-equity, total assets to debt, proprietary, interest coverage, debt to capital employed'),
  c('XII.3.activity', 'XII.3', 'Activity ratios: inventory, receivables, payables, fixed-asset, net-asset, working-capital turnover'),
  c('XII.3.profitability', 'XII.3', 'Profitability ratios: gross profit, operating, operating profit, net profit, ROI', 'Net profit ratio on profit before and after tax'),
  // ── Class XII · Unit 4 Cash flow (Option I)
  c('XII.4.classification', 'XII.4', 'Cash flow: meaning, cash equivalents, classification of activities'),
  c('XII.4.preparation', 'XII.4', 'Preparation of the cash flow statement per AS 3 (Revised)', 'Indirect method only'),
  // ── Class XII · Option II
  c('XII.C.cas', 'XII.C', 'Computerised accounting system: features, structure, packages'),
  c('XII.C.spreadsheet', 'XII.C', 'Electronic spreadsheet applications (BRS, asset accounting, loan schedule, ratio analysis)'),
  c('XII.C.using', 'XII.C', 'Using a CAS: codification, data entry, adjusting/closing entries, security'),
  // ── Class XII · Project
  c('XII.P.project', 'XII.P', 'Project on analysis of a company (any two aspects) / Practical file and viva (Option II)'),
];

export const clausesOf = (unit: string) => CLAUSES.filter(x => x.unit === unit);
export const clauseById = (id: string): Clause | undefined => CLAUSES.find(x => x.id === id);
export const unitById = (id: string): Unit | undefined => UNITS.find(u => u.id === id);

/** Theory marks must add up to the official totals — checked by tests. XII Option I = 36+24+12+8 = 80, Option II = 36+24+20 = 80. */
export function theoryMarks(cls: ClassLevel, route: Exclude<Route, 'COMMON'> | 'COMMON' = 'COMMON'): number {
  return UNITS.filter(u => u.cls === cls && !u.id.endsWith('.P') && (u.route === 'COMMON' || (cls === 'XII' && u.route === route))).reduce((a, u) => a + u.marks, 0);
}
