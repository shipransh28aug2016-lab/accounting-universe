import { describe, expect, it } from 'vitest';
import { CLAUSES, GENERATORS, SKILLS, checkAnswer, makeQuestion, makeQuestionUnfiltered } from '../src';

const SEEDS = Array.from({ length: 150 }, (_, i) => i + 1);

describe('every generator, many seeds', () => {
  for (const { skill } of SKILLS) {
    describe(skill, () => {
      it('produces well-formed questions for all seeds', () => {
        for (const seed of SEEDS) {
          const q = makeQuestion(skill, seed);
          expect(q.parts.length, `${skill}#${seed}`).toBeGreaterThan(0);
          expect(q.stem.length).toBeGreaterThan(30);
          expect(q.hints.length).toBeGreaterThanOrEqual(2);
          expect(q.working.length).toBeGreaterThan(0);
          expect(q.marks).toBe(q.parts.reduce((a, p) => a + p.marks, 0));
          for (const p of q.parts) expect(p.answer, `${skill}#${seed} ${p.label}`).not.toMatch(/NaN|undefined|Infinity/);
          expect(q.stem).not.toMatch(/NaN|undefined|\[object/);
          for (const w of q.working) expect(w).not.toMatch(/NaN|undefined|\[object/);
        }
      });
      it('is deterministic: same seed ⇒ identical question', () => {
        for (const seed of [1, 7, 42, 99]) expect(makeQuestion(skill, seed)).toEqual(makeQuestion(skill, seed));
      });
      it('varies with the seed (not one fixed question)', () => {
        expect(new Set(SEEDS.map(s => makeQuestion(skill, s).stem)).size).toBeGreaterThan(5);
      });
      it('accepts its own answers and rejects a wrong one', () => {
        for (const seed of SEEDS.slice(0, 40)) {
          const q = makeQuestion(skill, seed);
          for (const p of q.parts) {
            expect(checkAnswer(p, p.answer), `${skill}#${seed} ${p.label} = ${p.answer}`).toBe(true);
            expect(checkAnswer(p, p.kind === 'TEXT' ? 'zzz' : '987654321.99')).toBe(false);
            expect(checkAnswer(p, '')).toBe(false);
          }
        }
      });
      it('hints never reveal the final answer', () => {
        for (const seed of SEEDS) {
          const q = makeQuestion(skill, seed);
          const hints = q.hints.join(' ');
          for (const p of q.parts) {
            if (p.kind !== 'MONEY') continue;
            const n = Number(p.answer);
            if (Math.abs(n) < 1000) continue;                       // tiny numbers appear by coincidence
            const plain = p.answer.replace(/\.00$/, '');
            // whole-number match only: '3000' inside '30000 : 40000' is a coincidence, not a leak
            const asWholeNumber = new RegExp(`(?<![\\d,.])${plain.replace(/\./g, '\\.')}(?![\\d]|\\.\\d)`);
            expect(asWholeNumber.test(hints.replace(/,/g, '')), `${skill}#${seed} hint leaks ${plain}`).toBe(false);
          }
        }
      });
      it('every distractor (UNFILTERED generator output) is a genuinely different answer to the part it targets', () => {
        for (const seed of SEEDS) {
          const q = makeQuestionUnfiltered(skill, seed);
          for (const d of q.distractors) {
            expect(d.part).toBeLessThan(q.parts.length);
            expect(d.value, `${skill}#${seed}`).not.toBe(q.parts[d.part]!.answer);
            expect(d.mistake.length).toBeGreaterThan(10);
            expect(d.fix.length).toBeGreaterThan(5);
          }
        }
      });
    });
  }
  it('every skill points at a real syllabus clause', () => {
    for (const g of GENERATORS) expect(CLAUSES.some(c => c.id === g.clause), g.skill).toBe(true);
  });
  it('skills are unique', () => expect(new Set(SKILLS.map(s => s.skill)).size).toBe(SKILLS.length));
});

describe('answer checking', () => {
  const money = { label: 'x', kind: 'MONEY' as const, answer: '123456.50', marks: 1 };
  it('ignores ₹, commas and spaces', () => {
    for (const s of ['123456.5', '₹1,23,456.50', ' 123 456.50 ', '123,456.50']) expect(checkAnswer(money, s), s).toBe(true);
  });
  it('is exact: one paisa off is wrong', () => { expect(checkAnswer(money, '123456.51')).toBe(false); expect(checkAnswer(money, 'abc')).toBe(false); });
  it('handles negative amounts (a loss)', () => expect(checkAnswer({ ...money, answer: '-2900.00' }, '-2,900')).toBe(true));
  it('fractions are compared in lowest terms', () => {
    const f = { label: 'f', kind: 'FRACTION' as const, answer: '1/10', marks: 1 };
    expect(checkAnswer(f, '2/20')).toBe(true); expect(checkAnswer(f, '1 / 10')).toBe(true); expect(checkAnswer(f, '1/5')).toBe(false); expect(checkAnswer(f, '1/0')).toBe(false);
  });
});

// ── Independent closed-form checks: the expected value is recomputed in the TEST from numbers parsed out of the stem ──
const amounts = (s: string) => [...s.matchAll(/₹([\d,]+\.\d\d)/g)].map(m => BigInt(m[1]!.replace(/[,.]/g, '')));   // paise
const pctOf = (s: string) => Number(/(\d+)%/.exec(s)![1]);
const rupees = (p: bigint) => (p / 100n).toString() + '.' + (p % 100n).toString().padStart(2, '0');

describe('independent cross-checks against closed-form arithmetic', () => {
  it('dep-slm: (cost − scrap) ÷ life', () => {
    for (const seed of SEEDS) {
      const q = makeQuestion('dep-slm', seed); const [cost, scrap] = amounts(q.stem); const life = BigInt(/life of (\d+) years/.exec(q.stem)![1]!);
      expect(q.parts[0]!.answer, q.stem).toBe(rupees((cost! - scrap!) / life!));
    }
  });
  it('dep-wdv: cost × Π(1 − rate), exact in paise', () => {
    for (const seed of SEEDS) {
      const q = makeQuestion('dep-wdv', seed); const [cost] = amounts(q.stem); const r = BigInt(pctOf(q.stem)); const yrs = Number(/end of year (\d)/.exec(q.stem)![1]);
      const exact = (cost! * (100n - r) ** BigInt(yrs)) / 100n ** BigInt(yrs);
      expect((cost! * (100n - r) ** BigInt(yrs)) % 100n ** BigInt(yrs), `${q.stem} must be an exact-paise question`).toBe(0n);
      expect(q.parts[0]!.answer).toBe(rupees(exact));
    }
  });
  it('goodwill-avg: ((p1+p2+p3) ÷ 3) × years', () => {
    for (const seed of SEEDS) {
      const q = makeQuestion('goodwill-avg', seed); const a = amounts(q.stem); const yrs = BigInt(/valued at (\d) years/.exec(q.stem)![1]!);
      const avg = (a[0]! + a[1]! + a[2]!) / 3n;
      expect(q.parts[1]!.answer).toBe(rupees(avg * yrs));
    }
  });
  it('goodwill-super: (average − capital × rate) × years', () => {
    for (const seed of SEEDS) {
      const q = makeQuestion('goodwill-super', seed); const [avg, ce] = amounts(q.stem); const rate = BigInt(/return is (\d+)%/.exec(q.stem)![1]!); const yrs = BigInt(/at (\d) years/.exec(q.stem)![1]!);
      expect(q.parts[2]!.answer).toBe(rupees((avg! - (ce! * rate) / 100n) * yrs));
    }
  });
  it('brs: cash-book balance + unpresented cheques − bank charges', () => {
    for (const seed of SEEDS) {
      const q = makeQuestion('brs', seed); const [cb, unpres, charges] = amounts(q.stem);
      expect(q.parts[0]!.answer).toBe(rupees(cb! + unpres! - charges!));
    }
  });
  it('gst: (list − list×td% + freight) × (1 + gst%)', () => {
    for (const seed of SEEDS) {
      const q = makeQuestion('gst', seed); const [list, freight] = amounts(q.stem);
      const td = BigInt(/less (\d+)% trade/.exec(q.stem)![1]!), g = BigInt(/charged at (\d+)%/.exec(q.stem)![1]!);
      const taxable = list! - (list! * td) / 100n + freight!;
      expect(q.parts[0]!.answer).toBe(rupees(taxable));
      expect(q.parts[1]!.answer).toBe(rupees(taxable + (taxable * g) / 100n));
    }
  });
  it('pdd: new provision = rate × (debtors − bad debts); P&L = new − old', () => {
    for (const seed of SEEDS) {
      const q = makeQuestion('pdd', seed); const [debtors, bad, , old] = [amounts(q.stem)[0]!, amounts(q.stem)[1]!, 0n, amounts(q.stem)[2]!];
      const rate = BigInt(/of (\d+)% is to be kept/.exec(q.stem)![1]!);
      const np = ((debtors - bad) * rate) / 100n;
      expect(q.parts[0]!.answer).toBe(rupees(np));
      expect(q.parts[1]!.answer).toBe(rupees(np - old));
    }
  });
  it('soa: closing − opening + drawings − fresh capital', () => {
    for (const seed of SEEDS) {
      const q = makeQuestion('soa', seed); const [open, close, draw, fresh] = amounts(q.stem);
      expect(q.parts[0]!.answer).toBe(rupees(close! - open! + draw! - fresh!));
    }
  });
  it('int-drawings: drawings × rate × 6/12', () => {
    for (const seed of SEEDS) {
      const q = makeQuestion('int-drawings', seed); const [dr] = amounts(q.stem); const rate = BigInt(/charged at (\d+)%/.exec(q.stem)![1]!);
      expect(q.parts[0]!.answer).toBe(rupees((dr! * rate) / 200n));
    }
  });
  it('suspense: |Dr − Cr|, on the short side', () => {
    for (const seed of SEEDS) {
      const q = makeQuestion('suspense', seed); const [d, c] = amounts(q.stem);
      expect(q.parts[0]!.answer).toBe(rupees(d! > c! ? d! - c! : c! - d!));
      expect(q.parts[1]!.answer).toBe(d! < c! ? 'Debit' : 'Credit');
    }
  });
  it('debenture-issue: discount = (100 − issue) × n ; loss = premium on redemption × n', () => {
    for (const seed of SEEDS) {
      const q = makeQuestion('debenture-issue', seed); const n = BigInt(/issues (\d+) 10%/.exec(q.stem)![1]!);
      const disc = BigInt(/discount of (\d+)%/.exec(q.stem)![1]!), rp = BigInt(/premium of (\d+)%/.exec(q.stem)![1]!);
      expect(q.parts[0]!.answer).toBe(rupees(disc * n * 100n)); expect(q.parts[1]!.answer).toBe(rupees(rp * n * 100n));
    }
  });
});

describe('the pro-rata questions always give whole shares', () => {
  it('shares allotted is an integer and payable is positive', () => {
    for (const seed of SEEDS) {
      const q = makeQuestion('pro-rata', seed);
      expect(q.parts[0]!.answer).toMatch(/^\d+$/);
      expect(Number(q.parts[1]!.answer)).toBeGreaterThan(0);
    }
  });
});
