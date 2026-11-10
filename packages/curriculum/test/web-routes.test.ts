import { describe, expect, it } from 'vitest';
import { NAV, hashFor, resolve } from '../../../apps/web/src/routes';

/** The router and header logic as it was BEFORE the route table (kept here as an oracle so the refactor is provably behaviour-preserving). */
const OLD_NAV: { label: string; match: (p: string[]) => boolean }[] = [
  { label: 'HOME', match: p => p.length === 0 }, { label: 'CLASS XI', match: p => p[0] === 'class' && p[1] === 'XI' }, { label: 'CLASS XII', match: p => p[0] === 'class' && p[1] === 'XII' },
  { label: 'VISUAL LABS', match: p => ['labs', 'lab', 'ledger', 'trainer', 'cas', 'cards', 'project'].includes(p[0] ?? '') },
  { label: 'PRACTICE', match: p => ['practice', 'assignment', 'rescue'].includes(p[0] ?? '') }, { label: 'AI TUTOR', match: p => p[0] === 'tutor' },
  { label: 'MY PROGRESS', match: p => p[0] === 'progress' }, { label: 'TEACHER DASHBOARD', match: p => p[0] === 'teacher' },
];
const oldNav = (p: string[]) => OLD_NAV.find(n => n.match(p))?.label ?? null;
const oldPage = (p: string[]) => {
  if (p.length === 0) return 'home'; if (p[0] === 'class' && (p[1] === 'XI' || p[1] === 'XII')) return 'class'; if (p[0] === 'labs') return 'labs'; if (p[0] === 'lab' && p[1]) return 'lab';
  if (p[0] === 'ledger') return 'ledger'; if (p[0] === 'practice') return 'practice'; if (p[0] === 'cards') return 'cards'; if (p[0] === 'trainer') return 'trainer'; if (p[0] === 'cas') return 'cas';
  if (p[0] === 'project') return 'project'; if (p[0] === 'rescue') return 'rescue'; if (p[0] === 'assignment' && p[1]) return 'assignment'; if (p[0] === 'tutor') return 'tutor';
  if (p[0] === 'progress') return 'progress'; if (p[0] === 'teacher') return 'teacher'; return 'notfound';
};
const PATHS: string[][] = [[], ['class', 'XI'], ['class', 'XII'], ['class', 'X'], ['class'], ['labs'], ['lab'], ['lab', 'xi-brs'], ['lab', 'nope'], ['ledger'], ['practice'], ['practice', 'dep-wdv', '5', 'board'], ['cards'], ['cards', 'gst'], ['cards', 'zzz'],
  ['trainer'], ['cas'], ['project'], ['project', 'XII'], ['rescue'], ['rescue', 'XI.2.brs'], ['assignment'], ['assignment', 'A1-2'], ['tutor'], ['progress'], ['teacher'], ['nonsense'], ['teacher', 'extra'], ['', 'x']];

describe('route table', () => {
  it('agrees with the previous router and header highlighting on every path', () => {
    for (const p of PATHS) { const r = resolve(p); expect(r.id, JSON.stringify(p)).toBe(oldPage(p)); expect(r.nav, `nav ${JSON.stringify(p)}`).toBe(oldNav(p)); }
  });
  it('the header lists the same eight items in the same order, each linking to a route that resolves to it', () => {
    expect(NAV.map(n => n.key)).toEqual(OLD_NAV.map(n => n.label));
    for (const n of NAV) expect(resolve(n.hash.replace(/^#\/?/, '').split('/').filter(Boolean)).nav, n.key).toBe(n.key);
  });
  it('passes the rest of the path to the page', () => { expect(resolve(['practice', 'dep-wdv', '7', 'board']).rest).toEqual(['dep-wdv', '7', 'board']); });
  it('hashFor encodes segments', () => { expect(hashFor('rescue', 'XI.2.brs')).toBe('#/rescue/XI.2.brs'); expect(hashFor('lab', 'a b')).toBe('#/lab/a%20b'); });
});
