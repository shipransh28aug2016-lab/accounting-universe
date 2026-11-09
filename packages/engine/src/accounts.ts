/**
 * Chart of accounts — the SINGLE source of truth for what an account is.
 *
 * Unlike the legacy classifier, there is no guessing: an account that is not registered is an
 * error, never silently "an expense". (The legacy regex fallback once typed "Depr. Machinery" as an
 * asset.) Direction (increase/decrease) is derived from the type, never re-typed per transaction.
 */

export type AccountType = 'ASSET' | 'LIABILITY' | 'CAPITAL' | 'REVENUE' | 'EXPENSE' | 'DRAWINGS';
export type Side = 'DR' | 'CR';

export const ACCOUNT_TYPES: readonly AccountType[] = ['ASSET', 'LIABILITY', 'CAPITAL', 'REVENUE', 'EXPENSE', 'DRAWINGS'];

/** Assets, expenses and drawings carry debit balances; the rest credit balances. */
export function normalSide(type: AccountType): Side {
  return type === 'ASSET' || type === 'EXPENSE' || type === 'DRAWINGS' ? 'DR' : 'CR';
}

export interface Account {
  readonly id: string;
  readonly name: string;
  readonly type: AccountType;
}

export class AccountError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccountError';
  }
}

export class ChartOfAccounts {
  private readonly byId = new Map<string, Account>();

  add(account: Account): this {
    const id = account.id.trim();
    if (!id) throw new AccountError('Account id must not be empty');
    if (!account.name.trim()) throw new AccountError(`Account "${id}" must have a name`);
    if (!ACCOUNT_TYPES.includes(account.type)) throw new AccountError(`Account "${id}" has unknown type "${String(account.type)}"`);
    if (this.byId.has(id)) throw new AccountError(`Duplicate account id "${id}"`);
    this.byId.set(id, Object.freeze({ id, name: account.name.trim(), type: account.type }));
    return this;
  }

  has(id: string): boolean { return this.byId.has(id); }

  get(id: string): Account {
    const a = this.byId.get(id);
    if (!a) throw new AccountError(`Unknown account "${id}" — add it to the chart of accounts first`);
    return a;
  }

  list(): readonly Account[] { return [...this.byId.values()]; }
}

/**
 * Small starter chart for Class XI sole-proprietorship work (periodic-inventory treatment: goods are
 * debited to Purchases and credited to Sales; stock is brought in only at the end via closing stock).
 * Later phases extend this with the full prescribed set (petty cash, provisions, reserves, …).
 */
export function starterChartClassXI(): ChartOfAccounts {
  const c = new ChartOfAccounts();
  const A: [string, string][] = [
    ['cash', 'Cash'], ['bank', 'Bank'], ['debtors', 'Debtors'], ['bills-receivable', 'Bills Receivable'],
    ['machinery', 'Machinery'], ['furniture', 'Furniture'], ['building', 'Building'], ['prepaid-insurance', 'Prepaid Insurance'],
  ];
  const L: [string, string][] = [
    ['creditors', 'Creditors'], ['bills-payable', 'Bills Payable'], ['bank-loan', 'Bank Loan'], ['outstanding-salary', 'Outstanding Salary'],
  ];
  const R: [string, string][] = [['sales', 'Sales'], ['commission-received', 'Commission Received'], ['interest-received', 'Interest Received']];
  const E: [string, string][] = [
    ['purchases', 'Purchases'], ['wages', 'Wages'], ['rent', 'Rent'], ['salary', 'Salary'], ['electricity', 'Electricity'],
    ['insurance', 'Insurance'], ['depreciation', 'Depreciation'], ['bad-debts', 'Bad Debts'],
  ];
  A.forEach(([id, name]) => c.add({ id, name, type: 'ASSET' }));
  L.forEach(([id, name]) => c.add({ id, name, type: 'LIABILITY' }));
  c.add({ id: 'capital', name: 'Capital', type: 'CAPITAL' });
  c.add({ id: 'drawings', name: 'Drawings', type: 'DRAWINGS' });
  R.forEach(([id, name]) => c.add({ id, name, type: 'REVENUE' }));
  E.forEach(([id, name]) => c.add({ id, name, type: 'EXPENSE' }));
  return c;
}
