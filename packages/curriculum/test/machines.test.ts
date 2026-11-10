import { describe, expect, it } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import { Machine, toMermaid, validateSpec, targetsOf, type MachineSpec } from '../../engine/src';
import { AI_ASK, ASYNC_RESOURCE, CARD_CHECK, CAS_VOUCHER, CAS_YEAR, LAB_RUN, LEDGER_PLAYER, MACHINES, NETWORK, PRACTICE_QUESTION, SHARE_LIFECYCLE, STORAGE, TRAINER_ROUND, shareStages, type QuestionCtx } from '../src';

describe('every machine in the registry', () => {
  it('is well-formed: known targets, reachable states, no dead ends, documented', () => { for (const { spec } of MACHINES) expect(validateSpec(spec as MachineSpec<string, string, unknown>), spec.id).toEqual([]); });
  it('has a unique id', () => { expect(new Set(MACHINES.map(m => m.spec.id)).size).toBe(MACHINES.length); });
  it('random event walks never leave the declared states, and a refused event never changes state', () => {
    let seed = 99; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
    const ctxFor: Record<string, () => unknown> = {
      'practice-question': () => ({ mode: (['BEGINNER', 'PRACTICE', 'BOARD'] as const)[Math.floor(rnd() * 3)], hintsLeft: Math.floor(rnd() * 3), stepsLeft: Math.floor(rnd() * 3) }),
      'trainer-round': () => ({ hasBoth: rnd() < 0.5 }), 'card-check': () => ({ hasChoice: rnd() < 0.5 }), 'ai-ask': () => ({ hasQuestion: rnd() < 0.5 }),
      'cas-voucher': () => ({ role: (['ACCOUNTANT', 'CHECKER', 'VIEWER'] as const)[Math.floor(rnd() * 3)], yearClosed: rnd() < 0.3 }),
      'cas-year': () => ({ role: (['ACCOUNTANT', 'CHECKER', 'VIEWER'] as const)[Math.floor(rnd() * 3)], pending: Math.floor(rnd() * 3) }),
    };
    for (const { spec } of MACHINES) {
      const s = spec as MachineSpec<string, string, unknown>, names = Object.keys(s.states), events = [...new Set(names.flatMap(n => targetsOf(s.states[n]!).map(t => t.event)))];
      const m = new Machine(s, undefined as unknown);
      for (let i = 0; i < 3000; i++) {
        if (ctxFor[s.id]) m.ctx = ctxFor[s.id]!();
        const before = m.state, r = m.send(events[Math.floor(rnd() * events.length)]!);
        expect(names, s.id).toContain(m.state); if (!r.ok) { expect(m.state, s.id).toBe(before); expect(r.reason, `${s.id}: refusal without a reason`).toBeTruthy(); }
      }
    }
  });
});

describe('ledger player', () => {
  it('the story: play → ticks → done → finished; Play is refused with a clear reason; Replay works', () => {
    const m = new Machine(LEDGER_PLAYER);
    expect(m.send('PLAY').to).toBe('PLAYING'); m.send('TICK'); m.send('TICK'); expect(m.send('DONE').to).toBe('FINISHED');
    expect(m.why('PLAY')).toBe('The story is finished — press Replay or Reset.'); expect(m.why('STEP')).toMatch(/finished/);
    expect(m.send('REPLAY').to).toBe('PLAYING'); expect(m.send('RESET').to).toBe('IDLE');
  });
  it('a manual Step while playing pauses playback (as before); pausing when idle is refused', () => {
    const m = new Machine(LEDGER_PLAYER); expect(m.why('PAUSE')).toBe('Nothing is playing yet.');
    m.send('PLAY'); expect(m.send('STEP').to).toBe('PAUSED'); expect(m.send('PLAY').to).toBe('PLAYING');
  });
  it('DISPOSE is possible from every live state and then nothing else is (the timer-leak fix)', () => {
    for (const path of [[], ['PLAY'], ['PLAY', 'PAUSE'], ['PLAY', 'DONE']] as const) {
      const m = new Machine(LEDGER_PLAYER); path.forEach(e => m.send(e)); expect(m.send('DISPOSE').to).toBe('DISPOSED'); expect(m.isFinal()).toBe(true);
      for (const e of ['PLAY', 'STEP', 'TICK', 'REPLAY'] as const) expect(m.can(e)).toBe(false);
    }
  });
});

describe('practice question', () => {
  const ctx = (o: Partial<QuestionCtx> = {}): QuestionCtx => ({ mode: 'PRACTICE', hintsLeft: 2, stepsLeft: 3, ...o });
  it('beginner: a wrong answer can be retried; the final answer ends it and can never be recorded twice', () => {
    const m = new Machine(PRACTICE_QUESTION, ctx({ mode: 'BEGINNER' }));
    expect(m.send('SUBMIT_PARTIAL').to).toBe('RETRYING'); expect(m.send('SUBMIT_PARTIAL').to).toBe('RETRYING'); expect(m.send('SUBMIT_FINAL').to).toBe('SUBMITTED');
    const again = m.send('SUBMIT_FINAL'); expect(again.ok).toBe(false); expect(again.reason).toMatch(/Already checked/);
    expect(m.why('HINT')).toBe('The full working is already shown.'); expect(m.send('NEXT').to).toBe('ANSWERING');
  });
  it('hints: not in Board mode, not when used up; steps: Beginner only', () => {
    expect(new Machine(PRACTICE_QUESTION, ctx({ mode: 'BOARD' })).why('HINT')).toBe('Hints are off in Board mode (exam conditions).');
    expect(new Machine(PRACTICE_QUESTION, ctx({ hintsLeft: 0 })).why('HINT')).toBe('No more hints for this question.');
    expect(new Machine(PRACTICE_QUESTION, ctx()).why('STEP_SHOW')).toBe('Step-by-step help is only in Beginner mode.');
    expect(new Machine(PRACTICE_QUESTION, ctx({ mode: 'BEGINNER', stepsLeft: 0 })).why('STEP_SHOW')).toBe('You have seen every step.');
    expect(new Machine(PRACTICE_QUESTION, ctx()).can('HINT')).toBe(true);
  });
  it('non-beginner modes have no RETRYING path that the UI uses, but the spec stays permissive (the UI decides when a wrong answer ends the question)', () => {
    const m = new Machine(PRACTICE_QUESTION, ctx()); expect(m.send('SUBMIT_FINAL').to).toBe('SUBMITTED');
  });
});

describe('trainer, card check, ai ask, lab run', () => {
  it('trainer: needs both accounts; one answer per question; finish and play again', () => {
    const m = new Machine(TRAINER_ROUND, { hasBoth: false }); expect(m.why('ANSWER')).toBe('Choose an account for both the debit and the credit side.');
    m.ctx.hasBoth = true; m.send('ANSWER'); expect(m.why('ANSWER')).toMatch(/Already answered/); m.send('FINISH'); expect(m.send('AGAIN').to).toBe('ASKING');
  });
  it('card check: choose first; locked after', () => {
    const m = new Machine(CARD_CHECK, { hasChoice: false }); expect(m.why('ANSWER')).toBe('Choose an answer first.'); m.ctx.hasChoice = true; m.send('ANSWER'); expect(m.why('ANSWER')).toBe('Already answered.');
  });
  it('ai ask: a question is required; one at a time; every outcome allows asking again', () => {
    const m = new Machine(AI_ASK, { hasQuestion: false }); expect(m.why('ASK')).toBe('Type your question first.'); m.ctx.hasQuestion = true;
    m.send('ASK'); expect(m.why('ASK')).toBe('Still thinking — one question at a time.');
    for (const e of ['RESOLVE', 'WITHHOLD', 'REJECT'] as const) { const x = new Machine(AI_ASK, { hasQuestion: true }); x.send('ASK'); x.send(e); expect(x.can('ASK'), e).toBe(true); }
  });
  it('lab run: ok ↔ error freely, reset to idle', () => { const m = new Machine(LAB_RUN); m.send('RUN_ERROR'); m.send('RUN_OK'); expect(m.state).toBe('OK'); expect(m.send('RESET').to).toBe('IDLE'); });
});

describe('async resource, storage, boot, network', () => {
  it('async: loading → ready; failure offers retry; late results after leaving are refused', () => {
    const m = new Machine(ASYNC_RESOURCE); m.send('LOAD'); m.send('REJECT'); expect(m.can('RETRY')).toBe(true); m.send('RETRY'); m.send('DISPOSE'); expect(m.send('RESOLVE').ok).toBe(false);
    const ok = new Machine(ASYNC_RESOURCE); ok.send('LOAD'); ok.send('RESOLVE'); expect(ok.send('RELOAD').to).toBe('LOADING');
  });
  it('storage: opened → indexeddb → degraded on a failed write; unavailable → memory (both are final and flagged for a banner)', () => {
    const a = new Machine(STORAGE); a.send('OPENED'); expect(a.state).toBe('INDEXEDDB'); a.send('WRITE_FAILED'); expect(a.state).toBe('DEGRADED'); expect(a.isFinal()).toBe(true);
    const b = new Machine(STORAGE); b.send('UNAVAILABLE'); expect(b.state).toBe('MEMORY');
  });
  it('network toggles', () => { const m = new Machine(NETWORK); m.send('WENT_OFFLINE'); expect(m.state).toBe('OFFLINE'); m.send('WENT_ONLINE'); expect(m.state).toBe('ONLINE'); });
});

describe('Computerised Accounting Simulator machines — the exact messages the UI shows', () => {
  it('voucher: only an Accountant enters, only a Checker verifies or sends back, and not in a closed year', () => {
    const m = new Machine(CAS_VOUCHER, { role: 'VIEWER', yearClosed: false });
    expect(m.why('SAVE')).toBe('Your role cannot enter vouchers. Switch to Accountant.');
    m.ctx.role = 'ACCOUNTANT'; m.ctx.yearClosed = true; expect(m.why('SAVE')).toBe('The year is closed. Start the next year before entering vouchers.');
    m.ctx.yearClosed = false; expect(m.send('SAVE').to).toBe('PENDING');
    expect(m.why('VERIFY')).toBe('Only a Checker can verify and post. Switch role.'); expect(m.why('SEND_BACK')).toBe('Only a Checker can reject.');
    m.ctx.role = 'CHECKER'; expect(m.send('VERIFY').to).toBe('POSTED'); expect(m.isFinal()).toBe(true);
  });
  it('year: close needs a Checker and an empty queue; then it cannot be closed twice; next year needs a Checker', () => {
    const y = new Machine(CAS_YEAR, { role: 'ACCOUNTANT', pending: 0 });
    expect(y.why('CLOSE')).toBe('Only a Checker can close the year.'); y.ctx.role = 'CHECKER'; y.ctx.pending = 2; expect(y.why('CLOSE')).toBe('Verify or reject all pending vouchers first.');
    expect(y.why('START_NEXT_YEAR')).toBe('Close the year first.'); y.ctx.pending = 0; expect(y.send('CLOSE').to).toBe('CLOSED');
    expect(y.why('CLOSE')).toBe('This year is already closed.'); y.ctx.role = 'VIEWER'; expect(y.why('START_NEXT_YEAR')).toBe('Only a Checker can start the next year.');
    y.ctx.role = 'CHECKER'; expect(y.send('START_NEXT_YEAR').to).toBe('OPEN');
  });
  it('restoring a saved book can land in either state from either state', () => {
    for (const from of [[], ['CLOSE']] as const) for (const e of ['RESTORE_OPEN', 'RESTORE_CLOSED'] as const) { const y = new Machine(CAS_YEAR, { role: 'CHECKER', pending: 0 }); from.forEach(x => y.send(x)); expect(y.can(e)).toBe(true); }
  });
});

describe('share lifecycle (domain) — stages drawn by the Share Capital lab', () => {
  it('fully paid', () => { expect(shareStages({ arrears: false, forfeited: false, reissued: false }).map(s => s.state)).toEqual(['done', 'done', 'done', 'done', 'skip', 'skip']); });
  it('arrears only', () => { expect(shareStages({ arrears: true, forfeited: false, reissued: false }).map(s => s.state)).toEqual(['done', 'done', 'done', 'issue', 'skip', 'skip']); });
  it('arrears → forfeited', () => { expect(shareStages({ arrears: true, forfeited: true, reissued: false }).map(s => s.state)).toEqual(['done', 'done', 'done', 'issue', 'issue', 'skip']); });
  it('arrears → forfeited → re-issued', () => { expect(shareStages({ arrears: true, forfeited: true, reissued: true }).map(s => s.state)).toEqual(['done', 'done', 'done', 'issue', 'issue', 'done']); });
  it('impossible stories are refused', () => {
    expect(() => shareStages({ arrears: false, forfeited: true, reissued: false })).toThrow(/after a call was not paid/);
    expect(() => shareStages({ arrears: true, forfeited: false, reissued: true })).toThrow();       // cannot re-issue what was never forfeited
  });
  it('the machine itself matches the syllabus story', () => { expect(Object.keys(SHARE_LIFECYCLE.states)).toEqual(['APPLICATION', 'ALLOTMENT', 'CALLS', 'PAID', 'ARREARS', 'FORFEITED', 'REISSUED']); });
});

// ───────── generated documentation: docs/STATE_MACHINES.md stays in step with the specs ─────────
const DOC = new URL('../../../docs/STATE_MACHINES.md', import.meta.url), BEGIN = '<!-- BEGIN GENERATED -->', END = '<!-- END GENERATED -->';
export function generate(): string {
  const parts: string[] = [];
  for (const { spec, where, kind } of MACHINES) {
    const s = spec as MachineSpec<string, string, unknown>;
    parts.push(`### \`${s.id}\` — ${kind === 'domain' ? 'domain' : 'UI'}\n\n${s.doc}\n\nImplemented in: \`${where}\`\n\n\`\`\`mermaid\n${toMermaid(s)}\n\`\`\`\n`);
    parts.push(`| State | Meaning | Events |\n|---|---|---|\n${Object.entries(s.states).map(([n, st]) => `| \`${n}\`${st.final ? ' (final)' : ''} | ${st.doc ?? ''} | ${targetsOf(st).map(t => `\`${t.event}\`→\`${t.to}\`${t.guarded ? ' ⚑' : ''}`).join(', ') || '—'} |`).join('\n')}\n`);
  }
  return parts.join('\n');
}
describe('docs/STATE_MACHINES.md', () => {
  it('is generated from the specs (run `UPDATE_DOCS=1 npx vitest run test/machines.test.ts` to refresh it)', () => {
    const file = readFileSync(DOC, 'utf8'), a = file.indexOf(BEGIN), b = file.indexOf(END);
    expect(a).toBeGreaterThan(-1); expect(b).toBeGreaterThan(a);
    const next = file.slice(0, a + BEGIN.length) + '\n\n' + generate() + '\n' + file.slice(b);
    if (process.env.UPDATE_DOCS === '1') writeFileSync(DOC, next);
    else expect(file, 'docs/STATE_MACHINES.md is out of date — run UPDATE_DOCS=1 npx vitest run test/machines.test.ts').toBe(next);
  });
});
