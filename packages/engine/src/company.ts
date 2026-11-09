/**
 * Company accounts — Class XII, "Accounting for Companies" (syllabus matrix §3).
 *
 * SCOPE GUARDS (official limits, enforced here rather than left to the UI):
 *  - Interest on calls in arrears / advance is EXCLUDED — there is deliberately no API for it.
 *  - Debenture REDEMPTION journals are not prescribed — only issue WITH TERMS of redemption (premium on
 *    redemption raised at issue). There is deliberately no redemption entry builder.
 *  - TDS on debenture interest is excluded.
 */
import { Fraction } from './fraction';
import { Money } from './money';

export type EntrySide = 'DR' | 'CR';
export interface EntryLine { readonly account: string; readonly side: EntrySide; readonly amount: Money; }
/** A teaching journal entry in plain account names (company accounts are not posted to the Class XI chart). */
export interface Illustration { readonly narration: string; readonly lines: readonly EntryLine[]; }

const dr = (account: string, amount: Money): EntryLine => ({ account, side: 'DR', amount });
const cr = (account: string, amount: Money): EntryLine => ({ account, side: 'CR', amount });
const nz = (...lines: EntryLine[]) => lines.filter(l => !l.amount.isZero());
const times = (m: Money, n: bigint) => Money.fromPaise(m.paise * n);

export function isBalanced(e: Illustration): boolean {
  let d = 0n, c = 0n;
  for (const l of e.lines) { if (l.side === 'DR') d += l.amount.paise; else c += l.amount.paise; }
  return d === c && d > 0n;
}

// ────────────────────────── allotment ───────────────────────────────────────────────────────────

export type AllotmentTreatment = 'REJECT' | 'FULL' | 'PRORATA';
export interface ApplicantCategory { readonly label: string; readonly applied: bigint; readonly treatment: AllotmentTreatment; }

export interface AllotmentPlan {
  readonly accepted: bigint;                    // shares allotted in total
  readonly rejectedShares: bigint;              // applications refunded in full
  readonly proRataRatio: Fraction;              // remaining ÷ pro-rata applications (1 when no pro-rata is needed)
  readonly perCategory: readonly { label: string; applied: bigint; allotted: bigint }[];
  /** Application shares not converted into allotted shares (their money is refunded or carried to allotment). */
  readonly excessApplied: bigint;
}

export class ShareError extends Error { constructor(m: string) { super(m); this.name = 'ShareError'; } }

/**
 * Basis of allotment (e.g. SQP Q26B: 10,000 regret, 10,000 fully allotted, the rest pro-rata).
 * Pro-rata allotment must come out in whole shares; otherwise the question is ill-formed and we say so.
 */
export function allotmentPlan(offered: bigint, categories: readonly ApplicantCategory[]): AllotmentPlan {
  const full = categories.filter(c => c.treatment === 'FULL').reduce((a, c) => a + c.applied, 0n);
  const pro = categories.filter(c => c.treatment === 'PRORATA').reduce((a, c) => a + c.applied, 0n);
  const remaining = offered - full;
  if (remaining < 0n) throw new ShareError('Fully-allotted applications exceed the shares offered');
  const ratio = pro === 0n || remaining >= pro ? Fraction.ONE : Fraction.of(remaining, pro);
  const per = categories.map(c => {
    let allotted = 0n;
    if (c.treatment === 'FULL') allotted = c.applied;
    else if (c.treatment === 'PRORATA') {
      const n = c.applied * ratio.num;
      if (n % ratio.den !== 0n) throw new ShareError(`Pro-rata allotment of ${c.label} (${c.applied} shares × ${ratio.toString()}) is not a whole number of shares`);
      allotted = n / ratio.den;
    }
    return { label: c.label, applied: c.applied, allotted };
  });
  const accepted = per.reduce((a, c) => a + c.allotted, 0n);
  const rejectedShares = categories.filter(c => c.treatment === 'REJECT').reduce((a, c) => a + c.applied, 0n);
  const excessApplied = categories.filter(c => c.treatment !== 'REJECT').reduce((a, c) => a + c.applied, 0n) - accepted;
  return { accepted, rejectedShares, proRataRatio: ratio, perCategory: per, excessApplied };
}

/** One applicant: shares actually allotted for `applied` shares applied (SQP Q4: 6,000 applied ⇒ 5,000 allotted at 5/6). */
export function allottedTo(applied: bigint, ratio: Fraction): bigint {
  const n = applied * ratio.num;
  if (n % ratio.den !== 0n) throw new ShareError('Not a whole number of shares');
  return n / ratio.den;
}

/** What an applicant must still pay on allotment after the excess application money is adjusted. */
export function allotmentPayable(applied: bigint, ratio: Fraction, applicationPerShare: Money, allotmentPerShare: Money): { allotted: bigint; excessApplication: Money; payable: Money } {
  const allotted = allottedTo(applied, ratio);
  const excess = times(applicationPerShare, applied - allotted);
  const due = times(allotmentPerShare, allotted);
  return { allotted, excessApplication: excess, payable: due.sub(excess) };
}

// ────────────────────────── share issue ─────────────────────────────────────────────────────────

export interface Instalment { readonly name: string; readonly face: Money; readonly premium: Money; }   // per share

export interface ShareIssueSpec {
  readonly company: string;
  readonly faceValue: Money;
  /** application, allotment, call(s)… per-share face and premium parts. Σ face must equal the face value. */
  readonly instalments: readonly Instalment[];
  readonly offered: bigint;
  readonly categories: readonly ApplicantCategory[];
  /**
   * Money NOT received on an instalment (calls in arrears), by instalment index (≥ 1). An amount, not a share count,
   * because a defaulter's excess application money has already reduced what he owes on allotment (SQP Q21, Q26B).
   */
  readonly arrearsAmount?: Readonly<Record<number, Money>>;
}

export interface ShareIssueResult {
  readonly plan: AllotmentPlan;
  readonly entries: readonly Illustration[];
  readonly applicationReceived: Money;
  readonly refund: Money;
  readonly shareCapital: Money;                 // called-up face on accepted shares
  readonly securitiesPremium: Money;
  readonly callsInArrears: Money;
}

export function issueShares(spec: ShareIssueSpec): ShareIssueResult {
  const faceSum = Money.sum(spec.instalments.map(i => i.face));
  if (!faceSum.equals(spec.faceValue)) throw new ShareError(`Instalment face parts add to ${faceSum.toString()}, not the face value ${spec.faceValue.toString()}`);
  if (spec.instalments.length < 1) throw new ShareError('At least an application instalment is needed');
  const plan = allotmentPlan(spec.offered, spec.categories);
  const appliedAll = spec.categories.reduce((a, c) => a + c.applied, 0n);
  const [app, ...rest] = spec.instalments as [Instalment, ...Instalment[]];
  const appPer = app.face.add(app.premium);
  const entries: Illustration[] = [];

  const received = times(appPer, appliedAll);
  entries.push({ narration: `Application money received on ${appliedAll} shares`, lines: [dr('Bank A/c', received), cr('Share Application A/c', received)] });

  const appDue = times(appPer, plan.accepted);
  // Money from REJECTED applicants is always refunded. Excess money from applicants who were allotted fewer shares than
  // they applied for is adjusted against allotment (up to what is due) and only the surplus is refunded.
  const rejectedMoney = times(appPer, plan.rejectedShares);
  const proRataExcess = received.sub(appDue).sub(rejectedMoney);
  const allot = rest[0];
  const allotDue = allot ? times(allot.face.add(allot.premium), plan.accepted) : Money.ZERO;
  const toAllotment = proRataExcess.cmp(allotDue) < 0 ? proRataExcess : allotDue;
  const refund = rejectedMoney.add(proRataExcess.sub(toAllotment));
  entries.push({
    narration: `Application money on ${plan.accepted} shares transferred to capital; excess adjusted to allotment / refunded`,
    lines: nz(
      dr('Share Application A/c', received),
      cr('Share Capital A/c', times(app.face, plan.accepted)),
      cr('Securities Premium A/c', times(app.premium, plan.accepted)),
      cr(allot ? `Share ${allot.name} A/c` : 'Share Allotment A/c', toAllotment),
      cr('Bank A/c (refund)', refund),
    ),
  });

  let shareCapital = times(app.face, plan.accepted), premium = times(app.premium, plan.accepted), arrearsTotal = Money.ZERO;
  rest.forEach((inst, k) => {
    const idx = k + 1;
    const due = times(inst.face.add(inst.premium), plan.accepted);
    entries.push({
      narration: `${inst.name} money due on ${plan.accepted} shares`,
      lines: nz(dr(`Share ${inst.name} A/c`, due), cr('Share Capital A/c', times(inst.face, plan.accepted)), cr('Securities Premium A/c', times(inst.premium, plan.accepted))),
    });
    shareCapital = shareCapital.add(times(inst.face, plan.accepted)); premium = premium.add(times(inst.premium, plan.accepted));
    const adjusted = idx === 1 ? toAllotment : Money.ZERO;
    const unpaid = spec.arrearsAmount?.[idx] ?? Money.ZERO;
    arrearsTotal = arrearsTotal.add(unpaid);
    entries.push({
      narration: `${inst.name} money received${unpaid.isZero() ? '' : ' (calls in arrears ' + unpaid.format() + ')'}`,
      lines: nz(dr('Bank A/c', due.sub(adjusted).sub(unpaid)), dr('Calls in Arrears A/c', unpaid), cr(`Share ${inst.name} A/c`, due.sub(adjusted))),
    });
  });
  const kept = entries.filter(e => e.lines.length > 0);
  return { plan, entries: kept, applicationReceived: received, refund, shareCapital, securitiesPremium: premium, callsInArrears: arrearsTotal };
}

// ────────────────────────── forfeiture & re-issue ───────────────────────────────────────────────

export interface ForfeitureInput {
  readonly shares: bigint;
  /** Instalments CALLED UP so far (per share, face/premium parts). */
  readonly called: readonly Instalment[];
  /**
   * Total money actually received on the forfeited shares, per called instalment (including application money
   * adjusted to allotment). Within an instalment, money received is taken to cover FACE value first, then premium —
   * the convention that reproduces the CBSE marking scheme (Q21: ₹26,000; Q26A: ₹9,600; Q26B: ₹1,80,000).
   */
  readonly receivedByInstalment: readonly Money[];
}

export interface ForfeitureResult {
  readonly shareCapitalDebit: Money;            // face value called up
  readonly securitiesPremiumDebit: Money;       // premium called but NOT received (premium received stays in the account)
  readonly unpaidCredit: Money;                 // calls in arrears / unpaid instalments closed
  readonly forfeitedCredit: Money;              // face value actually received ⇒ Share Forfeited A/c
  readonly premiumReceived: Money;
  readonly entry: Illustration;
}

export function forfeit(inp: ForfeitureInput): ForfeitureResult {
  if (inp.called.length !== inp.receivedByInstalment.length) throw new ShareError('One received amount is needed per called instalment');
  let faceCalled = Money.ZERO, premCalled = Money.ZERO, faceRecv = Money.ZERO, premRecv = Money.ZERO, recvTotal = Money.ZERO;
  inp.called.forEach((inst, k) => {
    const f = times(inst.face, inp.shares), p = times(inst.premium, inp.shares), r = inp.receivedByInstalment[k]!;
    if (r.cmp(f.add(p)) > 0) throw new ShareError(`Received more than called for ${inst.name}`);
    if (r.isNegative()) throw new ShareError(`Negative receipt for ${inst.name}`);
    faceCalled = faceCalled.add(f); premCalled = premCalled.add(p);
    const toFace = r.cmp(f) < 0 ? r : f;
    faceRecv = faceRecv.add(toFace); premRecv = premRecv.add(r.sub(toFace)); recvTotal = recvTotal.add(r);
  });
  const unpaid = faceCalled.add(premCalled).sub(recvTotal);
  const spDr = premCalled.sub(premRecv);
  const entry: Illustration = {
    narration: `${inp.shares} shares forfeited for non-payment`,
    lines: nz(dr('Share Capital A/c', faceCalled), dr('Securities Premium A/c', spDr), cr('Share Allotment / Calls in Arrears A/c', unpaid), cr('Share Forfeited A/c', faceRecv)),
  };
  return { shareCapitalDebit: faceCalled, securitiesPremiumDebit: spDr, unpaidCredit: unpaid, forfeitedCredit: faceRecv, premiumReceived: premRecv, entry };
}

export interface ReissueInput {
  readonly reissued: bigint;
  /** Price received per share. The shares are re-issued AS FULLY PAID (the case the syllabus asks for). */
  readonly price: Money;
  readonly faceValue: Money;
  /** Forfeited amount per share held in Share Forfeited A/c (total forfeited ÷ shares forfeited). */
  readonly forfeitedPerShare: Money;
}

export interface ReissueResult {
  readonly bank: Money; readonly shareCapital: Money; readonly premium: Money; readonly discount: Money;
  readonly capitalReserve: Money;
  readonly entries: readonly Illustration[];
}

/**
 * Re-issue of forfeited shares as fully paid. Discount on re-issue may not exceed the amount forfeited on those
 * shares. Capital reserve = forfeited amount on the re-issued shares − discount allowed
 * (SQP Q11: ₹6,000 − ₹2,000 = ₹4,000; Q26A: no loss ⇒ the whole ₹9,600 goes to Capital Reserve).
 */
export function reissue(inp: ReissueInput): ReissueResult {
  const bank = times(inp.price, inp.reissued);
  const sc = times(inp.faceValue, inp.reissued);
  const forfeitedAmt = times(inp.forfeitedPerShare, inp.reissued);
  const premium = bank.cmp(sc) > 0 ? bank.sub(sc) : Money.ZERO;
  const discount = bank.cmp(sc) < 0 ? sc.sub(bank) : Money.ZERO;
  if (discount.cmp(forfeitedAmt) > 0) throw new ShareError(`Discount on re-issue (${discount.toString()}) cannot exceed the amount forfeited (${forfeitedAmt.toString()})`);
  const reserve = forfeitedAmt.sub(discount);
  const entries: Illustration[] = [
    { narration: `${inp.reissued} forfeited shares re-issued as fully paid`, lines: nz(dr('Bank A/c', bank), dr('Share Forfeited A/c', discount), cr('Share Capital A/c', sc), cr('Securities Premium A/c', premium)) },
    { narration: 'Gain on re-issue transferred to Capital Reserve', lines: nz(dr('Share Forfeited A/c', reserve), cr('Capital Reserve A/c', reserve)) },
  ];
  return { bank, shareCapital: sc, premium, discount, capitalReserve: reserve, entries };
}

// ────────────────────────── purchase of business ────────────────────────────────────────────────

export interface PurchaseOfBusiness { readonly assets: Money; readonly liabilities: Money; readonly consideration: Money; }
export interface PurchaseResult { readonly netAssets: Money; readonly goodwill: Money; readonly capitalReserve: Money; readonly entry: Illustration; }

/** Assets and liabilities taken over at AGREED values. Consideration > net assets ⇒ goodwill; less ⇒ capital reserve. */
export function purchaseOfBusiness(p: PurchaseOfBusiness, vendor = 'Vendor'): PurchaseResult {
  const net = p.assets.sub(p.liabilities);
  const diff = p.consideration.sub(net);
  const goodwill = diff.isPositive() ? diff : Money.ZERO;
  const reserve = diff.isNegative() ? diff.neg() : Money.ZERO;
  return {
    netAssets: net, goodwill, capitalReserve: reserve,
    entry: { narration: 'Business purchased', lines: nz(dr('Assets A/c', p.assets), dr('Goodwill A/c', goodwill), cr('Liabilities A/c', p.liabilities), cr('Capital Reserve A/c', reserve), cr(`${vendor} A/c`, p.consideration)) },
  };
}

// ────────────────────────── debentures ──────────────────────────────────────────────────────────

export interface DebentureIssue {
  readonly rate: string;                       // e.g. "12%"
  readonly count: bigint;
  readonly face: Money;
  /** Issue price per debenture (face − discount, or face + premium). */
  readonly issuePrice: Money;
  /** Redemption price per debenture (face, or face + premium on redemption). Terms only — no redemption entries exist. */
  readonly redemptionPrice?: Money;
}

export interface DebentureIssueResult {
  readonly received: Money; readonly discountOnIssue: Money; readonly premiumOnIssue: Money;
  readonly premiumOnRedemption: Money; readonly lossOnIssue: Money; readonly entries: readonly Illustration[];
}

/**
 * Issue of debentures with terms of redemption. The premium payable on redemption is a LIABILITY created now and the
 * same amount is a "Loss on issue of debentures" (SQP Q23: 750 × ₹100 at 10% discount redeemable at 5% premium ⇒ discount 7,500,
 * loss 3,750, premium on redemption 3,750).
 */
export function issueDebentures(d: DebentureIssue): DebentureIssueResult {
  const redemption = d.redemptionPrice ?? d.face;
  const received = times(d.issuePrice, d.count);
  const faceTotal = times(d.face, d.count);
  const discount = d.issuePrice.cmp(d.face) < 0 ? times(d.face.sub(d.issuePrice), d.count) : Money.ZERO;
  const premium = d.issuePrice.cmp(d.face) > 0 ? times(d.issuePrice.sub(d.face), d.count) : Money.ZERO;
  const redPremium = redemption.cmp(d.face) > 0 ? times(redemption.sub(d.face), d.count) : Money.ZERO;
  const entries: Illustration[] = [
    { narration: `Application money received on ${d.count} ${d.rate} debentures`, lines: [dr('Bank A/c', received), cr('Debenture Application & Allotment A/c', received)] },
    {
      narration: `Application money transferred to ${d.rate} debentures`,
      lines: nz(
        dr('Debenture Application & Allotment A/c', received), dr('Discount on Issue of Debentures A/c', discount), dr('Loss on Issue of Debentures A/c', redPremium),
        cr(`${d.rate} Debentures A/c`, faceTotal), cr('Securities Premium A/c', premium), cr('Premium on Redemption of Debentures A/c', redPremium),
      ),
    },
  ];
  return { received, discountOnIssue: discount, premiumOnIssue: premium, premiumOnRedemption: redPremium, lossOnIssue: redPremium, entries };
}

/** Debentures issued to a vendor: number = purchase consideration ÷ issue price (SQP Q19: 6,30,000 ÷ 90 = 7,000). */
export function debenturesForConsideration(consideration: Money, issuePrice: Money, face: Money): { count: bigint; faceTotal: Money; discount: Money; entry: Illustration } {
  if (!issuePrice.isPositive()) throw new ShareError('Issue price must be positive');
  if (consideration.paise % issuePrice.paise !== 0n) throw new ShareError('Consideration is not an exact multiple of the issue price');
  const count = consideration.paise / issuePrice.paise;
  const faceTotal = times(face, count);
  const discount = faceTotal.sub(consideration);
  return { count, faceTotal, discount, entry: { narration: 'Debentures issued to vendor', lines: nz(dr('Vendor A/c', consideration), dr('Discount on Issue of Debentures A/c', discount.isPositive() ? discount : Money.ZERO), cr('Debentures A/c', faceTotal), cr('Securities Premium A/c', discount.isNegative() ? discount.neg() : Money.ZERO)) } };
}

/** Collateral security: no cash for the debentures — entry through Debenture Suspense, shown net in the balance sheet note. */
export function collateralDebentures(loan: Money, debenturesFace: Money): { entries: Illustration[]; longTermBorrowings: readonly { label: string; amount: Money }[]; total: Money } {
  return {
    entries: [
      { narration: 'Loan raised', lines: [dr('Bank A/c', loan), cr('Bank Loan A/c', loan)] },
      { narration: 'Debentures issued as collateral security', lines: [dr('Debenture Suspense A/c', debenturesFace), cr('Debentures A/c', debenturesFace)] },
    ],
    longTermBorrowings: [{ label: 'Debentures', amount: debenturesFace }, { label: 'Less: Debenture Suspense', amount: debenturesFace.neg() }, { label: 'Bank Loan', amount: loan }],
    total: loan,
  };
}

/** Interest on debentures for `months` at `ratePercent` on the FACE value (TDS excluded by the syllabus). */
export function debentureInterest(faceTotal: Money, ratePercent: bigint, months = 12n): Money {
  return faceTotal.mulRatio(ratePercent * months, 1200n, 'HALF_UP');
}

/** Official note: discount/loss on issue is written off in the year of allotment, first from Securities Premium Reserve (if any), then from P&L as finance cost (AS 16). */
export function writeOffIssueLosses(discount: Money, loss: Money, securitiesPremiumBalance: Money): Illustration {
  const total = discount.add(loss);
  const fromSP = securitiesPremiumBalance.cmp(total) < 0 ? securitiesPremiumBalance : total;
  const fromPL = total.sub(fromSP);
  return { narration: 'Discount / loss on issue of debentures written off', lines: nz(dr('Securities Premium A/c', fromSP), dr('Statement of P&L (Finance Cost)', fromPL), cr('Discount on Issue of Debentures A/c', discount), cr('Loss on Issue of Debentures A/c', loss)) };
}

// ────────────────────────── Schedule III disclosure ─────────────────────────────────────────────

export interface ShareCapitalNote {
  readonly authorised: Money; readonly issued: Money; readonly subscribedAndPaid: Money;
  readonly subscribedNotFullyPaid: Money; readonly forfeitedAdded: Money; readonly total: Money;
}

/** Note on share capital for the balance sheet (SQP Q21 and Q15). Amounts are on FACE value; forfeited shares add the amount received. */
export function shareCapitalNote(i: {
  authorisedShares: bigint; face: Money; issuedShares: bigint;
  fullyPaidShares: bigint; notFullyPaidShares?: bigint; calledUpPerShare?: Money; arrearsOnNotFullyPaid?: Money; forfeitedReceived?: Money;
}): ShareCapitalNote {
  const authorised = times(i.face, i.authorisedShares), issued = times(i.face, i.issuedShares), paid = times(i.face, i.fullyPaidShares);
  const part = i.notFullyPaidShares && i.calledUpPerShare ? times(i.calledUpPerShare, i.notFullyPaidShares).sub(i.arrearsOnNotFullyPaid ?? Money.ZERO) : Money.ZERO;
  const fa = i.forfeitedReceived ?? Money.ZERO;
  return { authorised, issued, subscribedAndPaid: paid, subscribedNotFullyPaid: part, forfeitedAdded: fa, total: paid.add(part).add(fa) };
}
