/**
 * Depreciation — Class XI Unit 2 (SLM, WDV, recording by two methods, disposal). "Excluding change of method."
 */
import { Fraction } from './fraction';
import type { Illustration } from './company';
import { Money } from './money';

const R = 'HALF_UP' as const;
export type DepMethod = 'SLM' | 'WDV';

export interface DepRow { readonly year: number; readonly opening: Money; readonly depreciation: Money; readonly closing: Money; }

/** Percentage helper: pct(10) = 10%, pct(7.5 as 15,2) = Fraction.of(15, 200). */
export const pct = (n: number | bigint, outOf = 100): Fraction => Fraction.of(n, outOf);

/**
 * Schedule of depreciation.
 *  SLM: a fixed amount each year = cost × rate  (or (cost − scrap) ÷ life when `lifeYears` is given).
 *  WDV: rate × opening book value each year.
 * `firstYearMonths` (1–12) charges only part of the first year (asset bought mid-year).
 * With a life-based SLM the LAST year absorbs rounding so the closing value is exactly the scrap value.
 */
export function depreciationSchedule(o: {
  cost: Money; method: DepMethod; years: number; rate?: Fraction; scrap?: Money; lifeYears?: number; firstYearMonths?: number;
}): DepRow[] {
  if (!(o.years >= 1) || !Number.isInteger(o.years)) throw new RangeError('years must be a whole number ≥ 1');
  const scrap = o.scrap ?? Money.ZERO;
  if (o.cost.isNegative() || scrap.isNegative() || scrap.cmp(o.cost) > 0) throw new RangeError('Scrap value must be between 0 and the cost');
  const fm = o.firstYearMonths ?? 12;
  if (!Number.isInteger(fm) || fm < 1 || fm > 12) throw new RangeError('firstYearMonths must be 1–12');
  const part = (k: number) => (k === 1 ? Fraction.of(fm, 12) : Fraction.ONE);

  let annualSLM: Money | undefined;
  if (o.method === 'SLM') {
    if (o.lifeYears) {
      if (o.lifeYears < 1 || !Number.isInteger(o.lifeYears)) throw new RangeError('lifeYears must be a whole number ≥ 1');
      annualSLM = o.cost.sub(scrap).mulRatio(1n, BigInt(o.lifeYears), R);
    } else if (o.rate) annualSLM = o.rate.of_(o.cost, R);
    else throw new RangeError('SLM needs either a rate or lifeYears');
  } else if (!o.rate) throw new RangeError('WDV needs a rate');

  const rows: DepRow[] = [];
  let open = o.cost;
  for (let k = 1; k <= o.years; k++) {
    let dep = o.method === 'SLM' ? part(k).of_(annualSLM!, R) : part(k).of_(o.rate!.of_(open, R), R);
    // never depreciate below scrap (and absorb rounding in the last year of a life-based SLM)
    const floor = scrap;
    if (o.method === 'SLM' && o.lifeYears && k === o.lifeYears && fm === 12) dep = open.sub(floor);
    if (open.sub(dep).cmp(floor) < 0) dep = open.sub(floor);
    rows.push({ year: k, opening: open, depreciation: dep, closing: open.sub(dep) });
    open = open.sub(dep);
  }
  return rows;
}

export type RecordingMethod = 'ASSET_ACCOUNT' | 'PROVISION';

/** Annual depreciation entry under the two prescribed methods of recording. */
export function depreciationEntry(assetName: string, amount: Money, method: RecordingMethod): Illustration {
  return method === 'ASSET_ACCOUNT'
    ? { narration: `Depreciation on ${assetName}`, lines: [{ account: 'Depreciation A/c', side: 'DR', amount }, { account: `${assetName} A/c`, side: 'CR', amount }] }
    : { narration: `Depreciation on ${assetName}`, lines: [{ account: 'Depreciation A/c', side: 'DR', amount }, { account: `Provision for Depreciation / Accumulated Depreciation A/c`, side: 'CR', amount }] };
}

export interface DisposalResult {
  readonly bookValue: Money; readonly saleProceeds: Money;
  /** Positive = profit on sale, negative = loss. */
  readonly profitOrLoss: Money;
  readonly entries: readonly Illustration[];
}

/**
 * Sale of an asset.
 *  - `accumulated`: total depreciation provided up to the date of sale INCLUDING the part-year charge.
 *  - Under ASSET_ACCOUNT the asset is carried at book value, so the disposal removes the book value.
 *  - Under PROVISION the asset is at cost, so it is transferred (with its provision) to an Asset Disposal A/c.
 */
export function disposeAsset(o: { name: string; cost: Money; accumulated: Money; saleProceeds: Money; method: RecordingMethod }): DisposalResult {
  const bv = o.cost.sub(o.accumulated);
  const pl = o.saleProceeds.sub(bv);
  const L = (account: string, side: 'DR' | 'CR', amount: Money) => ({ account, side, amount });
  const nz = <T extends { amount: Money }>(xs: T[]) => xs.filter(x => !x.amount.isZero());
  const plLines = pl.isPositive() ? [L('Profit on Sale of Asset A/c', 'CR', pl)] : pl.isNegative() ? [L('Loss on Sale of Asset A/c', 'DR', pl.neg())] : [];
  const entries: Illustration[] = o.method === 'ASSET_ACCOUNT'
    ? [{ narration: `Sale of ${o.name}`, lines: nz([L('Bank A/c', 'DR', o.saleProceeds), ...plLines.filter(l => l.side === 'DR'), L(`${o.name} A/c`, 'CR', bv), ...plLines.filter(l => l.side === 'CR')]) }]
    : [
      { narration: `${o.name} transferred to Asset Disposal A/c at cost`, lines: [L('Asset Disposal A/c', 'DR', o.cost), L(`${o.name} A/c`, 'CR', o.cost)] },
      { narration: 'Provision for depreciation on the asset sold', lines: nz([L('Provision for Depreciation A/c', 'DR', o.accumulated), L('Asset Disposal A/c', 'CR', o.accumulated)]) },
      { narration: 'Sale proceeds', lines: [L('Bank A/c', 'DR', o.saleProceeds), L('Asset Disposal A/c', 'CR', o.saleProceeds)] },
      { narration: 'Profit / loss on sale', lines: nz(pl.isPositive() ? [L('Asset Disposal A/c', 'DR', pl), L('Profit & Loss A/c', 'CR', pl)] : [L('Profit & Loss A/c', 'DR', pl.neg()), L('Asset Disposal A/c', 'CR', pl.neg())]) },
    ];
  return { bookValue: bv, saleProceeds: o.saleProceeds, profitOrLoss: pl, entries };
}
