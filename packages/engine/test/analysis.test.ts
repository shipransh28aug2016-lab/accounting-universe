import { describe, expect, it } from 'vitest';
import {
  CASH_FLOW_CLASSIFICATION, Money, RatioError, capitalEmployed, cashFlowStatement, commonSize, comparative, costOfMaterialsConsumed, costOfRevenueFromOperations,
  currentRatio, debentureInterest, debtEquityRatio, fixedAssetRollForward, grossProfitRatio, interestCoverageRatio, inventoryTurnoverRatio, netProfitRatio,
  operatingRatio, profitAfterTax, proprietaryRatio, quickRatio, returnOnInvestment, totalAssetsToDebtRatio, workingCapitalTurnoverRatio,
} from '../src';

const M = (s: string) => Money.parse(s);
const s = (m: Money) => m.toString();

describe('ratios', () => {
  it('SQP Q27: cost of materials consumed = 10,000 + 1,60,000 − 20,000 = ₹1,50,000', () =>
    expect(s(costOfMaterialsConsumed(M('10000'), M('160000'), M('20000')))).toBe('150000.00'));

  describe('SQP Q33 B (marking scheme: current ratio 1.47 : 1, inventory turnover 44 times)', () => {
    // revenue 5,00,000; opening inventory 7,000; closing = 7,000 + 4,000 = 11,000; purchases 70% × 5,00,000 = 3,50,000;
    // direct expenses = wages 10,000 + carriage inwards 40,000
    const revenue = M('500000'), opening = M('7000'), closing = M('11000');
    const purchases = revenue.mulRatio(70n, 100n, 'HALF_UP');
    const cost = costOfRevenueFromOperations({ openingInventory: opening, purchases, directExpenses: M('10000').add(M('40000')), closingInventory: closing });
    it('cost of revenue 3,96,000', () => expect(s(cost)).toBe('396000.00'));
    it('current ratio = (75,000 + 11,000 + 2,000) ÷ 60,000 = 1.47 : 1', () => {
      const r = currentRatio(M('75000').add(closing).add(M('2000')), M('60000'));
      expect(r.display).toBe('1.47 : 1');
      expect(r.working).toContain('₹88,000.00');
      expect(r.reading).toMatch(/1\.47/);
    });
    it('inventory turnover = 3,96,000 ÷ average (7,000, 11,000 = 9,000) = 44 times', () => {
      const r = inventoryTurnoverRatio(cost, opening, closing);
      expect(r.display).toBe('44.00 times');
      expect(r.reading).toMatch(/about 8 days/);                  // 365 × 9,000 ÷ 3,96,000 = 8.3
    });
  });

  it('quick ratio excludes inventory and prepaid: (1,00,000 − 30,000 − 5,000) ÷ 50,000 = 1.30 : 1', () => expect(quickRatio(M('100000'), M('30000'), M('5000'), M('50000')).display).toBe('1.30 : 1'));
  it('solvency set (hand-worked)', () => {
    // shareholders' funds 8,00,000 ; long-term debt 4,00,000 ; total assets 15,00,000 ; PBIT 1,20,000 ; interest 40,000
    expect(debtEquityRatio(M('400000'), M('800000')).display).toBe('0.50 : 1');
    expect(totalAssetsToDebtRatio(M('1500000'), M('400000')).display).toBe('3.75 : 1');
    expect(proprietaryRatio(M('800000'), M('1500000')).display).toBe('0.53 : 1');
    expect(proprietaryRatio(M('800000'), M('1500000')).reading).toContain('53%');
    expect(interestCoverageRatio(M('120000'), M('40000')).display).toBe('3.00 times');
    expect(s(capitalEmployed(M('800000'), M('400000')))).toBe('1200000.00');
  });
  it('profitability set (hand-worked)', () => {
    expect(grossProfitRatio(M('150000'), M('500000')).display).toBe('30.00%');
    expect(operatingRatio(M('350000'), M('50000'), M('500000')).display).toBe('80.00%');
    expect(netProfitRatio(M('60000'), M('500000'), 'BEFORE_TAX').display).toBe('12.00%');
    expect(netProfitRatio(M('42000'), M('500000'), 'AFTER_TAX').display).toBe('8.40%');
    expect(returnOnInvestment(M('160000'), M('1000000')).display).toBe('16.00%');
    expect(workingCapitalTurnoverRatio(M('500000'), M('125000')).display).toBe('4.00 times');
  });
  it('a ratio is never shown with a zero denominator — it says why', () => {
    expect(() => currentRatio(M('1'), M('0'))).toThrow(RatioError);
    expect(() => currentRatio(M('1'), M('0'))).toThrow(/Current liabilities/);
  });
  it('exact half-up rounding, no float drift: 2/3 → 0.67 : 1', () => expect(debtEquityRatio(M('2'), M('3')).display).toBe('0.67 : 1'));
});

describe('comparative and common-size statements', () => {
  const stmt = (rev26: string, rev25: string) => [
    { label: 'Revenue from operations', previous: M(rev25), current: M(rev26) },
    { label: 'Interest paid', previous: M('100000'), current: M('100000') },
    { label: 'Previous zero', previous: M('0'), current: M('500') },
  ];
  it('SQP Q31 A figures as printed in the marking scheme: revenue +20,00,000 = 100%; interest unchanged = 0%', () => {
    const c = comparative(stmt('4000000', '2000000'));
    expect([s(c[0]!.change), c[0]!.percentChange]).toEqual(['2000000.00', '100.00']);
    expect([s(c[1]!.change), c[1]!.percentChange]).toEqual(['0.00', '0.00']);
    expect(c[2]!.percentChange).toBeNull();                                      // no base year ⇒ no percentage
  });
  it('SQP Q31 A — net profit before tax 17,00,000 → 35,00,000 is +105.88% (18/17)', () => {
    const c = comparative([{ label: 'NPBT', previous: M('1700000'), current: M('3500000') }]);
    expect(c[0]!.percentChange).toBe('105.88');
    const t25 = profitAfterTax(M('1700000'), 50n), t26 = profitAfterTax(M('3500000'), 50n);
    expect([s(t25.tax), s(t26.profitAfterTax)]).toEqual(['850000.00', '1750000.00']);
  });
  it('DISCREPANCY WE FOUND: the marking scheme omits the Wages row printed in Q31 A — including it gives NPBT 13,00,000 → 29,00,000 (+123.08%)', () => {
    // 2025: 20,00,000 − (2,00,000 + 4,00,000 wages + 1,00,000 interest) = 13,00,000 ; 2026: 40,00,000 − (4,00,000 + 6,00,000 + 1,00,000) = 29,00,000
    const exp = (cost: string, wages: string, interest: string) => M(cost).add(M(wages)).add(M(interest));
    const p25 = M('2000000').sub(exp('200000', '400000', '100000')), p26 = M('4000000').sub(exp('400000', '600000', '100000'));
    expect([s(p25), s(p26)]).toEqual(['1300000.00', '2900000.00']);
    expect(comparative([{ label: 'NPBT', previous: p25, current: p26 }])[0]!.percentChange).toBe('123.08');
  });
  it('SQP Q31 B common-size: revenue 6,00,000; cost 4,00,000 = 66.67%; indirect expenses 25% of GP = 50,000 = 8.33%; NPAT 1,26,000 = 21%', () => {
    const revenue = M('600000'), other = M('30000'), cost = M('400000');
    const gp = revenue.sub(cost);
    const indirect = gp.mulRatio(25n, 100n, 'HALF_UP');
    const npbt = revenue.add(other).sub(cost).sub(indirect);
    const { tax, profitAfterTax: npat } = profitAfterTax(npbt, 30n);
    expect([s(indirect), s(npbt), s(tax), s(npat)]).toEqual(['50000.00', '180000.00', '54000.00', '126000.00']);
    const rows = commonSize([{ label: 'Revenue', amount: revenue }, { label: 'Other income', amount: other }, { label: 'Cost', amount: cost }, { label: 'Indirect', amount: indirect }, { label: 'NPBT', amount: npbt }, { label: 'Tax', amount: tax }, { label: 'NPAT', amount: npat }], revenue);
    expect(rows.map(r => r.percent)).toEqual(['100.00', '5.00', '66.67', '8.33', '30.00', '9.00', '21.00']);
    expect(() => commonSize([], M('0'))).toThrow(RatioError);
  });
  it('no tax on a loss', () => expect(s(profitAfterTax(M('-100'), 30n).tax)).toBe('0.00'));
});

describe('cash flow statement — SQP Q34 (Krishang Ltd.)', () => {
  // working notes, reproduced from the balance sheets (machinery 5,00,000 → 6,35,000; acc. dep. 75,000 → 1,00,000; machine cost 12,000 / dep 8,000 sold for 3,000)
  const fa = fixedAssetRollForward({ openingCost: M('500000'), closingCost: M('635000'), openingAccDep: M('75000'), closingAccDep: M('100000'), disposedCost: M('12000'), disposedAccDep: M('8000'), saleProceeds: M('3000') });
  it('roll-forward: purchases 1,47,000; depreciation 33,000; loss on sale 1,000', () => {
    expect([s(fa.purchases), s(fa.depreciationCharge), s(fa.profitOrLossOnSale)]).toEqual(['147000.00', '33000.00', '-1000.00']);
  });
  // interest on 10% debentures: 85,000 all year + 35,000 more for 6 months (issued 1 Oct)
  const interest = debentureInterest(M('85000'), 10n, 12n).add(debentureInterest(M('35000'), 10n, 6n));
  const input = {
    netProfitBeforeTaxAndExtraordinary: M('50000').add(M('25000')),               // Δ surplus 50,000 + provision for tax 25,000
    adjustments: [
      { label: 'Depreciation', amount: fa.depreciationCharge },
      { label: 'Amortisation of goodwill', amount: M('56000').sub(M('20000')) },
      { label: 'Loss on sale of machinery', amount: fa.profitOrLossOnSale.neg() },
      { label: 'Interest on debentures', amount: interest },
      { label: 'Gain on sale of land', amount: M('20000').neg() },                // sold 2,20,000 − cost 2,00,000
    ],
    workingCapitalChanges: [
      { label: 'Increase in trade receivables', amount: M('132000').sub(M('152500')) },
      { label: 'Decrease in trade payables', amount: M('89500').sub(M('102000')) },
    ],
    taxPaid: M('38500'),
    investing: [
      { label: 'Sale of machinery', amount: M('3000') }, { label: 'Purchase of machinery', amount: fa.purchases.neg() },
      { label: 'Purchase of land', amount: M('200000').neg() }, { label: 'Sale of land', amount: M('220000') },
    ],
    financing: [
      { label: 'Issue of shares', amount: M('50000') }, { label: 'Issue of 10% debentures', amount: M('35000') }, { label: 'Interest on debentures paid', amount: interest.neg() },
    ],
    openingCashEquivalents: M('187500').add(M('75000')),                          // cash + current investments (marketable securities)
    closingCashEquivalents: M('157000').add(M('120000')),
  };
  const r = cashFlowStatement(input);
  it('interest on debentures is ₹10,250', () => expect(s(interest)).toBe('10250.00'));
  it('operating: profit before working capital 1,35,250 ⇒ cash generated 1,02,250 ⇒ net operating cash 63,750 (marking scheme)', () => {
    expect([s(r.operatingProfitBeforeWorkingCapital), s(r.cashGeneratedFromOperations), s(r.cashFromOperating)]).toEqual(['135250.00', '102250.00', '63750.00']);
  });
  it('investing: net cash used 1,24,000 (marking scheme)', () => expect(s(r.cashFromInvesting)).toBe('-124000.00'));
  it('the whole statement reconciles to the balance sheet cash: opening 2,62,500 + 14,500 = closing 2,77,000', () => {
    expect(s(r.cashFromFinancing)).toBe('74750.00');
    expect(s(r.netChange)).toBe('14500.00');
    expect(s(r.closing)).toBe('277000.00');
    expect(r.reconciles).toBe(true);
  });
  it('a wrong statement is caught: leave out the land sale and it no longer reconciles', () => {
    const bad = cashFlowStatement({ ...input, investing: input.investing.filter(x => x.label !== 'Sale of land') });
    expect(bad.reconciles).toBe(false); expect(s(bad.difference!)).toBe('220000.00');
  });
  it('without a closing balance it reports null rather than pretending to reconcile', () => {
    const { closingCashEquivalents: _c, ...rest } = input;
    expect(cashFlowStatement(rest).reconciles).toBeNull();
  });
  it('classification table: current investments and non-cash purchases are NOT cash flows (SQP Q29, Q30)', () => {
    const get = (t: string) => CASH_FLOW_CLASSIFICATION.find(c => c.transaction.startsWith(t))!;
    expect(get('Purchase of marketable securities').activity).toBe('NONE');
    expect(get('Purchase of furniture by issuing shares').activity).toBe('NONE');
    expect(get('Bank overdraft').activity).toBe('FINANCING');
    expect(get('Purchase of machinery').activity).toBe('INVESTING');
  });
});
