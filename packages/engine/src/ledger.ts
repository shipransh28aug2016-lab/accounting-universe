import { type Account, type ChartOfAccounts, type Side, normalSide } from './accounts';
import { type DraftEntry, EntryValidationError, type PostedEntry, validateEntry } from './journal';
import { Money } from './money';
import { check, type MachineSpec } from './machine';

export class LedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LedgerError';
  }
}


// ───────────────────────── entry lifecycle (explicit state machine) ─────────────────────────
export type EntryStatus = 'POSTED' | 'REVERSED' | 'REVERSAL';
export type EntryLifecycleState = 'NEW' | EntryStatus;
export type EntryLifecycleEvent = 'POST' | 'POST_AS_REVERSAL' | 'REVERSE';
export interface EntryLifecycleContext { readonly id: string; readonly reversedBy?: string }
/**
 * The life of one journal entry. A posted entry is frozen; the ONLY thing that can happen to it is a single linked reversal.
 * A reversal entry is itself final — you cannot reverse a reversal (post a new entry instead). Error texts are user-facing.
 */
export const ENTRY_LIFECYCLE: MachineSpec<EntryLifecycleState, EntryLifecycleEvent, EntryLifecycleContext> = {
  id: 'journal-entry', doc: 'One journal entry in the ledger: posted once, optionally reversed once, never edited or deleted.', initial: 'NEW',
  states: {
    NEW: { doc: 'Being created inside Ledger.post / Ledger.reverse.', on: { POST: 'POSTED', POST_AS_REVERSAL: 'REVERSAL' } },
    POSTED: { doc: 'Frozen in the journal. Counts in every balance.', on: { REVERSE: 'REVERSED' } },
    REVERSED: { doc: 'Cancelled by a linked reversal entry. Stays in the journal for the audit trail.', final: true, blocked: { REVERSE: c => `${c.id} was already reversed by ${c.reversedBy ?? 'another entry'}` } },
    REVERSAL: { doc: 'An entry that cancels another entry. Final: a reversal cannot itself be reversed.', final: true, blocked: { REVERSE: c => `${c.id} is itself a reversal and cannot be reversed` } },
  },
};

export interface AuditEvent {
  readonly seq: number;
  readonly type: 'POST' | 'REVERSE';
  readonly entryId: string;
  /** For REVERSE: the entry that was cancelled and why. */
  readonly target?: string;
  readonly reason?: string;
}

export interface TrialBalanceRow {
  readonly account: Account;
  /** Exactly one of these is non-zero (balance method). */
  readonly debit: Money;
  readonly credit: Money;
}

export interface TrialBalance {
  readonly rows: readonly TrialBalanceRow[];
  readonly totalDebit: Money;
  readonly totalCredit: Money;
  readonly balanced: boolean;
}

export interface EquationSnapshot {
  readonly assets: Money;
  readonly liabilities: Money;
  /** Capital − Drawings + Revenue − Expenses (profit/loss carried into capital). */
  readonly capital: Money;
  readonly balanced: boolean;
}

export interface TAccountRow {
  readonly entryId: string;
  readonly date: string;
  readonly narration: string;
  readonly side: Side;
  readonly amount: Money;
  /** Running balance on the account's NORMAL side (negative = it has flipped to the other side). */
  readonly running: Money;
}

/**
 * The ledger owns the journal. Posted entries are frozen and can never be edited or deleted; a
 * mistake is corrected by posting a linked, equal-and-opposite REVERSAL (so history is preserved).
 * Everything — balances, trial balance, equation, T-accounts — is derived from the journal, so there
 * is no second copy of state that can drift.
 */
export class Ledger {
  private readonly journal: PostedEntry[] = [];
  private readonly trail: AuditEvent[] = [];
  private readonly reversed = new Map<string, string>();     // original id -> reversing entry id

  constructor(readonly chart: ChartOfAccounts) {}

  // ---- posting --------------------------------------------------------------------------------

  post(draft: DraftEntry): PostedEntry {
    const issues = validateEntry(draft, this.chart);
    if (issues.length) throw new EntryValidationError(issues);
    return this.append(draft.date, draft.narration.trim(), draft.lines.map(l => ({ ...l })), undefined, { type: 'POST' });
  }

  /** Cancel an entry with a linked opposite entry. An entry can be reversed once; reversals cannot be reversed. */
  reverse(entryId: string, opts: { date: string; reason: string }): PostedEntry {
    const original = this.journal.find(e => e.id === entryId);
    if (!original) throw new LedgerError(`No such entry "${entryId}"`);
    const ctx: EntryLifecycleContext = { id: entryId, ...(this.reversed.has(entryId) ? { reversedBy: this.reversed.get(entryId)! } : {}) };
    const verdict = check(ENTRY_LIFECYCLE, this.entryStatus(entryId)!, 'REVERSE', ctx);
    if (!verdict.ok) throw new LedgerError(verdict.reason!);
    if (!opts.reason.trim()) throw new LedgerError('A reversal needs a reason');

    const lines = original.lines.map(l => ({ accountId: l.accountId, side: (l.side === 'DR' ? 'CR' : 'DR') as Side, amount: l.amount }));
    const draft: DraftEntry = { date: opts.date, narration: `Reversal of ${entryId}: ${opts.reason.trim()}`, lines };
    const issues = validateEntry(draft, this.chart);
    if (issues.length) throw new EntryValidationError(issues);
    const posted = this.append(draft.date, draft.narration, lines, entryId, { type: 'REVERSE', target: entryId, reason: opts.reason.trim() });
    this.reversed.set(entryId, posted.id);
    return posted;
  }

  private append(
    date: string, narration: string, lines: { accountId: string; side: Side; amount: Money }[],
    reversalOf: string | undefined, ev: { type: 'POST' | 'REVERSE'; target?: string; reason?: string },
  ): PostedEntry {
    const seq = this.journal.length + 1;
    const id = `JE-${String(seq).padStart(6, '0')}`;
    const frozenLines = Object.freeze(lines.map(l => Object.freeze({ accountId: l.accountId, side: l.side, amount: l.amount })));
    const entry: PostedEntry = Object.freeze(
      reversalOf === undefined ? { id, seq, date, narration, lines: frozenLines } : { id, seq, date, narration, lines: frozenLines, reversalOf },
    );
    this.journal.push(entry);
    this.trail.push(Object.freeze({ seq: this.trail.length + 1, type: ev.type, entryId: id, ...(ev.target ? { target: ev.target } : {}), ...(ev.reason ? { reason: ev.reason } : {}) }));
    return entry;
  }

  // ---- reading --------------------------------------------------------------------------------

  entries(): readonly PostedEntry[] { return this.journal; }
  auditTrail(): readonly AuditEvent[] { return this.trail; }
  isReversed(entryId: string): boolean { return this.reversed.has(entryId); }
  /** Where an entry is in its lifecycle (undefined if there is no such entry). */
  entryStatus(entryId: string): EntryStatus | undefined {
    const e = this.journal.find(x => x.id === entryId);
    return !e ? undefined : e.reversalOf ? 'REVERSAL' : this.reversed.has(entryId) ? 'REVERSED' : 'POSTED';
  }

  /** Net debit position in paise: Σ debits − Σ credits (positive = net debit). */
  private net(accountId: string): bigint {
    this.chart.get(accountId);
    let n = 0n;
    for (const e of this.journal) for (const l of e.lines) if (l.accountId === accountId) n += l.side === 'DR' ? l.amount.paise : -l.amount.paise;
    return n;
  }

  /** Balance on the account's NORMAL side. Negative means the balance has flipped to the opposite side. */
  balance(accountId: string): Money {
    const acct = this.chart.get(accountId);
    const n = this.net(accountId);
    return Money.fromPaise(normalSide(acct.type) === 'DR' ? n : -n);
  }

  /** Trial balance by the balance method (each account shown once, on the side of its closing balance). */
  trialBalance(): TrialBalance {
    const rows: TrialBalanceRow[] = [];
    for (const account of this.chart.list()) {
      const n = this.net(account.id);
      if (n === 0n) continue;
      rows.push({ account, debit: n > 0n ? Money.fromPaise(n) : Money.ZERO, credit: n < 0n ? Money.fromPaise(-n) : Money.ZERO });
    }
    const totalDebit = Money.sum(rows.map(r => r.debit));
    const totalCredit = Money.sum(rows.map(r => r.credit));
    return { rows, totalDebit, totalCredit, balanced: totalDebit.equals(totalCredit) };
  }

  /** A = L + C, with profit/loss and drawings carried into capital. Derived purely from the journal. */
  equation(): EquationSnapshot {
    let assets = 0n, liabilities = 0n, capital = 0n;
    for (const a of this.chart.list()) {
      const bal = this.balance(a.id).paise;
      switch (a.type) {
        case 'ASSET': assets += bal; break;
        case 'LIABILITY': liabilities += bal; break;
        case 'CAPITAL': case 'REVENUE': capital += bal; break;
        case 'EXPENSE': case 'DRAWINGS': capital -= bal; break;
      }
    }
    const A = Money.fromPaise(assets), L = Money.fromPaise(liabilities), C = Money.fromPaise(capital);
    return { assets: A, liabilities: L, capital: C, balanced: A.equals(L.add(C)) };
  }

  /** Rows of an account's T-account / ledger page, in journal order, with a running balance. */
  tAccount(accountId: string): readonly TAccountRow[] {
    const acct = this.chart.get(accountId);
    const nat = normalSide(acct.type);
    const rows: TAccountRow[] = [];
    let running = 0n;
    for (const e of this.journal) for (const l of e.lines) {
      if (l.accountId !== accountId) continue;
      running += l.side === nat ? l.amount.paise : -l.amount.paise;
      rows.push({ entryId: e.id, date: e.date, narration: e.narration, side: l.side, amount: l.amount, running: Money.fromPaise(running) });
    }
    return rows;
  }
}
