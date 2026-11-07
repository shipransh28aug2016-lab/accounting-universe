import { describe, expect, it } from 'vitest';
import { ExtrasError, Fraction, Money, actDefaults, balanceSheet, callsInAdvance, cashBook, isBalanced, loanSchedule, openingEntry, partnerAccounts, provisionDoubtful, reserveTransfer, revaluation, statementOfProfitAndLoss, subsidiaryBooks } from '../src';
const M = (s: string) => Money.parse(s); const s = (m: Money) => m.toString();
const F = (n: number, d = 1) => Fraction.of(n, d);

describe('calls in advance', () => {
  it('1,000 shares × ₹2 = ₹2,000 received, then adjusted to the call when due (no interest)', () => {
    const r = callsInAdvance({ shares: 1000n, advancePerShare: M('2') });
    expect(s(r.received)).toBe('2000.00');
    expect(r.entries.every(isBalanced)).toBe(true);
    expect(r.entries[1]!.lines.map(l => `${l.side} ${l.account}`)).toEqual(['DR Calls in Advance A/c', 'CR Share Final Call A/c']);
  });
});

describe('cash book', () => {
  it('opening cash 10,000 / bank 20,000; sale 5,000 cash; deposit 8,000; cheque paid 12,000; withdrawal 1,000 ⇒ cash 6,000, bank 17,000', () => {
    // cash: 10,000 + 5,000 − 8,000 + 1,000 = 8,000 ;  bank: 20,000 + 8,000 − 12,000 − 1,000 = 15,000
    const r = cashBook({ cash: M('10000'), bank: M('20000') }, [
      { particulars: 'Sales', kind: 'RECEIPT_CASH', amount: M('5000') }, { particulars: 'Cash deposited', kind: 'DEPOSIT', amount: M('8000') },
      { particulars: 'Rent by cheque', kind: 'PAYMENT_BANK', amount: M('12000') }, { particulars: 'Cash drawn', kind: 'WITHDRAWAL', amount: M('1000') },
    ]);
    expect([s(r.closingCash), s(r.closingBank)]).toEqual(['8000.00', '15000.00']);
    expect(r.rows[1]!.contra).toBe(true);
    // both sides of each column foot to the same total
    expect(s(r.totalCashDr)).toBe(s(r.totalCashCr)); expect(s(r.totalBankDr)).toBe(s(r.totalBankCr));
    expect(s(r.totalCashDr)).toBe('16000.00');           // 10,000 + 5,000 + 1,000
    expect(s(r.totalBankDr)).toBe('28000.00');           // 20,000 + 8,000
  });
  it('overdraft: bank 1,000 pays 3,000 by cheque ⇒ bank −2,000 and the columns still foot', () => {
    const r = cashBook({ cash: M('0'), bank: M('1000') }, [{ particulars: 'Supplier', kind: 'PAYMENT_BANK', amount: M('3000') }]);
    expect(s(r.closingBank)).toBe('-2000.00'); expect(r.overdraft).toBe(true);
    expect(s(r.totalBankDr)).toBe(s(r.totalBankCr));
  });
  it('cash cannot go negative; zero amounts are refused', () => {
    expect(() => cashBook({ cash: M('100'), bank: M('0') }, [{ particulars: 'x', kind: 'PAYMENT_CASH', amount: M('200') }])).toThrow(ExtrasError);
    expect(() => cashBook({ cash: M('100'), bank: M('0') }, [{ particulars: 'x', kind: 'RECEIPT_CASH', amount: M('0') }])).toThrow(ExtrasError);
  });
});

describe('subsidiary books with simple GST', () => {
  const books = subsidiaryBooks([
    { kind: 'PURCHASE', party: 'Ram', listPrice: M('20000'), tradeDiscountPercent: 10n, gstPercent: 18n },      // 18,000 + 3,240 = 21,240
    { kind: 'SALE', party: 'Shyam', listPrice: M('50000'), tradeDiscountPercent: 20n, freight: M('1000'), gstPercent: 12n },   // 40,000 + 1,000 = 41,000 ; GST 4,920 ; total 45,920
    { kind: 'PURCHASE_RETURN', party: 'Ram', listPrice: M('2000'), tradeDiscountPercent: 10n, gstPercent: 18n },   // 1,800 + 324
    { kind: 'SALES_RETURN', party: 'Shyam', listPrice: M('5000'), gstPercent: 12n, interState: true },             // 5,000 + IGST 600
  ]);
  it('hand-worked totals', () => {
    expect([s(books.netPurchases), s(books.netSales)]).toEqual(['16200.00', '36000.00']);               // 18,000−1,800 ; 41,000−5,000
    expect([s(books.inputGst), s(books.outputGst), s(books.gstPayable)]).toEqual(['2916.00', '4320.00', '1404.00']);   // 3,240−324 ; 4,920−600 ; 4,320−2,916
  });
  it('every generated entry balances', () => {
    for (const k of ['PURCHASE', 'SALE', 'PURCHASE_RETURN', 'SALES_RETURN'] as const) for (const r of books.rows[k]) expect(isBalanced(r.entry)).toBe(true);
  });
  it('rejects bad lines', () => { expect(() => subsidiaryBooks([{ kind: 'SALE', party: 'x', listPrice: M('0'), gstPercent: 5n }])).toThrow(ExtrasError); });
});

describe('provision for doubtful debts and discount', () => {
  it('debtors 1,00,000; further bad debts 5,000; PDD 5 % ⇒ 4,750; discount 2 % of (95,000 − 4,750) = 1,805; old PDD 3,000, old discount 1,000', () => {
    const r = provisionDoubtful({ debtors: M('100000'), badDebtsInBooks: M('2000'), additionalBadDebts: M('5000'), pddPercent: 5n, discountPercent: 2n, oldPdd: M('3000'), oldDiscount: M('1000') });
    expect([s(r.newPdd), s(r.newDiscount), s(r.netDebtors)]).toEqual(['4750.00', '1805.00', '88445.00']);
    expect([s(r.badDebtsExpense), s(r.pddCharge), s(r.discountCharge), s(r.totalCharge)]).toEqual(['7000.00', '1750.00', '805.00', '9555.00']);
    expect(r.entries.every(isBalanced)).toBe(true);
  });
  it('a reduction credits the P&L, and recovered bad debts reduce the charge', () => {
    const r = provisionDoubtful({ debtors: M('50000'), pddPercent: 2n, oldPdd: M('3000'), badDebtsRecovered: M('500') });
    expect(s(r.pddCharge)).toBe('-2000.00'); expect(s(r.totalCharge)).toBe('-2500.00');
    expect(r.entries[0]!.lines.map(l => `${l.side} ${l.account}`)).toEqual(['DR Provision for Doubtful Debts A/c', 'CR Profit and Loss A/c']);
  });
  it('no new rate keeps the old provision; impossible bad debts refused', () => {
    expect(s(provisionDoubtful({ debtors: M('1000'), oldPdd: M('40') }).pddCharge)).toBe('0.00');
    expect(() => provisionDoubtful({ debtors: M('100'), additionalBadDebts: M('200') })).toThrow(ExtrasError);
  });
  it('reserve transfer entry balances', () => { expect(isBalanced(reserveTransfer('GENERAL', M('10000')))).toBe(true); expect(() => reserveTransfer('GENERAL', M('0'))).toThrow(ExtrasError); });
});

describe('opening entry', () => {
  it('assets 3,00,000 − liabilities 80,000 ⇒ capital 2,20,000 (balancing figure) and the entry balances', () => {
    const r = openingEntry({ assets: [{ name: 'Cash', amount: M('50000') }, { name: 'Stock', amount: M('250000') }], liabilities: [{ name: 'Creditors', amount: M('80000') }] });
    expect(s(r.capital)).toBe('220000.00'); expect(isBalanced(r.entry)).toBe(true);
  });
  it('liabilities above assets ⇒ capital deficiency is debited, entry still balances', () => {
    const r = openingEntry({ assets: [{ name: 'Cash', amount: M('1000') }], liabilities: [{ name: 'Loan', amount: M('3000') }] });
    expect(s(r.capital)).toBe('-2000.00'); expect(isBalanced(r.entry)).toBe(true);
  });
});

describe('loan schedule (EMI) — exact', () => {
  it('₹1,00,000 at 12 % for 12 months ⇒ EMI ₹8,884.88 (standard result), balance clears to exactly zero', () => {
    const r = loanSchedule({ principal: M('100000'), ratePercent: F(12), months: 12 });
    expect(s(r.emi)).toBe('8884.88');
    expect(s(r.rows[0]!.interest)).toBe('1000.00');                 // 1% of 1,00,000
    expect(s(r.rows[0]!.principal)).toBe('7884.88');
    expect(s(r.rows.at(-1)!.closing)).toBe('0.00');
    expect(s(Money.sum(r.rows.map(x => x.principal)))).toBe('100000.00');
    expect(s(r.totalPaid)).toBe(s(r.totalInterest.add(M('100000'))));
    expect(Math.abs(Number(r.rows.at(-1)!.payment.paise - r.emi.paise))).toBeLessThan(12);     // last instalment differs from EMI only by rounding dust
  });
  it('0 % interest = equal principal; fractional rate 8.5 % accepted; bad input refused', () => {
    const z = loanSchedule({ principal: M('1200'), ratePercent: F(0), months: 12 });
    expect(s(z.emi)).toBe('100.00'); expect(s(z.totalInterest)).toBe('0.00');
    expect(s(loanSchedule({ principal: M('500000'), ratePercent: F(17, 2), months: 60 }).rows.at(-1)!.closing)).toBe('0.00');
    expect(() => loanSchedule({ principal: M('0'), ratePercent: F(5), months: 5 })).toThrow(ExtrasError);
    expect(() => loanSchedule({ principal: M('100'), ratePercent: F(5), months: 0 })).toThrow(ExtrasError);
  });
});

describe('Schedule III totals', () => {
  it('balance sheet foots and reports working capital / capital employed', () => {
    const b = balanceSheet({ shareCapital: M('500000'), reservesAndSurplus: M('100000'), longTermBorrowings: M('200000'), tradePayables: M('80000'), shortTermProvisions: M('20000'),
      tangibleAssets: M('600000'), inventories: M('150000'), tradeReceivables: M('100000'), cashAndEquivalents: M('50000') });
    expect([s(b.totalEquityAndLiabilities), s(b.totalAssets), b.balanced]).toEqual(['900000.00', '900000.00', true]);
    expect([s(b.workingCapital), s(b.capitalEmployed)]).toEqual(['200000.00', '800000.00']);   // 300,000 − 100,000 ; 600,000 + 200,000
  });
  it('detects a balance sheet that does not balance', () => {
    const b = balanceSheet({ shareCapital: M('100'), tangibleAssets: M('150') });
    expect(b.balanced).toBe(false); expect(s(b.difference)).toBe('50.00');
  });
  it('P&L: revenue 10,00,000 + other 20,000; materials 4,00,000; stock 50,000 → 70,000; staff 1,50,000; finance 30,000; depreciation 50,000; other 80,000; tax 30 %', () => {
    // expenses: 400,000 + (50,000 − 70,000 = −20,000) + 150,000 + 30,000 + 50,000 + 80,000 = 690,000 ; PBT 330,000 ; tax 99,000 ; PAT 231,000
    const p = statementOfProfitAndLoss({ revenueFromOperations: M('1000000'), otherIncome: M('20000'), costOfMaterialsConsumed: M('400000'), openingInventory: M('50000'), closingInventory: M('70000'), employeeBenefits: M('150000'), financeCosts: M('30000'), depreciation: M('50000'), otherExpenses: M('80000'), taxRatePercent: 30n });
    expect([s(p.totalExpenses), s(p.profitBeforeTax), s(p.tax), s(p.profitAfterTax)]).toEqual(['690000.00', '330000.00', '99000.00', '231000.00']);
  });
  it('no tax on a loss', () => { expect(s(statementOfProfitAndLoss({ revenueFromOperations: M('100'), otherExpenses: M('300'), taxRatePercent: 30n }).tax)).toBe('0.00'); });
});

describe('fixed vs fluctuating capital', () => {
  const p = { id: 'A', openingCapital: M('100000'), drawings: M('10000'), interestOnCapital: M('5000'), interestOnDrawings: M('300'), salary: M('12000'), profitShare: M('20000') };
  it('fluctuating: everything flows through capital = 1,00,000 + 5,000 + 12,000 + 20,000 − 10,000 − 300 = 1,26,700', () => {
    const r = partnerAccounts('FLUCTUATING', [p])[0]!;
    expect(s(r.capital)).toBe('126700.00'); expect(r.current).toBeNull();
  });
  it('fixed: capital stays 1,00,000; current account = 37,000 − 10,300 = 26,700; the two methods agree in total', () => {
    const r = partnerAccounts('FIXED', [{ ...p, openingCurrent: M('0') }])[0]!;
    expect([s(r.capital), s(r.current!)]).toEqual(['100000.00', '26700.00']);
    expect(s(r.capital.add(r.current!))).toBe('126700.00');
  });
});

describe('revaluation', () => {
  it('stock −5,000, furniture +12,000, creditors written back −3,000 (liability down = gain) ⇒ profit 10,000; 3:2 ⇒ 6,000 / 4,000', () => {
    const r = revaluation([
      { name: 'Stock', kind: 'ASSET', before: M('40000'), after: M('35000') }, { name: 'Furniture', kind: 'ASSET', before: M('20000'), after: M('32000') },
      { name: 'Creditors', kind: 'LIABILITY', before: M('30000'), after: M('27000') }], { A: F(3, 5), B: F(2, 5) });
    expect(s(r.profit)).toBe('10000.00'); expect([s(r.partnerShare.A!), s(r.partnerShare.B!)]).toEqual(['6000.00', '4000.00']);
    expect(r.entries.every(isBalanced)).toBe(true);
    const first = r.entries[0]!;
    expect(first.lines.find(l => l.account === 'Revaluation A/c' && l.side === 'DR')!.amount.toString()).toBe('5000.00');
    expect(first.lines.find(l => l.account === 'Revaluation A/c' && l.side === 'CR')!.amount.toString()).toBe('15000.00');
  });
  it('a net loss is debited to the partners', () => {
    const r = revaluation([{ name: 'Machinery', kind: 'ASSET', before: M('50000'), after: M('44000') }, { name: 'Outstanding rent', kind: 'LIABILITY', before: M('0'), after: M('1000') }], { A: F(1, 2), B: F(1, 2) });
    expect(s(r.profit)).toBe('-7000.00'); expect(s(r.partnerShare.A!)).toBe('-3500.00');
    expect(r.entries[1]!.lines.filter(l => l.side === 'DR').map(l => l.account)).toEqual(["A's Capital A/c", "B's Capital A/c"]);
    expect(r.entries.every(isBalanced)).toBe(true);
  });
});

describe('Partnership Act 1932 defaults', () => {
  it('no deed: profit 90,000 shared equally by 3; partner C lent ₹50,000 for 12 months ⇒ interest ₹3,000 charged first ⇒ 87,000 ÷ 3 = 29,000 each', () => {
    const r = actDefaults({ netProfit: M('90000'), partners: ['A', 'B', 'C'], loans: [{ partner: 'C', amount: M('50000'), months: 12 }] });
    expect(s(r.loanInterest.C!)).toBe('3000.00'); expect(Object.values(r.shares).map(s)).toEqual(['29000.00', '29000.00', '29000.00']);
  });
  it('indivisible profit never loses a paisa; losses are shared equally too', () => {
    expect(s(Money.sum(Object.values(actDefaults({ netProfit: M('100'), partners: ['A', 'B', 'C'] }).shares)))).toBe('100.00');
    expect(Object.values(actDefaults({ netProfit: M('-6000'), partners: ['A', 'B'] }).shares).map(s)).toEqual(['-3000.00', '-3000.00']);
  });
});
