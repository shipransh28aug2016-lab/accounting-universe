import { Fraction, Money } from '../../../packages/engine/src';
import { InputError } from './spec';

const strip = (s: string) => s.replace(/[₹,\s]/g, '');

export function money(values: Record<string, string>, id: string, label?: string, opts: { allowNegative?: boolean; allowBlank?: boolean } = {}): Money {
  const raw = (values[id] ?? '').trim();
  if (raw === '') { if (opts.allowBlank) return Money.ZERO; throw new InputError(`${label ?? id} is empty — enter an amount (use 0 if there is none).`, id); }
  try {
    const m = Money.parse(strip(raw));
    if (m.isNegative() && !opts.allowNegative) throw new InputError(`${label ?? id} cannot be negative.`, id);
    return m;
  } catch (e) {
    if (e instanceof InputError) throw e;
    throw new InputError(`${label ?? id}: "${raw}" is not a valid amount. Use digits with at most 2 decimals, e.g. 25000 or 1,25,000.50.`, id);
  }
}
export const optMoney = (v: Record<string, string>, id: string, label?: string) => money(v, id, label, { allowBlank: true });

export function whole(values: Record<string, string>, id: string, label: string, min = 0, max = 1_000_000_000): number {
  const raw = (values[id] ?? '').trim();
  if (!/^\d+$/.test(raw)) throw new InputError(`${label} must be a whole number.`, id);
  const n = Number(raw);
  if (n < min || n > max) throw new InputError(`${label} must be between ${min} and ${max}.`, id);
  return n;
}
export function percent(values: Record<string, string>, id: string, label: string): bigint {
  const raw = strip(values[id] ?? '');
  if (!/^\d+$/.test(raw)) throw new InputError(`${label} must be a whole-number percentage (e.g. 10).`, id);
  const n = BigInt(raw);
  if (n > 100n) throw new InputError(`${label} cannot be more than 100%.`, id);
  return n;
}
/** "3:2:5" → fractions, for exactly `n` partners (or any count when n omitted). */
export function ratio(values: Record<string, string>, id: string, label: string, n?: number): Fraction[] {
  const raw = (values[id] ?? '').trim();
  const parts = raw.split(/[:\/,\s]+/).filter(Boolean);
  if (parts.length < 2 || parts.some(p => !/^\d+$/.test(p))) throw new InputError(`${label} must look like 3:2:5 (whole numbers separated by colons).`, id);
  if (n !== undefined && parts.length !== n) throw new InputError(`${label} needs exactly ${n} numbers, one for each partner.`, id);
  if (parts.every(p => p === '0')) throw new InputError(`${label} cannot be all zeros.`, id);
  return Fraction.fromRatio(parts.map(Number));
}
/** Comma/line separated list of amounts. */
export function moneyList(values: Record<string, string>, id: string, label: string, min = 1): Money[] {
  const parts = (values[id] ?? '').split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
  if (parts.length < min) throw new InputError(`${label} needs at least ${min} amount${min > 1 ? 's' : ''}, separated by commas.`, id);
  return parts.map((p, i) => { try { return Money.parse(strip(p)); } catch { throw new InputError(`${label}: item ${i + 1} ("${p}") is not a valid amount.`, id); } });
}
/** Lines like "Name : 1200" or "Name 1200". */
export function namedAmounts(values: Record<string, string>, id: string, label: string): { name: string; amount: Money }[] {
  const lines = (values[id] ?? '').split(/\n+/).map(s => s.trim()).filter(Boolean);
  return lines.map((ln, i) => {
    const m = /^(.*?)[\s:=]+([\d,]+(?:\.\d{1,2})?)\s*$/.exec(ln);
    if (!m) throw new InputError(`${label}, line ${i + 1} ("${ln}"): write it as  Name : amount.`, id);
    return { name: m[1]!.trim() || `Item ${i + 1}`, amount: Money.parse(strip(m[2]!)) };
  });
}
export const num = (m: Money): number => Number(m.paise) / 100;        // chart geometry only — never used for accounting
export const frac = (f: Fraction): number => Number(f.num) / Number(f.den);

/** "1/4" or "2/5" → Fraction (a share of profit). Must be strictly between 0 and 1. */
export function fraction(values: Record<string, string>, id: string, label: string): Fraction {
  const m = /^\s*(\d+)\s*\/\s*(\d+)\s*$/.exec(values[id] ?? '');
  if (!m || m[2] === '0') throw new InputError(`${label} must be a fraction like 1/4.`, id);
  const f = Fraction.of(BigInt(m[1]!), BigInt(m[2]!));
  if (!f.isPositive() || f.cmp(Fraction.ONE) >= 0) throw new InputError(`${label} must be more than 0 and less than 1.`, id);
  return f;
}
