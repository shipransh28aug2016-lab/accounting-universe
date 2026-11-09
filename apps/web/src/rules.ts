import { normalSide, type ChartOfAccounts, type Side } from '../../../packages/engine/src';
export const TYPE_WORD: Record<string, string> = { ASSET: 'Asset', LIABILITY: 'Liability', CAPITAL: 'Capital', REVENUE: 'Income', EXPENSE: 'Expense', DRAWINGS: 'Drawings' };
/** The rule of debit and credit, as one sentence, for one side of one account. */
export function ruleText(chart: ChartOfAccounts, accountId: string, side: Side): string {
  const acct = chart.get(accountId), nat = normalSide(acct.type), increases = side === nat, w = TYPE_WORD[acct.type]!;
  return `${acct.name} is ${/^[AEI]/.test(w) ? 'an' : 'a'} ${w.toLowerCase()} account; it ${increases ? 'increases' : 'decreases'}, so it is ${side === 'DR' ? 'DEBITED' : 'CREDITED'} (${w} ${increases ? '↑' : '↓'} → ${side === 'DR' ? 'Debit' : 'Credit'}).`;
}
