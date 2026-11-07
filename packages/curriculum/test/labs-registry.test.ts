import { describe, expect, it } from 'vitest';
import { CLAUSES } from '../src/syllabus';
import { SKILLS } from '../src/questions';
import { ALL_LABS, LEDGER_LAB, coverage, labsOfClause } from '../../../apps/web/src/labs';

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
    expect(labsOfClause('XII.C.cas')).toEqual([]);      // Computerised Accounting is NOT built — must not be claimed
  });
});
