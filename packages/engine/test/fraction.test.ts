import { describe, expect, it } from 'vitest';
import { Fraction, Money, allocate, fixed } from '../src';

describe('Fraction', () => {
  it('normalises and compares exactly', () => {
    expect(Fraction.of(2, 4).toString()).toBe('1/2');
    expect(Fraction.of(-3, -9).equals(Fraction.of(1, 3))).toBe(true);
    expect(Fraction.of(1, -2).toString()).toBe('-1/2');
    expect(Fraction.of(1, 3).add(Fraction.of(1, 6)).toString()).toBe('1/2');
    expect(Fraction.of(2, 9).sub(Fraction.of(1, 3)).toString()).toBe('-1/9');
    expect(() => Fraction.of(1, 0)).toThrow(RangeError);
  });
  it('builds shares from a ratio and rejects bad ratios', () => {
    expect(Fraction.fromRatio([4, 3, 2]).map(String)).toEqual(['4/9', '1/3', '2/9']);
    expect(() => Fraction.fromRatio([0, 0])).toThrow(RangeError);
    expect(() => Fraction.fromRatio([-1, 2])).toThrow(RangeError);
  });
});

describe('allocate — parts always add up to the total exactly', () => {
  it('₹100 split 1:1:1 is 33.34 / 33.33 / 33.33 (never 99.99)', () => {
    const p = allocate(Money.parse('100'), Fraction.fromRatio([1, 1, 1]));
    expect(p.map(String)).toEqual(['33.34', '33.33', '33.33']);
    expect(Money.sum(p).toString()).toBe('100.00');
  });
  it('handles negatives and zero', () => {
    expect(allocate(Money.parse('-100'), Fraction.fromRatio([1, 1, 1])).map(String)).toEqual(['-33.34', '-33.33', '-33.33']);
    expect(allocate(Money.ZERO, Fraction.fromRatio([3, 2])).map(String)).toEqual(['0.00', '0.00']);
  });
  it('rejects shares that do not add to 1', () => {
    expect(() => allocate(Money.parse('10'), [Fraction.of(1, 2), Fraction.of(1, 3)])).toThrow(RangeError);
  });
  it('property: for many totals and ratios the parts sum exactly', () => {
    let s = 7;
    const rnd = () => (s = (Math.imul(s, 1103515245) + 12345) >>> 0) / 2 ** 32;
    for (let i = 0; i < 500; i++) {
      const w = Array.from({ length: 2 + Math.floor(rnd() * 4) }, () => 1 + Math.floor(rnd() * 9));
      const total = Money.fromPaise(Math.floor(rnd() * 1e9) - 5e8);
      expect(Money.sum(allocate(total, Fraction.fromRatio(w))).equals(total)).toBe(true);
    }
  });
});

describe('fixed — exact decimal display of a ratio', () => {
  it('rounds half up without floats', () => {
    expect(fixed(88000n, 60000n, 2)).toBe('1.47');
    expect(fixed(1n, 3n, 4)).toBe('0.3333');
    expect(fixed(2n, 3n, 2)).toBe('0.67');
    expect(fixed(-1n, 8n, 2)).toBe('-0.13');
    expect(fixed(5n, 1n, 0)).toBe('5');
  });
});
