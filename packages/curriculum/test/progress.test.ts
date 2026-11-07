import { describe, expect, it } from 'vitest';
import { classReport, levelFor, mistakeTally, nextSkill, parseExport, reportToCsv, summariseClauses, type Attempt, type Seen } from '../src';

const LAB = 'xi-depreciation', CL = 'XI.2.depreciation';
const at = (over: Partial<Attempt>, t = 1): Attempt => ({ t, skill: 'dep-wdv', clause: CL, seed: 1, mode: 'BEGINNER', marks: 1, outOf: 1, hintsUsed: 0, mistakes: [], correctParts: 1, parts: 1, ...over });
const seen = (tab: Seen['tab']): Seen => ({ lab: LAB, tab, t: 1 });
const lvl = (attempts: Attempt[], s: Seen[]) => levelFor({ clause: CL, labs: [LAB], attempts, seen: s });

describe('mastery levels', () => {
  it('0 until the Learn tab is opened; levels need the one before', () => {
    expect(lvl([], [])).toBe(0);
    expect(lvl([], [seen('learn')])).toBe(1);
    expect(lvl([], [seen('example')])).toBe(0);                    // skipping Learn does not count
    expect(lvl([], [seen('learn'), seen('example')])).toBe(2);
  });
  it('3 needs three Beginner attempts', () => {
    const s = [seen('learn'), seen('example')];
    expect(lvl([at({}), at({})], s)).toBe(2);
    expect(lvl([at({}), at({}), at({})], s)).toBe(3);
    expect(lvl([at({ mode: 'PRACTICE' }), at({ mode: 'PRACTICE' }), at({ mode: 'PRACTICE' })], s)).toBe(2);
  });
  it('4 needs a mistake that was LATER corrected on the same skill', () => {
    const s = [seen('learn'), seen('example')], base = [at({}, 1), at({}, 2), at({}, 3)];
    expect(lvl([...base, at({ marks: 0, mistakes: ['used cost'], correctParts: 0 }, 4)], s)).toBe(3);                 // fell for it, not yet fixed
    expect(lvl([...base, at({ marks: 0, mistakes: ['used cost'], correctParts: 0 }, 4), at({}, 5)], s)).toBe(4);      // fixed
    expect(lvl([...base, at({ mistakes: ['x'] }, 9), at({ skill: 'other' }, 10)], s)).toBe(3);                         // fixed a DIFFERENT skill ≠ corrected
  });
  it('5 needs the last three Board attempts averaging ≥ 70 %', () => {
    const s = [seen('learn'), seen('example')];
    const pre = [at({}, 1), at({}, 2), at({}, 3), at({ marks: 0, mistakes: ['m'], correctParts: 0 }, 4), at({}, 5)];
    const board = (m: number[]) => m.map((x, i) => at({ mode: 'BOARD', marks: x, outOf: 4 }, 10 + i));
    expect(lvl([...pre, ...board([4, 4])], s)).toBe(4);            // only two board attempts
    expect(lvl([...pre, ...board([4, 3, 3])], s)).toBe(5);          // 10/12 = 83 %
    expect(lvl([...pre, ...board([2, 2, 2])], s)).toBe(4);          // 50 %
  });
});

describe('summaries and mistakes', () => {
  it('weak = at least 2 attempts and recent accuracy under 60 %', () => {
    const a = [at({ marks: 0, correctParts: 0 }, 1), at({ marks: 0, correctParts: 0 }, 2)];
    const s = summariseClauses(() => [LAB], a, [], 'XI').find(x => x.clause === CL)!;
    expect(s.weak).toBe(true); expect(s.accuracy).toBe(0);
    expect(summariseClauses(() => [LAB], [a[0]!], [], 'XI').find(x => x.clause === CL)!.weak).toBe(false);   // one attempt is not a pattern
    expect(summariseClauses(() => [LAB], [], [], 'XI').find(x => x.clause === CL)!.accuracy).toBeNull();
  });
  it('tallies repeated mistakes, most frequent first', () => {
    const t = mistakeTally([at({ mistakes: ['a', 'b'] }), at({ mistakes: ['a'] }), at({ mistakes: ['a'] })]);
    expect(t[0]).toMatchObject({ mistake: 'a', count: 3 }); expect(t[1]).toMatchObject({ mistake: 'b', count: 1 });
  });
  it('nextSkill: untried first, then the weakest; respects class and route', () => {
    expect(nextSkill([], 'XI').length).toBeGreaterThan(0);
    const many = ['dep-wdv', 'dep-slm', 'disposal', 'brs', 'gst', 'suspense', 'pdd', 'soa'];
    const tried = many.slice(0, 7).map((skill, i) => at({ skill, marks: skill === 'brs' ? 0 : 1, correctParts: skill === 'brs' ? 0 : 1 }, i));
    expect(nextSkill(tried, 'XI')).toBe('soa');                       // the only untried XI skill
    const all = many.map((skill, i) => at({ skill, marks: skill === 'brs' ? 0 : 1 }, i));
    expect(nextSkill(all, 'XI')).toBe('brs');                         // then the weakest
    expect(nextSkill([], 'XII', 'OPTION_II_COMPUTERISED')).not.toMatch(/ratio|cfo/);   // Option I skills are hidden on the computerised route
  });
});

describe('class report (teacher, from files students hand in)', () => {
  const file = (name: string, attempts: Attempt[]) => ({ file: `${name}.json`, data: { app: 'accounting-universe', version: 1, exportedAt: 1, profile: { cls: 'XI', route: 'OPTION_I_ANALYSIS', name }, attempts, seen: [] } });
  const bad = (n: number) => at({ marks: 0, correctParts: 0, mistakes: ['used cost'] }, n);
  it('aggregates by clause, finds struggling students and the commonest mistake', () => {
    const r = classReport([file('Asha', [bad(1), bad(2)]), file('Ravi', [at({}, 1), at({}, 2)]), file('Meena', [bad(1), at({}, 2)])]);
    expect(r.students.map(s => s.name)).toEqual(['Asha', 'Ravi', 'Meena']);
    const c = r.clauses.find(x => x.clause === CL)!;
    // Asha 0/2 and Meena 1/2 (50 %) are under the 60 % threshold; Ravi 2/2 is not
    expect(c.students).toBe(3); expect(c.strugglingStudents).toBe(2); expect(c.topMistake).toBe('used cost');
    expect(c.accuracy).toBeCloseTo(3 / 6);
    expect(r.students[0]!.weakClauses).toContain(CL);
  });
  it('rejects malformed or foreign files instead of crashing, and says why', () => {
    const r = classReport([{ file: 'x.json', data: { hello: 1 } }, { file: 'y.json', data: null }, { file: 'z.json', data: { app: 'accounting-universe', version: 1, attempts: [{ skill: 1 }], seen: [] } }, file('Ok', [at({})])]);
    expect(r.students.length).toBe(1); expect(r.skipped.length).toBe(3);
    expect(r.skipped.join()).toMatch(/not an Accounting Universe/); expect(r.skipped.join()).toMatch(/malformed/);
    expect(parseExport(undefined).ok).toBe(false);
  });
  it('CSV is valid and quotes awkward text', () => {
    const csv = reportToCsv(classReport([file('A', [at({ mistakes: ['said "yes", twice'] })])]));
    expect(csv.split('\n')[0]).toBe('clause,students_attempted,accuracy_percent,students_struggling,most_common_mistake');
    expect(csv).toContain('"said ""yes"", twice"');
  });
  it('an empty class gives an empty report, not an error', () => { const r = classReport([]); expect(r.students).toEqual([]); expect(r.clauses).toEqual([]); });
});
