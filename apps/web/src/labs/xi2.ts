import { ExtrasError, Money, cashBook, openingEntry, provisionDoubtful, reserveTransfer, subsidiaryBooks, type BookKind, type BookLine, type CashBookKind } from '../../../../packages/engine/src';
import { InputError, type Block, type Field, type Lab } from '../spec';
import { money, namedAmounts, num, optMoney, whole } from '../inputs';
import { note, R } from './common';

const guard = <T>(fn: () => T): T => { try { return fn(); } catch (e) { if (e instanceof ExtrasError) throw new InputError(e.message); throw e; } };
const amt = (s: string, line: number, what: string) => { try { return Money.parse(s.replace(/,/g, '')); } catch { throw new InputError(`Line ${line}: "${s}" is not a valid ${what}.`); } };

// ───────────────────────────── Cash book ─────────────────────────────
const CB_CODES: Record<string, { kind: CashBookKind; label: string }> = {
  RC: { kind: 'RECEIPT_CASH', label: 'receipt in cash' }, RB: { kind: 'RECEIPT_BANK', label: 'receipt by cheque / into bank' }, PC: { kind: 'PAYMENT_CASH', label: 'payment in cash' },
  PB: { kind: 'PAYMENT_BANK', label: 'payment by cheque / from bank' }, DEP: { kind: 'DEPOSIT', label: 'cash deposited into bank (contra)' }, WD: { kind: 'WITHDRAWAL', label: 'cash withdrawn from bank (contra)' },
};
export const cashbookLab: Lab = {
  id: 'xi-cashbook', cls: 'XI', title: 'Cash Book Simulator (cash + bank columns)', clauses: ['XI.2.cashbook'], skills: ['cashbook'],
  summary: 'Record receipts, payments and contra entries in a two-column cash book and see both balances move.',
  concept: [
    'The cash book is both a journal and a ledger for cash and bank. A two-column cash book has a Cash column and a Bank column on each side: receipts on the debit side, payments on the credit side.',
    'A CONTRA entry has both aspects inside the cash book itself — depositing cash into the bank (cash falls, bank rises) or withdrawing it (bank falls, cash rises). It is entered on both sides and marked “C”.',
    'Cash can never be negative. A negative bank balance is an overdraft — the bank has paid out more than you deposited.',
  ],
  realWorld: 'A shopkeeper takes cash sales through the day, banks the surplus each evening, and pays suppliers by cheque. At month-end the cash book must show the physical cash and the bank balance (before reconciliation with the pass book).',
  fields: [
    { id: 'cash', label: 'Opening cash (₹)', type: 'money' }, { id: 'bank', label: 'Opening bank balance (₹, minus = overdraft)', type: 'money' },
    { id: 'lines', label: 'Transactions — one per line: CODE amount particulars', type: 'textarea', help: 'Codes: RC receipt in cash · RB receipt in bank · PC payment in cash · PB payment from bank · DEP cash deposited into bank · WD cash withdrawn from bank' },
  ],
  example: { cash: '10000', bank: '20000', lines: 'RC 5000 Cash sales\nDEP 8000 Cash deposited into bank\nPB 12000 Rent paid by cheque\nWD 1000 Cash drawn from bank for office use\nRB 15000 Cheque received from debtor' },
  walkthrough: ['Opening: cash ₹10,000, bank ₹20,000.', 'Cash sales ₹5,000 raise cash to ₹15,000. Depositing ₹8,000 is a contra: cash ₹7,000, bank ₹28,000.', 'Rent by cheque ₹12,000 lowers bank to ₹16,000; withdrawing ₹1,000 gives cash ₹8,000 and bank ₹15,000; a cheque of ₹15,000 received takes bank to ₹30,000.', 'Closing: cash ₹8,000, bank ₹30,000 — each column foots when the closing balance is added to the smaller side.'],
  compute: v => {
    const open = { cash: money(v, 'cash', 'Opening cash'), bank: money(v, 'bank', 'Opening bank balance', { allowNegative: true }) };
    const txns = (v.lines ?? '').split(/\n+/).map(s => s.trim()).filter(Boolean).map((ln, i) => {
      const m = /^([A-Za-z]{2,3})\s+([\d,]+(?:\.\d{1,2})?)\s*(.*)$/.exec(ln);
      const code = m ? CB_CODES[m[1]!.toUpperCase()] : undefined;
      if (!m || !code) throw new InputError(`Line ${i + 1} ("${ln}"): start with a code (RC, RB, PC, PB, DEP, WD), then the amount, then a description.`, 'lines');
      return { particulars: m[3]!.trim() || code.label, kind: code.kind, amount: amt(m[2]!, i + 1, 'amount') };
    });
    if (txns.length === 0) throw new InputError('Enter at least one transaction.', 'lines');
    const cb = guard(() => cashBook(open, txns));
    const f = (m: Money) => (m.isZero() ? '' : R(m));
    return [
      { kind: 'table', caption: 'Two-column cash book (running balances after each line)', head: ['Particulars', 'Cash Dr', 'Bank Dr', 'Cash Cr', 'Bank Cr', 'Cash balance', 'Bank balance'], numeric: [1, 2, 3, 4, 5, 6],
        rows: [['Opening balance', R(open.cash), open.bank.isNegative() ? '' : R(open.bank), '', open.bank.isNegative() ? R(open.bank.neg()) : '', R(open.cash), R(open.bank)],
          ...cb.rows.map(x => [`${x.contra ? 'C · ' : ''}${x.txn.particulars}`, f(x.cashDr), f(x.bankDr), f(x.cashCr), f(x.bankCr), R(x.cashBalance), R(x.bankBalance)])],
        foot: ['Closing balance', '', '', R(cb.closingCash), cb.overdraft ? '' : R(cb.closingBank), R(cb.closingCash), R(cb.closingBank)] },
      { kind: 'table', caption: 'Each column foots (debit total = credit total)', head: ['', 'Debit side', 'Credit side'], numeric: [1, 2], rows: [['Cash column', R(cb.totalCashDr), R(cb.totalCashCr)], ['Bank column', R(cb.totalBankDr), R(cb.totalBankCr)]] },
      { kind: 'bars', title: 'Closing balances', items: [{ label: 'Cash', value: num(cb.closingCash), text: R(cb.closingCash), tone: 'a' }, { label: 'Bank', value: num(cb.closingBank), text: R(cb.closingBank), tone: cb.overdraft ? 'neg' : 'b' }] },
      note(cb.overdraft ? 'The bank column is negative: this is a bank OVERDRAFT. It is shown on the credit side of the cash book.' : 'Contra entries (marked C) are posted only inside the cash book — they are not posted to any other ledger account.', cb.overdraft ? 'warn' : 'info'),
    ];
  },
};

// ───────────────────────────── Subsidiary books ─────────────────────────────
const BK: Record<string, { kind: BookKind; title: string }> = { P: { kind: 'PURCHASE', title: 'Purchases Book' }, S: { kind: 'SALE', title: 'Sales Book' }, PR: { kind: 'PURCHASE_RETURN', title: 'Purchases Return Book' }, SR: { kind: 'SALES_RETURN', title: 'Sales Return Book' } };
export const subsidiaryLab: Lab = {
  id: 'xi-subsidiary', cls: 'XI', title: 'Subsidiary Books Simulator', clauses: ['XI.2.subsidiary'], skills: ['gst'],
  summary: 'Enter credit purchases, sales and returns once and watch the four subsidiary books, the GST and the ledger totals build themselves.',
  concept: [
    'Instead of journalising every credit transaction, a business keeps special books: Purchases Book (credit purchases of goods), Sales Book (credit sales), Purchases Return Book (goods sent back to suppliers) and Sales Return Book (goods sent back by customers). Cash transactions go to the cash book. Anything else (opening entry, adjustments, rectification) goes to the Journal Proper.',
    'Trade discount is deducted from the list price and never recorded. Freight billed on the invoice is added before GST. GST is charged on that taxable value: CGST + SGST within the state, IGST between states.',
    'The book totals are posted to the ledger once a period: net purchases, net sales and the GST accounts.',
  ],
  realWorld: 'A wholesaler issues dozens of invoices a day. Writing a journal entry for each would be slow; the Sales Book lists them in one place, and one total is posted at month-end.',
  fields: [{ id: 'lines', label: 'Credit transactions — one per line: CODE party list-price trade-discount% GST% [f=freight] [inter]', type: 'textarea', help: 'CODE: P purchase · S sale · PR purchase return · SR sales return. Example: S Shyam 50000 20 12 f=1000   (add the word inter for an inter-state sale).' }],
  example: { lines: 'P Ram 20000 10 18\nS Shyam 50000 20 12 f=1000\nPR Ram 2000 10 18\nSR Shyam 5000 0 12 inter' },
  walkthrough: ['Purchase from Ram: list ₹20,000 − 10% trade discount = ₹18,000; GST 18% = ₹3,240; Ram is owed ₹21,240.', 'Sale to Shyam: ₹50,000 − 20% = ₹40,000 + freight ₹1,000 = ₹41,000 taxable; GST 12% = ₹4,920.', 'Returns reverse the original: net purchases = 18,000 − 1,800 = ₹16,200; net sales = 41,000 − 5,000 = ₹36,000.', 'GST payable = output GST (4,920 − 600) − input GST (3,240 − 324) = ₹1,404.'],
  compute: v => {
    const lines: BookLine[] = (v.lines ?? '').split(/\n+/).map(s => s.trim()).filter(Boolean).map((ln, i) => {
      const t = ln.split(/\s+/); const code = BK[(t[0] ?? '').toUpperCase()];
      if (!code || t.length < 5) throw new InputError(`Line ${i + 1} ("${ln}"): write CODE party price trade-discount% GST% (for example  S Shyam 50000 20 12).`, 'lines');
      const [, party, price, td, gst, ...opts] = t as [string, string, string, string, string, ...string[]];
      if (!/^\d+$/.test(td) || !/^\d+$/.test(gst)) throw new InputError(`Line ${i + 1}: trade discount and GST must be whole-number percentages.`, 'lines');
      const fr = opts.find(o => /^f=/i.test(o));
      return { kind: code.kind, party, listPrice: amt(price, i + 1, 'price'), tradeDiscountPercent: BigInt(td), gstPercent: BigInt(gst), ...(fr ? { freight: amt(fr.slice(2), i + 1, 'freight') } : {}), ...(opts.some(o => o.toLowerCase() === 'inter') ? { interState: true } : {}) };
    });
    if (lines.length === 0) throw new InputError('Enter at least one transaction.', 'lines');
    const b = guard(() => subsidiaryBooks(lines));
    const blocks: Block[] = [];
    for (const code of ['P', 'S', 'PR', 'SR'] as const) {
      const { kind, title } = BK[code]!;
      if (b.rows[kind].length === 0) continue;
      blocks.push({ kind: 'table', caption: title, head: ['Party', 'List price', 'Trade discount', 'Freight', 'Taxable value', 'GST', 'Invoice total'], numeric: [1, 2, 3, 4, 5, 6],
        rows: b.rows[kind].map(r => [r.line.party, R(r.invoice.listPrice), R(r.invoice.tradeDiscount), R(r.invoice.freight), R(r.invoice.taxable), R(r.invoice.totalTax), R(r.invoice.total)]), foot: ['Total', '', '', '', R(b.taxable[kind]), R(b.gst[kind]), R(b.taxable[kind].add(b.gst[kind]))] });
    }
    blocks.push({ kind: 'table', caption: 'Totals posted to the ledger', head: ['Account', 'Amount'], numeric: [1], rows: [['Purchases (net of returns)', R(b.netPurchases)], ['Sales (net of returns)', R(b.netSales)], ['Input GST credit (net)', R(b.inputGst)], ['Output GST (net)', R(b.outputGst)]], foot: [b.gstPayable.isNegative() ? 'GST credit carried forward' : 'GST payable to government', R(b.gstPayable.abs())] });
    blocks.push({ kind: 'heading', text: 'The journal entry behind the first line of each book' });
    blocks.push({ kind: 'journal', entries: (['PURCHASE', 'SALE', 'PURCHASE_RETURN', 'SALES_RETURN'] as const).flatMap(k => b.rows[k].slice(0, 1).map(r => r.entry)) });
    blocks.push(note('Trade discount never appears in the ledger — only the net (taxable) value does. Cash transactions are not entered here; they go to the cash book.', 'info'));
    return blocks;
  },
};

// ───────────────────────────── Provisions & reserves ─────────────────────────────
export const provisionsLab: Lab = {
  id: 'xi-provisions', cls: 'XI', title: 'Provision & Reserve Lab', clauses: ['XI.2.provisions'], skills: ['pdd-provision'],
  summary: 'Provide for doubtful debts and discount on debtors in the right order, see the charge to profit, and learn how a reserve differs from a provision.',
  concept: [
    'A PROVISION is a charge against profit for a probable loss or liability of uncertain amount (doubtful debts, discount likely to be allowed). A RESERVE is profit kept back — an appropriation, not a charge.',
    'Order of working: (1) write off further bad debts; (2) provision for doubtful debts on the debtors that remain; (3) provision for discount on debtors on what is left after bad debts AND after the doubtful-debts provision.',
    'Only the CHANGE in a provision is charged to the P&L: an increase is a charge; a reduction is a gain. Debtors are shown in the Balance Sheet net of both provisions.',
  ],
  realWorld: 'A garment seller knows a few of her ₹2,00,000 debtors will never pay and that some will take the 2% early-payment discount. She provides for both this year instead of being surprised next year.',
  fields: [
    { id: 'debtors', label: 'Debtors before further bad debts (₹)', type: 'money' }, { id: 'badIn', label: 'Bad debts already in the books (₹)', type: 'money' }, { id: 'bad', label: 'Further bad debts to write off (₹)', type: 'money' }, { id: 'rec', label: 'Bad debts recovered (₹)', type: 'money' },
    { id: 'pdd', label: 'Provision for doubtful debts (%) — blank keeps the old amount', type: 'percent' }, { id: 'disc', label: 'Provision for discount on debtors (%) — blank keeps the old amount', type: 'percent' },
    { id: 'oldPdd', label: 'Old provision for doubtful debts (₹)', type: 'money' }, { id: 'oldDisc', label: 'Old provision for discount (₹)', type: 'money' }, { id: 'reserve', label: 'Transfer to general reserve (₹, blank = none)', type: 'money' },
  ],
  example: { debtors: '100000', badIn: '2000', bad: '5000', rec: '0', pdd: '5', disc: '2', oldPdd: '3000', oldDisc: '1000', reserve: '10000' },
  walkthrough: ['Debtors after further bad debts: ₹1,00,000 − ₹5,000 = ₹95,000.', 'New provision for doubtful debts = 5% × ₹95,000 = ₹4,750 (old ₹3,000, so ₹1,750 is charged).', 'Provision for discount = 2% × (₹95,000 − ₹4,750) = ₹1,805 (old ₹1,000, so ₹805 is charged).', 'Charge to P&L = bad debts ₹7,000 + ₹1,750 + ₹805 = ₹9,555. Debtors appear in the Balance Sheet at ₹88,445. The reserve is NOT part of this charge — it comes out of profit afterwards.'],
  compute: v => {
    const pct = (id: string, label: string) => ((v[id] ?? '').trim() === '' ? undefined : BigInt(whole(v, id, label, 0, 100)));
    const p = pct('pdd', 'Doubtful-debts %'), d = pct('disc', 'Discount %');
    const r = guard(() => provisionDoubtful({ debtors: money(v, 'debtors', 'Debtors'), badDebtsInBooks: optMoney(v, 'badIn', 'Bad debts in books'), additionalBadDebts: optMoney(v, 'bad', 'Further bad debts'), badDebtsRecovered: optMoney(v, 'rec', 'Bad debts recovered'), ...(p !== undefined ? { pddPercent: p } : {}), ...(d !== undefined ? { discountPercent: d } : {}), oldPdd: optMoney(v, 'oldPdd', 'Old provision'), oldDiscount: optMoney(v, 'oldDisc', 'Old discount provision') }));
    const blocks: Block[] = [
      { kind: 'steps', title: 'Working', steps: [`Debtors after further bad debts = ${R(r.debtorsAfterBadDebts)}`, `Provision for doubtful debts = ${R(r.newPdd)} (change ${R(r.pddCharge)})`, `Provision for discount = ${R(r.newDiscount)} (change ${R(r.discountCharge)})`] },
      { kind: 'table', caption: 'Charged to the Profit and Loss Account', head: ['Item', '₹'], numeric: [1], rows: [['Bad debts (in books + further − recovered)', R(r.badDebtsExpense)], [r.pddCharge.isNegative() ? 'Reduction in provision for doubtful debts' : 'Increase in provision for doubtful debts', R(r.pddCharge.abs())], [r.discountCharge.isNegative() ? 'Reduction in provision for discount' : 'Increase in provision for discount', R(r.discountCharge.abs())]], foot: ['Total charge', R(r.totalCharge)] },
      { kind: 'table', caption: 'Balance Sheet — Debtors', head: ['', '₹'], numeric: [1], rows: [['Debtors after bad debts', R(r.debtorsAfterBadDebts)], ['Less: provision for doubtful debts', R(r.newPdd)], ['Less: provision for discount on debtors', R(r.newDiscount)]], foot: ['Net debtors', R(r.netDebtors)] },
      { kind: 'journal', entries: r.entries },
    ];
    const rsv = optMoney(v, 'reserve', 'Reserve');
    if (rsv.isPositive()) { blocks.push({ kind: 'heading', text: 'A reserve is an appropriation of profit' }); blocks.push({ kind: 'journal', entries: [reserveTransfer('GENERAL', rsv)] }); }
    blocks.push({ kind: 'table', caption: 'Provision or reserve?', head: ['', 'Provision', 'Reserve'], rows: [['What it is', 'Charge against profit for a probable loss/liability', 'Profit kept back for strength or a purpose'], ['Effect on profit', 'Reduces profit', 'Profit is unchanged; it is appropriated'], ['Example', 'Doubtful debts, depreciation', 'General reserve, specific reserve, capital reserve'], ['Can be distributed as dividend?', 'No', 'Revenue reserves yes; capital reserves no']] });
    return blocks;
  },
};

// ───────────────────────────── Opening entry + capital/revenue ─────────────────────────────
const CR_TABLE: string[][] = [
  ['Purchase of machinery', 'Capital expenditure', 'Gives benefit for many years'], ['Carriage paid to bring the machine to the factory', 'Capital expenditure', 'Needed to bring the asset into use, so added to its cost'],
  ['Repairs of machinery', 'Revenue expenditure', 'Maintains earning capacity this year'], ['Wages paid', 'Revenue expenditure', 'Cost of running the business this year'],
  ['Wages paid for building a new shed', 'Capital expenditure', 'Spent on creating an asset'], ['Heavy advertising whose benefit lasts 3 years', 'Deferred revenue expenditure', 'Revenue in nature, benefit spread over several years'],
  ['Sale of old furniture', 'Capital receipt', 'Sale of a fixed asset'], ['Sale of goods', 'Revenue receipt', 'Normal trading income'],
  ['Loan from a bank', 'Capital receipt (a liability)', 'Not income'], ['Interest received on investments', 'Revenue receipt', 'Income for the year'],
];
export const openingLab: Lab = {
  id: 'xi-opening', cls: 'XI', title: 'Opening Entry & Capital vs Revenue', clauses: ['XI.3.concepts'], skills: ['opening-capital'],
  summary: 'Open a new year’s books from a list of assets and liabilities — capital falls out as the balancing figure — and classify items as capital or revenue.',
  concept: [
    'An opening entry carries the closing balances of last year into the new books: debit every asset, credit every liability, and credit Capital for the difference (Assets − Liabilities).',
    'Capital expenditure creates or improves an asset and benefits many years (Balance Sheet). Revenue expenditure keeps the business running this year (Profit and Loss). Deferred revenue expenditure is revenue in nature but spread over the years it benefits.',
  ],
  realWorld: 'On 1 April a shop owner lists everything the shop owns and owes. The difference is her investment in the shop — the capital — and that is the first journal entry of the new year.',
  fields: [{ id: 'assets', label: 'Assets — one per line: Name : amount', type: 'textarea' }, { id: 'liabs', label: 'Liabilities — one per line: Name : amount', type: 'textarea' }],
  example: { assets: 'Cash : 50000\nStock : 250000\nFurniture : 60000', liabs: 'Creditors : 80000\nBank Loan : 100000' },
  walkthrough: ['Assets = ₹50,000 + ₹2,50,000 + ₹60,000 = ₹3,60,000.', 'Liabilities = ₹80,000 + ₹1,00,000 = ₹1,80,000.', 'Capital = ₹3,60,000 − ₹1,80,000 = ₹1,80,000, credited in the opening entry so debit = credit.'],
  compute: v => {
    const a = namedAmounts(v, 'assets', 'Assets'), l = namedAmounts(v, 'liabs', 'Liabilities');
    if (a.length === 0) throw new InputError('List at least one asset.', 'assets');
    const o = openingEntry({ assets: a, liabilities: l });
    return [
      { kind: 'equation', assets: a.map(x => ({ label: x.name, value: num(x.amount), text: R(x.amount) })), rhs: [...l.map(x => ({ label: x.name, value: num(x.amount), text: R(x.amount) })), { label: 'Capital (balancing figure)', value: Math.max(0, num(o.capital)), text: R(o.capital) }], balanced: true },
      { kind: 'journal', entries: [o.entry] },
      ...(o.capital.isNegative() ? [note('Liabilities are more than assets, so the owner has a capital DEFICIENCY; it is debited in the opening entry.', 'warn') as Block] : []),
      { kind: 'table', caption: 'Classify these (capital or revenue)', head: ['Item', 'Type', 'Why'], rows: CR_TABLE },
    ];
  },
};

// ───────────────────────────── Accounting equation visualiser ─────────────────────────────
type TxnDef = { label: string; needs: 'amount' | 'amountCost'; apply: (s: Eq, a: Money, c: Money) => string };
interface Eq { cash: Money; stock: Money; other: Money; creditors: Money; loan: Money; capital: Money; }
const TXN: Record<string, TxnDef> = {
  INVEST: { label: 'Owner invests cash', needs: 'amount', apply: (s, a) => { s.cash = s.cash.add(a); s.capital = s.capital.add(a); return 'Assets ↑ (cash) and Capital ↑'; } },
  BUY_ASSET: { label: 'Buy furniture / machinery for cash', needs: 'amount', apply: (s, a) => { s.other = s.other.add(a); s.cash = s.cash.sub(a); return 'One asset ↑, another asset ↓ — total assets unchanged'; } },
  BUY_CREDIT: { label: 'Buy goods on credit', needs: 'amount', apply: (s, a) => { s.stock = s.stock.add(a); s.creditors = s.creditors.add(a); return 'Assets ↑ (stock) and Liabilities ↑ (creditors)'; } },
  PAY_CRED: { label: 'Pay creditors in cash', needs: 'amount', apply: (s, a) => { s.cash = s.cash.sub(a); s.creditors = s.creditors.sub(a); return 'Assets ↓ (cash) and Liabilities ↓'; } },
  LOAN: { label: 'Take a bank loan', needs: 'amount', apply: (s, a) => { s.cash = s.cash.add(a); s.loan = s.loan.add(a); return 'Assets ↑ (cash) and Liabilities ↑ (loan)'; } },
  REPAY: { label: 'Repay part of the loan', needs: 'amount', apply: (s, a) => { s.cash = s.cash.sub(a); s.loan = s.loan.sub(a); return 'Assets ↓ and Liabilities ↓'; } },
  SELL: { label: 'Sell goods for cash (amount = selling price, then cost)', needs: 'amountCost', apply: (s, a, c) => { s.cash = s.cash.add(a); s.stock = s.stock.sub(c); s.capital = s.capital.add(a.sub(c)); return `Cash ↑ by the price, stock ↓ by the COST, so Capital changes by the profit ${a.sub(c).format()}`; } },
  EXPENSE: { label: 'Pay an expense (rent, wages)', needs: 'amount', apply: (s, a) => { s.cash = s.cash.sub(a); s.capital = s.capital.sub(a); return 'Assets ↓ (cash) and Capital ↓ (expense reduces profit)'; } },
  DRAW: { label: 'Owner draws cash for personal use', needs: 'amount', apply: (s, a) => { s.cash = s.cash.sub(a); s.capital = s.capital.sub(a); return 'Assets ↓ (cash) and Capital ↓ (drawings)'; } },
};
const eqBlock = (s: Eq): Block => {
  const A = s.cash.add(s.stock).add(s.other), RHS = s.creditors.add(s.loan).add(s.capital);
  const it = (label: string, m: Money) => ({ label, value: num(m), text: R(m) });
  return { kind: 'equation', assets: [it('Cash', s.cash), it('Stock', s.stock), it('Furniture / machinery', s.other)].filter(x => x.value !== 0), rhs: [it('Creditors', s.creditors), it('Bank loan', s.loan), it('Capital', s.capital)].filter(x => x.value !== 0), balanced: A.equals(RHS) };
};
export const equationLab: Lab = {
  id: 'xi-equation', cls: 'XI', title: 'Accounting Equation Visualizer', clauses: ['XI.2.equation'], skills: [],
  summary: 'Pick up to four transactions and watch Assets = Liabilities + Capital stay in balance after every one.',
  concept: ['Every transaction has a dual effect, so the equation Assets = Liabilities + Capital always balances. Some transactions change only the make-up of assets; some raise or lower both sides.', 'Revenue raises capital (profit), expenses lower it, and drawings lower it. Selling goods at a profit adds the profit — not the whole price — to capital, because stock leaves at cost.'],
  realWorld: 'When Ravi buys a scooter for his courier business with cash, the business is no richer — cash simply became a scooter. When he earns delivery fees, the business is richer, and capital grows.',
  fields: [
    { id: 'cash', label: 'Opening cash (₹)', type: 'money', group: 'Opening position' }, { id: 'stock', label: 'Opening stock (₹)', type: 'money' }, { id: 'other', label: 'Furniture / machinery (₹)', type: 'money' }, { id: 'cred', label: 'Creditors (₹)', type: 'money' }, { id: 'loan', label: 'Bank loan (₹)', type: 'money' },
    ...[1, 2, 3, 4].flatMap((i): Field[] => [
      { id: `t${i}`, label: `Transaction ${i}`, type: 'select', ...(i === 1 ? { group: 'Transactions' } : {}), options: [{ value: '', label: '— none —' }, ...Object.entries(TXN).map(([k, d]) => ({ value: k, label: d.label }))] },
      { id: `a${i}`, label: `Amount ${i} (₹)`, type: 'money' }, { id: `c${i}`, label: `Cost of goods ${i} (₹, sales only)`, type: 'money' },
    ]),
  ],
  example: { cash: '100000', stock: '50000', other: '0', cred: '20000', loan: '0', t1: 'BUY_ASSET', a1: '30000', c1: '', t2: 'SELL', a2: '40000', c2: '30000', t3: 'EXPENSE', a3: '5000', c3: '', t4: 'LOAN', a4: '25000', c4: '' },
  walkthrough: ['Start: assets ₹1,50,000 = creditors ₹20,000 + capital ₹1,30,000.', 'Buy furniture for cash ₹30,000: cash falls, furniture rises — nothing else changes.', 'Sell goods ₹40,000 that cost ₹30,000: cash +40,000, stock −30,000, capital +10,000 (the profit).', 'Pay expense ₹5,000: cash and capital both fall. Loan ₹25,000: cash and liabilities both rise.'],
  compute: v => {
    const s: Eq = { cash: optMoney(v, 'cash', 'Cash'), stock: optMoney(v, 'stock', 'Stock'), other: optMoney(v, 'other', 'Furniture'), creditors: optMoney(v, 'cred', 'Creditors'), loan: optMoney(v, 'loan', 'Loan'), capital: Money.ZERO };
    s.capital = s.cash.add(s.stock).add(s.other).sub(s.creditors).sub(s.loan);
    const blocks: Block[] = [{ kind: 'heading', text: 'Opening position' }, eqBlock(s)];
    let n = 0;
    for (const i of [1, 2, 3, 4]) {
      const key = (v[`t${i}`] ?? '').trim(); if (!key) continue;
      const d = TXN[key]; if (!d) throw new InputError(`Transaction ${i} is not recognised.`, `t${i}`);
      const a = money(v, `a${i}`, `Amount ${i}`); if (!a.isPositive()) throw new InputError(`Amount ${i} must be more than zero.`, `a${i}`);
      const c = d.needs === 'amountCost' ? money(v, `c${i}`, `Cost ${i}`) : Money.ZERO;
      if (d.needs === 'amountCost' && c.cmp(s.stock) > 0) throw new InputError(`Transaction ${i}: you cannot sell goods costing ${R(c)} when stock is only ${R(s.stock)}.`, `c${i}`);
      const need = key === 'BUY_ASSET' || key === 'PAY_CRED' || key === 'REPAY' || key === 'EXPENSE' || key === 'DRAW' ? a : Money.ZERO;
      if (need.cmp(s.cash) > 0) throw new InputError(`Transaction ${i}: you do not have ${R(a)} in cash (only ${R(s.cash)}).`, `a${i}`);
      if (key === 'PAY_CRED' && a.cmp(s.creditors) > 0) throw new InputError(`Transaction ${i}: you owe creditors only ${R(s.creditors)}.`, `a${i}`);
      if (key === 'REPAY' && a.cmp(s.loan) > 0) throw new InputError(`Transaction ${i}: the loan outstanding is only ${R(s.loan)}.`, `a${i}`);
      const effect = d.apply(s, a, c); n++;
      blocks.push({ kind: 'heading', text: `${n}. ${d.label} — ${R(a)}` }, { kind: 'note', text: effect, tone: 'info' }, eqBlock(s));
    }
    if (n === 0) throw new InputError('Choose at least one transaction.', 't1');
    return blocks;
  },
};
export const XI2_LABS: Lab[] = [equationLab, cashbookLab, subsidiaryLab, provisionsLab, openingLab];
