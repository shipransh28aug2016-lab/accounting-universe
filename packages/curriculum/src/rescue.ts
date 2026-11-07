/** Weak-student rescue: turns a topic's progress into a concrete, ordered plan through the five levels. Pure and tested. */
import type { Attempt, Seen } from './progress';
import { levelFor, LEVELS } from './progress';
import { SKILLS } from './questions';

export interface RescueStep { readonly level: 1 | 2 | 3 | 4 | 5; readonly name: string; readonly done: boolean; readonly instruction: string; readonly href: string; }
export interface RescuePlan { readonly clause: string; readonly currentLevel: number; readonly levelName: string; readonly steps: readonly RescueStep[]; readonly next: RescueStep | null; }

export function rescuePlan(o: { clause: string; labs: readonly string[]; attempts: readonly Attempt[]; seen: readonly Seen[]; hrefForLab?: (id: string) => string }): RescuePlan {
  const own = o.attempts.filter(a => a.clause === o.clause);
  const lvl = levelFor({ clause: o.clause, labs: o.labs, attempts: own, seen: o.seen });
  const lab = o.labs[0];
  const labHref = lab ? (o.hrefForLab ? o.hrefForLab(lab) : `#/lab/${lab}`) : `#/class/${o.clause.split('.')[0]}`;
  const skill = SKILLS.find(s => s.clause === o.clause)?.skill;
  const practice = (mode: string) => skill ? `#/practice/${skill}/new/${mode}` : labHref;
  const steps: RescueStep[] = [
    { level: 1, name: LEVELS[1], done: lvl >= 1, instruction: 'Read the idea and the real-life example. No numbers yet.', href: labHref },
    { level: 2, name: LEVELS[2], done: lvl >= 2, instruction: 'Watch the worked example step by step; read why each step is done.', href: labHref + (lab ? '' : '') },
    { level: 3, name: LEVELS[3], done: lvl >= 3, instruction: skill ? 'Do 3 questions in Beginner mode. Use the hints — that is what they are for.' : 'This is a theory topic: answer the self-check questions on the card.', href: practice('beginner') },
    { level: 4, name: LEVELS[4], done: lvl >= 4, instruction: skill ? 'Find and fix your own mistake: when an answer is marked wrong, read why, then answer a fresh question of the same kind correctly.' : 'Re-read any card you got wrong and answer again.', href: practice('practice') },
    { level: 5, name: LEVELS[5], done: lvl >= 5, instruction: skill ? 'Three questions in Board mode, no hints, averaging 70% or more.' : 'Theory topics reach level 3 only; apply them in the related labs.', href: practice('board') },
  ];
  const reachable = skill ? steps : steps.filter(s => s.level <= 3);
  const next = reachable.find(s => !s.done) ?? null;
  return { clause: o.clause, currentLevel: lvl, levelName: LEVELS[lvl], steps: reachable, next };
}

/** Topics to rescue first: started-but-weak, then lowest level. */
export function rescueOrder(rows: readonly { clause: string; level: number; weak: boolean; attempts: number }[]): string[] {
  return [...rows].filter(r => r.weak || r.level < 5).sort((a, b) => Number(b.weak) - Number(a.weak) || (b.attempts > 0 ? 1 : 0) - (a.attempts > 0 ? 1 : 0) || a.level - b.level || a.clause.localeCompare(b.clause)).map(r => r.clause);
}
