/**
 * DOM glue for state machines (the machines themselves are pure data: packages/curriculum/src/machines.ts).
 *  - stamp/track : write `data-machine` + `data-state` on an element so humans (devtools), tests and AI agents can read the state
 *  - registry    : `window.__AU__.machines()` lists every live machine with its state and last transitions (state names only — no student data)
 *  - onDispose   : cleanup that runs when the student leaves the page (stops timers, ignores late async results)
 */
/** What the DOM glue needs from a machine (any `Machine<S, E, C>` satisfies it). */
export interface Inspectable {
  readonly id: string; readonly state: string;
  readonly history: readonly { readonly event: string; readonly from: string; readonly to: string; readonly ok: boolean }[];
  subscribe(fn: () => void): () => void;
}
type AnyMachine = Inspectable;
const live = new Set<AnyMachine>();
declare global { interface Window { __AU__?: { machines: () => { id: string; state: string; history: { event: string; from: string; to: string; ok: boolean }[] }[] } } }
export function register(m: AnyMachine): void {
  live.add(m);
  if (typeof window !== 'undefined') window.__AU__ = { machines: () => [...live].map(x => ({ id: x.id, state: x.state, history: x.history.slice(-8).map(h => ({ event: h.event, from: h.from, to: h.to, ok: h.ok })) })) };
}
export function unregister(m: AnyMachine): void { live.delete(m); }

/** Write the machine's current state onto an element (call again after a redraw). */
export function stamp(el: Element, m: AnyMachine): void { el.setAttribute('data-machine', m.id); el.setAttribute('data-state', m.state); }
/** Keep an element's attributes in step with the machine for as long as it lives. Returns the unsubscribe function. */
export function track(el: Element, m: AnyMachine): () => void { register(m); stamp(el, m); return m.subscribe(() => stamp(el, m)); }

// ───────── page lifecycle ─────────
const disposers: (() => void)[] = [];
/** Register cleanup for the page being built; it runs when the router leaves the page. */
export function onDispose(fn: () => void): void { disposers.push(fn); }
export function runDisposers(): void { for (const fn of disposers.splice(0)) { try { fn(); } catch { /* cleanup must never block navigation */ } } }

/** Mark a button that is unavailable RIGHT NOW without disabling it: it stays clickable so the click can explain why (disabled buttons cannot). */
export function setAvailability(btn: HTMLElement, reason: string | null): void {
  if (reason === null) { btn.classList.remove('unavailable'); btn.removeAttribute('title'); btn.removeAttribute('data-why'); }
  else { btn.classList.add('unavailable'); btn.setAttribute('title', reason); btn.setAttribute('data-why', reason); }
}
