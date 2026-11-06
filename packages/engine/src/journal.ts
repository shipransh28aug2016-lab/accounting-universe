import type { ChartOfAccounts, Side } from './accounts';
import { Money } from './money';

export interface DraftLine {
  readonly accountId: string;
  readonly side: Side;
  readonly amount: Money;
}

export interface DraftEntry {
  /** ISO calendar date, YYYY-MM-DD. */
  readonly date: string;
  readonly narration: string;
  readonly lines: readonly DraftLine[];
}

export interface PostedLine extends DraftLine {}

export interface PostedEntry {
  /** Unique, sequential, e.g. "JE-000007". */
  readonly id: string;
  readonly seq: number;
  readonly date: string;
  readonly narration: string;
  readonly lines: readonly PostedLine[];
  /** Set only on a reversing entry: the id of the entry it cancels. */
  readonly reversalOf?: string;
}

export type IssueCode =
  | 'NO_DEBIT' | 'NO_CREDIT' | 'NON_POSITIVE_AMOUNT' | 'UNKNOWN_ACCOUNT'
  | 'UNBALANCED' | 'ACCOUNT_ON_BOTH_SIDES' | 'BAD_DATE' | 'EMPTY_NARRATION' | 'BAD_SIDE';

export interface ValidationIssue {
  readonly code: IssueCode;
  readonly message: string;
}

export class EntryValidationError extends Error {
  constructor(readonly issues: readonly ValidationIssue[]) {
    super(issues.map(i => i.message).join(' | '));
    this.name = 'EntryValidationError';
  }
}

/** True only for real calendar dates in YYYY-MM-DD form (rejects 2026-02-30). */
export function isValidIsoDate(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

/**
 * Validate a draft. Returns EVERY problem (not just the first) so the UI can explain them all.
 * The fundamental rule: total debit = total credit, exactly.
 */
export function validateEntry(entry: DraftEntry, chart: ChartOfAccounts): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isValidIsoDate(entry.date)) issues.push({ code: 'BAD_DATE', message: `"${entry.date}" is not a valid date (use YYYY-MM-DD)` });
  if (!entry.narration.trim()) issues.push({ code: 'EMPTY_NARRATION', message: 'A journal entry needs a narration' });

  let dr = Money.ZERO, cr = Money.ZERO, nDr = 0, nCr = 0;
  const drAccts = new Set<string>(), crAccts = new Set<string>();

  for (const l of entry.lines) {
    if (l.side !== 'DR' && l.side !== 'CR') { issues.push({ code: 'BAD_SIDE', message: `Line for "${l.accountId}" has an invalid side` }); continue; }
    if (!chart.has(l.accountId)) issues.push({ code: 'UNKNOWN_ACCOUNT', message: `Unknown account "${l.accountId}"` });
    if (!l.amount.isPositive()) issues.push({ code: 'NON_POSITIVE_AMOUNT', message: `Amount for "${l.accountId}" must be greater than zero (got ${l.amount.toString()})` });
    if (l.side === 'DR') { dr = dr.add(l.amount); nDr++; drAccts.add(l.accountId); }
    else { cr = cr.add(l.amount); nCr++; crAccts.add(l.accountId); }
  }

  if (nDr === 0) issues.push({ code: 'NO_DEBIT', message: 'At least one debit line is required' });
  if (nCr === 0) issues.push({ code: 'NO_CREDIT', message: 'At least one credit line is required' });
  for (const a of drAccts) if (crAccts.has(a)) issues.push({ code: 'ACCOUNT_ON_BOTH_SIDES', message: `"${a}" appears on both the debit and the credit side` });
  if (nDr > 0 && nCr > 0 && !dr.equals(cr)) {
    issues.push({ code: 'UNBALANCED', message: `Dual aspect broken: total debit ${dr.format()} ≠ total credit ${cr.format()} (difference ${dr.sub(cr).abs().format()})` });
  }
  return issues;
}
