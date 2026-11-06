import { describe, expect, it } from 'vitest';
import { type DraftEntry, type IssueCode, Money, isValidIsoDate, starterChartClassXI, validateEntry } from '../src';

const chart = starterChartClassXI();
const dr = (accountId: string, amt: string) => ({ accountId, side: 'DR' as const, amount: Money.parse(amt) });
const cr = (accountId: string, amt: string) => ({ accountId, side: 'CR' as const, amount: Money.parse(amt) });
const entry = (lines: DraftEntry['lines'], over: Partial<DraftEntry> = {}): DraftEntry => ({ date: '2026-04-01', narration: 'test', lines, ...over });
const codes = (e: DraftEntry): IssueCode[] => validateEntry(e, chart).map(i => i.code);

describe('journal validation', () => {
  it('accepts a simple balanced entry', () => expect(codes(entry([dr('cash', '5000'), cr('capital', '5000')]))).toEqual([]));

  it('accepts a compound entry (two debits, one credit)', () =>
    expect(codes(entry([dr('cash', '8000'), dr('bank', '2000'), cr('sales', '10000')]))).toEqual([]));

  it('rejects an unbalanced entry and says by how much', () => {
    const issues = validateEntry(entry([dr('cash', '5000'), cr('capital', '4999.99')]), chart);
    expect(issues.map(i => i.code)).toEqual(['UNBALANCED']);
    expect(issues[0]!.message).toContain('₹0.01');                       // difference is exact
  });

  it('a one-paisa difference is still caught (no tolerance)', () =>
    expect(codes(entry([dr('cash', '0.01'), cr('capital', '0.02')]))).toContain('UNBALANCED'));

  it('rejects missing sides', () => {
    expect(codes(entry([dr('cash', '10'), dr('bank', '10')]))).toEqual(expect.arrayContaining(['NO_CREDIT']));
    expect(codes(entry([cr('cash', '10'), cr('bank', '10')]))).toEqual(expect.arrayContaining(['NO_DEBIT']));
    expect(codes(entry([]))).toEqual(expect.arrayContaining(['NO_DEBIT', 'NO_CREDIT']));
  });

  it('rejects zero and negative amounts', () => {
    expect(codes(entry([dr('cash', '0'), cr('capital', '0')]))).toContain('NON_POSITIVE_AMOUNT');
    expect(codes(entry([dr('cash', '-5'), cr('capital', '-5')]))).toContain('NON_POSITIVE_AMOUNT');
  });

  it('rejects an account that is not in the chart (never guesses a type)', () => {
    const issues = validateEntry(entry([dr('petty-cash', '5'), cr('capital', '5')]), chart);
    expect(issues.map(i => i.code)).toContain('UNKNOWN_ACCOUNT');
  });

  it('rejects the same account on both sides', () =>
    expect(codes(entry([dr('cash', '5'), dr('bank', '5'), cr('cash', '10')]))).toContain('ACCOUNT_ON_BOTH_SIDES'));

  it('rejects bad dates and empty narration', () => {
    expect(codes(entry([dr('cash', '5'), cr('capital', '5')], { date: '2026-02-30' }))).toContain('BAD_DATE');
    expect(codes(entry([dr('cash', '5'), cr('capital', '5')], { date: '26-04-01' }))).toContain('BAD_DATE');
    expect(codes(entry([dr('cash', '5'), cr('capital', '5')], { narration: '  ' }))).toContain('EMPTY_NARRATION');
  });

  it('reports every problem at once, not just the first', () => {
    const c = codes(entry([dr('nope', '0'), cr('capital', '7')], { date: 'x', narration: '' }));
    expect(c).toEqual(expect.arrayContaining(['BAD_DATE', 'EMPTY_NARRATION', 'UNKNOWN_ACCOUNT', 'NON_POSITIVE_AMOUNT', 'UNBALANCED']));
  });
});

describe('isValidIsoDate', () => {
  it.each([['2026-04-01', true], ['2028-02-29', true], ['2026-02-29', false], ['2026-13-01', false], ['2026-4-1', false], ['', false]])('%s → %s', (d, ok) =>
    expect(isValidIsoDate(d)).toBe(ok));
});
