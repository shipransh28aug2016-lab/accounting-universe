import { describe, expect, it } from 'vitest';
import { Money, MoneyError, divRound } from '../src';

describe('Money — exactness', () => {
  it('0.1 + 0.2 is exactly 0.3 (binary floats get this wrong)', () => {
    expect(0.1 + 0.2).not.toBe(0.3);                                   // the trap we avoid
    expect(Money.parse('0.1').add(Money.parse('0.2')).equals(Money.parse('0.3'))).toBe(true);
    expect(Money.parse('0.1').add(Money.parse('0.2')).toString()).toBe('0.30');
  });

  it('is exact beyond Number.MAX_SAFE_INTEGER', () => {
    const big = Money.parse('90071992547409930.99');                   // > 2^53 paise
    expect(big.add(Money.parse('0.01')).toString()).toBe('90071992547409931.00');
    expect(big.sub(big).isZero()).toBe(true);
  });

  it('parses canonical decimals', () => {
    expect(Money.parse('1234.5').paise).toBe(123450n);
    expect(Money.parse('7').paise).toBe(700n);
    expect(Money.parse('-0.05').paise).toBe(-5n);
    expect(Money.parse(' 12.34 ').paise).toBe(1234n);
    expect(Money.rupees(500).toString()).toBe('500.00');
  });

  it.each(['', '.5', '1.', '1.234', '1,000', 'abc', '1e3', '--1', '1 000', '₹5'])('rejects %j', bad => {
    expect(() => Money.parse(bad)).toThrow(MoneyError);
  });

  it('rejects non-integer / unsafe paise numbers', () => {
    expect(() => Money.fromPaise(0.5)).toThrow(MoneyError);
    expect(() => Money.fromPaise(2 ** 53)).toThrow(MoneyError);
    expect(Money.fromPaise(2n ** 70n).paise).toBe(2n ** 70n);
  });

  it('round-trips through toString', () => {
    for (const s of ['0.00', '0.01', '-0.01', '1.00', '99999999999.99', '-5.50']) expect(Money.parse(s).toString()).toBe(s);
  });

  it('compares, negates, sums', () => {
    expect(Money.parse('1').cmp(Money.parse('2'))).toBe(-1);
    expect(Money.parse('2').cmp(Money.parse('2'))).toBe(0);
    expect(Money.parse('3').neg().isNegative()).toBe(true);
    expect(Money.sum([Money.parse('1.10'), Money.parse('2.20'), Money.parse('3.30')]).toString()).toBe('6.60');
    expect(Money.sum([]).isZero()).toBe(true);
  });
});

describe('Money — Indian digit grouping', () => {
  it.each([
    ['0.05', '₹0.05'], ['999', '₹999.00'], ['1000', '₹1,000.00'], ['12345.6', '₹12,345.60'],
    ['100000', '₹1,00,000.00'], ['123456.78', '₹1,23,456.78'], ['1234567.89', '₹12,34,567.89'],
    ['10000000', '₹1,00,00,000.00'], ['-5', '-₹5.00'],
  ])('%s → %s', (input, out) => expect(Money.parse(input).format()).toBe(out));
});

describe('rounding is explicit', () => {
  const half = (p: bigint, mode: Parameters<Money['mulRatio']>[2]) => Money.fromPaise(p).mulRatio(1n, 2n, mode).paise;

  it('positive half-way (5 paise × ½ = 2.5)', () => {
    expect(half(5n, 'HALF_UP')).toBe(3n);
    expect(half(5n, 'HALF_EVEN')).toBe(2n);
    expect(half(5n, 'DOWN')).toBe(2n);
    expect(half(5n, 'UP')).toBe(3n);
  });
  it('negative half-way rounds symmetrically (−5 paise × ½ = −2.5)', () => {
    expect(half(-5n, 'HALF_UP')).toBe(-3n);
    expect(half(-5n, 'HALF_EVEN')).toBe(-2n);
    expect(half(-5n, 'DOWN')).toBe(-2n);
    expect(half(-5n, 'UP')).toBe(-3n);
  });
  it('half-even rounds 1.5 up to 2 and 2.5 down to 2', () => {
    expect(half(3n, 'HALF_EVEN')).toBe(2n);
    expect(half(5n, 'HALF_EVEN')).toBe(2n);
  });
  it('exact results are untouched', () => {
    expect(Money.parse('100').mulRatio(10n, 100n, 'HALF_UP').toString()).toBe('10.00');
    expect(half(4n, 'UP')).toBe(2n);
  });
  it('hand-worked: ₹99.99 × 15% = ₹14.9985 → ₹15.00 (HALF_UP), ₹14.99 (DOWN)', () => {
    const c = Money.parse('99.99');
    expect(c.mulRatio(15n, 100n, 'HALF_UP').toString()).toBe('15.00');
    expect(c.mulRatio(15n, 100n, 'DOWN').toString()).toBe('14.99');
  });
  it('negative divisor and zero divisor', () => {
    expect(divRound(5n, -2n, 'HALF_UP')).toBe(-3n);
    expect(() => divRound(1n, 0n, 'DOWN')).toThrow(MoneyError);
  });
});
