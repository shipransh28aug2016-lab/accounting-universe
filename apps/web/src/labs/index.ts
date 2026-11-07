import { CARDS, CLAUSES, UNITS, type ClassLevel } from '../../../../packages/curriculum/src';
import type { Lab } from '../spec';
import { XI_LABS } from './xi';
import { XI2_LABS } from './xi2';
import { PARTNERSHIP_LABS } from './partnership';
import { COMPANY_LABS } from './company';
import { XII2_LABS } from './xii2';

export const ALL_LABS: readonly Lab[] = [...XI_LABS, ...XI2_LABS, ...PARTNERSHIP_LABS, ...XII2_LABS, ...COMPANY_LABS];

/** Interactive pages that are not form-and-result labs. */
export interface PageEntry { readonly id: string; readonly title: string; readonly summary: string; readonly cls: 'XI' | 'XII'; readonly href: string; readonly clauses: readonly string[]; readonly route?: 'OPTION_I_ANALYSIS' | 'OPTION_II_COMPUTERISED'; }
export const PAGES: readonly PageEntry[] = [
  { id: 'xi-ledger', title: 'Journal → Ledger → Trial Balance', summary: 'Watch debit and credit move through the journal, ledger and trial balance — with reversals and an audit trail.', cls: 'XI', href: '#/ledger', clauses: ['XI.2.rules', 'XI.2.equation', 'XI.2.journal', 'XI.2.ledger', 'XI.2.tb'] },
  { id: 'xi-trainer', title: 'Debit & Credit Trainer', summary: 'Pick the accounts to debit and credit for everyday transactions and learn why from the rule of each account type.', cls: 'XI', href: '#/trainer', clauses: ['XI.2.rules', 'XI.2.journal'] },
  { id: 'xi-project', title: 'Project Assistant (Class XI)', summary: 'Plan and track your project: vouchers, bank reconciliation or a comprehensive sole-proprietorship project.', cls: 'XI', href: '#/project/XI', clauses: ['XI.P.project'] },
  { id: 'xii-cas', title: 'Computerised Accounting Simulator', summary: 'Codify accounts, enter and validate vouchers, post automatically, adjust and close the year — the way accounting software works.', cls: 'XII', href: '#/cas', clauses: ['XII.C.using', 'XII.C.cas'], route: 'OPTION_II_COMPUTERISED' },
  { id: 'xii-project', title: 'Project / Practical Assistant (Class XII)', summary: 'Plan and track your Class XII project (Option I) or practical file (Option II).', cls: 'XII', href: '#/project/XII', clauses: ['XII.P.project'] },
];
export const LEDGER_LAB = PAGES[0]!;

export const cardId = (id: string) => `card:${id}`;
export const isCard = (id: string) => id.startsWith('card:');
export const labById = (id: string) => ALL_LABS.find(l => l.id === id);
export const labsOfClause = (clause: string): string[] => [...ALL_LABS.filter(l => l.clauses.includes(clause)).map(l => l.id), ...PAGES.filter(p => p.clauses.includes(clause)).map(p => p.id), ...CARDS.filter(c => c.clause === clause).map(c => cardId(c.id))];
export const hrefOf = (id: string): string => isCard(id) ? `#/cards/${id.slice(5)}` : PAGES.find(p => p.id === id)?.href ?? `#/lab/${id}`;
export const titleOf = (id: string): string => isCard(id) ? `Card: ${CARDS.find(c => c.id === id.slice(5))?.title ?? id}` : PAGES.find(p => p.id === id)?.title ?? labById(id)?.title ?? id;

/** Honest coverage: interactive lab/page vs concept card only vs nothing built. */
export function coverage(cls: ClassLevel) {
  const rows = CLAUSES.filter(c => c.id.startsWith(cls + '.')).map(c => { const ids = labsOfClause(c.id); return { clause: c, labs: ids, interactive: ids.some(i => !isCard(i)), cards: ids.some(isCard), unit: UNITS.find(u => u.id === c.unit)! }; });
  return { rows, interactive: rows.filter(r => r.interactive).length, cardsOnly: rows.filter(r => !r.interactive && r.cards).length, none: rows.filter(r => !r.interactive && !r.cards).length, covered: rows.filter(r => r.interactive || r.cards).length, total: rows.length };
}
