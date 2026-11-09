/** Teacher assignments and chapter tests, shared as plain files (no server). The same question seeds give every student the same paper. */
import type { Attempt } from './progress';
import { SKILLS } from './questions';
import { Rng } from './rng';

export interface AssignmentItem { readonly skill: string; readonly seed: number; }
export interface Assignment { readonly app: 'accounting-universe'; readonly kind: 'assignment'; readonly version: 1; readonly id: string; readonly title: string; readonly mode: 'BEGINNER' | 'PRACTICE' | 'BOARD'; readonly createdAt: number; readonly items: readonly AssignmentItem[]; }

export function makeAssignment(o: { title: string; mode: Assignment['mode']; skills: readonly string[]; perSkill: number; seed: number; createdAt?: number }): Assignment {
  if (!o.title.trim()) throw new RangeError('An assignment needs a title');
  if (o.skills.length === 0) throw new RangeError('Choose at least one topic');
  if (!Number.isInteger(o.perSkill) || o.perSkill < 1 || o.perSkill > 20) throw new RangeError('Questions per topic must be 1 to 20');
  for (const s of o.skills) if (!SKILLS.some(x => x.skill === s)) throw new RangeError(`Unknown topic "${s}"`);
  const rng = new Rng(o.seed);
  const items: AssignmentItem[] = [];
  for (const skill of o.skills) for (let k = 0; k < o.perSkill; k++) items.push({ skill, seed: 1 + Math.floor(rng.next() * 999_999_999) });
  return { app: 'accounting-universe', kind: 'assignment', version: 1, id: `A${o.seed}-${items.length}`, title: o.title.trim(), mode: o.mode, createdAt: o.createdAt ?? 0, items };
}

export function parseAssignment(raw: unknown): { ok: true; value: Assignment } | { ok: false; reason: string } {
  if (typeof raw !== 'object' || raw === null) return { ok: false, reason: 'not a JSON object' };
  const o = raw as Record<string, unknown>;
  if (o.app !== 'accounting-universe' || o.kind !== 'assignment' || o.version !== 1) return { ok: false, reason: 'not an Accounting Universe assignment file' };
  if (typeof o.id !== 'string' || typeof o.title !== 'string' || !Array.isArray(o.items) || o.items.length === 0 || o.items.length > 200) return { ok: false, reason: 'missing id, title or questions' };
  if (o.mode !== 'BEGINNER' && o.mode !== 'PRACTICE' && o.mode !== 'BOARD') return { ok: false, reason: 'unknown mode' };
  const good = o.items.every(i => { const x = i as Record<string, unknown>; return typeof x.skill === 'string' && SKILLS.some(s => s.skill === x.skill) && Number.isInteger(x.seed) && (x.seed as number) > 0; });
  if (!good) return { ok: false, reason: 'a question refers to an unknown topic or has a bad seed' };
  return { ok: true, value: raw as Assignment };
}

export interface ItemProgress { readonly item: AssignmentItem; readonly attempted: boolean; readonly marks: number; readonly outOf: number; }
export function assignmentProgress(a: Assignment, attempts: readonly Attempt[]): { items: ItemProgress[]; done: number; marks: number; outOf: number } {
  const items = a.items.map(item => {
    const tries = attempts.filter(x => x.skill === item.skill && x.seed === item.seed);
    if (tries.length === 0) return { item, attempted: false, marks: 0, outOf: 0 };
    const best = tries.reduce((p, c) => (c.marks / Math.max(1, c.outOf) > p.marks / Math.max(1, p.outOf) ? c : p));
    return { item, attempted: true, marks: best.marks, outOf: best.outOf };
  });
  return { items, done: items.filter(i => i.attempted).length, marks: items.reduce((s, i) => s + i.marks, 0), outOf: items.reduce((s, i) => s + i.outOf, 0) };
}
