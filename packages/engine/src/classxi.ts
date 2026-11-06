/**
 * Class XI calculators: bank reconciliation, rectification & suspense, incomplete records, petty cash, simple GST.
 */
import type { Illustration } from './company';
import { Money } from './money';

const R = 'HALF_UP' as const;
const L = (account: string, side: 'DR' | 'CR', amount: Money) => ({ account, side, amount });

// ───────────────────────────── Bank reconciliation ─────────────────────────────────────────────

/** Effect of each item on moving from the CASH BOOK balance to the PASS BOOK balance (+ adds, − deducts). */
export const BRS_ITEMS = {
  CHEQUE_ISSUED_NOT_PRESENTED: { sign: 1, label: 'Cheques issued but not yet presented for payment' },
  CHEQUE_DEPOSITED_NOT_COLLECTED: { sign: -1, label: 'Cheques deposited but not yet collected/credited' },
  BANK_CHARGES_NOT_IN_CASH_BOOK: { sign: -1, label: 'Bank charges debited by the bank, not yet in the cash book' },
  INTEREST_CREDITED_NOT_IN_CASH_BOOK: { sign: 1, label: 'Interest / dividend credited by the bank, not yet in the cash book' },
  DIRECT_DEPOSIT_BY_CUSTOMER: { sign: 1, label: 'Amount deposited directly by a customer, not yet in the cash book' },
  DIRECT_PAYMENT_BY_BANK: { sign: -1, label: 'Direct payment by the bank (standing instruction / insurance), not yet in the cash book' },
  CHEQUE_DISHONOURED: { sign: -1, label: 'Cheque deposited by us dishonoured, not yet in the cash book' },
  INTEREST_ON_OVERDRAFT_NOT_IN_CASH_BOOK: { sign: -1, label: 'Interest on overdraft debited by the bank, not yet in the cash book' },
} as const;
export type BrsKind = keyof typeof BRS_ITEMS;
export interface BrsItem { readonly kind: BrsKind; readonly amount: Money; readonly note?: string; }

export interface BrsResult {
  readonly start: Money; readonly end: Money;
  readonly rows: readonly { kind: BrsKind; label: string; amount: Money; effect: 'ADD' | 'LESS' }[];
  readonly startFrom: 'CASH_BOOK' | 'PASS_BOOK';
}

/**
 * Reconcile. Balances are SIGNED: a favourable balance is positive, an OVERDRAFT is negative. The same arithmetic
 * therefore covers both (an item that "adds" to a favourable balance reduces an overdraft), which is the part students
 * most often get wrong when the words Add/Less are applied mechanically.
 */
export function reconcile(startBalance: Money, startFrom: 'CASH_BOOK' | 'PASS_BOOK', items: readonly BrsItem[]): BrsResult {
  let end = startBalance;
  const rows = items.map(i => {
    if (!i.amount.isPositive()) throw new RangeError('BRS item amounts must be positive');
    const s = BRS_ITEMS[i.kind].sign * (startFrom === 'CASH_BOOK' ? 1 : -1);
    end = s > 0 ? end.add(i.amount) : end.sub(i.amount);
    return { kind: i.kind, label: BRS_ITEMS[i.kind].label, amount: i.amount, effect: (s > 0 ? 'ADD' : 'LESS') as 'ADD' | 'LESS' };
  });
  return { start: startBalance, end, rows, startFrom };
}

// ───────────────────────────── Rectification & suspense ────────────────────────────────────────

export interface RectLine { readonly account: string; readonly side: 'DR' | 'CR'; readonly amount: Money; }
export interface Rectification { readonly lines: readonly RectLine[]; readonly usesSuspense: boolean; readonly suspenseSide?: 'DR' | 'CR'; readonly entry: Illustration; }

/**
 * Rectifying entry = (what SHOULD have been posted) − (what WAS posted), account by account.
 * If the mistake was one-sided (an amount posted to one side only), the books were out and the difference sits in a
 * Suspense A/c: the rectification clears it. Two-sided errors never touch Suspense and do not affect the trial balance.
 */
export function rectify(wrong: readonly RectLine[], right: readonly RectLine[]): Rectification {
  const net = new Map<string, bigint>();
  const add = (l: RectLine, k: 1n | -1n) => net.set(l.account, (net.get(l.account) ?? 0n) + k * (l.side === 'DR' ? l.amount.paise : -l.amount.paise));
  right.forEach(l => add(l, 1n)); wrong.forEach(l => add(l, -1n));
  const lines: RectLine[] = [];
  for (const [account, v] of net) { if (v > 0n) lines.push({ account, side: 'DR', amount: Money.fromPaise(v) }); else if (v < 0n) lines.push({ account, side: 'CR', amount: Money.fromPaise(-v) }); }
  const dr = lines.filter(l => l.side === 'DR').reduce((a, l) => a + l.amount.paise, 0n), cr = lines.filter(l => l.side === 'CR').reduce((a, l) => a + l.amount.paise, 0n);
  let suspenseSide: 'DR' | 'CR' | undefined;
  if (dr !== cr) {
    suspenseSide = dr > cr ? 'CR' : 'DR';
    lines.push({ account: 'Suspense A/c', side: suspenseSide, amount: Money.fromPaise(dr > cr ? dr - cr : cr - dr) });
  }
  return { lines, usesSuspense: suspenseSide !== undefined, ...(suspenseSide ? { suspenseSide } : {}), entry: { narration: 'Rectification of error', lines: lines.map(l => L(l.account, l.side, l.amount)) } };
}

/** Trial balance that does not agree: the difference goes to a Suspense A/c on the SHORT side. */
export function suspenseFromTrialBalance(totalDebit: Money, totalCredit: Money): { amount: Money; side: 'DR' | 'CR' } | null {
  const d = totalDebit.sub(totalCredit);
  if (d.isZero()) return null;
  return d.isNegative() ? { amount: d.neg(), side: 'DR' } : { amount: d, side: 'CR' };
}

export type ErrorClass = 'OMISSION_COMPLETE' | 'OMISSION_PARTIAL' | 'COMMISSION' | 'PRINCIPLE' | 'COMPENSATING' | 'WRONG_AMOUNT_ONE_SIDE';
/** Does the error disturb the trial balance? (syllabus: "their effect on trial balance") */
export const AFFECTS_TRIAL_BALANCE: Record<ErrorClass, boolean> = {
  OMISSION_COMPLETE: false, OMISSION_PARTIAL: true, COMMISSION: false, PRINCIPLE: false, COMPENSATING: false, WRONG_AMOUNT_ONE_SIDE: true,
};

// ───────────────────────────── Incomplete records (Statement of Affairs method) ────────────────

/**
 * Profit/loss by the Statement of Affairs method (the conversion method is excluded by the syllabus):
 *   closing capital − opening capital = profit − drawings + fresh capital  ⇒  profit = Δcapital + drawings − fresh capital.
 */
export function statementOfAffairs(o: { assets: readonly Money[]; liabilities: readonly Money[] }): Money {
  return Money.sum(o.assets).sub(Money.sum(o.liabilities));
}
export function profitByStatementOfAffairs(o: { openingCapital: Money; closingCapital: Money; drawings: Money; additionalCapital?: Money }): Money {
  return o.closingCapital.sub(o.openingCapital).add(o.drawings).sub(o.additionalCapital ?? Money.ZERO);
}

// ───────────────────────────── Petty cash (imprest system) ─────────────────────────────────────

export interface PettyCashResult {
  readonly totalSpent: Money; readonly byHead: Readonly<Record<string, Money>>;
  readonly closingBalance: Money; readonly reimbursement: Money; readonly restoredTo: Money;
}
/** Analytical petty cash book under the imprest system: the cashier is reimbursed exactly what was spent. */
export function pettyCash(o: { imprest: Money; openingBalance?: Money; payments: readonly { head: string; amount: Money }[] }): PettyCashResult {
  const byHead: Record<string, Money> = {};
  for (const p of o.payments) { if (!p.amount.isPositive()) throw new RangeError('Petty cash payments must be positive'); byHead[p.head] = (byHead[p.head] ?? Money.ZERO).add(p.amount); }
  const spent = Money.sum(o.payments.map(p => p.amount));
  const opening = o.openingBalance ?? o.imprest;
  if (spent.cmp(opening) > 0) throw new RangeError('Petty cash payments exceed the cash in hand');
  const closing = opening.sub(spent);
  return { totalSpent: spent, byHead, closingBalance: closing, reimbursement: o.imprest.sub(closing), restoredTo: o.imprest };
}

// ───────────────────────────── Simple GST (Class XI) ───────────────────────────────────────────

export interface Invoice {
  readonly listPrice: Money; readonly tradeDiscount: Money; readonly freight: Money; readonly taxable: Money;
  readonly cgst: Money; readonly sgst: Money; readonly igst: Money; readonly totalTax: Money; readonly total: Money;
}
/**
 * "Simple GST calculation" (Class XI): trade discount is deducted from the list price, freight/cartage billed is added,
 * and GST is charged on that taxable value. Intra-state ⇒ CGST + SGST (half each); inter-state ⇒ IGST. Trade discount is never recorded.
 */
export function invoice(o: { listPrice: Money; tradeDiscountPercent?: bigint; freight?: Money; gstPercent: bigint; interState?: boolean }): Invoice {
  const td = o.listPrice.mulRatio(o.tradeDiscountPercent ?? 0n, 100n, R);
  const freight = o.freight ?? Money.ZERO;
  const taxable = o.listPrice.sub(td).add(freight);
  const tax = taxable.mulRatio(o.gstPercent, 100n, R);
  let cgst = Money.ZERO, sgst = Money.ZERO, igst = Money.ZERO;
  if (o.interState) igst = tax; else { cgst = tax.mulRatio(1n, 2n, 'DOWN'); sgst = tax.sub(cgst); }
  return { listPrice: o.listPrice, tradeDiscount: td, freight, taxable, cgst, sgst, igst, totalTax: tax, total: taxable.add(tax) };
}
/** Journal in the books of the BUYER (input tax) or SELLER (output tax) for a credit transaction. */
export function invoiceEntry(i: Invoice, role: 'BUYER' | 'SELLER', party = 'Party'): Illustration {
  const lines = role === 'BUYER'
    ? [L('Purchases A/c', 'DR', i.taxable), L('Input CGST A/c', 'DR', i.cgst), L('Input SGST A/c', 'DR', i.sgst), L('Input IGST A/c', 'DR', i.igst), L(`${party} (Creditor) A/c`, 'CR', i.total)]
    : [L(`${party} (Debtor) A/c`, 'DR', i.total), L('Sales A/c', 'CR', i.taxable), L('Output CGST A/c', 'CR', i.cgst), L('Output SGST A/c', 'CR', i.sgst), L('Output IGST A/c', 'CR', i.igst)];
  return { narration: role === 'BUYER' ? 'Goods purchased on credit (GST)' : 'Goods sold on credit (GST)', lines: lines.filter(l => !l.amount.isZero()) };
}
