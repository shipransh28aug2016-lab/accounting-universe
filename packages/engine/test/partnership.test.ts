import { describe, expect, it } from 'vitest';
import {
  Fraction, Money, adjustmentWithoutRecording, admission, appropriate, averageProfit, capitalAdjustment, commissionAfterCharging, dissolve,
  executorSchedule, exitSettlement, goodwillAverageProfit, goodwillCapitalisation, goodwillOnRatioChange, goodwillSuperProfit, interestPA,
  newSharesAfterExit, pastAdjustment, ratioChange,
} from '../src';

const M = (s: string) => Money.parse(s);
const f = (n: number, d = 1) => Fraction.of(n, d);
const shares = (ids: string[], w: number[]) => Object.fromEntries(ids.map((id, i) => [id, Fraction.fromRatio(w)[i]!]));
const str = (r: Record<string, Money>) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.toString()]));
const P = (...ids: string[]) => ids.map(id => ({ id, name: id }));

describe('ratio change (CBSE 2026-27 SQP Q24 I)', () => {
  // old 4:3:3 → new 3:2:5 : A 4/10→3/10 sacrifices 1/10; B 3/10→2/10 sacrifices 1/10; C 3/10→5/10 gains 2/10 = 1/5
  const old = shares(['A', 'B', 'C'], [4, 3, 3]), nw = shares(['A', 'B', 'C'], [3, 2, 5]);
  it('sacrificing and gaining', () => {
    const c = ratioChange(old, nw);
    expect(String(c.sacrifice.A)).toBe('1/10'); expect(String(c.sacrifice.B)).toBe('1/10'); expect(String(c.gain.C)).toBe('1/5');
    expect(c.gain.A).toBeUndefined();
  });
  it('goodwill ₹1,50,000: C pays ₹30,000 (Q24 III), A and B receive ₹15,000 each', () => {
    expect(str(goodwillOnRatioChange(M('150000'), ratioChange(old, nw)))).toEqual({ A: '15000.00', B: '15000.00', C: '-30000.00' });
  });
  it("C's capital works out to ₹2,22,500 (Q24 VI)", () => {
    // 2,00,000 − goodwill 30,000 + (reserve 90,000 + P&L credit 60,000)×3/10 [old ratio] 45,000 + revaluation gain 25,000×3/10 7,500
    // revaluation: land +50,000, PDD 5% of 1,00,000 = −5,000, unrecorded liability −20,000 → +25,000 (Q24 IV)
    const reval = M('50000').sub(M('5000')).sub(M('20000'));
    expect(reval.toString()).toBe('25000.00');
    const cCap = M('200000').sub(M('30000')).add(M('150000').mulRatio(3n, 10n, 'HALF_UP')).add(reval.mulRatio(3n, 10n, 'HALF_UP'));
    expect(cCap.toString()).toBe('222500.00');
  });
});

describe('change of ratio without recording (SQP Q1)', () => {
  it('₹9,000 unrecorded liability, 4:3:2 → 1:1:1: A Dr 1,000, C Cr 1,000, B nil', () => {
    const r = adjustmentWithoutRecording(M('9000'), 'loss', shares(['A', 'B', 'C'], [4, 3, 2]), shares(['A', 'B', 'C'], [1, 1, 1]));
    expect(str(r)).toEqual({ A: '-1000.00', B: '0.00', C: '1000.00' });
  });
  it('a gain is the mirror image', () => {
    const r = adjustmentWithoutRecording(M('9000'), 'gain', shares(['A', 'B', 'C'], [4, 3, 2]), shares(['A', 'B', 'C'], [1, 1, 1]));
    expect(str(r)).toEqual({ A: '1000.00', B: '0.00', C: '-1000.00' });
  });
});

describe('P&L appropriation', () => {
  it('interest on drawings, 10% p.a. on ₹80,000 for an average 6 months = ₹4,000 (SQP Q2)', () =>
    expect(interestPA(M('80000'), 10n, 6n).toString()).toBe('4000.00'));

  it('Q5: interest on partners\' loans is a charge — loss ₹2,650 before it, ₹1,900 after, shared 3:2', () => {
    // loans to R 24,000 and S 6,000 at 10% for 3 months (1 Jan–31 Mar): interest 600 + 150 = 750 INCOME to the firm
    const income = interestPA(M('24000'), 10n, 3n).add(interestPA(M('6000'), 10n, 3n));
    expect(income.toString()).toBe('750.00');
    const r = appropriate({ partners: P('R', 'S'), netProfit: M('-2650').add(income), shares: shares(['R', 'S'], [3, 2]) });
    expect(str(r.totalPerPartner)).toEqual({ R: '-1140.00', S: '-760.00' });
  });

  it('Q7 guarantee: Z guaranteed ₹50,000, profit ₹40,000 shared 4:3:3 — X and Y bear ₹19,000 each', () => {
    const r = appropriate({
      partners: P('X', 'Y', 'Z'), netProfit: M('40000'), shares: shares(['X', 'Y', 'Z'], [4, 3, 3]),
      guarantee: { partner: 'Z', minimum: M('50000'), bornBy: ['X', 'Y'], borneRatio: shares(['X', 'Y'], [1, 1]) },
    });
    expect(str(r.guaranteeBorne)).toEqual({ X: '19000.00', Y: '19000.00', Z: '-38000.00' });
    expect(str(r.totalPerPartner)).toEqual({ X: '-3000.00', Y: '-7000.00', Z: '50000.00' });   // 16,000−19,000 ; 12,000−19,000 ; 12,000+38,000
    expect(Money.sum(Object.values(r.totalPerPartner)).toString()).toBe('40000.00');
  });

  describe('Q18 salaries B ₹24,000, C ₹16,000, D ₹16,000 (total ₹56,000), equal sharing', () => {
    const salary = { B: M('24000'), C: M('16000'), D: M('16000') };
    const run = (np: string) => appropriate({ partners: P('B', 'C', 'D'), netProfit: M(np), shares: shares(['B', 'C', 'D'], [1, 1, 1]), salary });
    it('Case 1: profit ₹72,000 − ₹10,000 employee salary = 62,000 → salaries then ₹2,000 each', () => {
      const r = run('62000');
      expect(str(r.totalPerPartner)).toEqual({ B: '26000.00', C: '18000.00', D: '18000.00' });
      expect(r.scaledDown).toBe(false);
    });
    it('Case 2: profit 35,000 < salaries → shared 3:2:2 = 15,000 / 10,000 / 10,000', () => {
      const r = run('35000');
      expect(str(r.totalPerPartner)).toEqual({ B: '15000.00', C: '10000.00', D: '10000.00' });
      expect(r.scaledDown).toBe(true);
    });
    it('Case 3: loss 30,000 → no salary, loss shared equally ₹10,000 each', () => {
      const r = run('-30000');
      expect(str(r.totalPerPartner)).toEqual({ B: '-10000.00', C: '-10000.00', D: '-10000.00' });
    });
  });

  it('Q22A: commission 10% of profit AFTER charging it = ₹10,000; adjusting entry D Dr 2,000, A Dr 3,000, S Cr 5,000', () => {
    expect(commissionAfterCharging(M('110000'), 10n).toString()).toBe('10000.00');
    // correct: S 50,000 + commission 10,000 = 60,000; D 20,000; A 30,000.   wrongly credited: 55,000 / 22,000 / 33,000
    const r = pastAdjustment({ S: M('60000'), D: M('20000'), A: M('30000') }, { S: M('55000'), D: M('22000'), A: M('33000') });
    expect(str(r)).toEqual({ S: '5000.00', D: '-2000.00', A: '-3000.00' });
    // and the engine reproduces the 'correct' column on its own
    const a = appropriate({ partners: P('S', 'D', 'A'), netProfit: M('110000'), shares: shares(['S', 'D', 'A'], [5, 2, 3]), commission: { S: M('10000') } });
    expect(str(a.totalPerPartner)).toEqual({ S: '60000.00', D: '20000.00', A: '30000.00' });
  });

  it('interest on capital + drawings + salary together (hand-worked)', () => {
    // A 1,00,000 & B 60,000 @10% ⇒ 10,000 & 6,000.  B's salary 12,000.  A draws 20,000 (avg 6 months @6% ⇒ 600).
    // Profit 1,00,000 + 600 (interest charged on drawings) = 1,00,600; less 10,000 − 6,000 − 12,000 = 72,600; shared 3:2 ⇒ 43,560 / 29,040.
    // A: 10,000 + 43,560 − 600 = 52,960.   B: 6,000 + 12,000 + 29,040 = 47,040.   Sum = 1,00,000.
    const r = appropriate({
      partners: P('A', 'B'), netProfit: M('100000'), shares: shares(['A', 'B'], [3, 2]),
      interestOnCapital: { ratePercent: 10n, capital: { A: M('100000'), B: M('60000') } },
      interestOnDrawings: { ratePercent: 6n, drawings: { A: M('20000'), B: M('0') } },
      salary: { B: M('12000') },
    });
    expect(r.residual.toString()).toBe('72600.00');
    expect(str(r.totalPerPartner)).toEqual({ A: '52960.00', B: '47040.00' });
    expect(Money.sum(Object.values(r.totalPerPartner)).toString()).toBe('100000.00');
  });
});

describe('goodwill valuation', () => {
  it('Q20: five-year average of adjusted profits × 3 = ₹49,80,000', () => {
    const adj = [
      M('-100000'), M('3000000'), M('1600000'),
      M('1750000').add(M('300000')).sub(M('70000')),     // 2025: fire loss 3,00,000 less claim 70,000 is abnormal ⇒ add back net 2,30,000
      M('1850000').sub(M('80000')).add(M('50000')),      // 2026: scrap sale gain removed, wages debited twice added back
    ];
    expect(adj[3]!.toString()).toBe('1980000.00'); expect(adj[4]!.toString()).toBe('1820000.00');
    expect(Money.sum(adj).toString()).toBe('8300000.00');
    const avg = averageProfit(adj);
    expect(avg.toString()).toBe('1660000.00');
    expect(goodwillAverageProfit(avg, 3n).toString()).toBe('4980000.00');
  });
  it('weighted average (hand-worked: 1×10,000 + 2×20,000 + 3×30,000 = 1,40,000 ÷ 6 = 23,333.33)', () =>
    expect(averageProfit([M('10000'), M('20000'), M('30000')], [1n, 2n, 3n]).toString()).toBe('23333.33'));
  it('super profit: avg 1,20,000, capital employed 8,00,000 @10% ⇒ normal 80,000, super 40,000 × 3 = 1,20,000', () => {
    const g = goodwillSuperProfit(M('120000'), M('800000'), 10n, 3n);
    expect(str({ n: g.normalProfit, s: g.superProfit, g: g.goodwill })).toEqual({ n: '80000.00', s: '40000.00', g: '120000.00' });
  });
  it('no super profit ⇒ goodwill is nil, never negative', () =>
    expect(goodwillSuperProfit(M('50000'), M('800000'), 10n, 3n).goodwill.toString()).toBe('0.00'));
  it('capitalisation: avg 60,000 @12% ⇒ 5,00,000; net assets 4,00,000 ⇒ goodwill 1,00,000', () => {
    const g = goodwillCapitalisation(M('60000'), 12n, M('400000'));
    expect(g.capitalisedValue.toString()).toBe('500000.00'); expect(g.goodwill.toString()).toBe('100000.00');
  });
});

describe('admission', () => {
  it('Q9: Kavita 1/5 brings ₹3,00,000 incl. ₹30,000 goodwill ⇒ Savita\'s adjusted capital ₹4,32,000', () => {
    const newShares = { R: Fraction.of(12, 25), S: Fraction.of(8, 25), K: Fraction.of(1, 5) };
    const r = capitalAdjustment(newShares, { R: M('0'), S: M('0'), K: M('270000') }, { partner: 'K', capital: M('270000') });
    expect(r.required.S!.toString()).toBe('432000.00');     // 13,50,000 × 8/25
    expect(r.required.R!.toString()).toBe('648000.00');
    const a = admission({
      partners: P('R', 'S'), oldShares: shares(['R', 'S'], [3, 2]), capitals: { R: M('0'), S: M('0') },
      newPartner: { id: 'K', name: 'K', share: f(1, 5) },
    });
    expect(String(a.newShares.R)).toBe('12/25'); expect(String(a.newShares.S)).toBe('8/25');
  });

  it('Q25A: X:Y = 1:2, Z for 1/4 — premium 15,000; adjusted capitals 1,44,000 / 2,88,000; Z brings 1,08,000', () => {
    const r = admission({
      partners: P('X', 'Y'), oldShares: shares(['X', 'Y'], [1, 2]),
      capitals: { X: M('150000'), Y: M('300000') },
      newPartner: { id: 'Z', name: 'Z', share: f(1, 4) },
      goodwillOfFirm: M('60000'),                    // Z's premium = 1/4 × 60,000 = 15,000
      revaluation: M('-36000'),                      // 4,500 bad debts + 3,000 PDD + 5,000 patents + 20,000 stock + 3,500 liability
      reserves: M('6000'), accumulatedLosses: M('3000'),
      newPartnerCapitalFractionOfOld: f(1, 4),       // "equal to 1/4th of the combined capital of X and Y"
    });
    expect(r.premium.toString()).toBe('15000.00');
    expect(str(r.premiumShare)).toEqual({ X: '5000.00', Y: '10000.00' });
    expect(str(r.adjustedCapital)).toEqual({ X: '144000.00', Y: '288000.00' });
    expect(r.newPartnerCapital.toString()).toBe('108000.00');
  });
  it('default capital rule: old partners hold 5,00,000 for 4/5, so C (1/5) brings 5,00,000 × (1/5)/(4/5) = 1,25,000 and total 6,25,000 = 5 × 1,25,000', () => {
    const r = admission({
      partners: P('A', 'B'), oldShares: shares(['A', 'B'], [3, 2]), capitals: { A: M('300000'), B: M('200000') }, newPartner: { id: 'C', name: 'C', share: f(1, 5) },
    });
    expect(r.newPartnerCapital.toString()).toBe('125000.00');
    expect(r.firmCapital.toString()).toBe('625000.00');
    expect(String(r.newShares.A)).toBe('12/25');                     // 3/5 × 4/5
  });
  it('rejects a sacrifice that does not leave shares adding to 1', () => {
    expect(() => admission({
      partners: P('X', 'Y'), oldShares: shares(['X', 'Y'], [1, 1]), capitals: { X: M('0'), Y: M('0') },
      newPartner: { id: 'Z', name: 'Z', share: f(1, 4) }, sacrifice: { X: f(1, 8), Y: f(1, 4) },
    })).toThrow(RangeError);
  });
});

describe('retirement / death', () => {
  it('Q6: A dies; goodwill 2 years\' purchase of avg profit 3,58,000 = 7,16,000; A\'s share 5/10 = 3,58,000 paid by B and C in 3:2 ⇒ 2,14,800 / 1,43,200', () => {
    const old = shares(['A', 'B', 'C'], [5, 3, 2]);
    const avg = averageProfit([M('328000'), M('346000'), M('400000')]);
    expect(avg.toString()).toBe('358000.00');
    const gw = goodwillAverageProfit(avg, 2n);
    const nw: Record<string, Fraction> = { ...newSharesAfterExit(old, 'A'), A: Fraction.ZERO };
    expect(String(nw.B)).toBe('3/5'); expect(String(nw.C)).toBe('2/5');
    const r = exitSettlement({ oldShares: old, newShares: nw, exiting: 'A', capitals: { A: M('0'), B: M('0'), C: M('0') }, goodwillOfFirm: gw });
    expect(str(r.goodwillCompensation)).toEqual({ A: '358000.00', B: '-214800.00', C: '-143200.00' });
  });

  it('hand-worked retirement: A,B,C 2:2:1, C retires; goodwill 45,000; reserve 10,000; revaluation loss 2,000', () => {
    // C's share of goodwill 1/5 × 45,000 = 9,000, paid by A and B equally (gaining ratio 1:1) ⇒ 4,500 each
    // reserve 10,000 old ratio: A 4,000 B 4,000 C 2,000.   revaluation −2,000: A −800 B −800 C −400
    // capitals 92,000 / 60,000 / 40,000 ⇒ A 92,000−4,500+4,000−800 = 90,700 ; B 60,000−4,500+4,000−800 = 58,700 ; C 40,000+9,000+2,000−400 = 50,600
    const old = shares(['A', 'B', 'C'], [2, 2, 1]);
    const r = exitSettlement({
      oldShares: old, newShares: { A: f(1, 2), B: f(1, 2), C: Fraction.ZERO }, exiting: 'C',
      capitals: { A: M('92000'), B: M('60000'), C: M('40000') }, goodwillOfFirm: M('45000'), reserves: M('10000'), revaluation: M('-2000'),
    });
    expect(str(r.closingCapital)).toEqual({ A: '90700.00', B: '58700.00', C: '50600.00' });
    expect(r.amountDue.toString()).toBe('50600.00');
    expect(Money.sum(Object.values(r.closingCapital)).toString()).toBe('200000.00');   // 1,92,000 + 10,000 − 2,000
  });

  it('existing goodwill is written off in the old ratio first', () => {
    const r = exitSettlement({
      oldShares: shares(['A', 'B', 'C'], [2, 2, 1]), newShares: { A: f(1, 2), B: f(1, 2), C: Fraction.ZERO }, exiting: 'C',
      capitals: { A: M('0'), B: M('0'), C: M('0') }, goodwillOfFirm: M('0'), existingGoodwill: M('10000'),
    });
    expect(str(r.closingCapital)).toEqual({ A: '-4000.00', B: '-4000.00', C: '-2000.00' });
  });

  it('Q22B executor\'s account: ₹3,22,000 due, ₹22,000 now, 3 instalments @10% — interest 17,500 / 20,000 / 10,000', () => {
    const s = executorSchedule({ amountDue: M('322000'), paidNow: M('22000'), instalments: 3, ratePercent: 10n, firstMonths: 7n, labels: ['31-08-23', '31-03-24', '31-03-25', '31-03-26'] });
    const interest = s.rows.filter(r => r.particulars === 'By interest').map(r => r.credit.toString());
    expect(interest).toEqual(['17500.00', '20000.00', '10000.00']);
    const paid = s.rows.filter(r => r.particulars.startsWith('To bank (instalment')).map(r => r.debit.toString());
    expect(paid).toEqual(['117500.00', '120000.00', '110000.00']);
    expect(s.interestTotal.toString()).toBe('47500.00');
    expect(s.paidInTotal.toString()).toBe('369500.00');          // 3,22,000 + 47,500
  });
});

describe('dissolution (realisation account)', () => {
  // A:B 3:2, capitals 80,000 / 60,000, GR 20,000, creditors 30,000;
  // assets: debtors 40,000 (→35,000) stock 50,000 (→45,000) machinery 80,000 (→70,000) goodwill 10,000 (→5,000), cash 10,000.
  const base = {
    partners: P('A', 'B'), shares: shares(['A', 'B'], [3, 2]), capitals: { A: M('80000'), B: M('60000') }, reserves: M('20000'),
    assets: [
      { name: 'Debtors', book: M('40000'), realised: M('35000'), tangible: true },
      { name: 'Stock', book: M('50000'), realised: M('45000'), tangible: true },
      { name: 'Machinery', book: M('80000'), realised: M('70000'), tangible: true },
      { name: 'Goodwill', book: M('10000'), realised: M('5000'), tangible: false },
    ],
    liabilities: [{ name: 'Creditors', book: M('30000') }],
  };

  it('loss on realisation 28,000 (Dr 2,13,000 vs Cr 1,85,000) → A 16,800 / B 11,200; cash ends at exactly nil', () => {
    const r = dissolve({ ...base, cashAtStart: M('10000'), expenses: [{ amount: M('3000'), paidBy: 'FIRM', borneBy: 'FIRM' }] });
    expect(r.realisationDebit.toString()).toBe('213000.00');
    expect(r.realisationCredit.toString()).toBe('185000.00');
    expect(r.profitOnRealisation.toString()).toBe('-28000.00');
    expect(str(r.profitShare)).toEqual({ A: '-16800.00', B: '-11200.00' });
    expect(str(r.finalCapital)).toEqual({ A: '75200.00', B: '56800.00' });      // 80,000+12,000−16,800 ; 60,000+8,000−11,200
    expect(r.cashEnd.toString()).toBe('0.00');
  });

  it('partner\'s loan repaid with capital; expense paid by B but borne by the firm credits B', () => {
    const r = dissolve({
      ...base, cashAtStart: M('20000'), partnerLoans: { A: M('10000') },
      expenses: [{ amount: M('3000'), paidBy: 'FIRM', borneBy: 'FIRM' }, { amount: M('2000'), paidBy: 'B', borneBy: 'FIRM' }],
    });
    expect(r.profitOnRealisation.toString()).toBe('-30000.00');
    expect(str(r.finalCapital)).toEqual({ A: '84000.00', B: '58000.00' });      // A: 80,000+12,000−18,000+10,000 loan ; B: 60,000+8,000−12,000+2,000
    expect(r.cashEnd.toString()).toBe('0.00');
  });

  it('syllabus note: unrealised tangible asset ⇒ book value; unrealised intangible ⇒ nil', () => {
    const r = dissolve({
      partners: P('A', 'B'), shares: shares(['A', 'B'], [1, 1]), capitals: { A: M('50000'), B: M('50000') }, cashAtStart: M('0'),
      assets: [{ name: 'Furniture', book: M('90000'), tangible: true }, { name: 'Patents', book: M('10000'), tangible: false }],
      liabilities: [],
    });
    expect(r.realisationCredit.toString()).toBe('90000.00');          // furniture at book, patents nil
    expect(r.profitOnRealisation.toString()).toBe('-10000.00');
    expect(r.cashEnd.toString()).toBe('0.00');
  });

  it('creditor accepts less: ₹40,000 settled for ₹30,000 and ₹15,000 paid in full — ₹55,000 goes to realisation (SQP Q14)', () => {
    const r = dissolve({
      partners: P('A', 'B', 'C'), shares: shares(['A', 'B', 'C'], [5, 3, 2]), capitals: { A: M('0'), B: M('0'), C: M('0') }, cashAtStart: M('100000'),
      assets: [], liabilities: [{ name: 'Creditor 1', book: M('40000'), paid: M('30000') }, { name: 'Creditor 2', book: M('15000') }],
    });
    expect(r.realisationCredit.toString()).toBe('55000.00');          // both creditors transferred at book value
    expect(r.realisationDebit.toString()).toBe('45000.00');           // paid 30,000 + 15,000
    expect(r.profitOnRealisation.toString()).toBe('10000.00');        // gain of 10,000 on settlement
  });
});
