/**
 * Remaining syllabus calculators: calls in advance, cash book (cash + bank columns), subsidiary books with simple GST,
 * provision for doubtful debts / discount, opening entry, loan schedule (computerised-accounting spreadsheet topic),
 * Schedule III totals, fixed vs fluctuating capital, revaluation, and the Partnership Act 1932 default provisions.
 * Exact Money / Fraction throughout; every rounding has an explicit mode.
 */
import { Fraction, allocate } from './fraction';
import { Money, divRound, type RoundingMode } from './money';
import type { Illustration, EntryLine } from './company';
import { invoice, type Invoice } from './classxi';

const R: RoundingMode = 'HALF_UP';
const L = (account: string, side: 'DR' | 'CR', amount: Money): EntryLine => ({ account, side, amount });
const nz = (...l: EntryLine[]) => l.filter(x => !x.amount.isZero());
export class ExtrasError extends Error { constructor(m: string) { super(m); this.name = 'ExtrasError'; } }

// ───────────────────────────── calls in advance (no interest — syllabus limit) ─────────────────────────────
export function callsInAdvance(o: { shares: bigint; advancePerShare: Money; callName?: string }): { received: Money; entries: Illustration[] } {
  if (o.shares <= 0n) throw new ExtrasError('Shares must be more than zero');
  if (!o.advancePerShare.isPositive()) throw new ExtrasError('Advance per share must be more than zero');
  const received = o.advancePerShare.mulRatio(o.shares, 1n, R);
  const call = o.callName ?? 'Final Call';
  return { received, entries: [
    { narration: `Call money received in advance on ${o.shares} shares`, lines: [L('Bank A/c', 'DR', received), L('Calls in Advance A/c', 'CR', received)] },
    { narration: `Calls in advance adjusted when the ${call} falls due`, lines: [L('Calls in Advance A/c', 'DR', received), L(`Share ${call} A/c`, 'CR', received)] },
  ] };
}

// ───────────────────────────── cash book with bank column ─────────────────────────────
export type CashBookKind = 'RECEIPT_CASH' | 'RECEIPT_BANK' | 'PAYMENT_CASH' | 'PAYMENT_BANK' | 'DEPOSIT' | 'WITHDRAWAL';
export interface CashBookTxn { readonly particulars: string; readonly kind: CashBookKind; readonly amount: Money; readonly date?: string; }
export interface CashBookRow { readonly txn: CashBookTxn; readonly cashDr: Money; readonly bankDr: Money; readonly cashCr: Money; readonly bankCr: Money; readonly contra: boolean; readonly cashBalance: Money; readonly bankBalance: Money; }
export interface CashBook { readonly rows: readonly CashBookRow[]; readonly closingCash: Money; readonly closingBank: Money; readonly overdraft: boolean; readonly totalCashDr: Money; readonly totalCashCr: Money; readonly totalBankDr: Money; readonly totalBankCr: Money; }

/** Cash can never be negative (you cannot pay out cash you do not have); the bank balance can be (an overdraft). */
export function cashBook(opening: { cash: Money; bank: Money }, txns: readonly CashBookTxn[]): CashBook {
  if (opening.cash.isNegative()) throw new ExtrasError('Opening cash cannot be negative');
  let cash = opening.cash, bank = opening.bank;
  const rows: CashBookRow[] = [];
  txns.forEach((t, i) => {
    if (!t.amount.isPositive()) throw new ExtrasError(`Line ${i + 1} ("${t.particulars}"): the amount must be more than zero`);
    const z = Money.ZERO; let cashDr = z, bankDr = z, cashCr = z, bankCr = z, contra = false;
    switch (t.kind) {
      case 'RECEIPT_CASH': cashDr = t.amount; cash = cash.add(t.amount); break;
      case 'RECEIPT_BANK': bankDr = t.amount; bank = bank.add(t.amount); break;
      case 'PAYMENT_CASH': cashCr = t.amount; cash = cash.sub(t.amount); break;
      case 'PAYMENT_BANK': bankCr = t.amount; bank = bank.sub(t.amount); break;
      case 'DEPOSIT': cashCr = t.amount; bankDr = t.amount; cash = cash.sub(t.amount); bank = bank.add(t.amount); contra = true; break;
      case 'WITHDRAWAL': bankCr = t.amount; cashDr = t.amount; bank = bank.sub(t.amount); cash = cash.add(t.amount); contra = true; break;
    }
    if (cash.isNegative()) throw new ExtrasError(`Line ${i + 1} ("${t.particulars}"): cash would fall below zero (${cash.format()}). Check the amounts, or deposit/withdraw first.`);
    rows.push({ txn: t, cashDr, bankDr, cashCr, bankCr, contra, cashBalance: cash, bankBalance: bank });
  });
  const sum = (f: (r: CashBookRow) => Money) => Money.sum(rows.map(f));
  return { rows, closingCash: cash, closingBank: bank, overdraft: bank.isNegative(),
    totalCashDr: opening.cash.add(sum(r => r.cashDr)), totalCashCr: sum(r => r.cashCr).add(cash),
    totalBankDr: (opening.bank.isNegative() ? Money.ZERO : opening.bank).add(sum(r => r.bankDr)).add(bank.isNegative() ? bank.neg() : Money.ZERO),
    totalBankCr: (opening.bank.isNegative() ? opening.bank.neg() : Money.ZERO).add(sum(r => r.bankCr)).add(bank.isNegative() ? Money.ZERO : bank) };
}

// ───────────────────────────── subsidiary books with simple GST ─────────────────────────────
export type BookKind = 'PURCHASE' | 'SALE' | 'PURCHASE_RETURN' | 'SALES_RETURN';
export interface BookLine { readonly kind: BookKind; readonly party: string; readonly listPrice: Money; readonly tradeDiscountPercent?: bigint; readonly freight?: Money; readonly gstPercent: bigint; readonly interState?: boolean; }
export interface BookRow { readonly line: BookLine; readonly invoice: Invoice; readonly entry: Illustration; }
export interface SubsidiaryBooks {
  readonly rows: Record<BookKind, readonly BookRow[]>;
  readonly taxable: Record<BookKind, Money>; readonly gst: Record<BookKind, Money>;
  readonly netPurchases: Money; readonly netSales: Money; readonly inputGst: Money; readonly outputGst: Money; readonly gstPayable: Money;
}
export function subsidiaryBooks(lines: readonly BookLine[]): SubsidiaryBooks {
  const kinds: BookKind[] = ['PURCHASE', 'SALE', 'PURCHASE_RETURN', 'SALES_RETURN'];
  const rows = { PURCHASE: [], SALE: [], PURCHASE_RETURN: [], SALES_RETURN: [] } as unknown as Record<BookKind, BookRow[]>;
  for (const [i, l] of lines.entries()) {
    if (!l.listPrice.isPositive()) throw new ExtrasError(`Line ${i + 1} (${l.party}): the price must be more than zero`);
    if (l.gstPercent < 0n || l.gstPercent > 100n) throw new ExtrasError(`Line ${i + 1}: GST must be between 0 and 100 %`);
    const inv = invoice({ listPrice: l.listPrice, ...(l.tradeDiscountPercent !== undefined ? { tradeDiscountPercent: l.tradeDiscountPercent } : {}), ...(l.freight ? { freight: l.freight } : {}), gstPercent: l.gstPercent, ...(l.interState ? { interState: true } : {}) });
    const tax = (side: 'DR' | 'CR', sym: string) => nz(L(`${sym} CGST A/c`, side, inv.cgst), L(`${sym} SGST A/c`, side, inv.sgst), L(`${sym} IGST A/c`, side, inv.igst));
    let entry: Illustration;
    switch (l.kind) {
      case 'PURCHASE': entry = { narration: `Goods purchased from ${l.party}`, lines: [L('Purchases A/c', 'DR', inv.taxable), ...tax('DR', 'Input'), L(`${l.party} A/c`, 'CR', inv.total)] }; break;
      case 'SALE': entry = { narration: `Goods sold to ${l.party}`, lines: [L(`${l.party} A/c`, 'DR', inv.total), L('Sales A/c', 'CR', inv.taxable), ...tax('CR', 'Output')] }; break;
      case 'PURCHASE_RETURN': entry = { narration: `Goods returned to ${l.party}`, lines: [L(`${l.party} A/c`, 'DR', inv.total), L('Purchases Return A/c', 'CR', inv.taxable), ...tax('CR', 'Input')] }; break;
      case 'SALES_RETURN': entry = { narration: `Goods returned by ${l.party}`, lines: [L('Sales Return A/c', 'DR', inv.taxable), ...tax('DR', 'Output'), L(`${l.party} A/c`, 'CR', inv.total)] }; break;
    }
    rows[l.kind].push({ line: l, invoice: inv, entry });
  }
  const taxable = {} as Record<BookKind, Money>, gst = {} as Record<BookKind, Money>;
  for (const k of kinds) { taxable[k] = Money.sum(rows[k].map(r => r.invoice.taxable)); gst[k] = Money.sum(rows[k].map(r => r.invoice.totalTax)); }
  const inputGst = gst.PURCHASE.sub(gst.PURCHASE_RETURN), outputGst = gst.SALE.sub(gst.SALES_RETURN);
  return { rows, taxable, gst, netPurchases: taxable.PURCHASE.sub(taxable.PURCHASE_RETURN), netSales: taxable.SALE.sub(taxable.SALES_RETURN), inputGst, outputGst, gstPayable: outputGst.sub(inputGst) };
}

// ───────────────────────────── provision for doubtful debts & discount on debtors ─────────────────────────────
export interface ProvisionInput { readonly debtors: Money; readonly badDebtsInBooks?: Money; readonly additionalBadDebts?: Money; readonly badDebtsRecovered?: Money; readonly pddPercent?: bigint; readonly discountPercent?: bigint; readonly oldPdd?: Money; readonly oldDiscount?: Money; }
export interface ProvisionResult {
  readonly debtorsAfterBadDebts: Money; readonly newPdd: Money; readonly newDiscount: Money; readonly netDebtors: Money;
  readonly badDebtsExpense: Money; readonly pddCharge: Money; readonly discountCharge: Money; readonly totalCharge: Money; readonly entries: Illustration[];
}
/** PDD on debtors AFTER further bad debts; provision for discount on debtors AFTER bad debts AND after PDD. */
export function provisionDoubtful(i: ProvisionInput): ProvisionResult {
  const z = Money.ZERO, add = i.additionalBadDebts ?? z, inBooks = i.badDebtsInBooks ?? z, rec = i.badDebtsRecovered ?? z;
  if (add.cmp(i.debtors) > 0) throw new ExtrasError('Further bad debts cannot be more than the debtors');
  const after = i.debtors.sub(add);
  const oldP = i.oldPdd ?? z, oldD = i.oldDiscount ?? z;
  const newPdd = i.pddPercent !== undefined ? after.mulRatio(i.pddPercent, 100n, R) : oldP;
  const newDisc = i.discountPercent !== undefined ? after.sub(newPdd).mulRatio(i.discountPercent, 100n, R) : oldD;
  const badExp = inBooks.add(add).sub(rec), pddCh = newPdd.sub(oldP), discCh = newDisc.sub(oldD);
  const entries: Illustration[] = [];
  if (add.isPositive()) entries.push({ narration: 'Further bad debts written off', lines: [L('Bad Debts A/c', 'DR', add), L('Debtors A/c', 'CR', add)] });
  const prov = (name: string, ch: Money, label: string) => { if (!ch.isZero()) entries.push(ch.isPositive() ? { narration: `${label} increased`, lines: [L('Profit and Loss A/c', 'DR', ch), L(name, 'CR', ch)] } : { narration: `${label} reduced`, lines: [L(name, 'DR', ch.abs()), L('Profit and Loss A/c', 'CR', ch.abs())] }); };
  prov('Provision for Doubtful Debts A/c', pddCh, 'Provision for doubtful debts'); prov('Provision for Discount on Debtors A/c', discCh, 'Provision for discount on debtors');
  return { debtorsAfterBadDebts: after, newPdd, newDiscount: newDisc, netDebtors: after.sub(newPdd).sub(newDisc), badDebtsExpense: badExp, pddCharge: pddCh, discountCharge: discCh, totalCharge: badExp.add(pddCh).add(discCh), entries };
}
export function reserveTransfer(kind: 'GENERAL' | 'SPECIFIC', amount: Money, name = 'General Reserve'): Illustration {
  if (!amount.isPositive()) throw new ExtrasError('A transfer to reserve must be more than zero');
  return { narration: kind === 'GENERAL' ? 'Profit transferred to general reserve' : `Profit set aside for a specific purpose (${name})`, lines: [L('Profit and Loss Appropriation A/c', 'DR', amount), L(kind === 'GENERAL' ? 'General Reserve A/c' : `${name} A/c`, 'CR', amount)] };
}

// ───────────────────────────── opening entry ─────────────────────────────
export function openingEntry(o: { assets: readonly { name: string; amount: Money }[]; liabilities: readonly { name: string; amount: Money }[] }): { capital: Money; entry: Illustration } {
  const A = Money.sum(o.assets.map(a => a.amount)), Li = Money.sum(o.liabilities.map(a => a.amount));
  const capital = A.sub(Li);
  const lines = [...o.assets.map(a => L(`${a.name} A/c`, 'DR', a.amount)), ...o.liabilities.map(a => L(`${a.name} A/c`, 'CR', a.amount))];
  if (capital.isPositive()) lines.push(L('Capital A/c', 'CR', capital)); else if (capital.isNegative()) lines.push(L('Capital A/c (deficiency)', 'DR', capital.abs()));
  return { capital, entry: { narration: 'Opening entry: assets and liabilities brought forward; capital is the balancing figure', lines: nz(...lines) } };
}

// ───────────────────────────── loan schedule (EMI), exact ─────────────────────────────
export interface LoanRow { readonly month: number; readonly opening: Money; readonly interest: Money; readonly principal: Money; readonly payment: Money; readonly closing: Money; }
/** ratePercent is a Fraction (12 → 12/1, 8.5 → 17/2). EMI = P·r·(1+r)^n / ((1+r)^n − 1), r = ratePercent/1200, evaluated in exact integers then rounded once. */
export function loanSchedule(o: { principal: Money; ratePercent: Fraction; months: number }): { emi: Money; rows: LoanRow[]; totalInterest: Money; totalPaid: Money } {
  if (!o.principal.isPositive()) throw new ExtrasError('Loan amount must be more than zero');
  if (!Number.isInteger(o.months) || o.months < 1 || o.months > 600) throw new ExtrasError('Months must be a whole number from 1 to 600');
  if (o.ratePercent.isNegative()) throw new ExtrasError('Interest rate cannot be negative');
  const r = o.ratePercent.div(Fraction.of(1200)), nu = r.num, d = r.den, n = BigInt(o.months);
  let emiPaise: bigint;
  if (nu === 0n) emiPaise = divRound(o.principal.paise, n, R);
  else { const A = (d + nu) ** n, B = d ** n; emiPaise = divRound(o.principal.paise * nu * A, d * (A - B), R); }
  const emi = Money.fromPaise(emiPaise);
  const rows: LoanRow[] = []; let bal = o.principal;
  for (let m = 1; m <= o.months; m++) {
    const interest = bal.mulRatio(nu, d, R);
    const last = m === o.months;
    const payment = last ? bal.add(interest) : emi;
    const principal = payment.sub(interest);
    if (!last && principal.cmp(bal) > 0) throw new ExtrasError('Instalment exceeds the balance — check the inputs');
    const closing = bal.sub(principal);
    rows.push({ month: m, opening: bal, interest, principal, payment, closing }); bal = closing;
  }
  return { emi, rows, totalInterest: Money.sum(rows.map(x => x.interest)), totalPaid: Money.sum(rows.map(x => x.payment)) };
}

// ───────────────────────────── Schedule III totals (company statements) ─────────────────────────────
export type BsKey = 'shareCapital' | 'reservesAndSurplus' | 'longTermBorrowings' | 'otherNonCurrentLiabilities' | 'shortTermBorrowings' | 'tradePayables' | 'otherCurrentLiabilities' | 'shortTermProvisions'
  | 'tangibleAssets' | 'intangibleAssets' | 'nonCurrentInvestments' | 'otherNonCurrentAssets' | 'currentInvestments' | 'inventories' | 'tradeReceivables' | 'cashAndEquivalents' | 'otherCurrentAssets';
export type BalanceSheetInput = Partial<Record<BsKey, Money>>;
export interface BalanceSheet {
  readonly shareholdersFunds: Money; readonly nonCurrentLiabilities: Money; readonly currentLiabilities: Money; readonly totalEquityAndLiabilities: Money;
  readonly nonCurrentAssets: Money; readonly currentAssets: Money; readonly totalAssets: Money; readonly balanced: boolean; readonly difference: Money;
  readonly workingCapital: Money; readonly capitalEmployed: Money;
}
export function balanceSheet(i: BalanceSheetInput): BalanceSheet {
  const g = (k: BsKey) => i[k] ?? Money.ZERO;
  const sf = g('shareCapital').add(g('reservesAndSurplus')), ncl = g('longTermBorrowings').add(g('otherNonCurrentLiabilities'));
  const cl = Money.sum([g('shortTermBorrowings'), g('tradePayables'), g('otherCurrentLiabilities'), g('shortTermProvisions')]);
  const nca = Money.sum([g('tangibleAssets'), g('intangibleAssets'), g('nonCurrentInvestments'), g('otherNonCurrentAssets')]);
  const ca = Money.sum([g('currentInvestments'), g('inventories'), g('tradeReceivables'), g('cashAndEquivalents'), g('otherCurrentAssets')]);
  const tel = sf.add(ncl).add(cl), ta = nca.add(ca);
  return { shareholdersFunds: sf, nonCurrentLiabilities: ncl, currentLiabilities: cl, totalEquityAndLiabilities: tel, nonCurrentAssets: nca, currentAssets: ca, totalAssets: ta, balanced: tel.equals(ta), difference: ta.sub(tel), workingCapital: ca.sub(cl), capitalEmployed: sf.add(ncl) };
}
export interface PnlInput { readonly revenueFromOperations: Money; readonly otherIncome?: Money; readonly costOfMaterialsConsumed?: Money; readonly purchasesOfStockInTrade?: Money; readonly openingInventory?: Money; readonly closingInventory?: Money; readonly employeeBenefits?: Money; readonly financeCosts?: Money; readonly depreciation?: Money; readonly otherExpenses?: Money; readonly taxRatePercent?: bigint; }
export interface Pnl { readonly totalRevenue: Money; readonly changesInInventories: Money; readonly totalExpenses: Money; readonly profitBeforeTax: Money; readonly tax: Money; readonly profitAfterTax: Money; }
export function statementOfProfitAndLoss(i: PnlInput): Pnl {
  const z = Money.ZERO, v = (m?: Money) => m ?? z;
  const totalRevenue = i.revenueFromOperations.add(v(i.otherIncome));
  const changes = v(i.openingInventory).sub(v(i.closingInventory));                // increase in stock REDUCES expenses
  const totalExpenses = Money.sum([v(i.costOfMaterialsConsumed), v(i.purchasesOfStockInTrade), changes, v(i.employeeBenefits), v(i.financeCosts), v(i.depreciation), v(i.otherExpenses)]);
  const pbt = totalRevenue.sub(totalExpenses);
  const tax = pbt.isPositive() ? pbt.mulRatio(i.taxRatePercent ?? 0n, 100n, R) : z;
  return { totalRevenue, changesInInventories: changes, totalExpenses, profitBeforeTax: pbt, tax, profitAfterTax: pbt.sub(tax) };
}

// ───────────────────────────── fixed vs fluctuating capital ─────────────────────────────
export interface PartnerYear { readonly id: string; readonly openingCapital: Money; readonly openingCurrent?: Money; readonly additionalCapital?: Money; readonly drawings?: Money; readonly interestOnCapital?: Money; readonly interestOnDrawings?: Money; readonly salary?: Money; readonly commission?: Money; readonly profitShare: Money; }
export interface PartnerYearResult { readonly id: string; readonly capital: Money; readonly current: Money | null; readonly credits: Money; readonly debits: Money; }
export function partnerAccounts(method: 'FIXED' | 'FLUCTUATING', ps: readonly PartnerYear[]): PartnerYearResult[] {
  return ps.map(p => {
    const z = Money.ZERO, g = (m?: Money) => m ?? z;
    const credits = Money.sum([g(p.interestOnCapital), g(p.salary), g(p.commission), p.profitShare]);
    const debits = g(p.drawings).add(g(p.interestOnDrawings));
    const capital = p.openingCapital.add(g(p.additionalCapital));
    if (method === 'FIXED') return { id: p.id, capital, current: g(p.openingCurrent).add(credits).sub(debits), credits, debits };
    return { id: p.id, capital: capital.add(g(p.openingCurrent)).add(credits).sub(debits), current: null, credits, debits };
  });
}

// ───────────────────────────── revaluation ─────────────────────────────
export interface RevalItem { readonly name: string; readonly kind: 'ASSET' | 'LIABILITY'; readonly before: Money; readonly after: Money; }
export interface RevalRow { readonly item: RevalItem; readonly effect: Money; }   // + = profit, − = loss
export function revaluation(items: readonly RevalItem[], shares: Record<string, Fraction>): { rows: RevalRow[]; profit: Money; partnerShare: Record<string, Money>; entries: Illustration[] } {
  const rows: RevalRow[] = items.map(item => ({ item, effect: item.kind === 'ASSET' ? item.after.sub(item.before) : item.before.sub(item.after) }));
  const lines: EntryLine[] = [];
  for (const { item, effect } of rows) {
    if (effect.isZero()) continue;
    const up = item.kind === 'ASSET' ? effect.isPositive() : effect.isNegative();           // balance of the item goes up
    const amt = effect.abs(), nm = `${item.name} A/c`;
    if (item.kind === 'ASSET') lines.push(up ? L(nm, 'DR', amt) : L(nm, 'CR', amt)); else lines.push(up ? L(nm, 'CR', amt) : L(nm, 'DR', amt));
    lines.push(effect.isPositive() ? L('Revaluation A/c', 'CR', amt) : L('Revaluation A/c', 'DR', amt));
  }
  const profit = Money.sum(rows.map(r => r.effect));
  const ids = Object.keys(shares);
  const split = allocate(profit.abs(), ids.map(i => shares[i]!));
  const partnerShare: Record<string, Money> = {}; ids.forEach((id, k) => { partnerShare[id] = profit.isNegative() ? split[k]!.neg() : split[k]!; });
  const entries: Illustration[] = [];
  if (lines.length) {
    // collapse the Revaluation A/c lines so the entry reads naturally
    const rev = lines.filter(l => l.account === 'Revaluation A/c'), other = lines.filter(l => l.account !== 'Revaluation A/c');
    const revDr = Money.sum(rev.filter(l => l.side === 'DR').map(l => l.amount)), revCr = Money.sum(rev.filter(l => l.side === 'CR').map(l => l.amount));
    entries.push({ narration: 'Assets and liabilities revalued', lines: nz(...other.filter(l => l.side === 'DR'), L('Revaluation A/c', 'DR', revDr), ...other.filter(l => l.side === 'CR'), L('Revaluation A/c', 'CR', revCr)) });
    entries.push({ narration: profit.isNegative() ? 'Loss on revaluation shared by partners' : 'Profit on revaluation shared by partners',
      lines: profit.isNegative() ? nz(...ids.map(id => L(`${id}'s Capital A/c`, 'DR', partnerShare[id]!.abs())), L('Revaluation A/c', 'CR', profit.abs())) : nz(L('Revaluation A/c', 'DR', profit), ...ids.map(id => L(`${id}'s Capital A/c`, 'CR', partnerShare[id]!))) });
  }
  return { rows, profit, partnerShare, entries };
}

// ───────────────────────────── Partnership Act 1932: when the deed is silent ─────────────────────────────
/** s.13: profits shared equally; no salary or interest on capital; interest on a partner's loan/advance 6 % p.a. (a charge before sharing); no interest on drawings. */
export function actDefaults(o: { netProfit: Money; partners: readonly string[]; loans?: readonly { partner: string; amount: Money; months: number }[] }): { loanInterest: Record<string, Money>; distributable: Money; shares: Record<string, Money> } {
  if (o.partners.length < 2) throw new ExtrasError('A partnership needs at least two partners');
  const loanInterest: Record<string, Money> = {};
  for (const l of o.loans ?? []) loanInterest[l.partner] = (loanInterest[l.partner] ?? Money.ZERO).add(l.amount.mulRatio(6n * BigInt(l.months), 1200n, R));
  const totalInt = Money.sum(Object.values(loanInterest));
  const distributable = o.netProfit.sub(totalInt);
  const parts = allocate(distributable.abs(), o.partners.map(() => Fraction.of(1, o.partners.length)));
  const shares: Record<string, Money> = {}; o.partners.forEach((p, k) => { shares[p] = distributable.isNegative() ? parts[k]!.neg() : parts[k]!; });
  return { loanInterest, distributable, shares };
}
