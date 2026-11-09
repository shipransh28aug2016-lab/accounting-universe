/**
 * Analysis of financial statements — Class XII Part B Option I (matrix §3).
 * Comparative and common-size statements, and every ratio the syllabus lists. Each ratio returns the formula, the
 * substituted values, the exact result and a plain-language reading — "never show a ratio without explaining it".
 */
import { fixed } from './fraction';
import { Money } from './money';

export interface RatioResult {
  readonly id: string; readonly name: string; readonly category: 'LIQUIDITY' | 'SOLVENCY' | 'ACTIVITY' | 'PROFITABILITY';
  readonly formula: string; readonly working: string;
  readonly unit: 'RATIO' | 'TIMES' | 'PERCENT';
  /** Exact value kept as numerator/denominator; display is rounded only for show. */
  readonly numerator: Money; readonly denominator: Money;
  readonly display: string;
  readonly reading: string;
}

class RatioError extends Error { constructor(m: string) { super(m); this.name = 'RatioError'; } }
export { RatioError };

function make(o: { id: string; name: string; category: RatioResult['category']; formula: string; labels: [string, string]; n: Money; d: Money; unit: RatioResult['unit']; reading: (v: string, n: Money, d: Money) => string }): RatioResult {
  if (o.d.isZero()) throw new RatioError(`${o.name}: the denominator (${o.labels[1]}) is zero, so the ratio cannot be calculated`);
  const scale = o.unit === 'PERCENT' ? 100n : 1n;
  const v = fixed(o.n.paise * scale, o.d.paise, 2);
  const display = o.unit === 'RATIO' ? `${v} : 1` : o.unit === 'TIMES' ? `${v} times` : `${v}%`;
  return {
    id: o.id, name: o.name, category: o.category, formula: o.formula, unit: o.unit, numerator: o.n, denominator: o.d, display,
    working: `${o.labels[0]} ${o.n.format()} ÷ ${o.labels[1]} ${o.d.format()}${o.unit === 'PERCENT' ? ' × 100' : ''} = ${display}`,
    reading: o.reading(v, o.n, o.d),
  };
}
const num = (v: string) => Number(v);       // display-only comparisons for the interpretation text, never used for money

export function currentRatio(currentAssets: Money, currentLiabilities: Money): RatioResult {
  return make({ id: 'current', name: 'Current Ratio', category: 'LIQUIDITY', formula: 'Current Assets ÷ Current Liabilities', labels: ['Current assets', 'Current liabilities'], n: currentAssets, d: currentLiabilities, unit: 'RATIO',
    reading: v => `For every ₹1 of current liabilities the firm holds ₹${v} of current assets. ${num(v) >= 2 ? 'This meets the traditional 2 : 1 comfort level.' : num(v) >= 1 ? 'It can pay its short-term dues, but below the traditional 2 : 1 benchmark.' : 'Below 1 : 1 — short-term dues exceed current assets, a liquidity warning.'} (Benchmarks are rules of thumb, not CBSE requirements.)` });
}
/** Quick (liquid) assets = current assets − inventory − prepaid expenses. */
export function quickRatio(currentAssets: Money, inventory: Money, prepaid: Money, currentLiabilities: Money): RatioResult {
  const quick = currentAssets.sub(inventory).sub(prepaid);
  return make({ id: 'quick', name: 'Quick Ratio', category: 'LIQUIDITY', formula: '(Current Assets − Inventory − Prepaid Expenses) ÷ Current Liabilities', labels: ['Quick assets', 'Current liabilities'], n: quick, d: currentLiabilities, unit: 'RATIO',
    reading: v => `Excluding stock and prepaid items (which are hard to turn into cash quickly), ₹${v} of liquid assets stand behind every ₹1 of current liabilities. ${num(v) >= 1 ? 'At or above the 1 : 1 benchmark.' : 'Below the 1 : 1 benchmark.'}` });
}
export function debtEquityRatio(longTermDebt: Money, shareholdersFunds: Money): RatioResult {
  return make({ id: 'debt-equity', name: 'Debt to Equity Ratio', category: 'SOLVENCY', formula: 'Long-term Debt ÷ Shareholders\' Funds', labels: ['Long-term debt', "Shareholders' funds"], n: longTermDebt, d: shareholdersFunds, unit: 'RATIO',
    reading: v => `The firm has borrowed ₹${v} of long-term money for every ₹1 contributed by shareholders. ${num(v) > 2 ? 'Above 2 : 1 — heavily dependent on borrowing.' : 'A moderate, generally comfortable level of borrowing.'}` });
}
export function totalAssetsToDebtRatio(totalAssets: Money, longTermDebt: Money): RatioResult {
  return make({ id: 'assets-debt', name: 'Total Assets to Debt Ratio', category: 'SOLVENCY', formula: 'Total Assets ÷ Long-term Debt', labels: ['Total assets', 'Long-term debt'], n: totalAssets, d: longTermDebt, unit: 'RATIO',
    reading: v => `Each ₹1 of long-term debt is backed by ₹${v} of assets — the higher, the safer for lenders.` });
}
export function proprietaryRatio(shareholdersFunds: Money, totalAssets: Money): RatioResult {
  return make({ id: 'proprietary', name: 'Proprietary Ratio', category: 'SOLVENCY', formula: "Shareholders' Funds ÷ Total Assets", labels: ["Shareholders' funds", 'Total assets'], n: shareholdersFunds, d: totalAssets, unit: 'RATIO',
    reading: (_v, n, d) => `Shareholders have financed ${fixed(n.paise * 100n, d.paise, 0)}% of the firm's assets; the rest is funded by outsiders.` });
}
export function interestCoverageRatio(profitBeforeInterestAndTax: Money, interestOnLongTermBorrowings: Money): RatioResult {
  return make({ id: 'interest-coverage', name: 'Interest Coverage Ratio', category: 'SOLVENCY', formula: 'Net Profit before Interest and Tax ÷ Interest on Long-term Borrowings', labels: ['Profit before interest & tax', 'Interest'], n: profitBeforeInterestAndTax, d: interestOnLongTermBorrowings, unit: 'TIMES',
    reading: v => `Profit covers the interest bill ${v} times. ${num(v) >= 3 ? 'Lenders are well protected.' : 'A thin margin of safety.'}` });
}
export function debtToCapitalEmployed(longTermDebt: Money, capitalEmployed: Money): RatioResult {
  return make({ id: 'debt-capital-employed', name: 'Debt to Capital Employed Ratio', category: 'SOLVENCY', formula: 'Long-term Debt ÷ Capital Employed', labels: ['Long-term debt', 'Capital employed'], n: longTermDebt, d: capitalEmployed, unit: 'RATIO',
    reading: (_v, n, d) => `${fixed(n.paise * 100n, d.paise, 0)}% of the long-term capital in use is borrowed.` });
}
export const capitalEmployed = (shareholdersFunds: Money, nonCurrentLiabilities: Money) => shareholdersFunds.add(nonCurrentLiabilities);

/** Cost of revenue from operations = opening inventory + purchases + direct expenses − closing inventory. */
export function costOfRevenueFromOperations(o: { openingInventory: Money; purchases: Money; directExpenses: Money; closingInventory: Money }): Money {
  return o.openingInventory.add(o.purchases).add(o.directExpenses).sub(o.closingInventory);
}
/** Cost of materials consumed = opening raw material + purchases of raw material − closing raw material (SQP Q27). */
export function costOfMaterialsConsumed(openingRM: Money, purchasesRM: Money, closingRM: Money): Money { return openingRM.add(purchasesRM).sub(closingRM); }

const avg = (a: Money, b: Money) => a.add(b).mulRatio(1n, 2n, 'HALF_UP');

export function inventoryTurnoverRatio(costOfRevenue: Money, openingInventory: Money, closingInventory: Money): RatioResult {
  const average = avg(openingInventory, closingInventory);
  return make({ id: 'inventory-turnover', name: 'Inventory Turnover Ratio', category: 'ACTIVITY', formula: 'Cost of Revenue from Operations ÷ Average Inventory', labels: ['Cost of revenue', 'Average inventory'], n: costOfRevenue, d: average, unit: 'TIMES',
    reading: (v, n, d) => `Stock is sold and replaced ${v} times a year, i.e. it stays on the shelf about ${n.isZero() ? 'an unbounded number of' : fixed(365n * d.paise, n.paise, 0)} days. A higher turnover means faster-moving stock.` });
}
export function receivablesTurnoverRatio(netCreditRevenue: Money, openingReceivables: Money, closingReceivables: Money): RatioResult {
  return make({ id: 'receivables-turnover', name: 'Trade Receivables Turnover Ratio', category: 'ACTIVITY', formula: 'Net Credit Revenue from Operations ÷ Average Trade Receivables', labels: ['Net credit revenue', 'Average receivables'], n: netCreditRevenue, d: avg(openingReceivables, closingReceivables), unit: 'TIMES',
    reading: v => `Debtors are collected ${v} times a year; a higher figure means customers pay sooner.` });
}
export function payablesTurnoverRatio(netCreditPurchases: Money, openingPayables: Money, closingPayables: Money): RatioResult {
  return make({ id: 'payables-turnover', name: 'Trade Payables Turnover Ratio', category: 'ACTIVITY', formula: 'Net Credit Purchases ÷ Average Trade Payables', labels: ['Net credit purchases', 'Average payables'], n: netCreditPurchases, d: avg(openingPayables, closingPayables), unit: 'TIMES',
    reading: v => `Suppliers are paid ${v} times a year; a lower figure means the firm takes longer to pay.` });
}
export function fixedAssetTurnoverRatio(revenue: Money, netFixedAssets: Money): RatioResult {
  return make({ id: 'fixed-asset-turnover', name: 'Fixed Asset Turnover Ratio', category: 'ACTIVITY', formula: 'Revenue from Operations ÷ Net Fixed Assets', labels: ['Revenue', 'Net fixed assets'], n: revenue, d: netFixedAssets, unit: 'TIMES',
    reading: v => `Every ₹1 invested in fixed assets generates ₹${v} of revenue.` });
}
export function netAssetTurnoverRatio(revenue: Money, netAssets: Money): RatioResult {
  return make({ id: 'net-asset-turnover', name: 'Net Asset Turnover Ratio', category: 'ACTIVITY', formula: 'Revenue from Operations ÷ Net Assets (Capital Employed)', labels: ['Revenue', 'Net assets'], n: revenue, d: netAssets, unit: 'TIMES',
    reading: v => `Every ₹1 of net assets generates ₹${v} of revenue.` });
}
export function workingCapitalTurnoverRatio(revenue: Money, workingCapital: Money): RatioResult {
  return make({ id: 'working-capital-turnover', name: 'Working Capital Turnover Ratio', category: 'ACTIVITY', formula: 'Revenue from Operations ÷ Working Capital', labels: ['Revenue', 'Working capital'], n: revenue, d: workingCapital, unit: 'TIMES',
    reading: v => `Working capital is turned into revenue ${v} times a year.` });
}
export function grossProfitRatio(grossProfit: Money, revenue: Money): RatioResult {
  return make({ id: 'gross-profit', name: 'Gross Profit Ratio', category: 'PROFITABILITY', formula: 'Gross Profit ÷ Revenue from Operations × 100', labels: ['Gross profit', 'Revenue'], n: grossProfit, d: revenue, unit: 'PERCENT',
    reading: v => `Out of every ₹100 of sales, ₹${v} is left after paying for the goods sold.` });
}
export function operatingRatio(costOfRevenue: Money, operatingExpenses: Money, revenue: Money): RatioResult {
  return make({ id: 'operating', name: 'Operating Ratio', category: 'PROFITABILITY', formula: '(Cost of Revenue from Operations + Operating Expenses) ÷ Revenue from Operations × 100', labels: ['Operating cost', 'Revenue'], n: costOfRevenue.add(operatingExpenses), d: revenue, unit: 'PERCENT',
    reading: v => `Running the business costs ₹${v} of every ₹100 of sales; the lower the better.` });
}
export function operatingProfitRatio(operatingProfit: Money, revenue: Money): RatioResult {
  return make({ id: 'operating-profit', name: 'Operating Profit Ratio', category: 'PROFITABILITY', formula: 'Operating Profit ÷ Revenue from Operations × 100', labels: ['Operating profit', 'Revenue'], n: operatingProfit, d: revenue, unit: 'PERCENT',
    reading: v => `₹${v} of every ₹100 of sales is left as operating profit.` });
}
/** The syllabus note asks for the net profit ratio on profit BEFORE and AFTER tax. */
export function netProfitRatio(profit: Money, revenue: Money, basis: 'BEFORE_TAX' | 'AFTER_TAX'): RatioResult {
  return make({ id: basis === 'BEFORE_TAX' ? 'net-profit-pbt' : 'net-profit-pat', name: `Net Profit Ratio (${basis === 'BEFORE_TAX' ? 'before' : 'after'} tax)`, category: 'PROFITABILITY', formula: `Net Profit ${basis === 'BEFORE_TAX' ? 'before' : 'after'} Tax ÷ Revenue from Operations × 100`, labels: ['Net profit', 'Revenue'], n: profit, d: revenue, unit: 'PERCENT',
    reading: v => `The firm keeps ₹${v} of every ₹100 of sales as net profit.` });
}
export function returnOnInvestment(profitBeforeInterestTaxAndPrefDividend: Money, capitalEmployedValue: Money): RatioResult {
  return make({ id: 'roi', name: 'Return on Investment', category: 'PROFITABILITY', formula: 'Profit before Interest, Tax and Preference Dividend ÷ Capital Employed × 100', labels: ['Profit before interest & tax', 'Capital employed'], n: profitBeforeInterestTaxAndPrefDividend, d: capitalEmployedValue, unit: 'PERCENT',
    reading: v => `Every ₹100 of long-term capital earns ₹${v} a year.` });
}

// ───────────────────────────── comparative & common-size statements ────────────────────────────

export interface ComparativeRow {
  readonly label: string; readonly previous: Money; readonly current: Money; readonly change: Money;
  /** % change on the previous year, as a 2-dp string; null when the previous year is zero (no base to compare with). */
  readonly percentChange: string | null;
}
export function comparative(items: readonly { label: string; previous: Money; current: Money }[]): ComparativeRow[] {
  return items.map(i => {
    const change = i.current.sub(i.previous);
    return { label: i.label, previous: i.previous, current: i.current, change, percentChange: i.previous.isZero() ? null : fixed(change.paise * 100n, i.previous.paise, 2) };
  });
}
export interface CommonSizeRow { readonly label: string; readonly amount: Money; readonly percent: string; }
/** Every item as a percentage of a base (revenue for the P&L, total assets / total liabilities for the balance sheet). */
export function commonSize(items: readonly { label: string; amount: Money }[], base: Money): CommonSizeRow[] {
  if (base.isZero()) throw new RatioError('The base of a common-size statement cannot be zero');
  return items.map(i => ({ label: i.label, amount: i.amount, percent: fixed(i.amount.paise * 100n, base.paise, 2) }));
}
/** Net profit before tax → tax → after tax, for building a comparative or common-size P&L consistently. */
export function profitAfterTax(profitBeforeTax: Money, taxRatePercent: bigint): { tax: Money; profitAfterTax: Money } {
  const tax = profitBeforeTax.isPositive() ? profitBeforeTax.mulRatio(taxRatePercent, 100n, 'HALF_UP') : Money.ZERO;
  return { tax, profitAfterTax: profitBeforeTax.sub(tax) };
}
