/**
 * A tiny, dependency-free finite-state-machine kit.
 *
 * WHY: the app's behaviour is full of small state machines (a question being answered, a voucher awaiting
 * verification, a year being closed, an animation playing). Written as booleans they hide impossible states and
 * duplicate their rules. Written as DATA with this kit they can be: tested (validateSpec), drawn (toMermaid), shown to
 * users ("why is this unavailable?") and read by tools (`data-state`).
 *
 * DESIGN RULES
 *  - A spec is plain data; guards are pure functions of the machine's context.
 *  - Illegal events are IGNORED and reported (`send` returns ok:false + a human reason); they never throw, so a
 *    double-click or a stale button can never crash the UI.
 *  - Side effects stay outside: callers react to the result / subscribe to changes.
 */
export type Reason<C> = string | ((ctx: C) => string);

export interface Transition<S extends string, C> {
  readonly to: S;
  /** Must return true for the transition to be available. */
  readonly guard?: (ctx: C) => boolean;
  /** Shown to the user when the guard is false (explains WHY the action is unavailable). */
  readonly reason?: Reason<C>;
}
export interface StateSpec<S extends string, E extends string, C> {
  readonly doc?: string;
  /** A final state has no outgoing transitions by design. */
  readonly final?: boolean;
  /** Event → target state, or a guarded transition. Events not listed are not allowed in this state. */
  readonly on?: { readonly [K in E]?: S | Transition<S, C> };
  /** Per-event explanation when the event is NOT allowed in this state at all (e.g. "Already checked — go to the next question"). */
  readonly blocked?: { readonly [K in E]?: Reason<C> };
}
export interface MachineSpec<S extends string, E extends string, C = undefined> {
  readonly id: string;
  readonly doc: string;
  readonly initial: S;
  readonly states: { readonly [K in S]: StateSpec<S, E, C> };
}

const norm = <S extends string, C>(t: S | Transition<S, C>): Transition<S, C> => (typeof t === 'string' ? { to: t } : t);
const text = <C>(r: Reason<C> | undefined, ctx: C, fallback: string) => (r === undefined ? fallback : typeof r === 'function' ? r(ctx) : r);

export interface Availability { readonly ok: boolean; readonly to?: string; readonly reason?: string }

/** Pure: can `event` fire from `state`, and if not, why not? */
export function check<S extends string, E extends string, C>(spec: MachineSpec<S, E, C>, state: S, event: E, ctx: C): Availability {
  const st = spec.states[state];
  const raw = st.on?.[event];
  if (raw === undefined) return { ok: false, reason: text(st.blocked?.[event], ctx, `“${event}” is not available while ${state.toLowerCase().replace(/_/g, ' ')}.`) };
  const t = norm<S, C>(raw as S | Transition<S, C>);
  if (t.guard && !t.guard(ctx)) return { ok: false, reason: text(t.reason, ctx, `“${event}” is not allowed right now.`) };
  return { ok: true, to: t.to };
}

export interface HistoryItem<S extends string, E extends string> { readonly event: E; readonly from: S; readonly to: S; readonly ok: boolean; readonly reason?: string }
export interface SendResult<S extends string> { readonly ok: boolean; readonly from: S; readonly to: S; readonly reason?: string }

/** Interpreter. Holds the current state and the (mutable, caller-owned) context. */
export class Machine<S extends string, E extends string, C = undefined> {
  private cur: S;
  private readonly subs = new Set<(m: Machine<S, E, C>, r: SendResult<S>) => void>();
  private readonly log: HistoryItem<S, E>[] = [];
  constructor(readonly spec: MachineSpec<S, E, C>, public ctx: C = undefined as C, private readonly keep = 40) { this.cur = spec.initial; }

  get state(): S { return this.cur; }
  get id(): string { return this.spec.id; }
  get history(): readonly HistoryItem<S, E>[] { return this.log; }
  is(...s: S[]): boolean { return s.includes(this.cur); }
  isFinal(): boolean { return !!this.spec.states[this.cur].final; }
  can(event: E): boolean { return check(this.spec, this.cur, event, this.ctx).ok; }
  /** null when the event is available, otherwise a human-readable reason. */
  why(event: E): string | null { const a = check(this.spec, this.cur, event, this.ctx); return a.ok ? null : (a.reason ?? 'Not available right now.'); }
  subscribe(fn: (m: Machine<S, E, C>, r: SendResult<S>) => void): () => void { this.subs.add(fn); return () => this.subs.delete(fn); }

  send(event: E): SendResult<S> {
    const from = this.cur, a = check(this.spec, from, event, this.ctx);
    const res: SendResult<S> = a.ok ? { ok: true, from, to: a.to as S } : { ok: false, from, to: from, ...(a.reason !== undefined ? { reason: a.reason } : {}) };
    if (a.ok) this.cur = a.to as S;
    this.log.push({ event, from, to: res.to, ok: res.ok, ...(res.reason !== undefined ? { reason: res.reason } : {}) });
    if (this.log.length > this.keep) this.log.shift();
    for (const s of [...this.subs]) s(this, res);
    return res;
  }
  /** Back to the initial state (new context optional). Not an event: it is for tests and for re-using an instance. */
  reset(ctx?: C): void { this.cur = this.spec.initial; if (ctx !== undefined) this.ctx = ctx; this.log.length = 0; }
}

// ───────────────────────── static analysis (used by tests, never at runtime) ─────────────────────────
export function targetsOf<S extends string, E extends string, C>(st: StateSpec<S, E, C>): { event: string; to: S; guarded: boolean }[] {
  return Object.entries(st.on ?? {}).map(([event, raw]) => { const t = norm<S, C>(raw as S | Transition<S, C>); return { event, to: t.to, guarded: !!t.guard }; });
}
export function reachable<S extends string, E extends string, C>(spec: MachineSpec<S, E, C>): Set<S> {
  const seen = new Set<S>([spec.initial]), todo: S[] = [spec.initial];
  while (todo.length) {
    const st = spec.states[todo.pop()!];
    if (!st) continue;                                                    // an unknown target is reported by validateSpec, not a crash here
    for (const t of targetsOf(st)) if (!seen.has(t.to)) { seen.add(t.to); todo.push(t.to); }
  }
  return seen;
}
/** Returns a list of problems; an empty list means the spec is well-formed. */
export function validateSpec<S extends string, E extends string, C>(spec: MachineSpec<S, E, C>): string[] {
  const p: string[] = [], names = Object.keys(spec.states) as S[];
  if (!spec.id.trim()) p.push('machine has no id'); if (!spec.doc.trim()) p.push(`${spec.id}: machine has no doc`);
  if (!(spec.initial in spec.states)) p.push(`${spec.id}: initial state "${spec.initial}" does not exist`);
  for (const n of names) {
    const st = spec.states[n];
    for (const t of targetsOf(st)) if (!(t.to in spec.states)) p.push(`${spec.id}.${n}: "${t.event}" goes to unknown state "${t.to}"`);
    if (st.final && targetsOf(st).length) p.push(`${spec.id}.${n}: a final state must not have outgoing transitions`);
    if (!st.final && targetsOf(st).length === 0) p.push(`${spec.id}.${n}: dead end — not final but nothing can happen`);
    if (!st.doc?.trim()) p.push(`${spec.id}.${n}: state has no doc`);
  }
  const r = reachable(spec); for (const n of names) if (!r.has(n)) p.push(`${spec.id}.${n}: unreachable from "${spec.initial}"`);
  return p;
}
/** Mermaid stateDiagram-v2 source (renders on GitHub). Guarded transitions are marked with "⚑". */
export function toMermaid<S extends string, E extends string, C>(spec: MachineSpec<S, E, C>): string {
  const names = Object.keys(spec.states) as S[], out = ['stateDiagram-v2', `  [*] --> ${spec.initial}`];
  for (const n of names) for (const t of targetsOf(spec.states[n])) out.push(`  ${n} --> ${t.to}: ${t.event}${t.guarded ? ' ⚑' : ''}`);
  for (const n of names) if (spec.states[n].final) out.push(`  ${n} --> [*]`);
  return out.join('\n');
}
