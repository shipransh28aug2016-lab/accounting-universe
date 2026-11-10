import { describe, expect, it } from 'vitest';
import { Machine, check, reachable, toMermaid, validateSpec, type MachineSpec } from '../src';

type S = 'OFF' | 'ON' | 'BROKEN'; type E = 'PRESS' | 'SMASH' | 'FIX';
interface Ctx { power: number }
const spec: MachineSpec<S, E, Ctx> = {
  id: 'lamp', doc: 'A lamp.', initial: 'OFF',
  states: {
    OFF: { doc: 'Off.', on: { PRESS: { to: 'ON', guard: c => c.power > 0, reason: c => `No power (${c.power}).` }, SMASH: 'BROKEN' } },
    ON: { doc: 'On.', on: { PRESS: 'OFF', SMASH: 'BROKEN' }, blocked: { FIX: 'It is not broken.' } },
    BROKEN: { doc: 'Broken.', on: { FIX: 'OFF' }, blocked: { PRESS: 'Fix it first.' } },
  },
};

describe('Machine', () => {
  it('moves along allowed transitions and records history', () => {
    const m = new Machine(spec, { power: 1 });
    expect(m.send('PRESS')).toEqual({ ok: true, from: 'OFF', to: 'ON' });
    expect(m.state).toBe('ON'); expect(m.history.at(-1)).toMatchObject({ event: 'PRESS', from: 'OFF', to: 'ON', ok: true });
  });
  it('ignores illegal events (never throws) and explains why', () => {
    const m = new Machine(spec, { power: 1 });
    const r = m.send('FIX');
    expect(r.ok).toBe(false); expect(m.state).toBe('OFF'); expect(r.reason).toMatch(/not available while off/i);
    m.send('SMASH'); expect(m.send('PRESS').reason).toBe('Fix it first.');
  });
  it('guards use the live context and give a dynamic reason', () => {
    const m = new Machine(spec, { power: 0 });
    expect(m.can('PRESS')).toBe(false); expect(m.why('PRESS')).toBe('No power (0).');
    m.ctx.power = 5; expect(m.can('PRESS')).toBe(true); expect(m.why('PRESS')).toBeNull();
  });
  it('notifies subscribers (also about rejected events) and can unsubscribe', () => {
    const m = new Machine(spec, { power: 1 }), seen: string[] = [];
    const off = m.subscribe((_m, r) => seen.push(`${r.ok ? 'ok' : 'no'}:${r.from}>${r.to}`));
    m.send('PRESS'); m.send('FIX'); off(); m.send('PRESS');
    expect(seen).toEqual(['ok:OFF>ON', 'no:ON>ON']);
  });
  it('keeps a bounded history', () => {
    const m = new Machine(spec, { power: 1 }, 5);
    for (let i = 0; i < 20; i++) m.send('PRESS');
    expect(m.history.length).toBe(5);
  });
  it('reset returns to the initial state', () => { const m = new Machine(spec, { power: 1 }); m.send('PRESS'); m.reset(); expect(m.state).toBe('OFF'); expect(m.history.length).toBe(0); });
  it('check() is pure: same inputs, same answer, no state change', () => {
    expect(check(spec, 'OFF', 'PRESS', { power: 1 })).toEqual({ ok: true, to: 'ON' });
    expect(check(spec, 'OFF', 'PRESS', { power: 1 })).toEqual({ ok: true, to: 'ON' });
  });
});

describe('static analysis', () => {
  it('a good spec has no problems and everything is reachable', () => { expect(validateSpec(spec)).toEqual([]); expect([...reachable(spec)].sort()).toEqual(['BROKEN', 'OFF', 'ON']); });
  it('finds unknown targets, unreachable states, dead ends, final states with exits and missing docs', () => {
    const bad = { id: 'bad', doc: 'x', initial: 'A', states: { A: { doc: 'a', on: { GO: 'NOPE' } }, B: { doc: 'b', final: true, on: { GO: 'A' } }, C: {}, D: { doc: 'd', on: { GO: 'A' } } } } as unknown as MachineSpec<string, string, undefined>;
    const p = validateSpec(bad).join(' | ');
    expect(p).toMatch(/unknown state "NOPE"/); expect(p).toMatch(/B: a final state must not have outgoing/); expect(p).toMatch(/C: dead end/); expect(p).toMatch(/C: state has no doc/); expect(p).toMatch(/D: unreachable/);
    expect(validateSpec({ ...bad, initial: 'Z' } as never).join()).toMatch(/initial state "Z" does not exist/);
  });
  it('draws a Mermaid diagram with guard markers', () => {
    const d = toMermaid(spec);
    expect(d.startsWith('stateDiagram-v2')).toBe(true); expect(d).toContain('[*] --> OFF'); expect(d).toContain('OFF --> ON: PRESS ⚑'); expect(d).toContain('BROKEN --> OFF: FIX');
  });
});

describe('property: random event sequences never reach an unknown state and never throw', () => {
  it('10,000 random events', () => {
    let seed = 12345; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
    const events: E[] = ['PRESS', 'SMASH', 'FIX'], m = new Machine(spec, { power: 1 });
    for (let i = 0; i < 10_000; i++) { m.ctx.power = rnd() < 0.5 ? 0 : 1; const before = m.state, r = m.send(events[Math.floor(rnd() * 3)]!); expect(['OFF', 'ON', 'BROKEN']).toContain(m.state); if (!r.ok) expect(m.state).toBe(before); }
  });
});

import { ENTRY_LIFECYCLE, Ledger, LedgerError, Money, starterChartClassXI } from '../src';
describe('journal-entry lifecycle (explicit machine behind Ledger.reverse)', () => {
  it('is a well-formed machine', () => { expect(validateSpec(ENTRY_LIFECYCLE)).toEqual([]); });
  it('status follows the lifecycle and the error texts are unchanged', () => {
    const l = new Ledger(starterChartClassXI());
    const e = l.post({ date: '2026-04-01', narration: 'x', lines: [{ accountId: 'cash', side: 'DR', amount: Money.parse('10') }, { accountId: 'capital', side: 'CR', amount: Money.parse('10') }] });
    expect(l.entryStatus(e.id)).toBe('POSTED'); expect(l.entryStatus('JE-999999')).toBeUndefined();
    const r = l.reverse(e.id, { date: '2026-04-02', reason: 'oops' });
    expect([l.entryStatus(e.id), l.entryStatus(r.id)]).toEqual(['REVERSED', 'REVERSAL']);
    expect(() => l.reverse(e.id, { date: '2026-04-02', reason: 'again' })).toThrow(`${e.id} was already reversed by ${r.id}`);
    expect(() => l.reverse(r.id, { date: '2026-04-02', reason: 'undo the undo' })).toThrow(`${r.id} is itself a reversal and cannot be reversed`);
    expect(() => l.reverse('JE-999999', { date: '2026-04-02', reason: 'x' })).toThrow(LedgerError);
  });
});
