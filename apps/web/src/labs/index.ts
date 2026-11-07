import { CLAUSES, UNITS, type ClassLevel } from '../../../../packages/curriculum/src';
import type { Lab } from '../spec';
import { XI_LABS } from './xi';
import { PARTNERSHIP_LABS } from './partnership';
import { COMPANY_LABS } from './company';

export const ALL_LABS: readonly Lab[] = [...XI_LABS, ...PARTNERSHIP_LABS, ...COMPANY_LABS];
/** The custom Journal → Ledger → Trial Balance page is not a `Lab` (it is interactive, not form-and-result) but covers these clauses. */
export const LEDGER_LAB = { id: 'xi-ledger', title: 'Journal → Ledger → Trial Balance', clauses: ['XI.2.rules', 'XI.2.equation', 'XI.2.journal', 'XI.2.ledger', 'XI.2.tb'] } as const;

export const labById = (id: string) => ALL_LABS.find(l => l.id === id);
export const labsOfClause = (clause: string): string[] => [...ALL_LABS.filter(l => l.clauses.includes(clause)).map(l => l.id), ...(LEDGER_LAB.clauses.includes(clause as never) ? [LEDGER_LAB.id] : [])];

/** Honest coverage: which syllabus clauses have an interactive lab, and which are not built yet. */
export function coverage(cls: ClassLevel) {
  const clauses = CLAUSES.filter(c => c.id.startsWith(cls + '.'));
  const rows = clauses.map(c => ({ clause: c, labs: labsOfClause(c.id), unit: UNITS.find(u => u.id === c.unit)! }));
  return { rows, covered: rows.filter(r => r.labs.length > 0).length, total: rows.length };
}
