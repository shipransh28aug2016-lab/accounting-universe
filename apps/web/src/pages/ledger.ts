import { EntryValidationError, Ledger, LedgerError, Money, starterChartClassXI, normalSide, type DraftLine, type Side } from '../../../../packages/engine/src';
import { h, mount, reducedMotion } from '../dom';
import { renderBlock } from '../render';
import { num } from '../inputs';
import { announce } from '../ui';
import { Machine } from '../../../../packages/engine/src';
import { LEDGER_PLAYER } from '../../../../packages/curriculum/src';
import { onDispose, setAvailability, stamp, track, unregister } from '../machine-dom';
import { TYPE_WORD, ruleText } from '../rules';
import { recordSeen } from '../store';

interface Step { narration: string; lines: { a: string; s: Side; amt: string }[] }
const SCENARIO: Step[] = [
  { narration: 'Ravi starts a business with ₹1,00,000 cash', lines: [{ a: 'cash', s: 'DR', amt: '100000' }, { a: 'capital', s: 'CR', amt: '100000' }] },
  { narration: 'Bought machinery for cash ₹30,000', lines: [{ a: 'machinery', s: 'DR', amt: '30000' }, { a: 'cash', s: 'CR', amt: '30000' }] },
  { narration: 'Purchased goods on credit ₹20,000', lines: [{ a: 'purchases', s: 'DR', amt: '20000' }, { a: 'creditors', s: 'CR', amt: '20000' }] },
  { narration: 'Sold goods for cash ₹35,000', lines: [{ a: 'cash', s: 'DR', amt: '35000' }, { a: 'sales', s: 'CR', amt: '35000' }] },
  { narration: 'Paid rent ₹5,000', lines: [{ a: 'rent', s: 'DR', amt: '5000' }, { a: 'cash', s: 'CR', amt: '5000' }] },
  { narration: 'Ravi withdrew ₹3,000 for personal use', lines: [{ a: 'drawings', s: 'DR', amt: '3000' }, { a: 'cash', s: 'CR', amt: '3000' }] },
  { narration: 'Paid creditors ₹10,000', lines: [{ a: 'creditors', s: 'DR', amt: '10000' }, { a: 'cash', s: 'CR', amt: '10000' }] },
];

export function ledgerPage(): HTMLElement {
  let ledger = new Ledger(starterChartClassXI());
  let step = 0, timer: number | undefined, speed = 1;
  const chart = ledger.chart;
  const out = h('div', { class: 'ledger-out' });
  const explain = h('div', { class: 'explain', 'aria-live': 'polite' });
  const err = h('div', { class: 'formerr', role: 'alert' });
  const status = h('span', { class: 'status' });
  const date = h('input', { type: 'date', value: '2026-04-01', id: 'je-date', 'aria-label': 'Date' });
  const narr = h('input', { type: 'text', id: 'je-narr', placeholder: 'Narration, e.g. Paid rent', 'aria-label': 'Narration' });
  const linesBox = h('div', { class: 'lines' });
  const accOptions = () => chart.list().map(a => h('option', { value: a.id }, `${a.name} (${TYPE_WORD[a.type]})`));
  const lineRow = (side: Side = 'DR') => {
    const sel = h('select', { 'aria-label': 'Account' }, ...accOptions());
    const sd = h('select', { 'aria-label': 'Debit or credit' }, h('option', { value: 'DR' }, 'Dr'), h('option', { value: 'CR' }, 'Cr'));
    sd.value = side;
    const amt = h('input', { type: 'text', inputmode: 'decimal', placeholder: 'Amount ₹', 'aria-label': 'Amount' });
    const rm = h('button', { type: 'button', class: 'ghost', 'aria-label': 'Remove line', onclick: () => { if (linesBox.children.length > 2) row.remove(); } }, '✕');
    const row = h('div', { class: 'linerow' }, sd, sel, amt, rm);
    return row;
  };
  linesBox.append(lineRow('DR'), lineRow('CR'));

  const ruleOf = (a: string, s: Side) => ruleText(chart, a, s);

  function post(date_: string, narration: string, lines: DraftLine[], why?: string[]) {
    try {
      const e = ledger.post({ date: date_, narration, lines });
      err.textContent = '';
      explain.replaceChildren(h('h4', {}, `${e.id}: ${narration}`), h('ul', {}, ...(why ?? lines.map(l => ruleOf(l.accountId, l.side))).map(t => h('li', {}, t))));
      announce(`Posted ${e.id}. ${narration}`);
      draw();
      return true;
    } catch (ex) {
      if (ex instanceof EntryValidationError) err.textContent = 'Not posted — ' + ex.issues.map(i => i.message).join('; ');
      else if (ex instanceof LedgerError) err.textContent = ex.message;
      else throw ex;
      announce(err.textContent!);
      return false;
    }
  }

  function manual() {
    const lines: DraftLine[] = [];
    for (const r of Array.from(linesBox.children)) {
      const [sd, sel, amt] = Array.from(r.querySelectorAll('select,input')) as (HTMLSelectElement | HTMLInputElement)[];
      const raw = amt!.value.replace(/[₹,\s]/g, '');
      let m: Money;
      try { m = Money.parse(raw === '' ? 'x' : raw); } catch { err.textContent = `"${amt!.value}" is not a valid amount.`; return; }
      lines.push({ accountId: sel!.value, side: sd!.value as Side, amount: m });
    }
    if (post(date.value, narr.value, lines)) { narr.value = ''; for (const i of Array.from(linesBox.querySelectorAll('input'))) i.value = ''; }
  }

  // ── the animated story, driven by the `ledger-player` machine (see docs/STATE_MACHINES.md) ──
  const player = new Machine(LEDGER_PLAYER);
  const say = (t: string) => { status.textContent = t; };
  const interval = () => (reducedMotion() ? 2400 : 1800) / speed;
  const clearTimer = () => { if (timer !== undefined) { clearInterval(timer); timer = undefined; } };
  const startTimer = () => { clearTimer(); timer = window.setInterval(() => { if (player.send('TICK').ok) postNext(); }, interval()); };
  /** Post the next transaction of the story; tell the machine when the story is complete. */
  function postNext() {
    void recordSeen({ lab: 'xi-ledger', tab: 'example', t: Date.now() });
    const s = SCENARIO[step];
    if (!s) { player.send('DONE'); return; }
    post('2026-04-' + String(step + 1).padStart(2, '0'), s.narration, s.lines.map(l => ({ accountId: l.a, side: l.s, amount: Money.parse(l.amt) })));
    step++; say(`Step ${step} of ${SCENARIO.length}`);
    if (step >= SCENARIO.length) player.send('DONE');
  }
  player.subscribe(m => {                      // the ONLY place that starts/stops the timer and labels the buttons
    if (m.is('PLAYING')) startTimer(); else clearTimer();
    playBtn.textContent = m.is('PLAYING') ? '⏸ Pause' : m.is('FINISHED') ? '↺ Replay' : '▶ Play';
    playBtn.setAttribute('aria-pressed', String(m.is('PLAYING')));
    setAvailability(stepBtn, m.why('STEP'));
    stamp(controls, m);
  });
  onDispose(() => { player.send('DISPOSE'); unregister(player); });   // leaving the page must stop the timer
  function onPlayClick() {
    if (player.is('PLAYING')) { player.send('PAUSE'); return; }
    if (player.is('FINISHED')) { resetBooks(); if (player.send('REPLAY').ok) postNext(); return; }
    const r = player.send('PLAY'); if (!r.ok) { say(r.reason!); return; }
    postNext();
  }
  function onStepClick() { const r = player.send('STEP'); if (!r.ok) { say(r.reason!); return; } postNext(); }
  function resetBooks() { ledger = new Ledger(chart); step = 0; say(''); err.textContent = ''; explain.replaceChildren(); draw(); }
  function onReset() { player.send('RESET'); resetBooks(); announce('Reset. The books are empty.'); }

  const playBtn = h('button', { type: 'button', class: 'primary', 'aria-pressed': 'false', onclick: onPlayClick }, '▶ Play');
  const stepBtn = h('button', { type: 'button', onclick: onStepClick }, '⏭ Step');
  const speedSel = h('select', { 'aria-label': 'Speed', onchange: (e: Event) => { speed = Number((e.target as HTMLSelectElement).value); if (player.send('SPEED').ok && player.is('PLAYING')) startTimer(); } },
    h('option', { value: '0.5' }, '0.5× slower'), h('option', { value: '1', selected: true }, '1× normal'), h('option', { value: '2' }, '2× faster'));
  const controls = h('div', { class: 'controls', role: 'group', 'aria-label': 'Animation controls' },
    playBtn, stepBtn, h('button', { type: 'button', onclick: onReset }, '↺ Reset'), h('label', { class: 'inl' }, 'Speed ', speedSel), status);
  track(controls, player);

  function draw() {
    const eq = ledger.equation(), tb = ledger.trialBalance();
    const balOf = (t: string) => chart.list().filter(a => a.type === t && !ledger.balance(a.id).isZero()).map(a => ({ label: a.name, value: num(ledger.balance(a.id)), text: ledger.balance(a.id).format() }));
    const tAcc = chart.list().filter(a => ledger.tAccount(a.id).length > 0).map(a => {
      const rows = ledger.tAccount(a.id), drs = rows.filter(r => r.side === 'DR'), crs = rows.filter(r => r.side === 'CR');
      const bal = ledger.balance(a.id), nat = normalSide(a.type);
      return h('div', { class: 't-account' }, h('h4', {}, a.name),
        h('div', { class: 'tcols' },
          h('ul', { 'aria-label': 'Debit side' }, h('li', { class: 'th' }, 'Dr.'), ...drs.map(r => h('li', {}, h('span', {}, r.entryId.slice(-2)), h('b', {}, r.amount.format())))),
          h('ul', { 'aria-label': 'Credit side' }, h('li', { class: 'th' }, 'Cr.'), ...crs.map(r => h('li', {}, h('span', {}, r.entryId.slice(-2)), h('b', {}, r.amount.format()))))),
        h('div', { class: 'tbal' }, `Balance: ${bal.format()} ${bal.isZero() ? '' : (bal.isNegative() ? (nat === 'DR' ? 'Cr' : 'Dr') : nat === 'DR' ? 'Dr' : 'Cr')}`));
    });
    const liab = balOf('LIABILITY');
    const capitalParts = [...balOf('CAPITAL'), ...balOf('REVENUE'), ...balOf('EXPENSE').map(x => ({ ...x, label: 'less ' + x.label })), ...balOf('DRAWINGS').map(x => ({ ...x, label: 'less ' + x.label }))];
    const entries = ledger.entries();
    mount(out,
      h('section', { class: 'panel' }, h('h3', {}, 'Accounting equation'), renderBlock({ kind: 'equation', assets: balOf('ASSET'), rhs: [...liab, { label: 'Capital (incl. profit, less drawings)', value: Math.max(0, num(eq.capital)), text: eq.capital.format() }], balanced: eq.balanced }),
        h('p', { class: 'eqline' }, `Assets ${eq.assets.format()} = Liabilities ${eq.liabilities.format()} + Capital ${eq.capital.format()}`), capitalParts.length ? h('details', {}, h('summary', {}, 'What is inside capital?'), h('ul', {}, ...capitalParts.map(x => h('li', {}, `${x.label}: ${x.text}`)))) : null),
      h('section', { class: 'panel' }, h('h3', {}, 'Journal'), entries.length === 0 ? h('p', { class: 'empty' }, 'No entries yet — press Play or post one yourself.') :
        h('div', { class: 'tablewrap' }, h('table', { class: 'data journal-list' }, h('thead', {}, h('tr', {}, ...['No.', 'Date', 'Particulars', 'Dr (₹)', 'Cr (₹)', ''].map((t, i) => h('th', { scope: 'col', class: i === 3 || i === 4 ? 'num' : '' }, t)))),
          h('tbody', {}, ...entries.flatMap(e => [
            ...[...e.lines.filter(l => l.side === 'DR'), ...e.lines.filter(l => l.side === 'CR')].map((l, i) => h('tr', { class: ledger.isReversed(e.id) ? 'reversed' : '' }, h('td', {}, i === 0 ? e.id : ''), h('td', {}, i === 0 ? e.date : ''), h('td', { class: l.side === 'CR' ? 'indent' : '' }, `${l.side === 'CR' ? 'To ' : ''}${chart.get(l.accountId).name}`), h('td', { class: 'num' }, l.side === 'DR' ? l.amount.format() : ''), h('td', { class: 'num' }, l.side === 'CR' ? l.amount.format() : ''),
              h('td', {}, i === 0 && !e.reversalOf && !ledger.isReversed(e.id) ? h('button', { type: 'button', class: 'ghost small', 'aria-label': `Reverse ${e.id}`, onclick: () => { const reason = prompt(`Why are you reversing ${e.id}?`, 'entered in error'); if (reason) { try { ledger.reverse(e.id, { date: e.date, reason }); err.textContent = ''; announce(`${e.id} reversed`); draw(); } catch (ex) { err.textContent = (ex as Error).message; } } } }, 'Reverse') : i === 0 && ledger.isReversed(e.id) ? h('span', { class: 'tag' }, 'reversed') : null))),
            h('tr', { class: 'narr' }, h('td', { colspan: 6 }, `(${e.narration})`))])))),
        entries.length ? h('p', { class: 'hint' }, 'Posted entries can never be edited or deleted. A mistake is fixed with a linked reversal, so the history stays honest.') : null),
      h('section', { class: 'panel' }, h('h3', {}, 'Ledger (T-accounts)'), tAcc.length ? h('div', { class: 'taccounts' }, ...tAcc) : h('p', { class: 'empty' }, 'Accounts appear here as soon as they are used.')),
      h('section', { class: 'panel' }, h('h3', {}, 'Trial balance (balance method)'), tb.rows.length === 0 ? h('p', { class: 'empty' }, 'Nothing to total yet.') :
        h('div', { class: 'tablewrap' }, h('table', { class: 'data' }, h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Account'), h('th', { scope: 'col', class: 'num' }, 'Debit (₹)'), h('th', { scope: 'col', class: 'num' }, 'Credit (₹)'))),
          h('tbody', {}, ...tb.rows.map(r => h('tr', {}, h('th', { scope: 'row' }, r.account.name), h('td', { class: 'num' }, r.debit.isZero() ? '' : r.debit.format()), h('td', { class: 'num' }, r.credit.isZero() ? '' : r.credit.format())))),
          h('tfoot', {}, h('tr', {}, h('td', {}, 'Total'), h('td', { class: 'num' }, tb.totalDebit.format()), h('td', { class: 'num' }, tb.totalCredit.format()))))),
        tb.rows.length ? h('p', { class: 'note ' + (tb.balanced ? 'good' : 'bad') }, tb.balanced ? '✓ Trial balance agrees: total debit equals total credit.' : '✗ Trial balance does NOT agree.') : null),
      h('section', { class: 'panel' }, h('h3', {}, 'Audit trail'), ledger.auditTrail().length === 0 ? h('p', { class: 'empty' }, 'Every post and reversal is recorded here.') : h('ol', { class: 'audit' }, ...ledger.auditTrail().map(a => h('li', {}, `${a.type === 'POST' ? 'Posted' : 'Reversed'} ${a.entryId}${a.target ? ` (cancels ${a.target}: ${a.reason})` : ''}`)))),
    );
  }
  draw();
  void recordSeen({ lab: 'xi-ledger', tab: 'learn', t: Date.now() });
  return h('div', { class: 'ledger-lab' },
    h('header', { class: 'labhead' }, h('p', { class: 'eyebrow' }, 'Class XI'), h('h2', {}, 'Journal → Ledger → Trial Balance'), h('p', { class: 'lead' }, 'Every transaction has two sides. Watch them travel from the journal to the ledger and into the trial balance.')),
    h('section', { class: 'panel' }, h('h3', {}, 'Watch a business happen'), h('p', {}, 'Ravi’s first week, one transaction at a time. Each step shows the rule of debit and credit that applies.'), controls, explain),
    h('section', { class: 'panel' }, h('h3', {}, 'Post an entry yourself'), h('p', { class: 'hint' }, 'Total debit must equal total credit. Try an unbalanced entry to see what the engine says.'),
      h('div', { class: 'formgrid' }, h('label', {}, 'Date', date), h('label', { class: 'wide' }, 'Narration', narr)), linesBox,
      h('div', { class: 'controls' }, h('button', { type: 'button', onclick: () => linesBox.append(lineRow('DR')) }, '+ Add line'), h('button', { type: 'button', class: 'primary', onclick: manual }, 'Post entry')), err),
    out);
}
