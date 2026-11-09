import { ChartOfAccounts, EntryValidationError, Ledger, Money, normalSide, validateEntry, type AccountType, type DraftEntry, type DraftLine, type Side } from '../../../../packages/engine/src';
import { Machine, check } from '../../../../packages/engine/src';
import { CAS_VOUCHER, CAS_YEAR, type VoucherCtx } from '../../../../packages/curriculum/src';
import { onDispose, register, setAvailability, unregister } from '../machine-dom';
import { h, mount } from '../dom';
import { renderBlock } from '../render';
import { num } from '../inputs';
import { announce } from '../ui';
import { getProject, recordSeen, setProject } from '../store';
import { download } from './progress';
import { TYPE_WORD } from '../rules';

/** Hierarchy of heads: the first digit of a code is its group. */
const GROUPS: { digit: string; type: AccountType; head: string }[] = [
  { digit: '1', type: 'ASSET', head: '1000 Assets' }, { digit: '2', type: 'LIABILITY', head: '2000 Liabilities' }, { digit: '3', type: 'CAPITAL', head: '3000 Capital' },
  { digit: '4', type: 'REVENUE', head: '4000 Income' }, { digit: '5', type: 'EXPENSE', head: '5000 Expenses' },
];
const SEED: [string, string, AccountType][] = [['1001', 'Cash', 'ASSET'], ['1002', 'Bank', 'ASSET'], ['1101', 'Debtors', 'ASSET'], ['1201', 'Stock', 'ASSET'], ['1301', 'Machinery', 'ASSET'], ['2001', 'Creditors', 'LIABILITY'], ['2002', 'Bank Loan', 'LIABILITY'], ['2003', 'Outstanding Expenses', 'LIABILITY'],
  ['3001', 'Capital', 'CAPITAL'], ['3002', 'Drawings', 'DRAWINGS'], ['3900', 'Profit and Loss Summary', 'CAPITAL'], ['4001', 'Sales', 'REVENUE'], ['4002', 'Interest Received', 'REVENUE'], ['5001', 'Purchases', 'EXPENSE'], ['5002', 'Rent', 'EXPENSE'], ['5003', 'Salary', 'EXPENSE'], ['5004', 'Depreciation', 'EXPENSE']];
type VType = 'RECEIPT' | 'PAYMENT' | 'JOURNAL';
const CASH = ['1001', '1002'];
interface Draft { id: number; vtype: VType; date: string; narration: string; lines: { code: string; side: Side; amount: string }[]; }
interface Saved { accounts: [string, string, AccountType][]; posted: DraftEntry[]; pending: Draft[]; role: Role; year: number; closed: boolean; }
type Role = 'ACCOUNTANT' | 'CHECKER' | 'VIEWER';
const ROLE_TEXT: Record<Role, string> = { ACCOUNTANT: 'Accountant — can enter vouchers', CHECKER: 'Checker — can verify and post, close the year', VIEWER: 'Viewer — can only read reports' };

const ser = (e: DraftEntry) => ({ date: e.date, narration: e.narration, lines: e.lines.map(l => ({ accountId: l.accountId, side: l.side, amount: l.amount.toString() })) });
const de = (e: { date: string; narration: string; lines: { accountId: string; side: Side; amount: string }[] }): DraftEntry => ({ date: e.date, narration: e.narration, lines: e.lines.map(l => ({ accountId: l.accountId, side: l.side, amount: Money.parse(l.amount) })) });

export function casPage(): HTMLElement {
  let accounts = SEED.map(a => [...a] as [string, string, AccountType]);
  let ledger: Ledger, posted: DraftEntry[] = [], pending: Draft[] = [], role: Role = 'ACCOUNTANT', year = 1, nextId = 1;
  // The year is a state machine (`cas-year`): OPEN → CLOSED → OPEN. A voucher's workflow is `cas-voucher` (DRAFT → PENDING → POSTED | SENT_BACK); see docs/STATE_MACHINES.md.
  const yearM = new Machine(CAS_YEAR, { role: 'ACCOUNTANT' as Role, pending: 0 });
  register(yearM); onDispose(() => unregister(yearM));
  const isClosed = () => yearM.is('CLOSED');
  const syncCtx = () => { yearM.ctx.role = role; yearM.ctx.pending = pending.length; };
  const vctx = (): VoucherCtx => ({ role, yearClosed: isClosed() });
  const buildChart = () => { const c = new ChartOfAccounts(); for (const [id, name, type] of accounts) c.add({ id, name, type }); return c; };
  const rebuild = () => { ledger = new Ledger(buildChart()); for (const e of posted) ledger.post(e); };
  rebuild();
  const root = h('div', { class: 'cas' }), msg = h('div', { class: 'formerr', role: 'alert' }), okmsg = h('div', { class: 'note good', hidden: true, role: 'status' });
  const flash = (text: string, good = false) => { msg.textContent = good ? '' : text; okmsg.hidden = !good; okmsg.textContent = good ? text : ''; announce(text); };
  const can = (what: 'enter' | 'verify') => (what === 'enter' ? role === 'ACCOUNTANT' : role === 'CHECKER');
  const nameOf = (code: string) => accounts.find(a => a[0] === code)?.[1] ?? '';
  const persist = () => { void setProject('cas', { accounts, posted: posted.map(ser), pending, role, year, closed: isClosed() } as unknown as Record<string, unknown>); };

  // ── voucher form
  const vtypeSel = h('select', { id: 'vtype', 'aria-label': 'Voucher type' }, h('option', { value: 'RECEIPT' }, 'Receipt voucher (money in)'), h('option', { value: 'PAYMENT' }, 'Payment voucher (money out)'), h('option', { value: 'JOURNAL' }, 'Journal voucher (no cash/bank)'));
  const date = h('input', { type: 'date', id: 'vdate', value: '2026-04-01', 'aria-label': 'Date' }), narr = h('input', { type: 'text', id: 'vnarr', placeholder: 'Narration', 'aria-label': 'Narration' });
  const linesBox = h('div', {}), hint = h('p', { class: 'hint' });
  const lineRow = (code = '', side: Side = 'DR') => {
    const c = h('input', { type: 'text', inputmode: 'numeric', maxlength: 4, placeholder: 'Code', 'aria-label': 'Account code', class: 'code', value: code, list: 'codes' });
    const nm = h('span', { class: 'acctname', 'aria-live': 'polite' }, code ? nameOf(code) : ''); c.addEventListener('input', () => { nm.textContent = nameOf(c.value) || (c.value.length === 4 ? 'Unknown code' : ''); });
    const sd = h('select', { 'aria-label': 'Debit or credit' }, h('option', { value: 'DR' }, 'Dr'), h('option', { value: 'CR' }, 'Cr')); sd.value = side;
    const amt = h('input', { type: 'text', inputmode: 'decimal', placeholder: 'Amount ₹', 'aria-label': 'Amount' });
    return h('div', { class: 'linerow cas-line' }, sd, c, amt, h('button', { type: 'button', class: 'ghost', 'aria-label': 'Remove line', onclick: (e: Event) => { if (linesBox.children.length > 2) (e.currentTarget as HTMLElement).parentElement!.remove(); } }, '✕'), nm);
  };
  const resetLines = () => { const t = vtypeSel.value as VType; mount(linesBox, ...(t === 'RECEIPT' ? [lineRow('1001', 'DR'), lineRow('', 'CR')] : t === 'PAYMENT' ? [lineRow('', 'DR'), lineRow('1001', 'CR')] : [lineRow('', 'DR'), lineRow('', 'CR')])); hint.textContent = t === 'RECEIPT' ? 'A receipt must DEBIT Cash or Bank.' : t === 'PAYMENT' ? 'A payment must CREDIT Cash or Bank.' : 'A journal voucher must not touch Cash or Bank.'; };
  vtypeSel.addEventListener('change', resetLines); resetLines();

  const readForm = (): Draft | null => {
    const lines: Draft['lines'] = [];
    for (const r of Array.from(linesBox.children)) { const [sd, c, a] = Array.from(r.querySelectorAll('select,input')) as HTMLInputElement[]; lines.push({ code: c!.value.trim(), side: sd!.value as Side, amount: a!.value.replace(/[₹,\s]/g, '') }); }
    return { id: nextId, vtype: vtypeSel.value as VType, date: date.value, narration: narr.value, lines };
  };
  /** Validation (machine): everything the CAS can check before a voucher is accepted. */
  const validate = (d: Draft): string[] => {
    const problems: string[] = [], chart = ledger.chart;
    const lines: DraftLine[] = [];
    for (const l of d.lines) {
      if (!/^\d{4}$/.test(l.code)) { problems.push(`"${l.code}" is not a 4-digit account code.`); continue; }
      let m: Money; try { m = Money.parse(l.amount === '' ? 'x' : l.amount); } catch { problems.push(`"${l.amount}" is not a valid amount for ${l.code}.`); continue; }
      lines.push({ accountId: l.code, side: l.side, amount: m });
    }
    if (problems.length) return problems;
    for (const i of validateEntry({ date: d.date, narration: d.narration, lines }, chart)) problems.push(i.message.replace(/Unknown account "(\d+)".*/, 'Account code $1 does not exist in the chart of accounts.'));
    const touchesCash = lines.some(l => CASH.includes(l.accountId));
    if (d.vtype === 'RECEIPT' && !lines.some(l => CASH.includes(l.accountId) && l.side === 'DR')) problems.push('A receipt voucher must debit Cash (1001) or Bank (1002).');
    if (d.vtype === 'PAYMENT' && !lines.some(l => CASH.includes(l.accountId) && l.side === 'CR')) problems.push('A payment voucher must credit Cash (1001) or Bank (1002).');
    if (d.vtype === 'JOURNAL' && touchesCash) problems.push('A journal voucher must not touch Cash or Bank — use a receipt or payment voucher.');
    return problems;
  };
  const toEntry = (d: Draft): DraftEntry => de({ date: d.date, narration: d.narration, lines: d.lines.map(l => ({ accountId: l.code, side: l.side, amount: l.amount })) });

  function enter() {
    const allowed = check(CAS_VOUCHER, 'DRAFT', 'SAVE', vctx());                // role / closed year
    if (!allowed.ok) { flash(allowed.reason!); return; }
    const d = readForm()!, p = validate(d);
    if (p.length) { flash('Voucher rejected — ' + p.join(' ')); return; }
    pending.push({ ...d, id: nextId++ }); narr.value = ''; for (const i of Array.from(linesBox.querySelectorAll('input:not(.code)'))) (i as HTMLInputElement).value = '';
    flash(`Voucher saved for verification (V${pending.at(-1)!.id}). It is not in the books until a checker verifies it.`, true); persist(); draw();
  }
  function verify(id: number) {
    const allowed = check(CAS_VOUCHER, 'PENDING', 'VERIFY', vctx());
    if (!allowed.ok) { flash(allowed.reason!); return; }
    const d = pending.find(x => x.id === id)!, p = validate(d);
    if (p.length) { flash('Cannot post — ' + p.join(' ')); return; }
    try { ledger.post(toEntry(d)); } catch (e) { flash(e instanceof EntryValidationError ? e.message : String(e)); return; }
    posted.push(toEntry(d)); pending = pending.filter(x => x.id !== id); flash(`Voucher V${id} verified and posted to the ledger.`, true); persist(); draw();
  }
  function reject(id: number) { const allowed = check(CAS_VOUCHER, 'PENDING', 'SEND_BACK', vctx()); if (!allowed.ok) { flash(allowed.reason!); return; } pending = pending.filter(x => x.id !== id); flash(`Voucher V${id} sent back and removed.`, true); persist(); draw(); }

  function closeYear() {
    syncCtx(); const may = check(CAS_YEAR, yearM.state, 'CLOSE', yearM.ctx);
    if (!may.ok) { flash(may.reason!); return; }
    const bal = (c: string) => ledger.balance(c);
    const rev = accounts.filter(a => a[2] === 'REVENUE' && bal(a[0]).isPositive()), exp = accounts.filter(a => a[2] === 'EXPENSE' && bal(a[0]).isPositive());
    const revTot = Money.sum(rev.map(a => bal(a[0]))), expTot = Money.sum(exp.map(a => bal(a[0])));
    const d = date.value || '2027-03-31', ent: [string, DraftLine[]][] = [];
    if (rev.length) ent.push(['Closing entry: income accounts transferred to Profit and Loss Summary', [...rev.map(a => ({ accountId: a[0], side: 'DR' as Side, amount: bal(a[0]) })), { accountId: '3900', side: 'CR', amount: revTot }]]);
    if (exp.length) ent.push(['Closing entry: expense accounts transferred to Profit and Loss Summary', [{ accountId: '3900', side: 'DR', amount: expTot }, ...exp.map(a => ({ accountId: a[0], side: 'CR' as Side, amount: bal(a[0]) }))]]);
    const net = revTot.sub(expTot);
    if (net.isPositive()) ent.push(['Closing entry: profit transferred to Capital', [{ accountId: '3900', side: 'DR', amount: net }, { accountId: '3001', side: 'CR', amount: net }]]);
    else if (net.isNegative()) ent.push(['Closing entry: loss transferred to Capital', [{ accountId: '3001', side: 'DR', amount: net.abs() }, { accountId: '3900', side: 'CR', amount: net.abs() }]]);
    const dw = bal('3002'); if (dw.isPositive()) ent.push(['Closing entry: drawings transferred to Capital', [{ accountId: '3001', side: 'DR', amount: dw }, { accountId: '3002', side: 'CR', amount: dw }]]);
    if (ent.length === 0) { flash('Nothing to close: there are no income, expense or drawings balances.'); return; }
    for (const [narration, lines] of ent) { const e: DraftEntry = { date: d, narration, lines }; ledger.post(e); posted.push(e); }
    yearM.send('CLOSE'); flash(`Year ${year} closed. ${net.isNegative() ? 'Loss' : 'Profit'} of ${net.abs().format()} moved to Capital.`, true); persist(); draw();
  }
  function nextYear() {
    syncCtx(); const may = check(CAS_YEAR, yearM.state, 'START_NEXT_YEAR', yearM.ctx);
    if (!may.ok) { flash(may.reason!); return; }
    const tb = ledger.trialBalance();
    const lines: DraftLine[] = tb.rows.map(r => ({ accountId: r.account.id, side: (r.debit.isPositive() ? 'DR' : 'CR') as Side, amount: r.debit.isPositive() ? r.debit : r.credit }));
    const keep = accounts; posted = [{ date: `${2026 + year}-04-01`, narration: `Opening entry for year ${year + 1}: closing balances brought forward`, lines }]; year++; yearM.send('START_NEXT_YEAR'); accounts = keep; rebuild(); flash(`Year ${year} started with an opening entry of the closing balances.`, true); persist(); draw();
  }

  function draw() {
    syncCtx();
    const eq = ledger.equation(), tb = ledger.trialBalance(), chart = ledger.chart;
    const bsRows = (t: AccountType) => accounts.filter(a => a[2] === t && !ledger.balance(a[0]).isZero()).map(a => ({ label: `${a[0]} ${a[1]}`, value: num(ledger.balance(a[0])), text: ledger.balance(a[0]).format() }));
    const revenue = bsRows('REVENUE'), expense = bsRows('EXPENSE');
    const profit = Money.sum(accounts.filter(a => a[2] === 'REVENUE').map(a => ledger.balance(a[0]))).sub(Money.sum(accounts.filter(a => a[2] === 'EXPENSE').map(a => ledger.balance(a[0]))));
    const acctSel = h('select', { id: 'ledgersel', 'aria-label': 'Account to view' }, ...accounts.map(a => h('option', { value: a[0] }, `${a[0]} ${a[1]}`)));
    const tview = h('div', {});
    const showT = () => { const rows = ledger.tAccount(acctSel.value); mount(tview, rows.length === 0 ? h('p', { class: 'empty' }, 'No postings to this account yet.') : h('div', { class: 'tablewrap' }, h('table', { class: 'data' }, h('thead', {}, h('tr', {}, ...['Voucher', 'Date', 'Narration', 'Dr (₹)', 'Cr (₹)', 'Balance'].map((t, i) => h('th', { scope: 'col', class: i >= 3 ? 'num' : '' }, t)))), h('tbody', {}, ...rows.map(r => h('tr', {}, h('td', {}, r.entryId), h('td', {}, r.date), h('td', {}, r.narration), h('td', { class: 'num' }, r.side === 'DR' ? r.amount.format() : ''), h('td', { class: 'num' }, r.side === 'CR' ? r.amount.format() : ''), h('td', { class: 'num' }, r.running.format()))))))); };
    acctSel.addEventListener('change', showT); showT();
    const newCode = h('input', { type: 'text', id: 'ncode', inputmode: 'numeric', maxlength: 4, placeholder: '4-digit code', 'aria-label': 'New account code' }), newName = h('input', { type: 'text', id: 'nname', placeholder: 'Account name', 'aria-label': 'New account name' });
    const addAcct = () => {
      const c = newCode.value.trim(), n = newName.value.trim(), g = GROUPS.find(x => x.digit === c[0]);
      if (!/^[1-5]\d{3}$/.test(c)) return flash('A code is 4 digits starting 1–5: 1 Assets, 2 Liabilities, 3 Capital, 4 Income, 5 Expenses.');
      if (accounts.some(a => a[0] === c)) return flash(`Code ${c} is already used by ${nameOf(c)}. Codes must be unique.`);
      if (!n) return flash('Give the account a name.');
      if (accounts.some(a => a[1].toLowerCase() === n.toLowerCase())) return flash(`An account named “${n}” already exists.`);
      if (!can('enter')) return flash('Your role cannot add accounts.');
      accounts.push([c, n, g!.type]); accounts.sort((a, b) => a[0].localeCompare(b[0])); rebuild(); flash(`Account ${c} ${n} added under ${g!.head}.`, true); persist(); draw();
    };

    const vBtn = (id: number) => { const b = h('button', { type: 'button', class: 'primary small', onclick: () => verify(id) }, 'Verify & post'); setAvailability(b, check(CAS_VOUCHER, 'PENDING', 'VERIFY', vctx()).reason ?? null); return b; };
    const rBtn = (id: number) => { const b = h('button', { type: 'button', class: 'small', onclick: () => reject(id) }, 'Send back'); setAvailability(b, check(CAS_VOUCHER, 'PENDING', 'SEND_BACK', vctx()).reason ?? null); return b; };
    const queueWhy = pending.length ? check(CAS_VOUCHER, 'PENDING', 'VERIFY', vctx()).reason : undefined;
    const enterWhy = check(CAS_VOUCHER, 'DRAFT', 'SAVE', vctx()).reason;
    const saveBtn = h('button', { type: 'button', class: 'primary', onclick: enter }, 'Save voucher for verification'); setAvailability(saveBtn, enterWhy ?? null);
    const closeBtn = h('button', { type: 'button', class: 'primary', onclick: closeYear }, 'Close the year (closing entries)'), nextBtn = h('button', { type: 'button', onclick: nextYear }, 'Start next year (opening entry)');
    setAvailability(closeBtn, yearM.why('CLOSE')); setAvailability(nextBtn, yearM.why('START_NEXT_YEAR'));
    const yearWhy = ([['Closing the year', yearM.why('CLOSE')], ['Starting the next year', yearM.why('START_NEXT_YEAR')]] as [string, string | null][]).filter((x): x is [string, string] => x[1] !== null);
    mount(root,
      h('header', { class: 'labhead' }, h('p', { class: 'eyebrow' }, 'Class XII · Option II'), h('h2', {}, 'Computerised Accounting Simulator'), h('p', { class: 'lead' }, 'Work like accounting software: coded accounts, validated vouchers, a maker–checker step, automatic posting, closing entries, an opening entry for next year, role-based access and a backup.'), h('p', { class: 'hint' }, `Year ${year}${isClosed() ? ' — CLOSED' : ''} · your work is saved on this device.`)),
      h('section', { class: 'panel' }, h('h3', {}, 'Security: who are you?'), h('div', { class: 'field' }, h('label', { for: 'role' }, 'Role'), (() => { const s = h('select', { id: 'role', onchange: (e: Event) => { role = (e.target as HTMLSelectElement).value as Role; persist(); draw(); } }, ...(Object.keys(ROLE_TEXT) as Role[]).map(r => h('option', { value: r }, ROLE_TEXT[r]))); s.value = role; return s; })()),
        h('p', { class: 'hint' }, 'Separating who enters from who verifies is a control: one person cannot create and approve the same voucher.')),
      msg, okmsg,
      h('section', { class: 'panel' }, h('h3', {}, '1 · Chart of accounts (codification and hierarchy of heads)'),
        h('div', { class: 'tablewrap' }, h('table', { class: 'data' }, h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Code'), h('th', { scope: 'col' }, 'Account'), h('th', { scope: 'col' }, 'Head'))), h('tbody', {}, ...accounts.map(a => h('tr', {}, h('th', { scope: 'row' }, a[0]), h('td', {}, a[1]), h('td', {}, GROUPS.find(g => g.digit === a[0][0])?.head ?? '')))))),
        h('div', { class: 'formgrid' }, h('label', {}, 'New code', newCode), h('label', {}, 'New account name', newName)), h('div', { class: 'actions' }, h('button', { type: 'button', onclick: addAcct }, '+ Add account'))),
      h('section', { class: 'panel' }, h('h3', {}, '2 · Enter a voucher (validation)'), h('datalist', { id: 'codes' }, ...accounts.map(a => h('option', { value: a[0] }, a[1]))),
        h('div', { class: 'formgrid' }, h('label', {}, 'Voucher type', vtypeSel), h('label', {}, 'Date', date)), h('label', { class: 'wide stack' }, 'Narration', narr), hint, linesBox,
        h('div', { class: 'actions' }, h('button', { type: 'button', onclick: () => linesBox.append(lineRow()) }, '+ Add line'), saveBtn), enterWhy ? h('p', { class: 'why' }, h('b', {}, 'Saving: '), enterWhy) : null),
      h('section', { class: 'panel' }, h('h3', {}, '3 · Verification queue (maker–checker)'), pending.length === 0 ? h('p', { class: 'empty' }, 'No vouchers waiting. Enter one above.') :
        h('ul', { class: 'queue' }, ...pending.map(d => h('li', {}, h('div', {}, h('b', {}, `V${d.id} · ${d.vtype.toLowerCase()} · ${d.date}`), ` ${d.narration} — `, d.lines.map(l => `${l.side} ${nameOf(l.code) || l.code} ${Money.parse(l.amount).format()}`).join(' · ')), h('div', { class: 'actions' }, vBtn(d.id), rBtn(d.id))))),
        queueWhy ? h('p', { class: 'why' }, h('b', {}, 'Verifying: '), queueWhy) : null, h('p', { class: 'hint' }, 'Validation is automatic (codes exist, Dr = Cr, voucher type rules). Verification is a person checking the voucher against its source document.')),
      h('section', { class: 'panel' }, h('h3', {}, '4 · Reports (updated automatically)'),
        h('h4', {}, 'Trial balance'), tb.rows.length === 0 ? h('p', { class: 'empty' }, 'Nothing posted yet.') : h('div', { class: 'tablewrap' }, h('table', { class: 'data' }, h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Account'), h('th', { scope: 'col', class: 'num' }, 'Debit'), h('th', { scope: 'col', class: 'num' }, 'Credit'))), h('tbody', {}, ...tb.rows.map(r => h('tr', {}, h('th', { scope: 'row' }, `${r.account.id} ${r.account.name}`), h('td', { class: 'num' }, r.debit.isZero() ? '' : r.debit.format()), h('td', { class: 'num' }, r.credit.isZero() ? '' : r.credit.format())))), h('tfoot', {}, h('tr', {}, h('td', {}, 'Total'), h('td', { class: 'num' }, tb.totalDebit.format()), h('td', { class: 'num' }, tb.totalCredit.format()))))),
        tb.rows.length ? h('p', { class: 'note ' + (tb.balanced ? 'good' : 'bad') }, tb.balanced ? '✓ Trial balance agrees.' : '✗ Trial balance does not agree.') : null,
        h('h4', {}, 'Profit and loss (before closing)'), revenue.length + expense.length === 0 ? h('p', { class: 'empty' }, isClosed() ? 'The year is closed; income and expense accounts are now nil.' : 'No income or expenses yet.') : h('p', {}, `Income ${Money.sum(accounts.filter(a => a[2] === 'REVENUE').map(a => ledger.balance(a[0]))).format()} − expenses ${Money.sum(accounts.filter(a => a[2] === 'EXPENSE').map(a => ledger.balance(a[0]))).format()} = ${profit.isNegative() ? 'loss' : 'profit'} ${profit.abs().format()}`),
        h('h4', {}, 'Balance sheet position'), renderBlock({ kind: 'equation', assets: bsRows('ASSET'), rhs: [...bsRows('LIABILITY'), { label: 'Capital (incl. profit, less drawings)', value: Math.max(0, num(eq.capital)), text: eq.capital.format() }], balanced: eq.balanced }),
        h('h4', {}, 'Ledger of one account'), h('div', { class: 'field' }, h('label', { for: 'ledgersel' }, 'Account'), acctSel), tview),
      h('section', { class: 'panel', 'data-machine': 'cas-year', 'data-state': yearM.state }, h('h3', {}, '5 · Year-end: adjusting, closing and opening entries'),
        h('p', {}, 'Adjusting entries (outstanding rent, depreciation …) are entered as ordinary journal vouchers above. Then the Checker closes the year: income and expense accounts are transferred to the Profit and Loss Summary, the result and drawings go to Capital, and the next year starts with an opening entry.'),
        h('div', { class: 'actions' }, closeBtn, nextBtn),
        yearWhy.length ? h('ul', { class: 'why-list', 'aria-label': 'Why some year-end actions are unavailable' }, ...yearWhy.map(([a, b]) => h('li', { class: 'why' }, h('b', {}, `${a}: `), b))) : null),
      h('section', { class: 'panel' }, h('h3', {}, '6 · Audit trail and backup'), ledger.auditTrail().length === 0 ? h('p', { class: 'empty' }, 'Every posting is logged here. Posted vouchers are never deleted.') : h('ol', { class: 'audit' }, ...ledger.entries().map(e => h('li', {}, `${e.id} · ${e.date} · ${e.narration}`))),
        h('div', { class: 'actions' }, h('button', { type: 'button', onclick: () => download('accounting-backup.json', JSON.stringify({ app: 'accounting-universe', kind: 'cas-backup', version: 1, year, closed: isClosed(), accounts, posted: posted.map(ser) }, null, 2), 'application/json') }, '⬇ Download backup'),
          h('button', { type: 'button', onclick: () => fileIn.click() }, '⬆ Restore from backup'), fileIn)));
    void chart; void normalSide; void TYPE_WORD;
  }
  const fileIn = h('input', { type: 'file', accept: 'application/json,.json', hidden: true, 'aria-label': 'Restore a backup', onchange: async (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
    try {
      const o = JSON.parse(await f.text());
      if (o?.app !== 'accounting-universe' || o?.kind !== 'cas-backup' || o?.version !== 1 || !Array.isArray(o.accounts) || !Array.isArray(o.posted)) throw new Error('This is not an Accounting Universe backup.');
      const oldA = accounts, oldP = posted;
      try { accounts = o.accounts; posted = o.posted.map(de); rebuild(); year = Number(o.year) || 1; yearM.send(o.closed ? 'RESTORE_CLOSED' : 'RESTORE_OPEN'); pending = []; flash(`Backup restored: ${posted.length} posted entries re-validated and re-posted.`, true); persist(); draw(); }
      catch (err) { accounts = oldA; posted = oldP; rebuild(); throw err; }
    } catch (err) { flash('Cannot restore: ' + (err instanceof Error ? err.message : String(err))); }
  } });
  draw();
  void recordSeen({ lab: 'xii-cas', tab: 'learn', t: Date.now() });
  void getProject('cas').then(s => {
    const d = s as unknown as Saved | null;
    if (!d || !Array.isArray(d.accounts) || !Array.isArray(d.posted)) return;
    try { accounts = d.accounts; posted = d.posted.map(de as never); rebuild(); pending = d.pending ?? []; role = d.role ?? 'ACCOUNTANT'; year = d.year ?? 1; yearM.send(d.closed ? 'RESTORE_CLOSED' : 'RESTORE_OPEN'); nextId = Math.max(1, ...pending.map(p => p.id + 1)); draw(); void recordSeen({ lab: 'xii-cas', tab: 'example', t: Date.now() }); }
    catch { accounts = SEED.map(a => [...a] as [string, string, AccountType]); posted = []; rebuild(); }
  });
  return root;
}
