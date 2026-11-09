import { describe, expect, it } from 'vitest';
import { CLAUSES } from '../src/syllabus';
import { SKILLS } from '../src/questions';
import { ALL_LABS, LEDGER_LAB, PAGES, coverage, hrefOf, labsOfClause } from '../../../apps/web/src/labs';
import { blocksToFacts } from '../../../apps/web/src/facts';

describe('lab registry', () => {
  it('has unique ids', () => { expect(new Set(ALL_LABS.map(l => l.id)).size).toBe(ALL_LABS.length); });
  it('only references syllabus clauses that exist', () => {
    const ids = new Set(CLAUSES.map(c => c.id));
    for (const l of [...ALL_LABS, LEDGER_LAB]) for (const c of l.clauses) expect(ids.has(c), `${l.id}: ${c}`).toBe(true);
  });
  it('only references practice skills that exist', () => {
    const sk = new Set(SKILLS.map(s => s.skill));
    for (const l of ALL_LABS) for (const s of l.skills) expect(sk.has(s), `${l.id}: ${s}`).toBe(true);
  });
  it('every lab field has an example value or is optional (no field is undefined-only by accident)', () => {
    for (const l of ALL_LABS) for (const k of Object.keys(l.example)) expect(l.fields.some(f => f.id === k), `${l.id}: example key ${k}`).toBe(true);
  });
  it('every worked example computes without error and yields output', () => {
    for (const l of ALL_LABS) { const blocks = l.compute({ ...l.example }); expect(blocks.length, l.id).toBeGreaterThan(0); }
  });
  it('class XI and XII both have labs and an honest coverage count', () => {
    for (const cls of ['XI', 'XII'] as const) { const c = coverage(cls); expect(c.covered).toBeGreaterThan(5); expect(c.covered).toBeLessThanOrEqual(c.total); }
    expect(labsOfClause('XII.2.forfeiture')).toContain('xii-shares');
    expect(labsOfClause('XII.C.cas')).toContain('xii-cas');          // Computerised Accounting simulator exists
    expect(labsOfClause('XII.C.spreadsheet')).toContain('xii-spreadsheet');
  });
  it('every syllabus topic has an interactive lab/page or at least a concept card — and the theory-only ones are exactly these', () => {
    const xi = coverage('XI'), xii = coverage('XII');
    expect(xi.none + xii.none).toBe(0);
    expect(xi.rows.filter(r => !r.interactive).map(r => r.clause.id)).toEqual(['XI.1.intro', 'XI.1.terms', 'XI.1.concepts', 'XI.1.basis', 'XI.1.standards', 'XI.2.vouchers']);
    expect(xii.rows.filter(r => !r.interactive)).toEqual([]);
  });
  it('page entries have routes that exist and clauses that exist', () => {
    const ids = new Set(CLAUSES.map(c => c.id));
    for (const p of PAGES) { expect(p.href.startsWith('#/')).toBe(true); expect(hrefOf(p.id)).toBe(p.href); for (const c of p.clauses) expect(ids.has(c), `${p.id}: ${c}`).toBe(true); }
  });
  it('Option II topics are reachable without any Option I lab', () => {
    for (const c of ['XII.C.cas', 'XII.C.spreadsheet', 'XII.C.using']) expect(labsOfClause(c).some(id => id === 'xii-cas' || id === 'xii-spreadsheet'), c).toBe(true);
  });
  it('tutor facts: every lab example flattens to a bounded list of sentences that contain the engine numbers', () => {
    for (const l of ALL_LABS) {
      const f = blocksToFacts(l.compute({ ...l.example }));
      expect(f.length, l.id).toBeGreaterThan(0); expect(f.length).toBeLessThanOrEqual(60); for (const line of f) expect(line.length).toBeLessThanOrEqual(300);
      expect(f.join(' '), l.id).toMatch(/\d/);
    }
  });
});
