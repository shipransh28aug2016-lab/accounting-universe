import { Fraction, Money } from '../../../../packages/engine/src';
import type { Block } from '../spec';
import { num } from '../inputs';

export const fmt = (m: Money) => m.format();
export const R = (m: Money) => m.format();
export const sh = (f: Fraction) => f.toString();
export const pctText = (f: Fraction) => `${f.toString()} (${(Number(f.num) / Number(f.den) * 100).toFixed(1)}%)`;
export const moneyRow = (label: string, m: Money): string[] => [label, m.format()];
export const note = (text: string, tone: 'info' | 'good' | 'warn' | 'bad' = 'info'): Block => ({ kind: 'note', text, tone });
export const bar = (label: string, m: Money, tone?: 'a' | 'b' | 'c' | 'neg') => ({ label, value: num(m), text: m.format(), ...(tone ? { tone } : {}) });
export const PARTNER_IDS = ['A', 'B', 'C'] as const;
export const names = (n: number) => PARTNER_IDS.slice(0, n);
