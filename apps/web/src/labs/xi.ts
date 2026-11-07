import {
  BRS_ITEMS, Money, depreciationEntry, depreciationSchedule, disposeAsset, finalAccounts, invoice, invoiceEntry, pct, pettyCash,
  profitByStatementOfAffairs, reconcile, rectify, statementOfAffairs, suspenseFromTrialBalance, type Adjustment, type BrsKind, type RectLine, type TbLine,
} from '../../../../packages/engine/src';
import { InputError, type Block, type Lab } from '../spec';
import { money, moneyList, namedAmounts, num, optMoney, percent, whole } from '../inputs';
import { bar, note, R } from './common';

// ───────────────────────────── Depreciation ─────────────────────────────
export const depreciation: Lab = {
  id: 'xi-depreciation', cls: 'XI', title: 'Depreciation Lab', clauses: ['XI.2.depreciation'], skills: ['dep-wdv', 'dep-slm', 'disposal'],
  summary: 'Spread an asset\'s cost over its life by SLM or WDV, record it two ways, and work out profit or loss when it is sold.',
  concept: [
    'Depreciation is the fall in the value of a fixed asset from use, passage of time or obsolescence. It is an expense of the year, but no cash leaves the business.',
    'Straight Line Method (SLM): the same amount every year. Written Down Value (WDV): a fixed percentage of the balance left after earlier years, so the charge shrinks each year.',
    'Two ways to record it: credit the Asset account directly (the asset shows at book value), or credit a Provision for Depreciation account (the asset stays at cost). Syllabus limit: no change of method.',
  ],
  realWorld: 'A bakery buys an oven for ₹1,00,000. It will not last forever, so each year part of its cost is charged against that year\'s profit — otherwise the first year would carry the whole cost and later years none.',
  fields: [
    { id: 'cost', label: 'Cost of asset (₹)', type: 'money' },
    { id: 'method', label: 'Method', type: 'select', options: [{ value: 'WDV', label: 'Written Down Value (WDV)' }, { value: 'SLM', label: 'Straight Line (SLM)' }] },
    { id: 'rate', label: 'Rate of depreciation (% a year)', type: 'percent', help: 'On cost for SLM, on opening book value for WDV.' },
    { id: 'years', label: 'Number of years', type: 'int' },
    { id: 'months', label: 'Months in the first year (1–12)', type: 'int', help: 'Bought mid-year? Only that part of the year is charged.' },
    { id: 'recording', label: 'Record by', type: 'select', options: [{ value: 'ASSET_ACCOUNT', label: 'Crediting the asset account' }, { value: 'PROVISION', label: 'Provision for depreciation account' }] },
    { id: 'sale', label: 'Sale price at the end of the last year (₹, blank = not sold)', type: 'money' },
  ],
  example: { cost: '100000', method: 'WDV', rate: '10', years: '3', months: '12', recording: 'ASSET_ACCOUNT', sale: '70000' },
  walkthrough: [
    'Year 1: 10% of ₹1,00,000 = ₹10,000, so the oven is now worth ₹90,000.',
    'Year 2: WDV charges 10% of the NEW balance ₹90,000 = ₹9,000 (SLM would still charge ₹10,000).',
    'Year 3: 10% of ₹81,000 = ₹8,100, leaving ₹72,900.',
    'Sold for ₹70,000 — less than the book value ₹72,900 — so there is a loss of ₹2,900 on sale.',
  ],
  compute: v => {
    const cost = money(v, 'cost', 'Cost');
    if (!cost.isPositive()) throw new InputError('Cost must be greater than zero.', 'cost');
    const method = v.method === 'SLM' ? 'SLM' : 'WDV';
    const rate = percent(v, 'rate', 'Rate');
    const years = whole(v, 'years', 'Number of years', 1, 50), months = whole(v, 'months', 'Months in first year', 1, 12);
    let rows;
    try { rows = depreciationSchedule({ cost, method, rate: pct(rate), years, firstYearMonths: months }); } catch (e) { throw new InputError((e as Error).message); }
    const blocks: Block[] = [];
    blocks.push({ kind: 'table', caption: `${method === 'SLM' ? 'Straight Line' : 'Written Down Value'} schedule`, head: ['Year', 'Opening value', 'Depreciation', 'Closing value'], numeric: [1, 2, 3],
      rows: rows.map(r => [String(r.year), R(r.opening), R(r.depreciation), R(r.closing)]), foot: ['Total', '', R(Money.sum(rows.map(r => r.depreciation))), ''] });
    blocks.push({ kind: 'bars', title: 'Book value at the end of each year', items: [{ ...bar('Cost', cost), tone: 'c' as const }, ...rows.map(r => bar(`End of year ${r.year}`, r.closing))] });
    blocks.push({ kind: 'steps', title: 'Working notes', steps: rows.map(r => `Year ${r.year}: ${method === 'WDV' ? `${rate}% of opening ${R(r.opening)}` : `${rate}% of cost ${R(cost)}`}${r.year === 1 && months < 12 ? ` × ${months}/12` : ''} = ${R(r.depreciation)}`) });
    const recording = v.recording === 'PROVISION' ? 'PROVISION' : 'ASSET_ACCOUNT';
    blocks.push({ kind: 'heading', text: 'Journal entry for the first year' });
    blocks.push({ kind: 'journal', entries: [depreciationEntry('Machinery', rows[0]!.depreciation, recording)] });
    if ((v.sale ?? '').trim() !== '') {
      const sale = optMoney(v, 'sale', 'Sale price');
      const acc = cost.sub(rows[rows.length - 1]!.closing);
      const d = disposeAsset({ name: 'Machinery', cost, accumulated: acc, saleProceeds: sale, method: recording });
      blocks.push({ kind: 'heading', text: 'Sale of the asset' });
      blocks.push({ kind: 'table', head: ['', 'Amount'], numeric: [1], rows: [['Cost', R(cost)], ['Less: depreciation to date', R(acc)], ['Book value at sale', R(d.bookValue)], ['Sale price', R(sale)], [d.profitOrLoss.isNegative() ? 'Loss on sale' : 'Profit on sale', R(d.profitOrLoss.abs())]] });
      blocks.push({ kind: 'journal', entries: d.entries });
      blocks.push(note(d.profitOrLoss.isNegative() ? `Sold for less than book value, so ${R(d.profitOrLoss.abs())} is a LOSS (an expense).` : d.profitOrLoss.isZero() ? 'Sold exactly at book value: no profit, no loss.' : `Sold for more than book value, so ${R(d.profitOrLoss)} is a PROFIT (a gain).`, d.profitOrLoss.isNegative() ? 'warn' : 'good'));
    }
    return blocks;
  },
};

// ───────────────────────────── Bank reconciliation ─────────────────────────────
const brsKinds = Object.keys(BRS_ITEMS) as BrsKind[];
export const brs: Lab = {
  id: 'xi-brs', cls: 'XI', title: 'Bank Reconciliation Lab', clauses: ['XI.2.brs'], skills: ['brs'],
  summary: 'Find why the cash book and the pass book disagree and reconcile them — from either starting point, including an overdraft.',
  concept: [
    'Your cash book (bank column) and the bank\'s pass book record the same money but at different times, so they often show different balances. A Bank Reconciliation Statement (BRS) explains the difference.',
    'Timing differences: a cheque you issued but the bank has not yet paid, or one you deposited but the bank has not yet collected. Omissions: bank charges, interest or direct deposits that the bank knows about and you do not.',
    'Memory aid: ask "has the bank done this yet?" If it already has but you have not, move your balance toward the bank\'s.',
  ],
  realWorld: 'You write a ₹10,000 cheque to a supplier on 30 March. Your cash book falls at once. The supplier banks it on 3 April — so on 31 March the bank still shows the higher balance.',
  fields: [
    { id: 'balance', label: 'Starting balance (₹, negative = overdraft)', type: 'money', help: 'Type a minus sign for an overdraft, e.g. -20000.' },
    { id: 'start', label: 'Start from', type: 'select', options: [{ value: 'CASH_BOOK', label: 'Balance as per cash book' }, { value: 'PASS_BOOK', label: 'Balance as per pass book' }] },
    ...brsKinds.map(k => ({ id: k, label: BRS_ITEMS[k].label + ' (₹)', type: 'money' as const, group: 'Items (leave blank if none)' })),
  ],
  example: { balance: '50000', start: 'CASH_BOOK', CHEQUE_ISSUED_NOT_PRESENTED: '10000', BANK_CHARGES_NOT_IN_CASH_BOOK: '500', CHEQUE_DEPOSITED_NOT_COLLECTED: '3000' },
  walkthrough: [
    'Start with the cash book balance ₹50,000.',
    'Cheques issued but not presented (₹10,000): your book already deducted them, the bank has not — ADD.',
    'Bank charges (₹500): the bank already deducted them, your book has not — LESS.',
    'Cheques deposited but not collected (₹3,000): your book already added them, the bank has not — LESS.',
    'Result ₹56,500 is the pass book balance.',
  ],
  compute: v => {
    const start = money(v, 'balance', 'Starting balance', { allowNegative: true });
    const startFrom = v.start === 'PASS_BOOK' ? 'PASS_BOOK' : 'CASH_BOOK';
    const items = brsKinds.map(k => ({ kind: k, amount: optMoney(v, k, BRS_ITEMS[k].label) })).filter(i => i.amount.isPositive());
    if (!items.length) throw new InputError('Enter at least one reconciling item below.');
    const r = reconcile(start, startFrom, items);
    const startName = startFrom === 'CASH_BOOK' ? 'cash book' : 'pass book', endName = startFrom === 'CASH_BOOK' ? 'pass book' : 'cash book';
    return [
      { kind: 'table', caption: `Reconciliation statement (starting from the ${startName})`, head: ['Particulars', 'Add / Less', 'Amount'], numeric: [2],
        rows: [[`Balance as per ${startName}${start.isNegative() ? ' (overdraft)' : ''}`, '', R(start)], ...r.rows.map(x => [x.label, x.effect === 'ADD' ? 'Add' : 'Less', R(x.amount)])], foot: [`Balance as per ${endName}`, '', R(r.end)] },
      { kind: 'bars', title: 'Before and after', items: [bar(`Per ${startName}`, start.abs(), 'a'), bar(`Per ${endName}`, r.end.abs(), 'b')] },
      note(start.isNegative() ? 'Balances are shown signed: a minus sign means an OVERDRAFT. An item that adds to a favourable balance reduces an overdraft — the arithmetic does that for you.' : 'The words Add and Less depend on where you start. Starting from the other book reverses every one of them.', 'info'),
      { kind: 'steps', title: 'Why each item moves the balance', steps: r.rows.map(x => `${x.label}: ${x.effect === 'ADD' ? 'add' : 'deduct'} ${R(x.amount)}`) },
    ];
  },
};

// ───────────────────────────── Rectification & suspense ─────────────────────────────
function parseLines(text: string, label: string): RectLine[] {
  return text.split(/\n+/).map(s => s.trim()).filter(Boolean).map((ln, i) => {
    const m = /^(dr|cr)\.?\s+(.+?)\s+([\d,]+(?:\.\d{1,2})?)$/i.exec(ln);
    if (!m) throw new InputError(`${label}, line ${i + 1} ("${ln}"): write it as  Dr Account name 5000  or  Cr Account name 5000.`);
    return { side: m[1]!.toUpperCase() as 'DR' | 'CR', account: m[2]!.trim(), amount: Money.parse(m[3]!.replace(/,/g, '')) };
  });
}
export const errors: Lab = {
  id: 'xi-errors', cls: 'XI', title: 'Error Detective & Suspense Account', clauses: ['XI.2.errors', 'XI.2.tb'], skills: ['suspense'],
  summary: 'Compare what was posted with what should have been posted — the difference IS the rectifying entry.',
  concept: [
    'Errors are of omission, commission, principle and compensating. Errors that debit and credit the same amount wrongly do not disturb the trial balance; one-sided errors do.',
    'Rectification rule: rectifying entry = (correct entry) − (entry actually passed), account by account. Reverse what was wrong, then do what was right.',
    'If the trial balance does not agree and the mistake cannot be found, the difference is put in a Suspense Account on the short side; when the one-sided errors are found, the rectifying entry clears it.',
  ],
  realWorld: 'A shop pays ₹5,000 to install a machine but the clerk debits "Wages". Wages is overstated, the machine is understated — and the trial balance still tallies, so nothing warns you.',
  fields: [
    { id: 'wrong', label: 'Entry actually passed (one line per account)', type: 'textarea', help: 'e.g.  Dr Wages A/c 5000  (new line)  Cr Cash A/c 5000. Leave empty if nothing was passed.' },
    { id: 'right', label: 'Entry that should have been passed', type: 'textarea' },
  ],
  example: { wrong: 'Dr Wages A/c 5000\nCr Cash A/c 5000', right: 'Dr Machinery A/c 5000\nCr Cash A/c 5000' },
  walkthrough: [
    'Passed: Dr Wages 5,000, Cr Cash 5,000.  Should be: Dr Machinery 5,000, Cr Cash 5,000.',
    'Subtract: Cash is the same in both, so it drops out. Machinery needs +5,000 on the debit side; Wages needs −5,000 on the debit side (i.e. a credit).',
    'Rectifying entry: Dr Machinery 5,000, Cr Wages 5,000. It balances by itself, so no suspense account is needed.',
  ],
  compute: v => {
    const wrong = parseLines(v.wrong ?? '', 'Entry passed'), right = parseLines(v.right ?? '', 'Correct entry');
    if (!right.length) throw new InputError('Write the entry that should have been passed.', 'right');
    const dr = (ls: RectLine[]) => Money.sum(ls.filter(l => l.side === 'DR').map(l => l.amount)), cr = (ls: RectLine[]) => Money.sum(ls.filter(l => l.side === 'CR').map(l => l.amount));
    const blocks: Block[] = [];
    const wrongGap = suspenseFromTrialBalance(dr(wrong), cr(wrong));
    if (wrong.length && wrongGap) blocks.push(note(`The entry that was passed is one-sided: debits ${R(dr(wrong))} vs credits ${R(cr(wrong))}. The trial balance would be out by ${R(wrongGap.amount)}, and a ${wrongGap.side === 'DR' ? 'DEBIT' : 'CREDIT'} Suspense Account of that amount would have been opened to make it agree.`, 'warn'));
    const rg = rectify(wrong, right);
    blocks.push({ kind: 'heading', text: 'Rectifying entry' });
    if (!rg.lines.length) { blocks.push(note('The two entries are identical — nothing to rectify.', 'good')); return blocks; }
    blocks.push({ kind: 'journal', entries: [rg.entry] });
    blocks.push(note(rg.usesSuspense ? `One-sided error: the rectifying entry clears the Suspense Account (${rg.suspenseSide === 'CR' ? 'credit' : 'debit'} ${R(rg.lines.find(l => l.account === 'Suspense A/c')!.amount)}). A one-sided error DOES disturb the trial balance: it stayed out of agreement until a suspense account was opened.` : 'Two-sided error: debits and credits were wrong by the same amount, so the trial balance still agreed. It does NOT affect the trial balance — and no suspense account is needed.', rg.usesSuspense ? 'warn' : 'good'));
    blocks.push({ kind: 'table', caption: 'Account-by-account difference (correct − passed)', head: ['Account', 'Passed', 'Should be', 'Rectification'], rows: [...new Set([...wrong, ...right].map(l => l.account))].map(a => {
      const f = (ls: RectLine[]) => Money.sum(ls.filter(l => l.account === a).map(l => (l.side === 'DR' ? l.amount : l.amount.neg())));
      const s = (m: Money) => (m.isZero() ? '—' : m.isPositive() ? `${R(m)} Dr` : `${R(m.neg())} Cr`);
      return [a, s(f(wrong)), s(f(right)), s(f(right).sub(f(wrong)))];
    }), numeric: [1, 2, 3] });
    return blocks;
  },
};

// ───────────────────────────── Final accounts ─────────────────────────────
const D = (name: string, kind: TbLine['kind'], a: string): TbLine => ({ name, kind, debit: Money.parse(a) });
const C = (name: string, kind: TbLine['kind'], a: string): TbLine => ({ name, kind, credit: Money.parse(a) });
export const FA_TB: TbLine[] = [
  D('Opening Stock', 'OPENING_STOCK', '20000'), D('Purchases', 'PURCHASES', '100000'), D('Wages', 'DIRECT_EXPENSE', '10000'),
  D('Salaries', 'INDIRECT_EXPENSE', '18000'), D('Rent', 'INDIRECT_EXPENSE', '12000'), D('Bad debts', 'BAD_DEBTS', '1000'),
  D('Debtors', 'DEBTORS', '40000'), D('Furniture', 'FIXED_ASSET', '30000'), D('Cash', 'CURRENT_ASSET', '5000'), D('Bank', 'CURRENT_ASSET', '25000'),
  D('Drawings', 'DRAWINGS', '8000'), D('Sales Returns', 'SALES_RETURNS', '2000'),
  C('Sales', 'SALES', '190000'), C('Creditors', 'CURRENT_LIABILITY', '30000'), C('Provision for doubtful debts', 'PROVISION_DOUBTFUL', '2000'), C('Capital', 'CAPITAL', '49000'),
];
export const finalAccountsLab: Lab = {
  id: 'xi-final-accounts', cls: 'XI', title: 'Final Accounts with Adjustments', clauses: ['XI.3.trading-pl', 'XI.3.balance-sheet', 'XI.3.adjustments'], skills: ['pdd'],
  summary: 'Switch adjustments on and off and watch the Trading A/c, Profit & Loss A/c and Balance Sheet rebuild from the trial balance.',
  concept: [
    'The Trading account finds Gross Profit (sales and closing stock against opening stock, purchases and direct expenses). The Profit & Loss account finds Net Profit. The Balance Sheet shows what the business owns and owes.',
    'Adjustments are items the trial balance does not yet reflect. Each has TWO effects — one in the P&L (or Trading) account and one in the Balance Sheet — which is why the Balance Sheet still balances.',
    'Provision for discount on debtors is calculated on debtors left AFTER bad debts and after the provision for doubtful debts. Manager\'s commission can be on profit before or after charging itself.',
  ],
  realWorld: 'At year-end the shop still owes the shop assistant ₹2,000 salary. It is this year\'s expense even though unpaid, so it goes into the P&L and also shows as a liability on the Balance Sheet.',
  fields: [
    { id: 'closing', label: 'Closing stock (₹)', type: 'money', group: 'Adjustments (leave blank or 0 to switch one off)' },
    { id: 'osSalary', label: 'Outstanding salaries (₹)', type: 'money' }, { id: 'prepRent', label: 'Prepaid rent (₹)', type: 'money' },
    { id: 'depRate', label: 'Depreciation on furniture (% of cost)', type: 'percent' }, { id: 'extraBad', label: 'Further bad debts (₹)', type: 'money' },
    { id: 'pdd', label: 'Provision for doubtful debts (% of debtors)', type: 'percent' }, { id: 'pd', label: 'Provision for discount on debtors (%)', type: 'percent' },
    { id: 'ioc', label: 'Interest on capital (%)', type: 'percent' }, { id: 'personal', label: 'Goods taken for personal use (₹)', type: 'money' },
    { id: 'comm', label: 'Manager\'s commission (%)', type: 'percent' }, { id: 'commBasis', label: 'Commission is on profit', type: 'select', options: [{ value: 'BEFORE', label: 'before charging the commission' }, { value: 'AFTER', label: 'after charging the commission' }] },
  ],
  example: { closing: '30000', osSalary: '2000', prepRent: '1000', depRate: '10', extraBad: '2000', pdd: '5', pd: '2', ioc: '5', personal: '1500', comm: '0', commBasis: 'BEFORE' },
  walkthrough: [
    'Closing stock ₹30,000 goes on the credit side of Trading A/c AND becomes an asset.',
    'Outstanding salaries ₹2,000 raise this year\'s salary expense and appear as a liability; prepaid rent ₹1,000 lowers rent expense and appears as an asset.',
    'Further bad debts ₹2,000: debtors fall to ₹38,000. Provision 5% × ₹38,000 = ₹1,900 (old provision was ₹2,000, so P&L gains ₹100). Discount provision 2% × (₹38,000 − ₹1,900) = ₹722.',
    'Net profit comes to ₹49,428; capital grows by it, plus interest on capital, less drawings and goods taken. Both sides of the Balance Sheet total ₹1,23,378.',
  ],
  compute: v => {
    const adj: Adjustment[] = [];
    const m = (id: string, label: string) => optMoney(v, id, label);
    const p = (id: string, label: string) => ((v[id] ?? '').trim() === '' ? 0n : percent(v, id, label));
    const cs = m('closing', 'Closing stock'); if (cs.isPositive()) adj.push({ type: 'CLOSING_STOCK', amount: cs });
    const os = m('osSalary', 'Outstanding salaries'); if (os.isPositive()) adj.push({ type: 'OUTSTANDING', account: 'Salaries', amount: os });
    const pr = m('prepRent', 'Prepaid rent'); if (pr.isPositive()) adj.push({ type: 'PREPAID', account: 'Rent', amount: pr });
    const dep = p('depRate', 'Depreciation rate'); if (dep > 0n) adj.push({ type: 'DEPRECIATION', asset: 'Furniture', amount: Money.parse('30000').mulRatio(dep, 100n, 'HALF_UP') });
    const eb = m('extraBad', 'Further bad debts'); if (eb.isPositive()) adj.push({ type: 'BAD_DEBTS', amount: eb });
    if (eb.cmp(Money.parse('40000')) > 0) throw new InputError('Further bad debts cannot exceed the debtors (₹40,000).', 'extraBad');
    const pdd = p('pdd', 'Provision for doubtful debts'); if (pdd > 0n) adj.push({ type: 'PROVISION_DOUBTFUL', ratePercent: pdd });
    const pd = p('pd', 'Provision for discount'); if (pd > 0n) adj.push({ type: 'PROVISION_DISCOUNT', ratePercent: pd });
    const ioc = p('ioc', 'Interest on capital'); if (ioc > 0n) adj.push({ type: 'INTEREST_ON_CAPITAL', ratePercent: ioc });
    const pu = m('personal', 'Goods for personal use'); if (pu.isPositive()) adj.push({ type: 'GOODS_PERSONAL_USE', amount: pu });
    const cm = p('comm', 'Commission'); if (cm > 0n) adj.push({ type: 'MANAGER_COMMISSION', ratePercent: cm, basis: v.commBasis === 'AFTER' ? 'AFTER' : 'BEFORE' });
    const f = finalAccounts(FA_TB, adj);
    const base = finalAccounts(FA_TB, adj.filter(a => a.type === 'CLOSING_STOCK'));
    const side = (d: readonly { label: string; amount: Money }[], c: readonly { label: string; amount: Money }[], dt: Money, ct: Money, caption: string): Block => {
      const n = Math.max(d.length, c.length);
      return { kind: 'table', caption, head: ['Particulars (Dr.)', '₹', 'Particulars (Cr.)', '₹'], numeric: [1, 3], rows: Array.from({ length: n }, (_, i) => [d[i] ? `To ${d[i]!.label}` : '', d[i] ? R(d[i]!.amount) : '', c[i] ? `By ${c[i]!.label}` : '', c[i] ? R(c[i]!.amount) : '']), foot: ['Total', R(dt), 'Total', R(ct)] };
    };
    const tsum = (rows: readonly { amount: Money }[]) => Money.sum(rows.map(r => r.amount));
    const gp = f.trading.grossProfit;
    const trD = [...f.trading.debit, ...(gp.isPositive() ? [{ label: 'Gross Profit c/d', amount: gp }] : [])], trC = [...f.trading.credit, ...(gp.isNegative() ? [{ label: 'Gross Loss c/d', amount: gp.neg() }] : [])];
    const np = f.profitLoss.netProfit;
    const plD = [...f.profitLoss.debit, ...(np.isPositive() ? [{ label: 'Net Profit (to Capital)', amount: np }] : [])], plC = [...f.profitLoss.credit, ...(np.isNegative() ? [{ label: 'Net Loss (to Capital)', amount: np.neg() }] : [])];
    const bs = f.balanceSheet;
    const eqAssets = bs.assets.map(r => ({ label: r.label, value: num(r.amount), text: R(r.amount) })), eqRhs = bs.liabilities.map(r => ({ label: r.label.replace(/ \(after.*$/, ''), value: num(r.amount), text: R(r.amount) }));
    return [
      { kind: 'table', caption: 'Trial balance (given)', head: ['Account', 'Debit (₹)', 'Credit (₹)'], numeric: [1, 2], rows: FA_TB.map(l => [l.name, l.debit ? R(l.debit) : '', l.credit ? R(l.credit) : '']), foot: ['Total', R(Money.sum(FA_TB.map(l => l.debit ?? Money.ZERO))), R(Money.sum(FA_TB.map(l => l.credit ?? Money.ZERO)))] },
      side(trD, trC, tsum(trD), tsum(trC), 'Trading Account'),
      side(plD, plC, tsum(plD), tsum(plC), 'Profit & Loss Account'),
      { kind: 'table', caption: 'Balance Sheet', head: ['Liabilities', '₹', 'Assets', '₹'], numeric: [1, 3], rows: Array.from({ length: Math.max(bs.liabilities.length, bs.assets.length) }, (_, i) => [bs.liabilities[i]?.label ?? '', bs.liabilities[i] ? R(bs.liabilities[i]!.amount) : '', bs.assets[i]?.label ?? '', bs.assets[i] ? R(bs.assets[i]!.amount) : '']), foot: ['Total', R(bs.totalLiabilities), 'Total', R(bs.totalAssets)] },
      note(bs.balanced ? `✓ The Balance Sheet balances at ${R(bs.totalAssets)}. Every adjustment was recorded twice, so it must.` : `✗ The Balance Sheet is out by ${R(bs.totalLiabilities.sub(bs.totalAssets).abs())}.`, bs.balanced ? 'good' : 'bad'),
      { kind: 'equation', assets: eqAssets, rhs: eqRhs, balanced: bs.balanced },
      { kind: 'bars', title: 'What the adjustments did to profit', items: [bar('Net profit with only closing stock', base.profitLoss.netProfit, 'c'), bar('Net profit after your adjustments', np, np.isNegative() ? 'neg' : 'a'), bar('Gross profit', gp, 'b')] },
    ];
  },
};

// ───────────────────────────── GST invoice ─────────────────────────────
export const gst: Lab = {
  id: 'xi-gst', cls: 'XI', title: 'Invoice, Trade Discount & GST', clauses: ['XI.2.subsidiary', 'XI.1.gst'], skills: ['gst'],
  summary: 'Build an invoice: trade discount, freight and simple GST — and the purchase / sales book entry for it.',
  concept: [
    'Trade discount is deducted from the list price on the invoice and is NEVER recorded in the books. Freight or cartage billed to the buyer is added.',
    'GST is charged on that taxable value. Within a state it is split equally into CGST and SGST; between states it is a single IGST.',
    'The buyer records input GST (an asset to be set off); the seller records output GST (a liability to the government).',
  ],
  realWorld: 'A stationery wholesaler lists ₹10,000 of goods, allows a 10% trade discount, adds ₹500 freight and charges 18% GST. The invoice shows a total of ₹11,210.',
  fields: [
    { id: 'list', label: 'List price (₹)', type: 'money' }, { id: 'td', label: 'Trade discount (%)', type: 'percent' }, { id: 'freight', label: 'Freight / cartage billed (₹)', type: 'money' },
    { id: 'gst', label: 'GST rate (%)', type: 'percent' }, { id: 'inter', label: 'Supply is', type: 'select', options: [{ value: 'N', label: 'Within the state (CGST + SGST)' }, { value: 'Y', label: 'Between states (IGST)' }] },
    { id: 'role', label: 'Show the entry in the books of the', type: 'select', options: [{ value: 'BUYER', label: 'Buyer (Purchases book)' }, { value: 'SELLER', label: 'Seller (Sales book)' }] },
  ],
  example: { list: '10000', td: '10', freight: '500', gst: '18', inter: 'N', role: 'BUYER' },
  walkthrough: ['Trade discount 10% of ₹10,000 = ₹1,000, so goods are ₹9,000.', 'Add freight ₹500 → taxable value ₹9,500.', 'GST 18% of ₹9,500 = ₹1,710, split ₹855 CGST + ₹855 SGST.', 'Invoice total = ₹9,500 + ₹1,710 = ₹11,210.'],
  compute: v => {
    const i = invoice({ listPrice: money(v, 'list', 'List price'), tradeDiscountPercent: percent(v, 'td', 'Trade discount'), freight: optMoney(v, 'freight', 'Freight'), gstPercent: percent(v, 'gst', 'GST rate'), interState: v.inter === 'Y' });
    const role = v.role === 'SELLER' ? 'SELLER' : 'BUYER';
    return [
      { kind: 'table', caption: 'Invoice', head: ['', '₹'], numeric: [1], rows: [['List price', R(i.listPrice)], ['Less: trade discount', R(i.tradeDiscount)], ['Add: freight / cartage', R(i.freight)], ['Taxable value', R(i.taxable)], ...(v.inter === 'Y' ? [['IGST', R(i.igst)]] : [['CGST', R(i.cgst)], ['SGST', R(i.sgst)]])], foot: ['Invoice total', R(i.total)] },
      { kind: 'journal', entries: [invoiceEntry(i, role, 'Party')] },
      note('The trade discount does not appear in the journal: only the net taxable value is recorded.', 'info'),
    ];
  },
};

// ───────────────────────────── Petty cash ─────────────────────────────
export const petty: Lab = {
  id: 'xi-petty', cls: 'XI', title: 'Petty Cash (Imprest) Lab', clauses: ['XI.2.cashbook'], skills: [],
  summary: 'Run an imprest petty cash book: small payments are analysed by head and the cashier is topped back up to the imprest.',
  concept: ['Petty cash covers small day-to-day expenses (postage, tea, conveyance). Under the imprest system the cashier is given a fixed sum.', 'At the end of the period the cashier is reimbursed exactly what was spent, restoring the imprest. Payments are analysed under heads in columns.'],
  realWorld: 'The office keeps ₹5,000 for small bills. After a month ₹2,450 has gone on postage and conveyance; the head cashier hands over ₹2,450 and the float is ₹5,000 again.',
  fields: [{ id: 'imprest', label: 'Imprest amount (₹)', type: 'money' }, { id: 'payments', label: 'Payments (one per line:  Head : amount)', type: 'textarea' }],
  example: { imprest: '5000', payments: 'Postage : 1200\nConveyance : 800\nPostage : 450' },
  walkthrough: ['Cashier starts with the imprest ₹5,000.', 'Spent: postage ₹1,650 + conveyance ₹800 = ₹2,450.', 'Cash left ₹2,550. To restore the imprest the cashier is reimbursed ₹2,450.'],
  compute: v => {
    const imprest = money(v, 'imprest', 'Imprest');
    const pays = namedAmounts(v, 'payments', 'Payments').map(p => ({ head: p.name, amount: p.amount }));
    if (!pays.length) throw new InputError('Enter at least one payment.', 'payments');
    let r; try { r = pettyCash({ imprest, payments: pays }); } catch (e) { throw new InputError((e as Error).message, 'payments'); }
    const heads = Object.entries(r.byHead);
    return [
      { kind: 'table', caption: 'Analysis of petty cash payments', head: ['Head', 'Total (₹)'], numeric: [1], rows: heads.map(([h, a]) => [h, R(a)]), foot: ['Total spent', R(r.totalSpent)] },
      { kind: 'bars', title: 'Where the money went', items: heads.map(([h, a]) => bar(h, a)) },
      { kind: 'table', head: ['', '₹'], numeric: [1], rows: [['Imprest', R(imprest)], ['Spent', R(r.totalSpent)], ['Cash in hand at end', R(r.closingBalance)], ['Reimbursement to restore imprest', R(r.reimbursement)]] },
    ];
  },
};

// ───────────────────────────── Incomplete records ─────────────────────────────
export const incomplete: Lab = {
  id: 'xi-incomplete', cls: 'XI', title: 'Incomplete Records — Statement of Affairs', clauses: ['XI.3.incomplete'], skills: ['soa'],
  summary: 'No proper books? Estimate profit from the change in capital, adjusted for drawings and fresh capital.',
  concept: ['A small trader may not keep double-entry books. Profit can still be estimated by comparing capital at two dates.', 'Capital = assets − liabilities, listed in a Statement of Affairs. Profit = closing capital − opening capital + drawings − fresh capital. Syllabus limit: the conversion method is excluded.'],
  realWorld: 'A street vendor never wrote anything down. At year-end she lists what she owns and owes and compares it with last year.',
  fields: [{ id: 'openCap', label: 'Capital at the start (₹)', type: 'money' }, { id: 'assets', label: 'Assets at the end (amounts, comma separated)', type: 'text' }, { id: 'liabs', label: 'Liabilities at the end (amounts, comma separated)', type: 'text' }, { id: 'draw', label: 'Drawings (₹)', type: 'money' }, { id: 'fresh', label: 'Fresh capital introduced (₹)', type: 'money' }],
  example: { openCap: '150000', assets: '300000, 50000', liabs: '140000', draw: '30000', fresh: '20000' },
  walkthrough: ['Closing capital = ₹3,50,000 − ₹1,40,000 = ₹2,10,000.', 'It rose by ₹60,000 from ₹1,50,000.', 'But she took out ₹30,000 (so profit was higher) and put in ₹20,000 (so profit was lower): ₹60,000 + ₹30,000 − ₹20,000 = ₹70,000 profit.'],
  compute: v => {
    const assets = moneyList(v, 'assets', 'Assets'), liabs = moneyList(v, 'liabs', 'Liabilities', 0);
    const close = statementOfAffairs({ assets, liabilities: liabs }), open = money(v, 'openCap', 'Opening capital'), draw = optMoney(v, 'draw', 'Drawings'), fresh = optMoney(v, 'fresh', 'Fresh capital');
    const p = profitByStatementOfAffairs({ openingCapital: open, closingCapital: close, drawings: draw, additionalCapital: fresh });
    return [
      { kind: 'table', caption: 'Statement of Affairs at the end of the year', head: ['', '₹'], numeric: [1], rows: [['Total assets', R(Money.sum(assets))], ['Less: total liabilities', R(Money.sum(liabs))]], foot: ['Closing capital', R(close)] },
      { kind: 'table', caption: 'Statement of Profit or Loss', head: ['', '₹'], numeric: [1], rows: [['Closing capital', R(close)], ['Less: opening capital', R(open)], ['Increase in capital', R(close.sub(open))], ['Add: drawings', R(draw)], ['Less: fresh capital introduced', R(fresh)]], foot: [p.isNegative() ? 'Loss for the year' : 'Profit for the year', R(p.abs())] },
      note(p.isNegative() ? 'A loss: capital fell by more than the drawings explain.' : 'The increase in capital understates profit by the amount drawn and overstates it by any fresh capital — hence both adjustments.', p.isNegative() ? 'warn' : 'info'),
    ];
  },
};
export const XI_LABS: Lab[] = [depreciation, brs, errors, finalAccountsLab, gst, petty, incomplete];
