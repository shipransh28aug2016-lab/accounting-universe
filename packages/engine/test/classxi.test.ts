import { describe, expect, it } from 'vitest';
import {
  AFFECTS_TRIAL_BALANCE, Money, depreciationEntry, depreciationSchedule, disposeAsset, finalAccounts, FinalAccountsError, invoice, invoiceEntry, isBalanced,
  pct, pettyCash, profitByStatementOfAffairs, reconcile, rectify, statementOfAffairs, suspenseFromTrialBalance, type Adjustment, type TbLine,
} from '../src';

const M = (s: string) => Money.parse(s);
const s = (m: Money) => m.toString();

describe('depreciation schedules', () => {
  it('WDV 10% on ₹1,00,000: 10,000 / 9,000 / 8,100 ⇒ book value 72,900', () => {
    const r = depreciationSchedule({ cost: M('100000'), method: 'WDV', rate: pct(10), years: 3 });
    expect(r.map(x => s(x.depreciation))).toEqual(['10000.00', '9000.00', '8100.00']);
    expect(s(r[2]!.closing)).toBe('72900.00');
  });
  it('SLM 10% on cost ₹1,00,000: 10,000 every year', () => {
    const r = depreciationSchedule({ cost: M('100000'), method: 'SLM', rate: pct(10), years: 3 });
    expect(r.map(x => s(x.depreciation))).toEqual(['10000.00', '10000.00', '10000.00']);
    expect(s(r[2]!.closing)).toBe('70000.00');
  });
  it('SLM by life: (1,00,000 − 1,000) ÷ 3 = 33,000 a year, closing = scrap exactly', () => {
    const r = depreciationSchedule({ cost: M('100000'), scrap: M('1000'), method: 'SLM', lifeYears: 3, years: 3 });
    expect(r.map(x => s(x.depreciation))).toEqual(['33000.00', '33000.00', '33000.00']);
    expect(s(r[2]!.closing)).toBe('1000.00');
  });
  it('rounding never loses a paisa: ₹100 over 3 years = 33.33 + 33.33 + 33.34', () => {
    const r = depreciationSchedule({ cost: M('100'), method: 'SLM', lifeYears: 3, years: 3 });
    expect(r.map(x => s(x.depreciation))).toEqual(['33.33', '33.33', '33.34']);
    expect(s(Money.sum(r.map(x => x.depreciation)))).toBe('100.00');
  });
  it('part year: bought 1 October, year-end 31 March ⇒ 6 months = ₹5,000 (SLM 10%)', () => {
    const r = depreciationSchedule({ cost: M('100000'), method: 'SLM', rate: pct(10), years: 2, firstYearMonths: 6 });
    expect(r.map(x => s(x.depreciation))).toEqual(['5000.00', '10000.00']);
  });
  it('never depreciates below scrap and rejects bad input', () => {
    const r = depreciationSchedule({ cost: M('100'), scrap: M('90'), method: 'WDV', rate: pct(50), years: 5 });
    expect(s(r.at(-1)!.closing)).toBe('90.00');
    expect(() => depreciationSchedule({ cost: M('100'), scrap: M('200'), method: 'SLM', rate: pct(10), years: 1 })).toThrow(RangeError);
    expect(() => depreciationSchedule({ cost: M('100'), method: 'WDV', years: 1 })).toThrow(RangeError);
    expect(() => depreciationSchedule({ cost: M('100'), method: 'SLM', rate: pct(10), years: 0 })).toThrow(RangeError);
  });
  it('both recording methods balance', () => {
    expect(isBalanced(depreciationEntry('Machinery', M('10000'), 'ASSET_ACCOUNT'))).toBe(true);
    expect(depreciationEntry('Machinery', M('10000'), 'PROVISION').lines[1]!.account).toMatch(/Provision for Depreciation/);
  });
});

describe('disposal of an asset', () => {
  it('WDV example: bought 1,00,000, depreciation 10,000 + 9,000 + 8,100 = 27,100, sold for 70,000 ⇒ BV 72,900, loss 2,900', () => {
    const d = disposeAsset({ name: 'Machinery', cost: M('100000'), accumulated: M('27100'), saleProceeds: M('70000'), method: 'ASSET_ACCOUNT' });
    expect([s(d.bookValue), s(d.profitOrLoss)]).toEqual(['72900.00', '-2900.00']);
    expect(d.entries.every(isBalanced)).toBe(true);
    expect(d.entries[0]!.lines.find(l => l.account === 'Loss on Sale of Asset A/c')!.amount.toString()).toBe('2900.00');
  });
  it('profit case under the PROVISION method uses an Asset Disposal A/c; every entry balances', () => {
    const d = disposeAsset({ name: 'Furniture', cost: M('50000'), accumulated: M('20000'), saleProceeds: M('35000'), method: 'PROVISION' });
    expect(s(d.profitOrLoss)).toBe('5000.00');               // 35,000 − BV 30,000
    expect(d.entries.length).toBe(4);
    expect(d.entries.every(isBalanced)).toBe(true);
    expect(d.entries[0]!.lines[0]!.account).toBe('Asset Disposal A/c');
  });
  it('sale at exactly book value has neither profit nor loss', () => {
    const d = disposeAsset({ name: 'X', cost: M('100'), accumulated: M('40'), saleProceeds: M('60'), method: 'ASSET_ACCOUNT' });
    expect(d.profitOrLoss.isZero()).toBe(true); expect(d.entries.every(isBalanced)).toBe(true);
  });
});

describe('bank reconciliation', () => {
  it('SQP Q15/Q16 rules from the cash book: bank charges ₹500 ⇒ deduct; unpresented cheque ₹10,000 ⇒ add', () => {
    const r = reconcile(M('50000'), 'CASH_BOOK', [{ kind: 'BANK_CHARGES_NOT_IN_CASH_BOOK', amount: M('500') }, { kind: 'CHEQUE_ISSUED_NOT_PRESENTED', amount: M('10000') }]);
    expect(r.rows.map(x => x.effect)).toEqual(['LESS', 'ADD']);
    expect(s(r.end)).toBe('59500.00');
  });
  it('starting from the PASS BOOK reverses every effect and returns the cash-book balance', () => {
    const items = [{ kind: 'BANK_CHARGES_NOT_IN_CASH_BOOK' as const, amount: M('500') }, { kind: 'CHEQUE_ISSUED_NOT_PRESENTED' as const, amount: M('10000') }, { kind: 'CHEQUE_DEPOSITED_NOT_COLLECTED' as const, amount: M('3000') }];
    const fwd = reconcile(M('50000'), 'CASH_BOOK', items);
    const back = reconcile(fwd.end, 'PASS_BOOK', items);
    expect(s(back.end)).toBe('50000.00');                     // round trip
    expect(back.rows.map(x => x.effect)).toEqual(['ADD', 'LESS', 'ADD']);
  });
  it('overdraft is a negative balance: −20,000 overdraft per cash book, unpresented cheque 5,000 ⇒ overdraft per pass book −15,000', () => {
    expect(s(reconcile(M('-20000'), 'CASH_BOOK', [{ kind: 'CHEQUE_ISSUED_NOT_PRESENTED', amount: M('5000') }]).end)).toBe('-15000.00');
  });
  it('rejects non-positive items', () => expect(() => reconcile(M('1'), 'CASH_BOOK', [{ kind: 'CHEQUE_DISHONOURED', amount: M('0') }])).toThrow(RangeError));
});

describe('rectification and suspense', () => {
  const line = (account: string, side: 'DR' | 'CR', a: string) => ({ account, side, amount: M(a) });
  it('error of principle: wages on installation debited to Wages ⇒ Dr Machinery, Cr Wages (no suspense)', () => {
    const r = rectify([line('Wages A/c', 'DR', '5000'), line('Cash A/c', 'CR', '5000')], [line('Machinery A/c', 'DR', '5000'), line('Cash A/c', 'CR', '5000')]);
    expect(r.lines.map(l => `${l.side} ${l.account} ${l.amount}`).sort()).toEqual(['CR Wages A/c 5000.00', 'DR Machinery A/c 5000.00']);
    expect(r.usesSuspense).toBe(false); expect(isBalanced(r.entry)).toBe(true);
  });
  it('commission: cash from Ramesh credited to Suresh ⇒ Dr Suresh, Cr Ramesh', () => {
    const r = rectify([line('Cash A/c', 'DR', '1500'), line('Suresh', 'CR', '1500')], [line('Cash A/c', 'DR', '1500'), line('Ramesh', 'CR', '1500')]);
    expect(r.lines.map(l => `${l.side} ${l.account}`).sort()).toEqual(['CR Ramesh', 'DR Suresh']);
  });
  it('rent debited to the landlord ⇒ Dr Rent, Cr Landlord', () => {
    const r = rectify([line('Landlord', 'DR', '1000'), line('Cash A/c', 'CR', '1000')], [line('Rent A/c', 'DR', '1000'), line('Cash A/c', 'CR', '1000')]);
    expect(r.lines.map(l => `${l.side} ${l.account}`).sort()).toEqual(['CR Landlord', 'DR Rent A/c']);
  });
  it('complete omission: the whole entry is simply passed', () => {
    const r = rectify([], [line('Debtors A/c', 'DR', '2000'), line('Sales A/c', 'CR', '2000')]);
    expect(r.lines.length).toBe(2); expect(r.usesSuspense).toBe(false);
  });
  it('ONE-SIDED error: credit to Sales posted, debit to Debtors omitted ⇒ rectification clears the Suspense A/c', () => {
    const r = rectify([line('Sales A/c', 'CR', '1000')], [line('Debtors A/c', 'DR', '1000'), line('Sales A/c', 'CR', '1000')]);
    expect(r.usesSuspense).toBe(true); expect(r.suspenseSide).toBe('CR');
    expect(r.lines.map(l => `${l.side} ${l.account} ${l.amount}`).sort()).toEqual(['CR Suspense A/c 1000.00', 'DR Debtors A/c 1000.00']);
    expect(isBalanced(r.entry)).toBe(true);
  });
  it('a trial balance short on the debit side opens a DEBIT suspense account (SQP-style Virtual Client case: short by ₹5,000)', () => {
    expect(suspenseFromTrialBalance(M('95000'), M('100000'))).toEqual({ amount: M('5000'), side: 'DR' });
    expect(suspenseFromTrialBalance(M('100000'), M('95000'))).toEqual({ amount: M('5000'), side: 'CR' });
    expect(suspenseFromTrialBalance(M('1'), M('1'))).toBeNull();
  });
  it('which errors disturb the trial balance', () => {
    expect(AFFECTS_TRIAL_BALANCE.COMMISSION).toBe(false); expect(AFFECTS_TRIAL_BALANCE.PRINCIPLE).toBe(false);
    expect(AFFECTS_TRIAL_BALANCE.COMPENSATING).toBe(false); expect(AFFECTS_TRIAL_BALANCE.OMISSION_PARTIAL).toBe(true);
  });
});

describe('incomplete records / petty cash / GST', () => {
  it('statement of affairs: opening capital 1,50,000, closing 2,10,000, drawings 30,000, fresh capital 20,000 ⇒ profit 70,000', () => {
    expect(s(statementOfAffairs({ assets: [M('300000'), M('50000')], liabilities: [M('140000')] }))).toBe('210000.00');
    expect(s(profitByStatementOfAffairs({ openingCapital: M('150000'), closingCapital: M('210000'), drawings: M('30000'), additionalCapital: M('20000') }))).toBe('70000.00');
  });
  it('a loss comes out negative', () => expect(s(profitByStatementOfAffairs({ openingCapital: M('100'), closingCapital: M('60'), drawings: M('0') }))).toBe('-40.00'));
  it('petty cash: imprest 5,000, spent 1,200 + 800 + 450 ⇒ reimburse 2,450, balance 2,550', () => {
    const p = pettyCash({ imprest: M('5000'), payments: [{ head: 'Postage', amount: M('1200') }, { head: 'Conveyance', amount: M('800') }, { head: 'Postage', amount: M('450') }] });
    expect([s(p.totalSpent), s(p.reimbursement), s(p.closingBalance), s(p.byHead.Postage!)]).toEqual(['2450.00', '2450.00', '2550.00', '1650.00']);
    expect(() => pettyCash({ imprest: M('100'), payments: [{ head: 'x', amount: M('101') }] })).toThrow(RangeError);
  });
  it('GST: list ₹10,000, trade discount 10%, freight ₹500, GST 18% intra-state ⇒ taxable 9,500, CGST 855, SGST 855, total 11,210', () => {
    const i = invoice({ listPrice: M('10000'), tradeDiscountPercent: 10n, freight: M('500'), gstPercent: 18n });
    expect([i.tradeDiscount, i.taxable, i.cgst, i.sgst, i.igst, i.total].map(s)).toEqual(['1000.00', '9500.00', '855.00', '855.00', '0.00', '11210.00']);
    expect(isBalanced(invoiceEntry(i, 'BUYER', 'Ram'))).toBe(true); expect(isBalanced(invoiceEntry(i, 'SELLER', 'Ram'))).toBe(true);
  });
  it('inter-state uses IGST only; an odd paisa of tax goes to SGST so CGST + SGST = total tax', () => {
    const a = invoice({ listPrice: M('10000'), gstPercent: 12n, interState: true });
    expect([s(a.igst), s(a.cgst)]).toEqual(['1200.00', '0.00']);
    const b = invoice({ listPrice: M('0.50'), gstPercent: 5n });
    expect(s(b.cgst.add(b.sgst))).toBe(s(b.totalTax));
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────
// Final accounts: every figure below was worked out by hand BEFORE running the engine.
// ───────────────────────────────────────────────────────────────────────────────────────────────
describe('final accounts of a sole proprietor', () => {
  const D = (name: string, kind: TbLine['kind'], a: string): TbLine => ({ name, kind, debit: M(a) });
  const C = (name: string, kind: TbLine['kind'], a: string): TbLine => ({ name, kind, credit: M(a) });
  const tb: TbLine[] = [
    D('Opening Stock', 'OPENING_STOCK', '20000'), D('Purchases', 'PURCHASES', '100000'), D('Wages', 'DIRECT_EXPENSE', '10000'),
    D('Salaries', 'INDIRECT_EXPENSE', '18000'), D('Rent', 'INDIRECT_EXPENSE', '12000'), D('Bad debts', 'BAD_DEBTS', '1000'),
    D('Debtors', 'DEBTORS', '40000'), D('Furniture', 'FIXED_ASSET', '30000'), D('Cash', 'CURRENT_ASSET', '5000'), D('Bank', 'CURRENT_ASSET', '25000'),
    D('Drawings', 'DRAWINGS', '8000'), D('Sales Returns', 'SALES_RETURNS', '2000'),
    C('Sales', 'SALES', '190000'), C('Creditors', 'CURRENT_LIABILITY', '30000'), C('Provision for doubtful debts', 'PROVISION_DOUBTFUL', '2000'), C('Capital', 'CAPITAL', '49000'),
  ];
  // Dr: 20+100+10+18+12+1+40+30+5+25+8+2 = 271,000    Cr: 190+30+2+49 = 271,000
  const adjs: Adjustment[] = [
    { type: 'CLOSING_STOCK', amount: M('30000') },
    { type: 'OUTSTANDING', account: 'Salaries', amount: M('2000') },
    { type: 'PREPAID', account: 'Rent', amount: M('1000') },
    { type: 'DEPRECIATION', asset: 'Furniture', amount: M('3000') },
    { type: 'BAD_DEBTS', amount: M('2000') },
    { type: 'PROVISION_DOUBTFUL', ratePercent: 5n },
    { type: 'PROVISION_DISCOUNT', ratePercent: 2n },
    { type: 'INTEREST_ON_CAPITAL', ratePercent: 5n },
    { type: 'GOODS_PERSONAL_USE', amount: M('1500') },
  ];

  it('Trading A/c: Dr 1,28,500 (20,000 + 98,500 + 10,000) ; Cr 2,18,000 (1,88,000 + 30,000) ⇒ Gross Profit 89,500', () => {
    const f = finalAccounts(tb, adjs);
    expect(s(Money.sum(f.trading.debit.map(r => r.amount)))).toBe('128500.00');
    expect(s(Money.sum(f.trading.credit.map(r => r.amount)))).toBe('218000.00');
    expect(s(f.trading.grossProfit)).toBe('89500.00');
  });
  it('P&L: provisions work out as 5% × 38,000 = 1,900 and 2% × 36,100 = 722; net profit 49,428', () => {
    // expenses: salaries 18,000+2,000 = 20,000 ; rent 12,000−1,000 = 11,000 ; bad debts 1,000+2,000 = 3,000 ; depreciation 3,000 ;
    //           discount provision 722 ; interest on capital 5% × 49,000 = 2,450  ⇒ 40,172.   PDD falls 2,000 → 1,900 ⇒ income 100.
    // net profit = 89,500 + 100 − 40,172 = 49,428
    const f = finalAccounts(tb, adjs);
    const label = (rows: readonly { label: string; amount: Money }[], l: string) => rows.find(r => r.label.startsWith(l))?.amount.toString();
    expect(label(f.profitLoss.debit, 'Provision for Discount')).toBe('722.00');
    expect(label(f.profitLoss.credit, 'Provision for Doubtful Debts (reduction)')).toBe('100.00');
    expect(label(f.profitLoss.debit, 'Salaries')).toBe('20000.00');
    expect(label(f.profitLoss.debit, 'Rent')).toBe('11000.00');
    expect(s(f.profitLoss.netProfit)).toBe('49428.00');
  });
  it('Balance Sheet: capital 49,000 + 49,428 + 2,450 − 8,000 − 1,500 = 91,378; both sides ₹1,23,378', () => {
    // assets: furniture 27,000 + stock 30,000 + debtors (38,000 − 1,900 − 722 = 35,378) + cash 5,000 + bank 25,000 + prepaid rent 1,000 = 1,23,378
    const f = finalAccounts(tb, adjs);
    expect(s(f.balanceSheet.liabilities[0]!.amount)).toBe('91378.00');
    expect(s(f.balanceSheet.totalLiabilities)).toBe('123378.00');
    expect(s(f.balanceSheet.totalAssets)).toBe('123378.00');
    expect(f.balanceSheet.balanced).toBe(true);
    expect(f.balanceSheet.assets.find(r => r.label.startsWith('Debtors'))!.amount.toString()).toBe('35378.00');
  });
  it('abnormal loss and manager\'s commission (hand-worked)', () => {
    const tb2: TbLine[] = [
      D('Opening Stock', 'OPENING_STOCK', '10000'), D('Purchases', 'PURCHASES', '60000'), D('General expenses', 'INDIRECT_EXPENSE', '10000'), D('Cash', 'CURRENT_ASSET', '90000'),
      C('Sales', 'SALES', '100000'), C('Capital', 'CAPITAL', '70000'),
    ];
    // Trading Cr: sales 1,00,000 + closing 15,000 + goods lost 5,000 = 1,20,000 ; Dr 70,000 ⇒ GP 50,000
    // P&L: expenses 10,000 + abnormal loss (5,000 − claim 3,000) 2,000 ⇒ profit before commission 38,000
    const base: Adjustment[] = [{ type: 'CLOSING_STOCK', amount: M('15000') }, { type: 'ABNORMAL_LOSS', amount: M('5000'), insuranceClaim: M('3000') }];
    const before = finalAccounts(tb2, [...base, { type: 'MANAGER_COMMISSION', ratePercent: 10n, basis: 'BEFORE' }]);
    expect(s(before.trading.grossProfit)).toBe('50000.00');
    expect(s(before.profitLoss.netProfitBeforeCommission)).toBe('38000.00');
    expect(s(before.profitLoss.netProfit)).toBe('34200.00');                                   // commission 3,800
    expect(before.balanceSheet.balanced).toBe(true);
    expect(s(before.balanceSheet.totalAssets)).toBe('108000.00');                              // cash 90,000 + stock 15,000 + claim 3,000
    const after = finalAccounts(tb2, [...base, { type: 'MANAGER_COMMISSION', ratePercent: 10n, basis: 'AFTER' }]);
    expect(s(after.profitLoss.netProfit)).toBe('34545.45');                                    // commission 38,000 × 10/110 = 3,454.55
    expect(after.balanceSheet.balanced).toBe(true);
  });
  it('a reduction in provision flows to the credit side, an increase to the debit side', () => {
    const t: TbLine[] = [D('Debtors', 'DEBTORS', '1000'), D('Cash', 'CURRENT_ASSET', '9000'), C('Provision for doubtful debts', 'PROVISION_DOUBTFUL', '100'), C('Capital', 'CAPITAL', '9900')];
    expect(finalAccounts(t, [{ type: 'PROVISION_DOUBTFUL', ratePercent: 5n }]).profitLoss.debit.some(r => r.label.includes('increase'))).toBe(false);   // 50 < 100 ⇒ reduction
    expect(finalAccounts(t, [{ type: 'PROVISION_DOUBTFUL', ratePercent: 20n }]).profitLoss.debit.some(r => r.label.includes('increase'))).toBe(true);    // 200 > 100
  });
  it('rejects a trial balance that does not tally, and adjustments that name unknown accounts', () => {
    expect(() => finalAccounts([D('Cash', 'CURRENT_ASSET', '100'), C('Capital', 'CAPITAL', '99')], [])).toThrow(FinalAccountsError);
    expect(() => finalAccounts(tb, [{ type: 'OUTSTANDING', account: 'Ghost', amount: M('1') }])).toThrow(/not in the trial balance/);
    expect(() => finalAccounts(tb, [{ type: 'DEPRECIATION', asset: 'Cash', amount: M('1') }])).toThrow(FinalAccountsError);
  });
  it('property: the balance sheet balances whenever the trial balance tallies (any closing stock / outstanding / prepaid)', () => {
    let seed = 99; const rnd = (n: number) => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
    for (let i = 0; i < 200; i++) {
      const adj: Adjustment[] = [
        { type: 'CLOSING_STOCK', amount: Money.fromPaise(rnd(5_000_000)) },
        { type: 'OUTSTANDING', account: 'Salaries', amount: Money.fromPaise(rnd(500_000)) },
        { type: 'PREPAID', account: 'Rent', amount: Money.fromPaise(rnd(500_000)) },
        { type: 'DEPRECIATION', asset: 'Furniture', amount: Money.fromPaise(rnd(300_000)) },
        { type: 'PROVISION_DOUBTFUL', ratePercent: BigInt(rnd(10)) },
        { type: 'PROVISION_DISCOUNT', ratePercent: BigInt(rnd(5)) },
        { type: 'INTEREST_ON_CAPITAL', ratePercent: BigInt(rnd(12)) },
        { type: 'MANAGER_COMMISSION', ratePercent: BigInt(1 + rnd(10)), basis: rnd(2) ? 'BEFORE' : 'AFTER' },
      ];
      expect(finalAccounts(tb, adj).balanceSheet.balanced, JSON.stringify(adj, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).toBe(true);
    }
  });
});
