/**
 * Final accounts of a sole proprietor (Class XI Unit 3): Trading A/c, Profit & Loss A/c and Balance Sheet from a
 * trial balance and the prescribed adjustments. Generated from the data — nothing is hard-coded.
 *
 * Adjustments (syllabus matrix §2 Unit 3): closing stock, outstanding / prepaid expenses, accrued income, income
 * received in advance, depreciation, bad debts, provision for doubtful debts, provision for discount on debtors, abnormal
 * loss, goods taken for personal use, interest on capital, manager's commission.
 */
import { Money } from './money';

const R = 'HALF_UP' as const;

export type TbKind =
  | 'OPENING_STOCK' | 'PURCHASES' | 'PURCHASE_RETURNS' | 'SALES' | 'SALES_RETURNS'
  | 'DIRECT_EXPENSE' | 'DIRECT_INCOME' | 'INDIRECT_EXPENSE' | 'INDIRECT_INCOME' | 'BAD_DEBTS'
  | 'DEBTORS' | 'PROVISION_DOUBTFUL' | 'PROVISION_DISCOUNT'
  | 'CAPITAL' | 'DRAWINGS' | 'FIXED_ASSET' | 'CURRENT_ASSET' | 'CURRENT_LIABILITY' | 'LONG_TERM_LIABILITY';

export interface TbLine { readonly name: string; readonly kind: TbKind; readonly debit?: Money; readonly credit?: Money; }

export type Adjustment =
  | { type: 'CLOSING_STOCK'; amount: Money }
  | { type: 'OUTSTANDING'; account: string; amount: Money }
  | { type: 'PREPAID'; account: string; amount: Money }
  | { type: 'ACCRUED_INCOME'; account: string; amount: Money }
  | { type: 'ADVANCE_INCOME'; account: string; amount: Money }
  | { type: 'DEPRECIATION'; asset: string; amount: Money }
  | { type: 'BAD_DEBTS'; amount: Money }
  | { type: 'PROVISION_DOUBTFUL'; ratePercent: bigint }
  | { type: 'PROVISION_DISCOUNT'; ratePercent: bigint }
  | { type: 'ABNORMAL_LOSS'; amount: Money; insuranceClaim?: Money }
  | { type: 'GOODS_PERSONAL_USE'; amount: Money }
  | { type: 'INTEREST_ON_CAPITAL'; ratePercent: bigint }
  | { type: 'MANAGER_COMMISSION'; ratePercent: bigint; basis: 'BEFORE' | 'AFTER' };

export interface Row { readonly label: string; readonly amount: Money; }
export interface FinalAccounts {
  readonly trading: { readonly debit: readonly Row[]; readonly credit: readonly Row[]; readonly grossProfit: Money; readonly total: Money };
  readonly profitLoss: { readonly debit: readonly Row[]; readonly credit: readonly Row[]; readonly netProfit: Money; readonly netProfitBeforeCommission: Money; readonly total: Money };
  readonly balanceSheet: { readonly liabilities: readonly Row[]; readonly assets: readonly Row[]; readonly totalLiabilities: Money; readonly totalAssets: Money; readonly balanced: boolean };
}

export class FinalAccountsError extends Error { constructor(m: string) { super(m); this.name = 'FinalAccountsError'; } }

const sum = (rows: readonly Row[]) => Money.sum(rows.map(r => r.amount));

export function finalAccounts(tb: readonly TbLine[], adjustments: readonly Adjustment[]): FinalAccounts {
  // 0. the trial balance must tally, otherwise nothing downstream can be trusted
  const dr = Money.sum(tb.map(l => l.debit ?? Money.ZERO)), cr = Money.sum(tb.map(l => l.credit ?? Money.ZERO));
  if (!dr.equals(cr)) throw new FinalAccountsError(`Trial balance does not tally: debit ${dr.format()} vs credit ${cr.format()} (difference ${dr.sub(cr).abs().format()})`);

  const net = (l: TbLine) => (l.debit ?? Money.ZERO).sub(l.credit ?? Money.ZERO);       // + debit balance
  const byKind = (k: TbKind) => tb.filter(l => l.kind === k);
  const total = (k: TbKind) => Money.sum(byKind(k).map(net));
  const adj = <T extends Adjustment['type']>(t: T) => adjustments.filter((a): a is Extract<Adjustment, { type: T }> => a.type === t);

  // expense/income lines adjusted for outstanding/prepaid/accrued/advance
  const adjustedLine = (l: TbLine, expense: boolean): Row => {
    let a = expense ? net(l) : net(l).neg();
    for (const o of adj('OUTSTANDING')) if (o.account === l.name) a = expense ? a.add(o.amount) : a;
    for (const p of adj('PREPAID')) if (p.account === l.name) a = expense ? a.sub(p.amount) : a;
    for (const x of adj('ACCRUED_INCOME')) if (x.account === l.name) a = !expense ? a.add(x.amount) : a;
    for (const x of adj('ADVANCE_INCOME')) if (x.account === l.name) a = !expense ? a.sub(x.amount) : a;
    return { label: l.name, amount: a };
  };
  const knownAccounts = new Set(tb.map(l => l.name));
  for (const a of adjustments) {
    const acct = (a as { account?: string }).account;
    if (acct && !knownAccounts.has(acct)) throw new FinalAccountsError(`Adjustment refers to "${acct}", which is not in the trial balance`);
  }

  // ───────── Trading account
  const closingStock = Money.sum(adj('CLOSING_STOCK').map(a => a.amount));
  const personalUse = Money.sum(adj('GOODS_PERSONAL_USE').map(a => a.amount));
  const abnormal = adj('ABNORMAL_LOSS');
  const abnormalGoods = Money.sum(abnormal.map(a => a.amount));
  const claim = Money.sum(abnormal.map(a => a.insuranceClaim ?? Money.ZERO));

  const purchases = total('PURCHASES');
  const tradingDr: Row[] = [
    { label: 'Opening Stock', amount: total('OPENING_STOCK') },
    { label: 'Purchases', amount: purchases },
    ...(!total('PURCHASE_RETURNS').isZero() ? [{ label: 'Less: Purchase Returns', amount: total('PURCHASE_RETURNS') }] : []),
    ...(!personalUse.isZero() ? [{ label: 'Less: Goods taken for personal use', amount: personalUse.neg() }] : []),
    ...byKind('DIRECT_EXPENSE').map(l => adjustedLine(l, true)),
  ];
  // Purchase returns are a CREDIT balance (negative here) and personal use is negated above, so both already reduce the debit side.
  const tradingDebitRows = tradingDr;
  const salesNet = total('SALES').neg().sub(total('SALES_RETURNS'));                     // Sales are credit ⇒ net is negative ⇒ negate
  const tradingCr: Row[] = [
    { label: 'Sales (net of returns)', amount: salesNet },
    ...byKind('DIRECT_INCOME').map(l => adjustedLine(l, false)),
    { label: 'Closing Stock', amount: closingStock },
    ...(!abnormalGoods.isZero() ? [{ label: 'Abnormal loss of goods (credited to Trading A/c)', amount: abnormalGoods }] : []),
  ];
  // `Less:` rows are signed: a deduction is a negative amount on the debit side
  const dTotal = sum(tradingDebitRows), cTotal = sum(tradingCr);
  const grossProfit = cTotal.sub(dTotal);

  // ───────── Profit & Loss account
  const plDr: Row[] = byKind('INDIRECT_EXPENSE').map(l => adjustedLine(l, true));
  const plCr: Row[] = byKind('INDIRECT_INCOME').map(l => adjustedLine(l, false));

  for (const d of adj('DEPRECIATION')) {
    if (!tb.some(l => l.name === d.asset && l.kind === 'FIXED_ASSET')) throw new FinalAccountsError(`Depreciation refers to "${d.asset}", which is not a fixed asset in the trial balance`);
    plDr.push({ label: `Depreciation on ${d.asset}`, amount: d.amount });
  }

  const debtors = total('DEBTORS');
  const extraBad = Money.sum(adj('BAD_DEBTS').map(a => a.amount));
  const badDebts = total('BAD_DEBTS').add(extraBad);
  if (!badDebts.isZero()) plDr.push({ label: 'Bad Debts', amount: badDebts });
  const debtorsAfterBad = debtors.sub(extraBad);

  const oldPDD = total('PROVISION_DOUBTFUL').neg();                                      // credit balance ⇒ positive
  const pddRate = adj('PROVISION_DOUBTFUL')[0]?.ratePercent;
  const newPDD = pddRate !== undefined ? debtorsAfterBad.mulRatio(pddRate, 100n, R) : oldPDD;   // no instruction ⇒ existing provision stays
  const pddCharge = newPDD.sub(oldPDD);
  if (!pddCharge.isZero()) (pddCharge.isPositive() ? plDr : plCr).push({ label: pddCharge.isPositive() ? 'Provision for Doubtful Debts (increase)' : 'Provision for Doubtful Debts (reduction)', amount: pddCharge.abs() });

  const oldPD = total('PROVISION_DISCOUNT').neg();
  const pdRate = adj('PROVISION_DISCOUNT')[0]?.ratePercent;
  const newPD = pdRate !== undefined ? debtorsAfterBad.sub(newPDD).mulRatio(pdRate, 100n, R) : oldPD;   // on debtors after bad debts AND after the PDD
  const pdCharge = newPD.sub(oldPD);
  if (!pdCharge.isZero()) (pdCharge.isPositive() ? plDr : plCr).push({ label: pdCharge.isPositive() ? 'Provision for Discount on Debtors (increase)' : 'Provision for Discount on Debtors (reduction)', amount: pdCharge.abs() });

  const abnormalNet = abnormalGoods.sub(claim);
  if (!abnormalNet.isZero()) plDr.push({ label: 'Abnormal Loss (net of insurance claim)', amount: abnormalNet });

  const capital = total('CAPITAL').neg();
  const icRate = adj('INTEREST_ON_CAPITAL')[0]?.ratePercent;
  const interestOnCapital = icRate !== undefined ? capital.mulRatio(icRate, 100n, R) : Money.ZERO;
  if (!interestOnCapital.isZero()) plDr.push({ label: 'Interest on Capital', amount: interestOnCapital });

  // net profit BEFORE manager's commission
  const preCommission = grossProfit.add(sum(plCr)).sub(sum(plDr));
  let commission = Money.ZERO;
  const mc = adj('MANAGER_COMMISSION')[0];
  if (mc) commission = mc.basis === 'BEFORE' ? preCommission.mulRatio(mc.ratePercent, 100n, R) : preCommission.mulRatio(mc.ratePercent, 100n + mc.ratePercent, R);
  if (!commission.isZero()) plDr.push({ label: `Manager's Commission (${mc!.ratePercent}% on profit ${mc!.basis === 'BEFORE' ? 'before' : 'after'} charging it)`, amount: commission });
  const netProfit = preCommission.sub(commission);

  const gpDr = grossProfit.isNegative() ? [{ label: 'Gross Loss b/d', amount: grossProfit.neg() }] : [];
  const gpCr = grossProfit.isPositive() ? [{ label: 'Gross Profit b/d', amount: grossProfit }] : [];
  const plDebitRows = [...gpDr, ...plDr], plCreditRows = [...gpCr, ...plCr];

  // ───────── Balance sheet
  const outstanding = adj('OUTSTANDING'), prepaid = adj('PREPAID'), accrued = adj('ACCRUED_INCOME'), advance = adj('ADVANCE_INCOME');
  const drawings = total('DRAWINGS');
  const capitalNow = capital.add(netProfit).add(interestOnCapital).sub(drawings).sub(personalUse);
  const liabilities: Row[] = [
    { label: 'Capital (after profit, drawings and interest on capital)', amount: capitalNow },
    ...byKind('LONG_TERM_LIABILITY').map(l => ({ label: l.name, amount: net(l).neg() })),
    ...byKind('CURRENT_LIABILITY').map(l => ({ label: l.name, amount: net(l).neg() })),
    ...outstanding.map(o => ({ label: `Outstanding ${o.account}`, amount: o.amount })),
    ...advance.map(o => ({ label: `${o.account} received in advance`, amount: o.amount })),
    ...(!commission.isZero() ? [{ label: "Manager's commission payable", amount: commission }] : []),
  ];
  const depFor = (name: string) => Money.sum(adj('DEPRECIATION').filter(d => d.asset === name).map(d => d.amount));
  const assets: Row[] = [
    ...byKind('FIXED_ASSET').map(l => ({ label: depFor(l.name).isZero() ? l.name : `${l.name} (less depreciation ${depFor(l.name).format()})`, amount: net(l).sub(depFor(l.name)) })),
    ...(!closingStock.isZero() ? [{ label: 'Closing Stock', amount: closingStock }] : []),
    ...(!debtors.isZero() ? [{ label: debtors.sub(debtorsAfterBad).isZero() && newPDD.isZero() && newPD.isZero() ? 'Debtors' : 'Debtors (net of bad debts and provisions)', amount: debtorsAfterBad.sub(newPDD).sub(newPD) }] : []),
    ...byKind('CURRENT_ASSET').map(l => ({ label: l.name, amount: net(l) })),
    ...prepaid.map(p => ({ label: `Prepaid ${p.account}`, amount: p.amount })),
    ...accrued.map(p => ({ label: `Accrued ${p.account}`, amount: p.amount })),
    ...(!claim.isZero() ? [{ label: 'Insurance claim receivable', amount: claim }] : []),
  ];
  const totalL = sum(liabilities), totalA = sum(assets);
  return {
    trading: { debit: tradingDebitRows, credit: tradingCr, grossProfit, total: grossProfit.isPositive() ? dTotal.add(grossProfit) : dTotal },
    profitLoss: { debit: plDebitRows, credit: plCreditRows, netProfit, netProfitBeforeCommission: preCommission, total: sum(plCreditRows) },
    balanceSheet: { liabilities, assets, totalLiabilities: totalL, totalAssets: totalA, balanced: totalL.equals(totalA) },
  };
}
