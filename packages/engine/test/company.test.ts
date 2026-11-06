import { describe, expect, it } from 'vitest';
import {
  Fraction, Money, ShareError, allotmentPayable, allotmentPlan, collateralDebentures, debentureInterest, debenturesForConsideration, forfeit,
  isBalanced, issueDebentures, issueShares, purchaseOfBusiness, reissue, shareCapitalNote, writeOffIssueLosses, type Illustration,
} from '../src';

const M = (s: string) => Money.parse(s);
const sum = (e: Illustration, side: 'DR' | 'CR') => Money.sum(e.lines.filter(l => l.side === side).map(l => l.amount)).toString();
const find = (e: Illustration, account: string, side?: 'DR' | 'CR') => e.lines.find(l => l.account === account && (!side || l.side === side))?.amount.toString();

describe('allotment', () => {
  it('SQP Q4: 50,000 offered, 80,000 applied, pro-rata to 60,000 ⇒ a 6,000-share applicant gets 5,000 and pays ₹17,000 on allotment', () => {
    const plan = allotmentPlan(50000n, [{ label: 'rejected', applied: 20000n, treatment: 'REJECT' }, { label: 'pro-rata', applied: 60000n, treatment: 'PRORATA' }]);
    expect(plan.proRataRatio.toString()).toBe('5/6');
    expect(plan.accepted).toBe(50000n);
    const a = allotmentPayable(6000n, plan.proRataRatio, M('3'), M('4'));
    expect(a.allotted).toBe(5000n);
    expect(a.excessApplication.toString()).toBe('3000.00');         // 1,000 shares × ₹3
    expect(a.payable.toString()).toBe('17000.00');                  // 5,000 × 4 − 3,000
  });
  it('undersubscribed issue: everyone gets what they applied for', () => {
    const plan = allotmentPlan(100000n, [{ label: 'all', applied: 95000n, treatment: 'PRORATA' }]);
    expect(plan.accepted).toBe(95000n); expect(plan.excessApplied).toBe(0n);
  });
  it('rejects a pro-rata basis that does not give whole shares, and over-allotment to the FULL category', () => {
    expect(() => allotmentPlan(10n, [{ label: 'x', applied: 7n, treatment: 'PRORATA' }, { label: 'y', applied: 5n, treatment: 'PRORATA' }])).toThrow(ShareError);
    expect(() => allotmentPlan(10n, [{ label: 'x', applied: 11n, treatment: 'FULL' }])).toThrow(ShareError);
  });
});

describe('SQP Q26A — Lacchoo Ltd: 1,20,000 shares ₹10 at ₹4 premium; app ₹6 (₹2 prem), allot ₹5 (₹1 prem), call ₹3', () => {
  const spec = {
    company: 'Lacchoo Ltd.', faceValue: M('10'),
    instalments: [
      { name: 'Application', face: M('4'), premium: M('2') },
      { name: 'Allotment', face: M('4'), premium: M('1') },
      { name: 'First & Final Call', face: M('2'), premium: M('1') },
    ],
    offered: 120000n,
    categories: [{ label: 'rejected', applied: 10000n, treatment: 'REJECT' as const }, { label: 'rest', applied: 260000n, treatment: 'PRORATA' as const }],
    arrearsAmount: { 2: M('3600') },                                  // Parivesh: 1,200 shares × ₹3
  };
  const r = issueShares(spec);
  it('basis of allotment 6/13; refund ₹3,00,000', () => {
    expect(r.plan.proRataRatio.toString()).toBe('6/13');
    expect(r.plan.accepted).toBe(120000n);
    expect(r.applicationReceived.toString()).toBe('1620000.00');
    expect(r.refund.toString()).toBe('300000.00');
  });
  it('every entry balances', () => { for (const e of r.entries) expect(isBalanced(e), e.narration).toBe(true); });
  it('application entry matches the marking scheme', () => {
    const e = r.entries[1]!;
    expect([find(e, 'Share Capital A/c'), find(e, 'Securities Premium A/c'), find(e, 'Share Allotment A/c'), find(e, 'Bank A/c (refund)')])
      .toEqual(['480000.00', '240000.00', '600000.00', '300000.00']);
  });
  it('first call: Bank ₹3,56,400 and Calls in Arrears ₹3,600', () => {
    const e = r.entries.find(x => x.narration.startsWith('First & Final Call money received'))!;
    expect(find(e, 'Bank A/c', 'DR')).toBe('356400.00'); expect(find(e, 'Calls in Arrears A/c', 'DR')).toBe('3600.00');
  });
  it('forfeiture of 1,200 shares: SC 12,000, SP 1,200 ⇒ Share Forfeited 9,600 + call 3,600', () => {
    const f = forfeit({
      shares: 1200n, called: spec.instalments,
      receivedByInstalment: [M('7200'), M('6000'), M('0')],          // app 6×1,200 ; allotment 5×1,200 (met from excess application money) ; call unpaid
    });
    expect([f.shareCapitalDebit, f.securitiesPremiumDebit, f.unpaidCredit, f.forfeitedCredit].map(String)).toEqual(['12000.00', '1200.00', '3600.00', '9600.00']);
    expect(isBalanced(f.entry)).toBe(true);
    const ri = reissue({ reissued: 1200n, price: M('100'), faceValue: M('10'), forfeitedPerShare: M('8') });
    expect([ri.bank, ri.shareCapital, ri.premium, ri.capitalReserve].map(String)).toEqual(['120000.00', '12000.00', '108000.00', '9600.00']);
    for (const e of ri.entries) expect(isBalanced(e)).toBe(true);
  });
});

describe('SQP Q26B — Neha Tech: 1,00,000 shares ₹10 at ₹90 premium; face on application, premium on allotment', () => {
  const spec = {
    company: 'Neha Tech Ltd.', faceValue: M('10'),
    instalments: [{ name: 'Application', face: M('10'), premium: M('0') }, { name: 'Allotment', face: M('0'), premium: M('90') }],
    offered: 100000n,
    categories: [
      { label: 'regret', applied: 10000n, treatment: 'REJECT' as const },
      { label: 'full', applied: 10000n, treatment: 'FULL' as const },
      { label: 'pro-rata', applied: 130000n, treatment: 'PRORATA' as const },
    ],
    // holder of 18,000 shares applied for 26,000: paid 2,60,000; allotment due 16,20,000; excess 80,000 ⇒ unpaid 15,40,000
    arrearsAmount: { 1: M('1540000') },
  };
  const r = issueShares(spec);
  it('9/13 pro-rata; refund only the ₹1,00,000 of regrets', () => {
    expect(r.plan.proRataRatio.toString()).toBe('9/13');
    expect(r.applicationReceived.toString()).toBe('1500000.00');
    expect(r.refund.toString()).toBe('100000.00');
  });
  it('cash received on allotment = ₹70,60,000 (the cash book figure)', () => {
    const e = r.entries.find(x => x.narration.startsWith('Allotment money received'))!;
    expect(find(e, 'Bank A/c', 'DR')).toBe('7060000.00');
  });
  it('forfeiture of 18,000 shares: SC 1,80,000, SP 15,40,000 / arrears 15,40,000, forfeited 1,80,000', () => {
    const f = forfeit({
      shares: 18000n, called: spec.instalments,
      receivedByInstalment: [M('180000'), M('80000')],                // application on allotted shares ; excess adjusted to allotment
    });
    expect([f.shareCapitalDebit, f.securitiesPremiumDebit, f.unpaidCredit, f.forfeitedCredit].map(String)).toEqual(['180000.00', '1540000.00', '1540000.00', '180000.00']);
    const ri = reissue({ reissued: 5000n, price: M('30'), faceValue: M('10'), forfeitedPerShare: f.forfeitedCredit.mulRatio(1n, 18000n, 'DOWN') });
    expect([ri.bank, ri.shareCapital, ri.premium, ri.capitalReserve].map(String)).toEqual(['150000.00', '50000.00', '100000.00', '50000.00']);
  });
});

describe('forfeiture and re-issue', () => {
  it('SQP Q11: 3,000 shares forfeited after allotment (only application paid), 2,000 re-issued at ₹9 ⇒ Capital Reserve ₹4,000', () => {
    const called = [{ name: 'Application', face: M('3'), premium: M('1') }, { name: 'Allotment', face: M('4'), premium: M('1') }];
    const f = forfeit({ shares: 3000n, called, receivedByInstalment: [M('12000'), M('0')] });
    expect(f.forfeitedCredit.toString()).toBe('9000.00');            // ₹3 face received × 3,000
    expect(f.securitiesPremiumDebit.toString()).toBe('3000.00');     // allotment premium unpaid
    const ri = reissue({ reissued: 2000n, price: M('9'), faceValue: M('10'), forfeitedPerShare: M('3') });
    expect(ri.discount.toString()).toBe('2000.00');
    expect(ri.capitalReserve.toString()).toBe('4000.00');            // 6,000 forfeited on these shares − 2,000 discount
  });
  it('discount on re-issue cannot exceed the amount forfeited', () =>
    expect(() => reissue({ reissued: 10n, price: M('4'), faceValue: M('10'), forfeitedPerShare: M('5') })).toThrow(ShareError));
  it('rejects receipts that exceed what was called', () =>
    expect(() => forfeit({ shares: 1n, called: [{ name: 'App', face: M('1'), premium: M('0') }], receivedByInstalment: [M('2')] })).toThrow(ShareError));
});

describe('SQP Q21 — XYZ Ltd: share capital in the balance sheet and the note', () => {
  const spec = {
    company: 'XYZ Ltd.', faceValue: M('10'),
    instalments: [{ name: 'Application', face: M('2'), premium: M('1') }, { name: 'Allotment', face: M('5'), premium: M('1') }, { name: 'Call', face: M('3'), premium: M('0') }],
    offered: 100000n,
    categories: [{ label: 'rejected', applied: 5000n, treatment: 'REJECT' as const }, { label: 'rest', applied: 120000n, treatment: 'PRORATA' as const }],
    // Raja: 10,000 shares (applied 12,000, so ₹6,000 excess went to allotment). Allotment ₹60,000 − 6,000 = 54,000 unpaid ; call 10,000 × 3 = 30,000 unpaid
    arrearsAmount: { 1: M('54000'), 2: M('30000') },
  };
  it('pro-rata 5/6; total unpaid = ₹84,000', () => {
    const r = issueShares(spec);
    expect(r.plan.proRataRatio.toString()).toBe('5/6');
    expect(r.callsInArrears.toString()).toBe('84000.00');
    for (const e of r.entries) expect(isBalanced(e), e.narration).toBe(true);
  });
  it('Raja\'s forfeiture credits Share Forfeited with ₹26,000', () => {
    const f = forfeit({ shares: 10000n, called: spec.instalments, receivedByInstalment: [M('30000'), M('6000'), M('0')] });
    expect(f.forfeitedCredit.toString()).toBe('26000.00');
    expect(f.securitiesPremiumDebit.toString()).toBe('10000.00');
    expect(f.unpaidCredit.toString()).toBe('84000.00');
    expect(isBalanced(f.entry)).toBe(true);
  });
  it('note: 90,000 shares fully paid ₹9,00,000 + forfeited ₹26,000 = ₹9,26,000; authorised ₹80,00,000, issued ₹10,00,000', () => {
    const n = shareCapitalNote({ authorisedShares: 800000n, face: M('10'), issuedShares: 100000n, fullyPaidShares: 90000n, forfeitedReceived: M('26000') });
    expect([n.authorised, n.issued, n.subscribedAndPaid, n.forfeitedAdded, n.total].map(String)).toEqual(['8000000.00', '1000000.00', '900000.00', '26000.00', '926000.00']);
  });
  it('SQP Q15: 1,000 shares of ₹80, ₹50 called incl. ₹6 premium ⇒ subscribed-but-not-fully-paid ₹44,000', () =>
    expect(shareCapitalNote({ authorisedShares: 1000n, face: M('80'), issuedShares: 1000n, fullyPaidShares: 0n, notFullyPaidShares: 1000n, calledUpPerShare: M('44') }).subscribedNotFullyPaid.toString()).toBe('44000.00'));
});

describe('purchase of business and debentures', () => {
  it('SQP Q12: assets 18,00,000, liabilities 2,50,000, paid 12,000 × ₹125 + ₹1,00,000 ⇒ goodwill ₹50,000', () => {
    const consideration = M('125').mulRatio(12000n, 1n, 'HALF_UP').add(M('100000'));
    expect(consideration.toString()).toBe('1600000.00');
    const r = purchaseOfBusiness({ assets: M('1800000'), liabilities: M('250000'), consideration });
    expect(r.goodwill.toString()).toBe('50000.00'); expect(r.capitalReserve.isZero()).toBe(true);
    expect(isBalanced(r.entry)).toBe(true);
  });
  it('a bargain purchase gives capital reserve, not negative goodwill', () => {
    const r = purchaseOfBusiness({ assets: M('100'), liabilities: M('10'), consideration: M('80') });
    expect(r.goodwill.isZero()).toBe(true); expect(r.capitalReserve.toString()).toBe('10.00'); expect(isBalanced(r.entry)).toBe(true);
  });
  it('SQP Q19: ₹6,30,000 ÷ ₹90 = 7,000 debentures; goodwill 70,000; discount 70,000', () => {
    const d = debenturesForConsideration(M('630000'), M('90'), M('100'));
    expect(d.count).toBe(7000n); expect(d.discount.toString()).toBe('70000.00'); expect(d.faceTotal.toString()).toBe('700000.00');
    expect(isBalanced(d.entry)).toBe(true);
    expect(purchaseOfBusiness({ assets: M('600000'), liabilities: M('40000'), consideration: M('630000') }, 'Crane Ltd.').goodwill.toString()).toBe('70000.00');
    expect(() => debenturesForConsideration(M('100'), M('30'), M('100'))).toThrow(ShareError);
  });

  describe('SQP Q23 — issue of debentures with terms of redemption', () => {
    it('(a) 750 × ₹100 at 10% discount, redeemable at 5% premium', () => {
      const r = issueDebentures({ rate: '12%', count: 750n, face: M('100'), issuePrice: M('90'), redemptionPrice: M('105') });
      expect([r.received, r.discountOnIssue, r.lossOnIssue, r.premiumOnRedemption].map(String)).toEqual(['67500.00', '7500.00', '3750.00', '3750.00']);
      const e = r.entries[1]!;
      expect(find(e, '12% Debentures A/c')).toBe('75000.00');
      expect(sum(e, 'DR')).toBe('78750.00'); expect(sum(e, 'CR')).toBe('78750.00');
      for (const x of r.entries) expect(isBalanced(x)).toBe(true);
    });
    it('(b) 800 × ₹100 at ₹20 premium, redeemable at ₹10 premium', () => {
      const r = issueDebentures({ rate: '9%', count: 800n, face: M('100'), issuePrice: M('120'), redemptionPrice: M('110') });
      expect([r.received, r.premiumOnIssue, r.lossOnIssue, r.premiumOnRedemption].map(String)).toEqual(['96000.00', '16000.00', '8000.00', '8000.00']);
      expect(find(r.entries[1]!, 'Securities Premium A/c')).toBe('16000.00');
      for (const x of r.entries) expect(isBalanced(x)).toBe(true);
    });
    it('issued at par and redeemable at par creates no discount, loss or premium', () => {
      const r = issueDebentures({ rate: '10%', count: 10n, face: M('100'), issuePrice: M('100') });
      expect(r.discountOnIssue.isZero() && r.lossOnIssue.isZero() && r.premiumOnRedemption.isZero() && r.premiumOnIssue.isZero()).toBe(true);
    });
    it('collateral security: ₹5,00,000 debentures for a ₹4,00,000 loan ⇒ long-term borrowings ₹4,00,000', () => {
      const c = collateralDebentures(M('400000'), M('500000'));
      expect(find(c.entries[1]!, 'Debenture Suspense A/c', 'DR')).toBe('500000.00');
      expect(Money.sum(c.longTermBorrowings.map(x => x.amount)).toString()).toBe('400000.00');
      expect(c.total.toString()).toBe('400000.00');
    });
  });

  it('interest on debentures: 9% on ₹5,00,000 for 6 months = ₹22,500 (hand-worked)', () => expect(debentureInterest(M('500000'), 9n, 6n).toString()).toBe('22500.00'));
  it('official note: discount/loss written off first from Securities Premium, the rest from P&L', () => {
    const e = writeOffIssueLosses(M('7500'), M('3750'), M('5000'));
    expect(find(e, 'Securities Premium A/c')).toBe('5000.00'); expect(find(e, 'Statement of P&L (Finance Cost)')).toBe('6250.00');
    expect(isBalanced(e)).toBe(true);
    const e2 = writeOffIssueLosses(M('7500'), M('3750'), M('50000'));
    expect(find(e2, 'Securities Premium A/c')).toBe('11250.00'); expect(find(e2, 'Statement of P&L (Finance Cost)')).toBeUndefined();
  });
});

describe('scope guards', () => {
  it('there is no API for interest on calls or for debenture redemption entries (outside the 2026-27 syllabus)', async () => {
    const api = await import('../src');
    const names = Object.keys(api).join(' ').toLowerCase();
    expect(names).not.toMatch(/callsinarrears?interest|interestoncalls|redeemdebentures|redemptionentr|debentureredemption|tds/);
  });
  it('Fraction type still exported for ratios used here', () => expect(Fraction.of(1, 2).toString()).toBe('1/2'));
});
