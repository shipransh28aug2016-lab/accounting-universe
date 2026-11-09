import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { type DraftEntry, EntryValidationError, Ledger, LedgerError, Money, type Side, starterChartClassXI } from '../src';

const dr = (accountId: string, amt: string) => ({ accountId, side: 'DR' as const, amount: Money.parse(amt) });
const cr = (accountId: string, amt: string) => ({ accountId, side: 'CR' as const, amount: Money.parse(amt) });
const draft = (narration: string, lines: DraftEntry['lines'], date = '2026-04-01'): DraftEntry => ({ date, narration, lines });
const bal = (l: Ledger, id: string) => l.balance(id).toString();

/** The scenario used as an independent oracle — every expected number below was worked out by hand. */
function oracle(): Ledger {
  const l = new Ledger(starterChartClassXI());
  l.post(draft('Commenced business with cash', [dr('cash', '50000'), cr('capital', '50000')]));
  l.post(draft('Purchased goods on credit', [dr('purchases', '20000'), cr('creditors', '20000')]));
  l.post(draft('Sold goods for cash', [dr('cash', '12000'), cr('sales', '12000')]));
  l.post(draft('Paid rent', [dr('rent', '2000'), cr('cash', '2000')]));
  return l;
}

describe('posting', () => {
  it('assigns unique sequential ids', () => {
    const l = oracle();
    expect(l.entries().map(e => e.id)).toEqual(['JE-000001', 'JE-000002', 'JE-000003', 'JE-000004']);
  });

  it('posted entries are frozen and cannot be edited', () => {
    const e = oracle().entries()[0]!;
    expect(() => { (e as { narration: string }).narration = 'tampered'; }).toThrow(TypeError);
    expect(() => { (e.lines as unknown as unknown[]).push({}); }).toThrow(TypeError);
    expect(() => { (e.lines[0] as { side: Side }).side = 'CR'; }).toThrow(TypeError);
  });

  it('later changes to the caller\'s draft do not leak into the ledger', () => {
    const l = new Ledger(starterChartClassXI());
    const lines = [dr('cash', '10'), cr('capital', '10')];
    l.post(draft('x', lines));
    (lines[0] as { accountId: string }).accountId = 'bank';
    expect(l.entries()[0]!.lines[0]!.accountId).toBe('cash');
  });

  it('an invalid entry is rejected with every issue and leaves the ledger untouched', () => {
    const l = oracle();
    const before = l.entries().length;
    expect(() => l.post(draft('bad', [dr('cash', '5'), cr('capital', '6')]))).toThrow(EntryValidationError);
    try { l.post(draft('bad', [dr('ghost', '0'), cr('capital', '6')])); } catch (e) {
      expect((e as EntryValidationError).issues.map(i => i.code)).toEqual(expect.arrayContaining(['UNKNOWN_ACCOUNT', 'NON_POSITIVE_AMOUNT', 'UNBALANCED']));
    }
    expect(l.entries().length).toBe(before);
    expect(l.auditTrail().length).toBe(before);
  });
});

describe('hand-worked oracle scenario', () => {
  // Cash = 50,000 + 12,000 − 2,000 = 60,000 Dr.  Capital 50,000 Cr.  Purchases 20,000 Dr.
  // Creditors 20,000 Cr.  Sales 12,000 Cr.  Rent 2,000 Dr.
  it('account balances', () => {
    const l = oracle();
    expect(bal(l, 'cash')).toBe('60000.00');
    expect(bal(l, 'capital')).toBe('50000.00');
    expect(bal(l, 'purchases')).toBe('20000.00');
    expect(bal(l, 'creditors')).toBe('20000.00');
    expect(bal(l, 'sales')).toBe('12000.00');
    expect(bal(l, 'rent')).toBe('2000.00');
    expect(bal(l, 'bank')).toBe('0.00');
  });

  // Dr side: 60,000 + 20,000 + 2,000 = 82,000.  Cr side: 50,000 + 20,000 + 12,000 = 82,000.
  it('trial balance (balance method) totals ₹82,000 each side', () => {
    const tb = oracle().trialBalance();
    expect(tb.totalDebit.toString()).toBe('82000.00');
    expect(tb.totalCredit.toString()).toBe('82000.00');
    expect(tb.balanced).toBe(true);
    expect(tb.rows.map(r => r.account.id).sort()).toEqual(['capital', 'cash', 'creditors', 'purchases', 'rent', 'sales']);
    const cash = tb.rows.find(r => r.account.id === 'cash')!;
    expect(cash.debit.toString()).toBe('60000.00');
    expect(cash.credit.isZero()).toBe(true);
  });

  // Assets 60,000 = Liabilities 20,000 + Capital (50,000 + 12,000 − 20,000 − 2,000 = 40,000).
  // (Periodic treatment: purchases are expensed until closing stock is brought in at year end.)
  it('accounting equation', () => {
    const eq = oracle().equation();
    expect(eq.assets.toString()).toBe('60000.00');
    expect(eq.liabilities.toString()).toBe('20000.00');
    expect(eq.capital.toString()).toBe('40000.00');
    expect(eq.balanced).toBe(true);
  });

  it('drawings reduce capital: ₹5,000 drawings → capital 35,000, cash 55,000', () => {
    const l = oracle();
    l.post(draft('Owner withdrew cash', [dr('drawings', '5000'), cr('cash', '5000')]));
    const eq = l.equation();
    expect(eq.assets.toString()).toBe('55000.00');
    expect(eq.capital.toString()).toBe('35000.00');
    expect(eq.balanced).toBe(true);
  });

  it('T-account for Cash with running balance', () => {
    const rows = oracle().tAccount('cash');
    expect(rows.map(r => `${r.side}:${r.amount.toString()}`)).toEqual(['DR:50000.00', 'DR:12000.00', 'CR:2000.00']);
    expect(rows.map(r => r.running.toString())).toEqual(['50000.00', '62000.00', '60000.00']);
  });
});

describe('regression: the legacy Simulator signed these accounts wrongly', () => {
  it('a credit sale leaves Debtors POSITIVE (+7,000), a cash purchase leaves Purchases POSITIVE (+4,000)', () => {
    const l = new Ledger(starterChartClassXI());
    l.post(draft('Commenced', [dr('cash', '50000'), cr('capital', '50000')]));
    l.post(draft('Credit sale', [dr('debtors', '7000'), cr('sales', '7000')]));
    l.post(draft('Cash purchase', [dr('purchases', '4000'), cr('cash', '4000')]));
    expect(bal(l, 'debtors')).toBe('7000.00');
    expect(bal(l, 'purchases')).toBe('4000.00');
    // Assets 46,000 + 7,000 = 53,000  =  Capital 50,000 + Sales 7,000 − Purchases 4,000 = 53,000
    const eq = l.equation();
    expect(eq.assets.toString()).toBe('53000.00');
    expect(eq.capital.toString()).toBe('53000.00');
  });

  it('a corrupted state would be detected: an unbalanced pair can never be posted', () => {
    const l = oracle();
    expect(() => l.post(draft('oops', [dr('cash', '1000'), cr('sales', '999.99')]))).toThrow(EntryValidationError);
    expect(l.trialBalance().balanced).toBe(true);
  });

  it('an overdrawn account reports its flipped balance honestly (teaching policy lives above the engine)', () => {
    const l = new Ledger(starterChartClassXI());
    l.post(draft('Cheque with no deposit', [dr('rent', '5000'), cr('bank', '5000')]));
    expect(bal(l, 'bank')).toBe('-5000.00');                                  // negative on its Dr side
    expect(l.trialBalance().rows.find(r => r.account.id === 'bank')!.credit.toString()).toBe('5000.00');
  });
});

describe('reversal (correction by a linked opposite entry)', () => {
  it('cancels the effect, keeps history, and links the two entries', () => {
    const l = oracle();
    const wrong = l.post(draft('Rent posted to wages by mistake', [dr('wages', '3000'), cr('cash', '3000')]));
    expect(bal(l, 'wages')).toBe('3000.00');
    const rev = l.reverse(wrong.id, { date: '2026-04-02', reason: 'wrong account' });
    expect(rev.reversalOf).toBe(wrong.id);
    expect(bal(l, 'wages')).toBe('0.00');
    expect(bal(l, 'cash')).toBe('60000.00');
    expect(l.entries()).toContain(wrong);                                    // never deleted
    expect(l.isReversed(wrong.id)).toBe(true);
    expect(l.auditTrail().map(a => a.type)).toEqual(['POST', 'POST', 'POST', 'POST', 'POST', 'REVERSE']);
    expect(l.auditTrail().at(-1)).toMatchObject({ type: 'REVERSE', entryId: rev.id, target: wrong.id, reason: 'wrong account' });
    expect(l.trialBalance().balanced).toBe(true);
  });

  it('cannot reverse twice, reverse a reversal, reverse a ghost, or reverse without a reason', () => {
    const l = oracle();
    const rev = l.reverse('JE-000004', { date: '2026-04-02', reason: 'test' });
    expect(() => l.reverse('JE-000004', { date: '2026-04-02', reason: 'again' })).toThrow(LedgerError);
    expect(() => l.reverse(rev.id, { date: '2026-04-02', reason: 'undo undo' })).toThrow(LedgerError);
    expect(() => l.reverse('JE-999999', { date: '2026-04-02', reason: 'x' })).toThrow(LedgerError);
    expect(() => l.reverse('JE-000001', { date: '2026-04-02', reason: '  ' })).toThrow(LedgerError);
    expect(() => l.reverse('JE-000001', { date: 'bad', reason: 'x' })).toThrow(EntryValidationError);
  });
});

/** Tiny seeded PRNG so the property test is reproducible. */
function lcg(seed: number) { let s = seed >>> 0; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32; }

describe('property: any sequence of valid entries keeps the books balanced', () => {
  it('300 random compound entries (seeded) — trial balance and A = L + C hold after every post; reversing all restores zero', () => {
    const rnd = lcg(20260401);
    const chart = starterChartClassXI();
    const ids = chart.list().map(a => a.id);
    const l = new Ledger(chart);
    const pick = (n: number) => { const pool = [...ids]; const out: string[] = []; while (out.length < n) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]!); return out; };
    const split = (total: number, n: number) => {                          // n positive integer parts summing to total
      const cuts = new Set<number>(); while (cuts.size < n - 1) cuts.add(1 + Math.floor(rnd() * (total - 1)));
      const pts = [0, ...[...cuts].sort((a, b) => a - b), total]; return pts.slice(1).map((p, i) => p - pts[i]!);
    };

    for (let i = 0; i < 300; i++) {
      const nDr = 1 + Math.floor(rnd() * 3), nCr = 1 + Math.floor(rnd() * 3);
      const accts = pick(nDr + nCr);
      const total = 10 + Math.floor(rnd() * 5_000_000);                    // paise, deliberately not round numbers
      const lines = [
        ...split(total, nDr).map((p, k) => ({ accountId: accts[k]!, side: 'DR' as const, amount: Money.fromPaise(p) })),
        ...split(total, nCr).map((p, k) => ({ accountId: accts[nDr + k]!, side: 'CR' as const, amount: Money.fromPaise(p) })),
      ];
      l.post(draft(`random ${i}`, lines));
      if (i % 25 === 0) { expect(l.trialBalance().balanced).toBe(true); expect(l.equation().balanced).toBe(true); }
    }
    expect(l.trialBalance().balanced).toBe(true);
    expect(l.equation().balanced).toBe(true);
    expect(l.entries().length).toBe(300);

    for (const e of [...l.entries()]) l.reverse(e.id, { date: '2026-05-01', reason: 'unwind' });
    expect(l.entries().length).toBe(600);
    expect(l.trialBalance().rows.length).toBe(0);
    for (const id of ids) expect(l.balance(id).isZero()).toBe(true);
  });
});

describe('guard: the engine never uses binary floating point for money', () => {
  it('source contains no parseFloat / toFixed / Math.round / Math.floor / Math.ceil', () => {
    const dir = new URL('../src/', import.meta.url);
    for (const f of readdirSync(dir)) {
      const text = readFileSync(new URL(f, dir), 'utf8');
      expect(text, f).not.toMatch(/parseFloat|toFixed|Math\.(round|floor|ceil)/);
    }
  });
});
