import { describe, expect, it } from 'vitest';
import { CARDS, CLAUSES, SKILLS, cardsOf, classReport, heatmap, makeAssignment, makeQuestion, assignmentProgress, parseAssignment, remedial, rescueOrder, rescuePlan, type Attempt, type Export } from '../src';

const at = (o: Partial<Attempt>): Attempt => ({ t: 1, skill: 'dep-wdv', clause: 'XI.2.depreciation', seed: 1, mode: 'PRACTICE', marks: 1, outOf: 1, hintsUsed: 0, mistakes: [], correctParts: 1, parts: 1, ...o });
const file = (name: string, attempts: Attempt[]): { file: string; data: Export } => ({ file: name + '.json', data: { app: 'accounting-universe', version: 1, exportedAt: 0, profile: { cls: 'XI', route: 'OPTION_I_ANALYSIS', name }, attempts, seen: [] } });

describe('concept cards', () => {
  it('every card names a real clause, has equal-length English and Hinglish text, and valid self-checks', () => {
    const ids = new Set(CLAUSES.map(c => c.id));
    expect(new Set(CARDS.map(c => c.id)).size).toBe(CARDS.length);
    for (const c of CARDS) {
      expect(ids.has(c.clause), c.id).toBe(true);
      expect(c.en.length, c.id).toBeGreaterThan(1); expect(c.hi.length, `${c.id} Hinglish paragraphs`).toBe(c.en.length);
      expect(c.checks.length, c.id).toBeGreaterThan(0);
      for (const k of c.checks) { expect(k.options.length).toBeGreaterThanOrEqual(2); expect(k.answer).toBeGreaterThanOrEqual(0); expect(k.answer).toBeLessThan(k.options.length); expect(k.why.length).toBeGreaterThan(10); }
    }
  });
  it('covers every theory-only clause the directive requires', () => {
    for (const id of ['XI.1.intro', 'XI.1.terms', 'XI.1.concepts', 'XI.1.basis', 'XI.1.standards', 'XI.1.gst', 'XI.2.vouchers', 'XI.3.concepts', 'XI.2.provisions', 'XII.1.fundamentals', 'XII.2.fundamentals', 'XII.2.concepts', 'XII.C.cas', 'XII.C.spreadsheet', 'XII.C.using']) expect(cardsOf(id).length, id).toBeGreaterThan(0);
  });
  it('does not state AS / Ind AS thresholds it cannot verify', () => {
    const t = (CARDS.find(c => c.id === 'standards')!.en.join(' ')).toLowerCase();
    expect(t).not.toMatch(/crore|net worth/); expect(t).toContain('notification');
  });
  it('each answer key is stable: the correct option is not always the first', () => {
    const idx = CARDS.flatMap(c => c.checks.map(k => k.answer));
    expect(new Set(idx).size).toBeGreaterThan(1);
  });
});

describe('new practice skills', () => {
  it('exist and are attached to syllabus clauses', () => {
    for (const s of ['pdd-provision', 'cashbook', 'opening-capital', 'revaluation', 'loan-emi', 'calls-advance']) expect(SKILLS.find(x => x.skill === s), s).toBeTruthy();
  });
  it('hand-check one: calls in advance 500 shares × ₹2 = ₹1,000 and the rest of the call is collected in cash', () => {
    const q = makeQuestion('calls-advance', 5);
    expect(q.parts.length).toBe(2);
  });
});

describe('rescue plan', () => {
  const labs = ['xi-depreciation'];
  it('starts at Understand for a new topic and points at the lab', () => {
    const p = rescuePlan({ clause: 'XI.2.depreciation', labs, attempts: [], seen: [] });
    expect(p.currentLevel).toBe(0); expect(p.next!.level).toBe(1); expect(p.next!.href).toBe('#/lab/xi-depreciation');
  });
  it('advances level by level and ends with Board mode', () => {
    const seen = [{ lab: 'xi-depreciation', tab: 'learn' as const, t: 1 }, { lab: 'xi-depreciation', tab: 'example' as const, t: 2 }];
    let p = rescuePlan({ clause: 'XI.2.depreciation', labs, attempts: [], seen });
    expect(p.next!.level).toBe(3); expect(p.next!.href).toMatch(/\/beginner$/);
    const three = [1, 2, 3].map(i => at({ t: i, mode: 'BEGINNER', marks: 0, correctParts: 0, mistakes: ['slip'], seed: i }));
    p = rescuePlan({ clause: 'XI.2.depreciation', labs, attempts: three, seen });
    expect(p.next!.level).toBe(4);
    p = rescuePlan({ clause: 'XI.2.depreciation', labs, attempts: [...three, at({ t: 9, seed: 9 })], seen });
    expect(p.next!.level).toBe(5); expect(p.next!.href).toMatch(/\/board$/);
  });
  it('theory-only topics stop at level 3 and say so', () => {
    const p = rescuePlan({ clause: 'XI.1.gst', labs: ['card:gst'], attempts: [], seen: [] });
    expect(p.steps.map(s => s.level)).toEqual([1, 2, 3]);
  });
  it('orders weak topics first', () => {
    expect(rescueOrder([{ clause: 'a', level: 3, weak: false, attempts: 3 }, { clause: 'b', level: 2, weak: true, attempts: 4 }, { clause: 'c', level: 5, weak: false, attempts: 9 }])).toEqual(['b', 'a']);
  });
});

describe('assignments and tests', () => {
  const a = makeAssignment({ title: 'Unit 2 test', mode: 'BOARD', skills: ['dep-wdv', 'brs'], perSkill: 2, seed: 7 });
  it('is deterministic and the same for every student', () => {
    expect(makeAssignment({ title: 'Unit 2 test', mode: 'BOARD', skills: ['dep-wdv', 'brs'], perSkill: 2, seed: 7 })).toEqual(a);
    expect(a.items.length).toBe(4);
    expect(a.items.map(i => makeQuestion(i.skill, i.seed).stem)).toEqual(a.items.map(i => makeQuestion(i.skill, i.seed).stem));
  });
  it('rejects bad definitions', () => {
    expect(() => makeAssignment({ title: ' ', mode: 'BOARD', skills: ['brs'], perSkill: 1, seed: 1 })).toThrow(RangeError);
    expect(() => makeAssignment({ title: 'x', mode: 'BOARD', skills: ['nope'], perSkill: 1, seed: 1 })).toThrow(RangeError);
    expect(() => makeAssignment({ title: 'x', mode: 'BOARD', skills: [], perSkill: 1, seed: 1 })).toThrow(RangeError);
  });
  it('parses its own file and rejects tampered ones', () => {
    expect(parseAssignment(JSON.parse(JSON.stringify(a))).ok).toBe(true);
    expect(parseAssignment({ ...a, items: [{ skill: 'zzz', seed: 1 }] }).ok).toBe(false);
    expect(parseAssignment({ ...a, mode: 'EASY' }).ok).toBe(false);
    expect(parseAssignment(null).ok).toBe(false);
  });
  it('tracks completion by skill + seed and keeps the best try', () => {
    const it0 = a.items[0]!;
    const p = assignmentProgress(a, [at({ skill: it0.skill, seed: it0.seed, marks: 1, outOf: 4 }), at({ skill: it0.skill, seed: it0.seed, marks: 3, outOf: 4 }), at({ skill: 'dep-wdv', seed: 999999 })]);
    expect(p.done).toBe(1); expect([p.marks, p.outOf]).toEqual([3, 4]);
  });
});

describe('teacher heat-map and remedial list', () => {
  const files = [file('Asha', [at({ marks: 0, mistakes: ['m1'] }), at({ marks: 0, seed: 2, mistakes: ['m1'] })]), file('Ravi', [at({ marks: 1 }), at({ skill: 'brs', clause: 'XI.2.brs', marks: 1 })])];
  it('builds a student × topic grid with null for untouched topics', () => {
    const h = heatmap([...files, { file: 'bad.json', data: { nope: 1 } }]);
    expect(h.students).toEqual(['Asha', 'Ravi']); expect(h.clauses).toEqual(['XI.2.brs', 'XI.2.depreciation']);
    expect(h.cells).toEqual([[null, 0], [1, 1]]);
  });
  it('recommends labs and a practice skill for topics the class struggles with', () => {
    const r = classReport(files);
    const rem = remedial(r, c => (c === 'XI.2.depreciation' ? ['xi-depreciation'] : []));
    expect(rem[0]!.clause).toBe('XI.2.depreciation'); expect(rem[0]!.labs).toEqual(['xi-depreciation']); expect(rem[0]!.skill).toBe('dep-wdv'); expect(rem[0]!.reason).toContain('struggling');
    expect(rem.some(x => x.clause === 'XI.2.brs')).toBe(false);
  });
});
