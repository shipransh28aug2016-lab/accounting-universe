/**
 * Exact money. Amounts are integer PAISE held in a `bigint`; binary floating point is never used
 * (so 0.10 + 0.20 is exactly 0.30, and values beyond Number.MAX_SAFE_INTEGER are safe).
 *
 * Anything that is not an exact integer number of paise (a depreciation rate, a ratio, a share of
 * profit) must go through `mulRatio`, which takes an explicit rounding mode — rounding is a visible
 * policy decision, never an accident.
 */

export type RoundingMode = 'HALF_UP' | 'HALF_EVEN' | 'DOWN' | 'UP';

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

/** Integer division with explicit rounding. `d` must be non-zero; sign is handled correctly. */
export function divRound(n: bigint, d: bigint, mode: RoundingMode): bigint {
  if (d === 0n) throw new MoneyError('Division by zero');
  if (d < 0n) { n = -n; d = -d; }
  const q = n / d;                 // truncates toward zero
  const r = n % d;                 // same sign as n
  if (r === 0n) return q;
  const away = n < 0n ? q - 1n : q + 1n;
  const twice = (r < 0n ? -r : r) * 2n;
  switch (mode) {
    case 'DOWN': return q;
    case 'UP': return away;
    case 'HALF_UP': return twice >= d ? away : q;                          // half away from zero
    case 'HALF_EVEN':
      if (twice > d) return away;
      if (twice < d) return q;
      return q % 2n === 0n ? q : away;
  }
}

export class Money {
  private constructor(readonly paise: bigint) {
    Object.freeze(this);
  }

  static readonly ZERO = new Money(0n);

  static fromPaise(paise: bigint | number): Money {
    if (typeof paise === 'number') {
      if (!Number.isSafeInteger(paise)) throw new MoneyError(`Not a safe integer number of paise: ${paise}`);
      return new Money(BigInt(paise));
    }
    return new Money(paise);
  }

  /** Parse a plain decimal string such as "1234.5" or "-0.05". Max 2 decimals; no commas, no floats. */
  static parse(text: string): Money {
    const m = /^(-)?(\d+)(?:\.(\d{1,2}))?$/.exec(text.trim());
    if (!m) throw new MoneyError(`Invalid amount "${text}" (use digits with at most 2 decimals)`);
    const whole = BigInt(m[2]!);
    const frac = BigInt((m[3] ?? '').padEnd(2, '0') || '0');
    const paise = whole * 100n + frac;
    return new Money(m[1] ? -paise : paise);
  }

  /** Whole rupees, e.g. Money.rupees(500) = ₹500.00. */
  static rupees(r: bigint | number): Money {
    if (typeof r === 'number' && !Number.isSafeInteger(r)) throw new MoneyError(`Not a whole number of rupees: ${r}`);
    return new Money(BigInt(r) * 100n);
  }

  add(o: Money): Money { return new Money(this.paise + o.paise); }
  sub(o: Money): Money { return new Money(this.paise - o.paise); }
  neg(): Money { return new Money(-this.paise); }
  abs(): Money { return this.paise < 0n ? this.neg() : this; }
  isZero(): boolean { return this.paise === 0n; }
  isPositive(): boolean { return this.paise > 0n; }
  isNegative(): boolean { return this.paise < 0n; }
  equals(o: Money): boolean { return this.paise === o.paise; }
  cmp(o: Money): -1 | 0 | 1 { return this.paise < o.paise ? -1 : this.paise > o.paise ? 1 : 0; }

  /** this × num/den, rounded to whole paise with an explicit mode. (e.g. 10% = mulRatio(10n, 100n, …)) */
  mulRatio(num: bigint, den: bigint, mode: RoundingMode): Money {
    return new Money(divRound(this.paise * num, den, mode));
  }

  /** Sum of a list (empty ⇒ zero). */
  static sum(items: Iterable<Money>): Money {
    let t = 0n;
    for (const i of items) t += i.paise;
    return new Money(t);
  }

  /** Canonical plain form: "1234.56", "-0.05". Safe for storage/transport. */
  toString(): string {
    const neg = this.paise < 0n;
    const abs = neg ? -this.paise : this.paise;
    const whole = abs / 100n;
    const frac = (abs % 100n).toString().padStart(2, '0');
    return `${neg ? '-' : ''}${whole}.${frac}`;
  }

  /** Indian digit grouping for display: ₹1,23,456.78 (lakh/crore). */
  format(): string {
    const neg = this.paise < 0n;
    const abs = neg ? -this.paise : this.paise;
    const whole = (abs / 100n).toString();
    const frac = (abs % 100n).toString().padStart(2, '0');
    let grouped: string;
    if (whole.length <= 3) grouped = whole;
    else {
      const head = whole.slice(0, -3);
      const tail = whole.slice(-3);
      grouped = head.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + tail;
    }
    return `${neg ? '-' : ''}₹${grouped}.${frac}`;
  }
}
