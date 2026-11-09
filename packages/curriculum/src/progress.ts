/**
 * Learning progress model — pure functions, no storage, no DOM. The app stores raw events; everything the student or
 * teacher sees (levels, weak areas, common mistakes, class heat-map) is DERIVED from them here, so it can be tested.
 */
import { CLAUSES, UNITS, type ClassLevel } from './syllabus';
import { SKILLS } from './questions';

export interface Attempt {
  readonly t: number; readonly skill: string; readonly clause: string; readonly seed: number;
  readonly mode: 'BEGINNER' | 'PRACTICE' | 'BOARD';
  readonly marks: number; readonly outOf: number; readonly hintsUsed: number;
  readonly mistakes: readonly string[]; readonly correctParts: number; readonly parts: number;
}
export interface Seen { readonly lab: string; readonly tab: 'learn' | 'example' | 'try'; readonly t: number; }
export interface Profile { readonly cls: ClassLevel; readonly route: 'OPTION_I_ANALYSIS' | 'OPTION_II_COMPUTERISED'; readonly name: string; }
export interface Export { readonly app: 'accounting-universe'; readonly version: 1; readonly exportedAt: number; readonly profile: Profile | null; readonly attempts: Attempt[]; readonly seen: Seen[]; }

export const LEVELS = ['Not started', 'Understand', 'Observe', 'Guided practice', 'Error correction', 'Independent mastery'] as const;
export type Level = 0 | 1 | 2 | 3 | 4 | 5;

const pct = (a: readonly Attempt[]) => (a.reduce((s, x) => s + x.outOf, 0) === 0 ? 0 : a.reduce((s, x) => s + x.marks, 0) / a.reduce((s, x) => s + x.outOf, 0));

export interface ClauseInput { readonly clause: string; readonly labs: readonly string[]; readonly attempts: readonly Attempt[]; readonly seen: readonly Seen[]; }

/**
 * Five levels, each requiring the one before:
 *  1 Understand   – opened the Learn tab of a lab covering the clause
 *  2 Observe      – opened its Worked example
 *  3 Guided       – ≥ 3 Beginner-mode attempts
 *  4 Error fixing – fell for a typical mistake at least once and LATER answered that skill fully correctly
 *  5 Independent  – last 3 Board-mode attempts average ≥ 70 %
 */
export function levelFor(i: ClauseInput): Level {
  const sawTab = (tab: Seen['tab']) => i.seen.some(s => i.labs.includes(s.lab) && s.tab === tab);
  if (!sawTab('learn')) return 0;
  if (!sawTab('example')) return 1;
  const own = [...i.attempts].sort((a, b) => a.t - b.t);
  if (own.filter(a => a.mode === 'BEGINNER').length < 3) return 2;
  const corrected = own.some((a, k) => a.mistakes.length > 0 && own.slice(k + 1).some(b => b.skill === a.skill && b.marks === b.outOf));
  if (!corrected) return 3;
  const board = own.filter(a => a.mode === 'BOARD').slice(-3);
  if (board.length < 3 || pct(board) < 0.7) return 4;
  return 5;
}

export interface ClauseSummary { readonly clause: string; readonly level: Level; readonly attempts: number; readonly accuracy: number | null; readonly weak: boolean; }
export function summariseClauses(labsOfClause: (c: string) => readonly string[], attempts: readonly Attempt[], seen: readonly Seen[], cls?: ClassLevel): ClauseSummary[] {
  return CLAUSES.filter(c => !cls || c.id.startsWith(cls + '.')).map(c => {
    const a = attempts.filter(x => x.clause === c.id);
    const recent = a.slice(-10);
    return { clause: c.id, level: levelFor({ clause: c.id, labs: labsOfClause(c.id), attempts: a, seen }), attempts: a.length, accuracy: a.length ? pct(recent) : null, weak: a.length >= 2 && pct(recent) < 0.6 };
  });
}

export interface MistakeTally { readonly mistake: string; readonly count: number; readonly skill: string; }
export function mistakeTally(attempts: readonly Attempt[]): MistakeTally[] {
  const m = new Map<string, MistakeTally>();
  for (const a of attempts) for (const x of a.mistakes) { const k = `${a.skill}|${x}`; m.set(k, { mistake: x, skill: a.skill, count: (m.get(k)?.count ?? 0) + 1 }); }
  return [...m.values()].sort((a, b) => b.count - a.count);
}

/** Pick the skill to practise next: the weakest by recent accuracy, preferring skills never tried. Deterministic. */
export function nextSkill(attempts: readonly Attempt[], cls: ClassLevel, route: Profile['route'] = 'OPTION_I_ANALYSIS'): string {
  const inRoute = (clause: string) => {
    const unit = UNITS.find(u => clause.startsWith(u.id + '.'));
    return !unit || unit.cls !== cls || unit.route === 'COMMON' || unit.route === route;
  };
  const pool = SKILLS.filter(s => s.clause.startsWith(cls + '.') && inRoute(s.clause));
  const score = (skill: string) => { const a = attempts.filter(x => x.skill === skill); return a.length === 0 ? -1 : pct(a.slice(-5)); };
  return [...pool].sort((x, y) => score(x.skill) - score(y.skill) || x.skill.localeCompare(y.skill))[0]!.skill;
}

// ───────────── teacher view: aggregate exports handed over by students (no server, no accounts) ─────────────

export interface StudentRow { readonly name: string; readonly attempts: number; readonly accuracy: number | null; readonly weakClauses: string[]; }
export interface ClassClause { readonly clause: string; readonly students: number; readonly accuracy: number | null; readonly strugglingStudents: number; readonly topMistake: string | null; }
export interface ClassReport { readonly students: StudentRow[]; readonly clauses: ClassClause[]; readonly mistakes: MistakeTally[]; readonly skipped: string[]; }

/** Validate an imported file. Returns the export or a reason it was rejected. */
export function parseExport(raw: unknown): { ok: true; value: Export } | { ok: false; reason: string } {
  if (typeof raw !== 'object' || raw === null) return { ok: false, reason: 'not a JSON object' };
  const o = raw as Record<string, unknown>;
  if (o.app !== 'accounting-universe' || o.version !== 1) return { ok: false, reason: 'not an Accounting Universe progress file (version 1)' };
  if (!Array.isArray(o.attempts) || !Array.isArray(o.seen)) return { ok: false, reason: 'missing attempts/seen lists' };
  const okAttempt = (a: unknown) => { const x = a as Record<string, unknown>; return !!x && typeof x.skill === 'string' && typeof x.clause === 'string' && typeof x.marks === 'number' && typeof x.outOf === 'number' && Array.isArray(x.mistakes) && typeof x.t === 'number'; };
  if (!o.attempts.every(okAttempt)) return { ok: false, reason: 'an attempt record is malformed' };
  return { ok: true, value: raw as Export };
}

export function classReport(files: readonly { file: string; data: unknown }[], labsOfClause: (c: string) => readonly string[] = () => []): ClassReport {
  const good: { name: string; e: Export }[] = [], skipped: string[] = [];
  for (const f of files) {
    const p = parseExport(f.data);
    if (!p.ok) { skipped.push(`${f.file}: ${p.reason}`); continue; }
    good.push({ name: p.value.profile?.name?.trim() || f.file.replace(/\.json$/i, ''), e: p.value });
  }
  const students: StudentRow[] = good.map(({ name, e }) => {
    const sum = summariseClauses(labsOfClause, e.attempts, e.seen);
    return { name, attempts: e.attempts.length, accuracy: e.attempts.length ? pct(e.attempts) : null, weakClauses: sum.filter(s => s.weak).map(s => s.clause) };
  });
  const allMistakes = mistakeTally(good.flatMap(g => g.e.attempts));
  const clauses: ClassClause[] = CLAUSES.map(c => {
    const per = good.map(g => g.e.attempts.filter(a => a.clause === c.id)).filter(a => a.length > 0);
    const flat = per.flat();
    const struggling = per.filter(a => a.length >= 2 && pct(a.slice(-10)) < 0.6).length;
    const top = mistakeTally(flat)[0];
    return { clause: c.id, students: per.length, accuracy: flat.length ? pct(flat) : null, strugglingStudents: struggling, topMistake: top ? top.mistake : null };
  }).filter(c => c.students > 0);
  return { students, clauses, mistakes: allMistakes, skipped };
}

export function reportToCsv(r: ClassReport): string {
  const esc = (s: string | number | null) => { const t = s === null ? '' : String(s); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const rows = [['clause', 'students_attempted', 'accuracy_percent', 'students_struggling', 'most_common_mistake'], ...r.clauses.map(c => [c.clause, c.students, c.accuracy === null ? null : Math.round(c.accuracy * 100), c.strugglingStudents, c.topMistake])];
  return rows.map(row => row.map(esc).join(',')).join('\n');
}

// ───────────── teacher: error heat-map and remedial suggestions ─────────────

export interface Heatmap { readonly students: string[]; readonly clauses: string[]; readonly cells: (number | null)[][]; }
/** accuracy 0..1 per student × topic (null = not attempted). Only topics someone attempted are listed. */
export function heatmap(files: readonly { file: string; data: unknown }[]): Heatmap {
  const good: { name: string; e: Export }[] = [];
  for (const f of files) { const p = parseExport(f.data); if (p.ok) good.push({ name: p.value.profile?.name?.trim() || f.file.replace(/\.json$/i, ''), e: p.value }); }
  const clauses = CLAUSES.map(c => c.id).filter(id => good.some(g => g.e.attempts.some(a => a.clause === id)));
  const cells = good.map(g => clauses.map(id => { const a = g.e.attempts.filter(x => x.clause === id); return a.length ? pct(a) : null; }));
  return { students: good.map(g => g.name), clauses, cells };
}

export interface Remedial { readonly clause: string; readonly reason: string; readonly labs: readonly string[]; readonly skill: string | null; }
/** Topics where students are stuck, with where to send them. Strugglers first, then lowest class accuracy. */
export function remedial(r: ClassReport, labsOfClause: (c: string) => readonly string[]): Remedial[] {
  return r.clauses.filter(c => c.strugglingStudents > 0 || (c.accuracy !== null && c.accuracy < 0.6))
    .sort((a, b) => b.strugglingStudents - a.strugglingStudents || (a.accuracy ?? 1) - (b.accuracy ?? 1) || a.clause.localeCompare(b.clause))
    .map(c => ({ clause: c.clause, reason: `${c.strugglingStudents} of ${c.students} student${c.students === 1 ? '' : 's'} struggling${c.accuracy !== null ? `, class accuracy ${Math.round(c.accuracy * 100)}%` : ''}${c.topMistake ? `; most common mistake: ${c.topMistake}` : ''}`, labs: labsOfClause(c.clause), skill: SKILLS.find(s => s.clause === c.clause)?.skill ?? null }));
}
