import { describe, expect, it } from 'vitest';
import { CLAUSES, SOURCE, UNITS, clauseById, theoryMarks, unitById } from '../src';

describe('syllabus data matches the official marks tables', () => {
  it('Class XI theory = 12 + 44 + 24 = 80 (+ project 20)', () => {
    expect(theoryMarks('XI')).toBe(80);
    expect(unitById('XI.P')!.marks).toBe(20);
  });
  it('Class XII theory is 80 on EITHER route: Option I 36+24+12+8, Option II 36+24+20', () => {
    expect(theoryMarks('XII', 'OPTION_I_ANALYSIS')).toBe(80);
    expect(theoryMarks('XII', 'OPTION_II_COMPUTERISED')).toBe(80);
  });
  it('the two Class XII routes are alternatives, never added together (would be 100)', () => {
    const both = UNITS.filter(u => u.cls === 'XII' && !u.id.endsWith('.P')).reduce((a, u) => a + u.marks, 0);
    expect(both).toBe(100);
    expect(theoryMarks('XII', 'OPTION_I_ANALYSIS')).not.toBe(both);
  });
  it('ids are unique and every clause belongs to a known unit of the right class', () => {
    expect(new Set(CLAUSES.map(c => c.id)).size).toBe(CLAUSES.length);
    for (const c of CLAUSES) {
      const u = unitById(c.unit);
      expect(u, c.id).toBeDefined();
      expect(c.id.startsWith(u!.cls + '.'), c.id).toBe(true);
    }
    for (const u of UNITS) expect(CLAUSES.some(c => c.unit === u.id), `unit ${u.id} has no clauses`).toBe(true);
  });
  it('official limits are recorded where the syllabus states them', () => {
    expect(clauseById('XII.2.debentures')!.limit).toMatch(/redemption accounting is not prescribed/);
    expect(clauseById('XII.2.issue')!.limit).toMatch(/exclude interest/);
    expect(clauseById('XII.1.dissolution')!.limit).toMatch(/piecemeal/);
    expect(clauseById('XI.2.tb')!.limit).toMatch(/Balance method only/);
    expect(clauseById('XI.3.incomplete')!.limit).toMatch(/conversion/);
    expect(clauseById('XII.4.preparation')!.limit).toMatch(/Indirect/);
  });
  it('records which official document this was built from', () => {
    expect(SOURCE.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(SOURCE.url).toContain('Accountancy_SecP2_2026-27.pdf');
  });
});
