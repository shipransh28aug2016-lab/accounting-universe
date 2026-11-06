/**
 * Cash Flow Statement — Class XII, AS 3 (Revised), INDIRECT method only (matrix §3).
 * Syllabus notes honoured: bank overdraft / cash credit are short-term borrowings (financing); current investments are
 * marketable securities, i.e. cash equivalents (so they are NOT an investing flow).
 */
import { Money } from './money';

export interface FlowItem { readonly label: string; /** signed: inflow / add-back positive, outflow / deduction negative */ readonly amount: Money; }

export interface CashFlowInput {
  readonly netProfitBeforeTaxAndExtraordinary: Money;
  /** Non-cash and non-operating items: + depreciation, amortisation, loss on sale, interest expense; − gain on sale, dividend/interest income. */
  readonly adjustments: readonly FlowItem[];
  /** Effect on CASH of changes in current assets/liabilities: an increase in receivables is NEGATIVE, an increase in payables POSITIVE. */
  readonly workingCapitalChanges: readonly FlowItem[];
  readonly taxPaid: Money;
  readonly investing: readonly FlowItem[];
  readonly financing: readonly FlowItem[];
  readonly openingCashEquivalents: Money;
  /** If supplied, the statement is checked against it. */
  readonly closingCashEquivalents?: Money;
}
export interface CashFlowResult {
  readonly operatingProfitBeforeWorkingCapital: Money; readonly cashGeneratedFromOperations: Money;
  readonly cashFromOperating: Money; readonly cashFromInvesting: Money; readonly cashFromFinancing: Money;
  readonly netChange: Money; readonly closing: Money;
  /** null when no closing balance was given; otherwise whether the statement reconciles to it. */
  readonly reconciles: boolean | null; readonly difference: Money | null;
}

export function cashFlowStatement(i: CashFlowInput): CashFlowResult {
  const sum = (xs: readonly FlowItem[]) => Money.sum(xs.map(x => x.amount));
  const opBeforeWC = i.netProfitBeforeTaxAndExtraordinary.add(sum(i.adjustments));
  const generated = opBeforeWC.add(sum(i.workingCapitalChanges));
  const cfo = generated.sub(i.taxPaid);
  const cfi = sum(i.investing), cff = sum(i.financing);
  const net = cfo.add(cfi).add(cff);
  const closing = i.openingCashEquivalents.add(net);
  const diff = i.closingCashEquivalents ? i.closingCashEquivalents.sub(closing) : null;
  return { operatingProfitBeforeWorkingCapital: opBeforeWC, cashGeneratedFromOperations: generated, cashFromOperating: cfo, cashFromInvesting: cfi, cashFromFinancing: cff, netChange: net, closing, reconciles: diff ? diff.isZero() : null, difference: diff };
}

/** Roll-forward of a fixed asset and its accumulated depreciation across a year with one disposal. */
export function fixedAssetRollForward(o: {
  openingCost: Money; closingCost: Money; openingAccDep: Money; closingAccDep: Money; disposedCost?: Money; disposedAccDep?: Money; saleProceeds?: Money;
}): { purchases: Money; depreciationCharge: Money; bookValueOfDisposal: Money; profitOrLossOnSale: Money } {
  const dc = o.disposedCost ?? Money.ZERO, da = o.disposedAccDep ?? Money.ZERO, sp = o.saleProceeds ?? Money.ZERO;
  const bv = dc.sub(da);
  return { purchases: o.closingCost.sub(o.openingCost).add(dc), depreciationCharge: o.closingAccDep.sub(o.openingAccDep).add(da), bookValueOfDisposal: bv, profitOrLossOnSale: sp.sub(bv) };
}

export type CashFlowActivity = 'OPERATING' | 'INVESTING' | 'FINANCING' | 'NONE';
/** Classification of common transactions (syllabus: classification of activities). `NONE` = not a cash flow at all. */
export const CASH_FLOW_CLASSIFICATION: readonly { transaction: string; activity: CashFlowActivity; why: string }[] = [
  { transaction: 'Cash received from customers', activity: 'OPERATING', why: 'Principal revenue-producing activity.' },
  { transaction: 'Cash paid to suppliers and employees', activity: 'OPERATING', why: 'Principal revenue-producing activity.' },
  { transaction: 'Income tax paid', activity: 'OPERATING', why: 'Taxes are operating unless tied to investing/financing.' },
  { transaction: 'Purchase of machinery for cash', activity: 'INVESTING', why: 'Acquisition of a fixed asset.' },
  { transaction: 'Sale of land for cash', activity: 'INVESTING', why: 'Disposal of a fixed asset.' },
  { transaction: 'Sale of shares held as a long-term investment', activity: 'INVESTING', why: 'Disposal of a non-current investment.' },
  { transaction: 'Interest and dividend received on investments', activity: 'INVESTING', why: 'Return on investments (for a non-financial company).' },
  { transaction: 'Issue of equity shares for cash', activity: 'FINANCING', why: 'Raises owners\' capital.' },
  { transaction: 'Proceeds from issue of debentures / long-term loan', activity: 'FINANCING', why: 'Raises borrowed capital.' },
  { transaction: 'Repayment of long-term borrowings', activity: 'FINANCING', why: 'Reduces borrowed capital.' },
  { transaction: 'Interest paid on debentures / loans', activity: 'FINANCING', why: 'Cost of borrowed capital (for a non-financial company).' },
  { transaction: 'Dividend paid', activity: 'FINANCING', why: 'Return to owners.' },
  { transaction: 'Bank overdraft / cash credit availed', activity: 'FINANCING', why: 'Syllabus note: treated as short-term borrowings.' },
  { transaction: 'Purchase of marketable securities / current investments', activity: 'NONE', why: 'Syllabus note: current investments are cash equivalents — switching between cash and cash equivalents is not a cash flow.' },
  { transaction: 'Cash deposited into / withdrawn from bank', activity: 'NONE', why: 'Movement within cash and cash equivalents.' },
  { transaction: 'Purchase of furniture by issuing shares', activity: 'NONE', why: 'Non-cash transaction: disclosed separately, not in the statement (cf. SQP Q29).' },
  { transaction: 'Depreciation charged', activity: 'NONE', why: 'Non-cash expense: added back to profit in the operating section.' },
];
