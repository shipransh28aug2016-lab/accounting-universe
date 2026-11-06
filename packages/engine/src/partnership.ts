/**
 * Partnership calculators — Class XII, Unit "Accounting for Partnership Firms".
 * Pure functions over exact Money/Fraction. Clause references are to
 * docs/CBSE_2026_27_SYLLABUS_MATRIX.md §3.
 */
import { Fraction, allocate } from './fraction';
import { Money, type RoundingMode } from './money';

export interface Partner { readonly id: string; readonly name: string; }
const R: RoundingMode = 'HALF_UP';

/** Σ of per-partner amounts. */
const total = (m: Record<string, Money>) => Money.sum(Object.values(m));

// ────────────────────────── ratios ──────────────────────────────────────────────────────────────

export interface RatioChange {
  /** new − old per partner: positive = GAINS, negative = SACRIFICES. */
  readonly delta: Record<string, Fraction>;
  readonly sacrifice: Record<string, Fraction>;
  readonly gain: Record<string, Fraction>;
}

/** Sacrificing / gaining ratio on a change of profit-sharing ratio among existing partners. */
export function ratioChange(oldShare: Record<string, Fraction>, newShare: Record<string, Fraction>): RatioChange {
  const ids = Object.keys(oldShare);
  if (ids.length !== Object.keys(newShare).length || ids.some(i => !(i in newShare))) throw new RangeError('Old and new ratios must name the same partners');
  const delta: Record<string, Fraction> = {}, sacrifice: Record<string, Fraction> = {}, gain: Record<string, Fraction> = {};
  for (const id of ids) {
    const d = newShare[id]!.sub(oldShare[id]!);
    delta[id] = d;
    if (d.isNegative()) sacrifice[id] = d.neg();
    if (d.isPositive()) gain[id] = d;
  }
  return { delta, sacrifice, gain };
}

/** Partners' shares expressed as a ratio of the given fractions (e.g. sacrificing ratio 1:1). */
export function normalise(parts: Record<string, Fraction>): Record<string, Fraction> {
  const ids = Object.keys(parts);
  const sum = ids.reduce((a, i) => a.add(parts[i]!), Fraction.ZERO);
  const out: Record<string, Fraction> = {};
  for (const i of ids) out[i] = parts[i]!.div(sum);
  return out;
}

/**
 * Adjustment when a gain/loss (unrecorded liability, undistributed reserve, …) is NOT recorded in the
 * books on a change of ratio. Each partner should have borne/enjoyed it at the OLD share but will
 * now do so at the NEW share. Result: + = credit the partner's capital, − = debit it. Sums to zero.
 *   kind 'gain' (reserve, unrecorded asset):   net = old-share amount − new-share amount
 *   kind 'loss' (unrecorded liability):         net = new-share amount − old-share amount
 * e.g. ₹9,000 unrecorded liability, 4:3:2 → 1:1:1:  A bears 4,000 but will now bear 3,000 ⇒ A is DEBITED 1,000 …
 * (sample paper Q1: A's Capital Dr 1,000 / To C's Capital 1,000).
 */
export function adjustmentWithoutRecording(
  amount: Money, kind: 'gain' | 'loss', oldShare: Record<string, Fraction>, newShare: Record<string, Fraction>,
): Record<string, Money> {
  const ids = Object.keys(oldShare);
  const gainFor = (s: Record<string, Fraction>) => allocate(amount, ids.map(i => s[i]!));
  const oldA = gainFor(oldShare), newA = gainFor(newShare);
  const out: Record<string, Money> = {};
  ids.forEach((id, k) => {
    const diff = oldA[k]!.sub(newA[k]!);          // old-share amount minus new-share amount
    out[id] = kind === 'gain' ? diff : diff.neg();
  });
  return out;
}

/** Goodwill compensation on a change of ratio: gainers pay, sacrificers receive. */
export function goodwillOnRatioChange(goodwill: Money, change: RatioChange): Record<string, Money> {
  const ids = Object.keys(change.delta);
  const out: Record<string, Money> = {};
  // each partner is credited/debited by (their sacrifice or gain) × goodwill; exact allocation of each side
  const sac = ids.filter(i => change.sacrifice[i]);
  const gain = ids.filter(i => change.gain[i]);
  for (const i of ids) out[i] = Money.ZERO;
  if (sac.length === 0 || gain.length === 0) return out;
  const totalChange = gain.reduce((a, i) => a.add(change.gain[i]!), Fraction.ZERO);          // = total sacrificed
  const pool = totalChange.of_(goodwill, R);
  const recv = allocate(pool, normaliseList(sac.map(i => change.sacrifice[i]!)));
  const pay = allocate(pool, normaliseList(gain.map(i => change.gain[i]!)));
  sac.forEach((i, k) => { out[i] = recv[k]!; });
  gain.forEach((i, k) => { out[i] = pay[k]!.neg(); });
  return out;
}

function normaliseList(fr: Fraction[]): Fraction[] {
  const s = fr.reduce((a, b) => a.add(b), Fraction.ZERO);
  return fr.map(f => f.div(s));
}

// ────────────────────────── profit & loss appropriation ─────────────────────────────────────────

export interface AppropriationInput {
  readonly partners: readonly Partner[];
  /** Net profit (loss negative) BEFORE interest on capital, salary and commission — each of those is deducted here, exactly once. */
  readonly netProfit: Money;
  readonly shares: Record<string, Fraction>;
  readonly interestOnCapital?: { readonly ratePercent: bigint; readonly capital: Record<string, Money> } | undefined;
  readonly interestOnDrawings?: { readonly ratePercent: bigint; readonly drawings: Record<string, Money>; readonly avgMonths?: Record<string, bigint> } | undefined;
  readonly salary?: Record<string, Money> | undefined;
  /** Commission: fixed amount per partner, already worked out (use commissionAfterCharging / commissionBeforeCharging). */
  readonly commission?: Record<string, Money> | undefined;
  /** Guarantee: a partner is assured at least `minimum`; the shortfall is borne by `bornBy` in `borneRatio` (default: the other partners in their ratio). */
  readonly guarantee?: { readonly partner: string; readonly minimum: Money; readonly bornBy?: readonly string[]; readonly borneRatio?: Record<string, Fraction> } | undefined;
}

export interface AppropriationResult {
  readonly interestOnCapital: Record<string, Money>;
  readonly interestOnDrawings: Record<string, Money>;
  readonly salary: Record<string, Money>;
  readonly commission: Record<string, Money>;
  /** Profit/(loss) left to share in the ratio, after the fixed appropriations. */
  readonly residual: Money;
  /** Final share of the residual per partner BEFORE any guarantee adjustment. */
  readonly shareOfResidual: Record<string, Money>;
  /** Guarantee deficiency borne per partner (positive = bears). */
  readonly guaranteeBorne: Record<string, Money>;
  /** Total credited to each partner's account for the year (interest + salary + commission + share − drawings interest). */
  readonly totalPerPartner: Record<string, Money>;
  /** True when profit was too small to cover the fixed appropriations, so they were scaled down pro-rata. */
  readonly scaledDown: boolean;
}

/** Interest on partner-capital for `months` of a year at `ratePercent` p.a. */
export function interestPA(amount: Money, ratePercent: bigint, months = 12n): Money {
  return amount.mulRatio(ratePercent * months, 100n * 12n, R);
}

/**
 * P&L Appropriation account.
 *
 * Syllabus rules implemented: interest on capital / drawings, salary, commission, guarantee of profit;
 * "interest on partner's loan is a charge against profits" (so it must NOT be passed in here — deduct it first).
 *
 * Insufficient profit: interest, salary and commission are NOT paid in full if profit cannot cover them;
 * the available profit is split in the RATIO of the amounts due (CBSE marking-scheme method, Q18 of the 2026-27 sample paper).
 * A loss means no salary/interest; it is simply shared in the profit-sharing ratio.
 */
export function appropriate(input: AppropriationInput): AppropriationResult {
  const ids = input.partners.map(p => p.id);
  const zero = () => Object.fromEntries(ids.map(i => [i, Money.ZERO])) as Record<string, Money>;
  const ioc = zero(), iod = zero(), sal = zero(), com = zero();

  for (const i of ids) {
    if (input.interestOnCapital) ioc[i] = interestPA(input.interestOnCapital.capital[i] ?? Money.ZERO, input.interestOnCapital.ratePercent);
    if (input.interestOnDrawings) iod[i] = interestPA(input.interestOnDrawings.drawings[i] ?? Money.ZERO, input.interestOnDrawings.ratePercent, input.interestOnDrawings.avgMonths?.[i] ?? 6n);
    if (input.salary?.[i]) sal[i] = input.salary[i]!;
    if (input.commission?.[i]) com[i] = input.commission[i]!;
  }

  const dueFixed = zero();
  for (const i of ids) dueFixed[i] = ioc[i]!.add(sal[i]!).add(com[i]!);
  const totalDue = total(dueFixed);
  const available = input.netProfit.add(total(iod));          // interest charged on drawings is income of the firm
  let scaledDown = false;
  let paid = dueFixed;

  if (available.isNegative() || available.isZero()) {
    // loss (or nothing): no salary/interest/commission is credited
    paid = zero();
    scaledDown = !totalDue.isZero();
  } else if (available.cmp(totalDue) < 0) {
    scaledDown = true;
    const weights = ids.map(i => dueFixed[i]!);
    const parts = allocate(available, weights.map(w => Fraction.of(w.paise, totalDue.paise)));
    paid = Object.fromEntries(ids.map((i, k) => [i, parts[k]!])) as Record<string, Money>;
  }

  const residual = available.sub(total(paid));
  const resShares = allocate(residual, ids.map(i => input.shares[i] ?? Fraction.ZERO));
  const shareOfResidual = Object.fromEntries(ids.map((i, k) => [i, resShares[k]!])) as Record<string, Money>;

  // guarantee
  const borne = zero();
  if (input.guarantee && !residual.isNegative()) {
    const g = input.guarantee;
    const gp = g.partner;
    const gets = shareOfResidual[gp]!.add(scaledDown ? paid[gp]! : dueFixed[gp]!);
    const shortfall = g.minimum.sub(gets);
    if (shortfall.isPositive()) {
      const bearers = g.bornBy ?? ids.filter(i => i !== gp);
      const ratio = g.borneRatio ?? normalise(Object.fromEntries(bearers.map(b => [b, input.shares[b]!])));
      const parts = allocate(shortfall, bearers.map(b => ratio[b]!));
      bearers.forEach((b, k) => { borne[b] = parts[k]!; });
      borne[gp] = shortfall.neg();
    }
  }

  const totalPerPartner = zero();
  for (const i of ids) totalPerPartner[i] = paid[i]!.add(shareOfResidual[i]!).sub(iod[i]!).sub(borne[i]!);
  // NOTE: `borne[gp]` is negative so subtracting it ADDS the shortfall to the guaranteed partner.

  return { interestOnCapital: ioc, interestOnDrawings: iod, salary: sal, commission: com, residual, shareOfResidual, guaranteeBorne: borne, totalPerPartner, scaledDown };
}

/** Commission on net profit AFTER charging it: profit × r/(100+r). (marking scheme Q22A: ₹1,10,000 × 10/110 = ₹10,000) */
export function commissionAfterCharging(netProfitAfterCommission: Money, ratePercent: bigint): Money {
  return netProfitAfterCommission.mulRatio(ratePercent, 100n + ratePercent, R);
}
/** Commission on net profit BEFORE charging it: profit × r/100. */
export function commissionBeforeCharging(netProfitBeforeCommission: Money, ratePercent: bigint): Money {
  return netProfitBeforeCommission.mulRatio(ratePercent, 100n, R);
}

/**
 * Past adjustment: an item was omitted/mis-stated in closed accounts. `shouldHave` is what each partner
 * should have received, `didReceive` what was actually credited. Returns net (+ credit / − debit), sums to zero.
 */
export function pastAdjustment(shouldHave: Record<string, Money>, didReceive: Record<string, Money>): Record<string, Money> {
  const out: Record<string, Money> = {};
  for (const i of Object.keys(shouldHave)) out[i] = shouldHave[i]!.sub(didReceive[i] ?? Money.ZERO);
  return out;
}

// ────────────────────────── goodwill ────────────────────────────────────────────────────────────

/** Simple/weighted average of profits. Weights default to 1. */
export function averageProfit(profits: readonly Money[], weights?: readonly bigint[]): Money {
  if (profits.length === 0) throw new RangeError('No profits given');
  const w = weights ?? profits.map(() => 1n);
  if (w.length !== profits.length) throw new RangeError('One weight per year is required');
  const num = profits.reduce((a, p, i) => a + p.paise * w[i]!, 0n);
  const den = w.reduce((a, b) => a + b, 0n);
  return Money.fromPaise(num).mulRatio(1n, den, R);
}

/** Goodwill = average profit × number of years' purchase. */
export function goodwillAverageProfit(avg: Money, yearsPurchase: bigint): Money { return avg.mulRatio(yearsPurchase, 1n, R); }

/**
 * Super-profit method. Normal profit = capital employed × normal rate; super profit = average − normal;
 * goodwill = super profit × years' purchase (nil if there is no super profit).
 */
export function goodwillSuperProfit(avg: Money, capitalEmployed: Money, normalRatePercent: bigint, yearsPurchase: bigint): { normalProfit: Money; superProfit: Money; goodwill: Money } {
  const normalProfit = capitalEmployed.mulRatio(normalRatePercent, 100n, R);
  const superProfit = avg.sub(normalProfit);
  return { normalProfit, superProfit, goodwill: superProfit.isPositive() ? superProfit.mulRatio(yearsPurchase, 1n, R) : Money.ZERO };
}

/**
 * Capitalisation method. Capitalised value of average profit = avg × 100/rate; goodwill = that − capital employed
 * (net assets). Capital employed must be supplied by the caller (net of goodwill, per the question).
 */
export function goodwillCapitalisation(avg: Money, normalRatePercent: bigint, capitalEmployed: Money): { capitalisedValue: Money; goodwill: Money } {
  const capitalisedValue = avg.mulRatio(100n, normalRatePercent, R);
  const g = capitalisedValue.sub(capitalEmployed);
  return { capitalisedValue, goodwill: g.isPositive() ? g : Money.ZERO };
}

// ────────────────────────── admission ───────────────────────────────────────────────────────────

export interface AdmissionInput {
  readonly partners: readonly Partner[];
  readonly oldShares: Record<string, Fraction>;
  readonly capitals: Record<string, Money>;
  /** New partner's id + share of future profit. */
  readonly newPartner: { readonly id: string; readonly name: string; readonly share: Fraction };
  /** Old partners' sacrifice; default = proportional to old shares (new partner's share comes out of old partners in old ratio). */
  readonly sacrifice?: Record<string, Fraction>;
  /** Total goodwill of the FIRM (new partner brings his share of it as premium). */
  readonly goodwillOfFirm?: Money;
  /** Premium actually brought by the new partner. Default = goodwillOfFirm × newShare. */
  readonly premiumBrought?: Money;
  /** Net revaluation profit (+) / loss (−) and accumulated reserves (+) / losses (−) to distribute in the OLD ratio. */
  readonly revaluation?: Money;
  readonly reserves?: Money;
  readonly accumulatedLosses?: Money;
  /** Existing goodwill in the books (written off in old ratio). */
  readonly existingGoodwill?: Money;
  /** If set, the new partner's capital is this exact amount. */
  readonly newPartnerCapital?: Money;
  /** …or: capital = this fraction of the OLD partners' combined ADJUSTED capital (sample paper Q25A: "equal to 1/4th of the combined capital of X and Y"). */
  readonly newPartnerCapitalFractionOfOld?: Fraction;
  /** Default when neither is given: capital in proportion to his profit share (Q9 style): old total × share/(1−share). */
}

export interface AdmissionResult {
  readonly newShares: Record<string, Fraction>;
  readonly sacrificeRatio: Record<string, Fraction>;
  readonly premium: Money;
  readonly premiumShare: Record<string, Money>;
  readonly adjustedCapital: Record<string, Money>;
  readonly newPartnerCapital: Money;
  readonly firmCapital: Money;
}

/**
 * Admission of a partner (hidden-goodwill-free). Order follows the usual textbook sequence:
 * premium for goodwill (to sacrificing partners) → write off existing goodwill → revaluation, reserves,
 * accumulated losses in old ratio → adjusted capital → new partner's capital = his share × firm capital
 * (derived from old partners' adjusted capital when not given).
 */
export function admission(input: AdmissionInput): AdmissionResult {
  const ids = input.partners.map(p => p.id);
  const np = input.newPartner;
  const oldShares = input.oldShares;
  const sacrifice = input.sacrifice ?? Object.fromEntries(ids.map(i => [i, oldShares[i]!.mul(np.share)]));
  const newShares: Record<string, Fraction> = {};
  for (const i of ids) newShares[i] = oldShares[i]!.sub(sacrifice[i]!);
  newShares[np.id] = np.share;
  const check = Object.values(newShares).reduce((a, b) => a.add(b), Fraction.ZERO);
  if (!check.equals(Fraction.ONE)) throw new RangeError(`New shares add up to ${check.toString()}, not 1 — check the sacrifice`);

  const premium = input.premiumBrought ?? (input.goodwillOfFirm ? np.share.of_(input.goodwillOfFirm, R) : Money.ZERO);
  const sacList = ids.map(i => sacrifice[i]!);
  const sacTotal = sacList.reduce((a, b) => a.add(b), Fraction.ZERO);
  const sacRatio = normaliseList(sacList);
  const premParts = sacTotal.isZero() ? ids.map(() => Money.ZERO) : allocate(premium, sacRatio);
  const premiumShare: Record<string, Money> = {};
  const oldRatio = ids.map(i => oldShares[i]!);
  const sacrificeRatio: Record<string, Fraction> = {};
  ids.forEach((i, k) => { premiumShare[i] = premParts[k]!; sacrificeRatio[i] = sacRatio[k]!; });

  const spread = (m: Money | undefined) => (m && !m.isZero() ? allocate(m, oldRatio) : ids.map(() => Money.ZERO));
  const rev = spread(input.revaluation), res = spread(input.reserves), loss = spread(input.accumulatedLosses), gw = spread(input.existingGoodwill);

  const adjustedCapital: Record<string, Money> = {};
  ids.forEach((i, k) => {
    adjustedCapital[i] = (input.capitals[i] ?? Money.ZERO)
      .add(premiumShare[i]!).add(rev[k]!).add(res[k]!).sub(loss[k]!).sub(gw[k]!);
  });
  const oldTotal = total(adjustedCapital);
  const oldShareTotal = Fraction.ONE.sub(np.share);
  // new partner's capital = share/(1−share) × old partners' adjusted capital (so capitals sit in the new ratio)
  const derived = oldTotal.mulRatio(np.share.num * oldShareTotal.den, np.share.den * oldShareTotal.num, R);
  const newPartnerCapital = input.newPartnerCapital
    ?? (input.newPartnerCapitalFractionOfOld ? input.newPartnerCapitalFractionOfOld.of_(oldTotal, R) : derived);
  return { newShares, sacrificeRatio, premium, premiumShare, adjustedCapital, newPartnerCapital, firmCapital: oldTotal.add(newPartnerCapital) };
}

/**
 * Capital adjustment to bring partners' capitals in line with the new profit-sharing ratio:
 * given the new partner's capital and share, what the others' capitals SHOULD be, and the cash to bring in (+)/withdraw (−).
 */
export function capitalAdjustment(newShares: Record<string, Fraction>, actual: Record<string, Money>, basis: { partner: string; capital: Money }): { required: Record<string, Money>; bringIn: Record<string, Money> } {
  const base = newShares[basis.partner]!;
  const firm = basis.capital.mulRatio(base.den, base.num, R);
  const required: Record<string, Money> = {}, bringIn: Record<string, Money> = {};
  for (const i of Object.keys(newShares)) {
    required[i] = newShares[i]!.of_(firm, R);
    bringIn[i] = required[i]!.sub(actual[i] ?? Money.ZERO);
  }
  return { required, bringIn };
}

// ────────────────────────── retirement / death ──────────────────────────────────────────────────

/** Gaining ratio on retirement/death = new share − old share for each continuing partner. */
export function gainingRatioOnExit(oldShares: Record<string, Fraction>, newShares: Record<string, Fraction>, exiting: string): Record<string, Fraction> {
  const out: Record<string, Fraction> = {};
  for (const i of Object.keys(oldShares)) {
    if (i === exiting) continue;
    out[i] = (newShares[i] ?? Fraction.ZERO).sub(oldShares[i]!);
  }
  return out;
}

/** New shares when the exiting partner's share is taken up by the others — default: in their old ratio (they gain proportionally). */
export function newSharesAfterExit(oldShares: Record<string, Fraction>, exiting: string, acquired?: Record<string, Fraction>): Record<string, Fraction> {
  const rest = Object.keys(oldShares).filter(i => i !== exiting);
  const out: Record<string, Fraction> = {};
  if (acquired) { for (const i of rest) out[i] = oldShares[i]!.add(acquired[i] ?? Fraction.ZERO); return out; }
  const restTotal = rest.reduce((a, i) => a.add(oldShares[i]!), Fraction.ZERO);
  for (const i of rest) out[i] = oldShares[i]!.div(restTotal);
  return out;
}

export interface ExitInput {
  readonly oldShares: Record<string, Fraction>;
  readonly newShares: Record<string, Fraction>;
  readonly exiting: string;
  readonly capitals: Record<string, Money>;
  readonly goodwillOfFirm: Money;
  /** Goodwill already in the books (written off in the old ratio first). */
  readonly existingGoodwill?: Money;
  readonly revaluation?: Money;          // net profit +, loss −
  readonly reserves?: Money;             // credit reserves & profit
  readonly accumulatedLosses?: Money;
  /** Extra items credited/debited to the exiting partner only (interest on capital, share of profit to date of death, less drawings…). */
  readonly exitingAdjustments?: Money;
}

export interface ExitResult {
  readonly goodwillCompensation: Record<string, Money>;   // + credit / − debit per partner (gainers pay the exiting partner)
  readonly closingCapital: Record<string, Money>;
  readonly amountDue: Money;
}

/**
 * Retirement / death settlement of the capital accounts.
 * Goodwill: partners' accounts are credited with their old-share of the firm's goodwill…, but the CBSE method used
 * (and tested against the sample paper) is: the exiting partner is credited with his share of goodwill and the
 * GAINING partners are debited in the gaining ratio. Existing goodwill is first written off in the old ratio.
 */
export function exitSettlement(input: ExitInput): ExitResult {
  const ids = Object.keys(input.oldShares);
  const old = ids.map(i => input.oldShares[i]!);
  const spread = (m: Money | undefined) => (m && !m.isZero() ? allocate(m, old) : ids.map(() => Money.ZERO));
  const gwOff = spread(input.existingGoodwill), rev = spread(input.revaluation), res = spread(input.reserves), loss = spread(input.accumulatedLosses);

  const exitShare = input.oldShares[input.exiting]!;
  const gwShare = exitShare.of_(input.goodwillOfFirm, R);
  const gain = gainingRatioOnExit(input.oldShares, input.newShares, input.exiting);
  const payers = Object.keys(gain).filter(i => gain[i]!.isPositive());
  const payParts = payers.length ? allocate(gwShare, normaliseList(payers.map(i => gain[i]!))) : [];
  const goodwillCompensation: Record<string, Money> = Object.fromEntries(ids.map(i => [i, Money.ZERO]));
  goodwillCompensation[input.exiting] = gwShare;
  payers.forEach((i, k) => { goodwillCompensation[i] = payParts[k]!.neg(); });

  const closingCapital: Record<string, Money> = {};
  ids.forEach((i, k) => {
    closingCapital[i] = (input.capitals[i] ?? Money.ZERO)
      .sub(gwOff[k]!).add(rev[k]!).add(res[k]!).sub(loss[k]!).add(goodwillCompensation[i]!);
  });
  closingCapital[input.exiting] = closingCapital[input.exiting]!.add(input.exitingAdjustments ?? Money.ZERO);
  return { goodwillCompensation, closingCapital, amountDue: closingCapital[input.exiting]! };
}

export interface ExecutorRow { readonly date: string; readonly particulars: string; readonly debit: Money; readonly credit: Money; }
export interface ExecutorSchedule { readonly rows: readonly ExecutorRow[]; readonly paidInTotal: Money; readonly interestTotal: Money; }

/**
 * Amount due paid in `instalments` equal yearly parts after an immediate payment, with interest on the unpaid balance.
 * `firstMonths` = months from the date of death to the first payment date (interest for that part year).
 * Matches the sample-paper executor's account (Q22B): ₹3,22,000 due, ₹22,000 now, 3 instalments, 10% p.a.
 */
export function executorSchedule(opts: {
  amountDue: Money; paidNow: Money; instalments: number; ratePercent: bigint; firstMonths: bigint; labels: readonly string[];
}): ExecutorSchedule {
  const balance0 = opts.amountDue.sub(opts.paidNow);
  const parts = allocate(balance0, Array.from({ length: opts.instalments }, () => Fraction.of(1, opts.instalments)));
  const rows: ExecutorRow[] = [];
  rows.push({ date: opts.labels[0] ?? '', particulars: 'By capital / amount due', debit: Money.ZERO, credit: opts.amountDue });
  rows.push({ date: opts.labels[0] ?? '', particulars: 'To bank (paid now)', debit: opts.paidNow, credit: Money.ZERO });
  let bal = balance0, interestTotal = Money.ZERO, paid = opts.paidNow;
  for (let k = 0; k < opts.instalments; k++) {
    const months = k === 0 ? opts.firstMonths : 12n;
    const interest = interestPA(bal, opts.ratePercent, months);
    interestTotal = interestTotal.add(interest);
    const pay = parts[k]!.add(interest);
    rows.push({ date: opts.labels[k + 1] ?? '', particulars: 'By interest', debit: Money.ZERO, credit: interest });
    rows.push({ date: opts.labels[k + 1] ?? '', particulars: 'To bank (instalment + interest)', debit: pay, credit: Money.ZERO });
    bal = bal.sub(parts[k]!);
    paid = paid.add(pay);
  }
  return { rows, paidInTotal: paid, interestTotal };
}

// ────────────────────────── dissolution ─────────────────────────────────────────────────────────

export interface DissolutionInput {
  readonly partners: readonly Partner[];
  readonly shares: Record<string, Fraction>;
  readonly capitals: Record<string, Money>;
  /** Credit reserves / P&L credit and debit P&L/deferred losses, distributed in the profit-sharing ratio. */
  readonly reserves?: Money;
  readonly accumulatedLosses?: Money;
  readonly partnerLoans?: Record<string, Money>;               // loans FROM partners (credit)
  readonly partnerAdvances?: Record<string, Money>;           // loans/advances TO partners (debit) — rare; netted into capital
  /** Assets (excluding cash/bank) at BOOK value and what they realised. Unlisted realised values follow the syllabus note. */
  readonly assets: readonly { name: string; book: Money; realised?: Money | undefined; tangible: boolean; takenOverBy?: string | undefined }[];
  /** Outside liabilities (book) and what was paid. Missing `paid` ⇒ paid at book. */
  readonly liabilities: readonly { name: string; book: Money; paid?: Money | undefined; assumedBy?: string | undefined }[];
  /** Liabilities already provided against / contra items transferred to realisation as credits (provisions against assets). */
  readonly provisionsAgainstAssets?: Money;
  readonly cashAtStart: Money;                                 // cash + bank balance
  /** Realisation expenses and who bears / pays them. */
  readonly expenses?: readonly { amount: Money; paidBy: 'FIRM' | string; borneBy: 'FIRM' | string }[];
}

export interface DissolutionResult {
  readonly realisationDebit: Money;
  readonly realisationCredit: Money;
  readonly profitOnRealisation: Money;      // negative = loss
  readonly profitShare: Record<string, Money>;
  readonly capitalBefore: Record<string, Money>;
  readonly finalCapital: Record<string, Money>;   // amount finally paid to (+) / brought by (−) each partner
  readonly cashEnd: Money;                      // must equal zero when everything is settled
  readonly rows: readonly { label: string; amount: Money }[];
}

/**
 * Dissolution by realisation account (syllabus scope: NO piecemeal distribution, sale to company or insolvency).
 * Syllabus notes honoured: tangible asset with no realised value ⇒ book value; intangible with none ⇒ nil.
 *
 *  Realisation A/c  Dr: assets at book, liabilities paid, expenses borne by firm and paid by firm.
 *  Realisation A/c  Cr: assets realised, liabilities taken over (at book),  provisions against assets.
 *  Profit/loss on realisation → partners in profit-sharing ratio.
 */
export function dissolve(inp: DissolutionInput): DissolutionResult {
  const ids = inp.partners.map(p => p.id);
  const shares = ids.map(i => inp.shares[i]!);
  const rows: { label: string; amount: Money }[] = [];
  let dr = Money.ZERO;     // Realisation Dr side
  let cr = Money.ZERO;     // Realisation Cr side
  let cash = inp.cashAtStart;
  const outsideCapital: Record<string, Money> = Object.fromEntries(ids.map(i => [i, Money.ZERO]));   // + = partner effectively received value / − = paid

  // 1. transfer assets (book) to Dr, outside liabilities (book) to Cr
  for (const a of inp.assets) dr = dr.add(a.book);
  for (const l of inp.liabilities) cr = cr.add(l.book);
  if (inp.provisionsAgainstAssets) cr = cr.add(inp.provisionsAgainstAssets);

  // 2. assets realised → Cr realisation, cash in (or taken over by a partner → debit his capital)
  for (const a of inp.assets) {
    const realised = a.realised ?? (a.tangible ? a.book : Money.ZERO);
    cr = cr.add(realised);
    if (a.takenOverBy) { outsideCapital[a.takenOverBy] = outsideCapital[a.takenOverBy]!.sub(realised); rows.push({ label: `${a.name} taken over by ${a.takenOverBy}`, amount: realised }); }
    else { cash = cash.add(realised); rows.push({ label: `${a.name} realised`, amount: realised }); }
  }
  // 3. liabilities paid → Dr realisation (what was paid), cash out (or assumed by a partner → credit his capital)
  for (const l of inp.liabilities) {
    const paid = l.paid ?? l.book;
    dr = dr.add(paid);
    if (l.assumedBy) { outsideCapital[l.assumedBy] = outsideCapital[l.assumedBy]!.add(paid); rows.push({ label: `${l.name} assumed by ${l.assumedBy}`, amount: paid }); }
    else { cash = cash.sub(paid); rows.push({ label: `${l.name} paid`, amount: paid }); }
  }
  // 4. expenses
  for (const e of inp.expenses ?? []) {
    const byFirm = e.borneBy === 'FIRM';
    if (byFirm) dr = dr.add(e.amount); else outsideCapital[e.borneBy] = outsideCapital[e.borneBy]!.sub(e.amount);
    if (e.paidBy === 'FIRM') cash = cash.sub(e.amount); else outsideCapital[e.paidBy] = outsideCapital[e.paidBy]!.add(e.amount);
    rows.push({ label: `Expenses (borne by ${e.borneBy}, paid by ${e.paidBy})`, amount: e.amount });
  }

  const profit = cr.sub(dr);                       // realisation profit (+) / loss (−)
  const split = allocate(profit.isNegative() ? profit.neg() : profit, shares);
  const profitShare: Record<string, Money> = {};
  ids.forEach((i, k) => { profitShare[i] = profit.isNegative() ? split[k]!.neg() : split[k]!; });

  const resSplit = inp.reserves && !inp.reserves.isZero() ? allocate(inp.reserves, shares) : ids.map(() => Money.ZERO);
  const lossSplit = inp.accumulatedLosses && !inp.accumulatedLosses.isZero() ? allocate(inp.accumulatedLosses, shares) : ids.map(() => Money.ZERO);

  const finalCapital: Record<string, Money> = {};
  const capitalBefore: Record<string, Money> = {};
  ids.forEach((i, k) => {
    capitalBefore[i] = inp.capitals[i] ?? Money.ZERO;
    finalCapital[i] = capitalBefore[i]!
      .add(resSplit[k]!).sub(lossSplit[k]!)
      .add(profitShare[i]!)
      .add(outsideCapital[i]!)
      .add(inp.partnerLoans?.[i] ?? Money.ZERO)         // partner's loan is repaid together with his capital
      .sub(inp.partnerAdvances?.[i] ?? Money.ZERO);
  });
  const toPartners = Money.sum(Object.values(finalCapital));
  const cashEnd = cash.sub(toPartners);
  return { realisationDebit: dr, realisationCredit: cr, profitOnRealisation: profit, profitShare, capitalBefore, finalCapital, cashEnd, rows };
}
