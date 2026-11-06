import { Money, type RoundingMode, divRound } from './money';

/** gcd on bigint (always non-negative). */
export function gcd(a: bigint, b: bigint): bigint {
  a = a < 0n ? -a : a; b = b < 0n ? -b : b;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
}

/**
 * Exact rational number (profit shares, ratios). Always stored in lowest terms with a positive
 * denominator, so equal fractions compare equal and nothing is ever approximated.
 */
export class Fraction {
  private constructor(readonly num: bigint, readonly den: bigint) { Object.freeze(this); }

  static of(num: bigint | number, den: bigint | number = 1n): Fraction {
    let n = BigInt(num), d = BigInt(den);
    if (d === 0n) throw new RangeError('Fraction with zero denominator');
    if (d < 0n) { n = -n; d = -d; }
    const g = gcd(n, d) || 1n;
    return new Fraction(n / g, d / g);
  }

  static readonly ZERO = Fraction.of(0);
  static readonly ONE = Fraction.of(1);

  /** Shares from integer weights, e.g. fromRatio([4,3,2]) = 4/9, 3/9, 2/9. */
  static fromRatio(weights: readonly (bigint | number)[]): Fraction[] {
    const ws = weights.map(BigInt);
    if (ws.some(w => w < 0n)) throw new RangeError('Ratio weights must not be negative');
    const total = ws.reduce((a, b) => a + b, 0n);
    if (total === 0n) throw new RangeError('Ratio weights sum to zero');
    return ws.map(w => Fraction.of(w, total));
  }

  add(o: Fraction): Fraction { return Fraction.of(this.num * o.den + o.num * this.den, this.den * o.den); }
  sub(o: Fraction): Fraction { return Fraction.of(this.num * o.den - o.num * this.den, this.den * o.den); }
  mul(o: Fraction): Fraction { return Fraction.of(this.num * o.num, this.den * o.den); }
  div(o: Fraction): Fraction { return Fraction.of(this.num * o.den, this.den * o.num); }
  neg(): Fraction { return Fraction.of(-this.num, this.den); }
  isZero(): boolean { return this.num === 0n; }
  isNegative(): boolean { return this.num < 0n; }
  isPositive(): boolean { return this.num > 0n; }
  equals(o: Fraction): boolean { return this.num === o.num && this.den === o.den; }
  cmp(o: Fraction): -1 | 0 | 1 { const l = this.num * o.den, r = o.num * this.den; return l < r ? -1 : l > r ? 1 : 0; }
  toString(): string { return this.den === 1n ? `${this.num}` : `${this.num}/${this.den}`; }

  /** Money × this fraction, rounded to whole paise with an explicit mode. */
  of_(m: Money, mode: RoundingMode): Money { return m.mulRatio(this.num, this.den, mode); }
}

/**
 * Divide `total` among shares so the parts add up to the total EXACTLY (largest-remainder method):
 * ₹100 split 1:1:1 gives 33.34 / 33.33 / 33.33, never 33.33 × 3 = 99.99.
 */
export function allocate(total: Money, shares: readonly Fraction[]): Money[] {
  if (shares.length === 0) throw new RangeError('No shares to allocate to');
  const sum = shares.reduce((a, b) => a.add(b), Fraction.ZERO);
  if (!sum.equals(Fraction.ONE)) throw new RangeError(`Shares must add up to 1 (got ${sum.toString()})`);
  if (shares.some(s => s.isNegative())) throw new RangeError('Shares must not be negative');
  const neg = total.isNegative();
  const t = neg ? -total.paise : total.paise;
  const floors = shares.map(s => (t * s.num) / s.den);
  const rems = shares.map((s, i) => ({ i, r: (t * s.num) % s.den, den: s.den }));
  let left = t - floors.reduce((a, b) => a + b, 0n);
  // hand out the leftover paise to the largest remainders (ties: earlier partner first)
  rems.sort((a, b) => { const l = a.r * b.den, r = b.r * a.den; return l === r ? a.i - b.i : l > r ? -1 : 1; });
  for (const x of rems) { if (left <= 0n) break; floors[x.i]! += 1n; left -= 1n; }
  return floors.map(p => Money.fromPaise(neg ? -p : p));
}

/** An exact ratio value (e.g. current ratio 1.47 : 1), kept as a fraction and rounded only for display. */
export function fixed(num: bigint, den: bigint, decimals: number, mode: RoundingMode = 'HALF_UP'): string {
  if (den === 0n) throw new RangeError('Division by zero');
  const scale = 10n ** BigInt(decimals);
  const q = divRound(num * scale, den, mode);
  const neg = q < 0n;
  const abs = neg ? -q : q;
  const whole = abs / scale;
  const frac = (abs % scale).toString().padStart(decimals, '0');
  return `${neg ? '-' : ''}${whole}${decimals ? '.' + frac : ''}`;
}
