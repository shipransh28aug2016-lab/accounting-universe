import { starterChartClassXI, type Side } from '../../../../packages/engine/src';
import { h, mount } from '../dom';
import { recordAttempt, recordSeen } from '../store';
import { announce } from '../ui';
import { TYPE_WORD, ruleText } from '../rules';

interface Q { text: string; dr: string; cr: string; why: string }
const QS: Q[] = [
  { text: 'The owner starts the business by putting in ₹1,00,000 cash.', dr: 'cash', cr: 'capital', why: 'Cash (asset) comes in; the owner’s claim (capital) rises.' },
  { text: 'Bought machinery for ₹40,000 and paid in cash.', dr: 'machinery', cr: 'cash', why: 'Machinery is a fixed asset, not goods for resale — so it is not “Purchases”.' },
  { text: 'Bought goods on credit from a supplier for ₹20,000.', dr: 'purchases', cr: 'creditors', why: 'Goods bought for resale go to Purchases; the supplier is a creditor.' },
  { text: 'Sold goods for cash ₹15,000.', dr: 'cash', cr: 'sales', why: 'Cash (asset) rises; income (sales) is credited.' },
  { text: 'Sold goods on credit to a customer for ₹12,000.', dr: 'debtors', cr: 'sales', why: 'The customer owes us (a debtor, an asset); sales is income.' },
  { text: 'Paid rent ₹5,000 in cash.', dr: 'rent', cr: 'cash', why: 'Rent is an expense (debit); cash falls (credit).' },
  { text: 'Paid salary ₹8,000 in cash.', dr: 'salary', cr: 'cash', why: 'Salary is an expense; expenses increase on the debit side.' },
  { text: 'The owner took ₹3,000 cash for household use.', dr: 'drawings', cr: 'cash', why: 'Personal withdrawals are drawings — not an expense of the business.' },
  { text: 'Received ₹6,000 in cash from a debtor.', dr: 'cash', cr: 'debtors', why: 'Cash rises; the debtor’s balance (an asset) falls.' },
  { text: 'Paid ₹10,000 in cash to a creditor.', dr: 'creditors', cr: 'cash', why: 'The liability falls (debit) and cash falls (credit).' },
  { text: 'Took a loan of ₹50,000 from the bank; it was credited to the bank account.', dr: 'bank', cr: 'bank-loan', why: 'Bank balance (asset) rises; the loan is a liability.' },
  { text: 'Deposited ₹7,000 cash into the bank.', dr: 'bank', cr: 'cash', why: 'One asset rises (bank) while another falls (cash).' },
  { text: 'Received ₹1,200 interest in cash.', dr: 'cash', cr: 'interest-received', why: 'Interest received is income (credit); cash rises (debit).' },
  { text: 'Charged depreciation ₹4,000 on machinery (shown as an expense, machinery reduced).', dr: 'depreciation', cr: 'machinery', why: 'Depreciation is an expense; the asset’s value falls.' },
  { text: 'A debtor could not pay; ₹2,500 is written off as bad debt.', dr: 'bad-debts', cr: 'debtors', why: 'Bad debt is an expense; the debtor (asset) is reduced.' },
];

export function trainerPage(): HTMLElement {
  const chart = starterChartClassXI();
  const order = [...QS].sort(() => Math.random() - 0.5);
  let i = 0, score = 0, answered = false;
  const root = h('div', { class: 'trainer' });
  void recordSeen({ lab: 'xi-trainer', tab: 'learn', t: Date.now() });
  const opts = (sel: HTMLSelectElement) => { sel.append(h('option', { value: '' }, '— choose —'), ...chart.list().map(a => h('option', { value: a.id }, `${a.name} (${TYPE_WORD[a.type]})`))); return sel; };

  function draw() {
    if (i >= order.length) {
      mount(root, head(), h('section', { class: 'panel' }, h('h3', {}, 'Round complete'), h('p', { class: 'lead' }, `You got ${score} of ${order.length} fully right.`), h('p', {}, score === order.length ? 'Excellent — now try the Journal → Ledger page with your own entries.' : 'Open the lab’s rule cards again and retry the ones you missed.'),
        h('div', { class: 'actions' }, h('button', { type: 'button', class: 'primary', onclick: () => { order.sort(() => Math.random() - 0.5); i = 0; score = 0; draw(); } }, 'Play again'), h('a', { class: 'button', href: '#/ledger' }, 'Open the Ledger lab'))));
      return;
    }
    answered = false;
    const q = order[i]!;
    const dr = opts(h('select', { id: 'dr' })), cr = opts(h('select', { id: 'cr' }));
    const out = h('div', { 'aria-live': 'polite' }), next = h('button', { type: 'button', class: 'primary', hidden: true, onclick: () => { i++; draw(); } }, i + 1 === order.length ? 'Finish' : 'Next →');
    const check = () => {
      if (answered) return;
      if (!dr.value || !cr.value) { mount(out, h('p', { class: 'note warn', role: 'alert' }, 'Choose an account for both the debit and the credit side.')); return; }
      answered = true;
      const okDr = dr.value === q.dr, okCr = cr.value === q.cr, ok = okDr && okCr;
      if (ok) score++;
      const mistakes: string[] = [];
      if (!okDr) mistakes.push(`Debited ${chart.get(dr.value).name} instead of ${chart.get(q.dr).name}`);
      if (!okCr) mistakes.push(`Credited ${chart.get(cr.value).name} instead of ${chart.get(q.cr).name}`);
      void recordAttempt({ t: Date.now(), skill: 'rules-trainer', clause: 'XI.2.rules', seed: QS.indexOf(q) + 1, mode: 'BEGINNER', marks: ok ? 1 : 0, outOf: 1, hintsUsed: 0, mistakes: ok ? [] : [mistakes.join('; ')], correctParts: Number(okDr) + Number(okCr), parts: 2 });
      void recordSeen({ lab: 'xi-trainer', tab: 'example', t: Date.now() });
      dr.disabled = true; cr.disabled = true; next.hidden = false;
      mount(out, h('p', { class: 'note ' + (ok ? 'good' : 'bad'), role: 'status' }, ok ? '✓ Correct.' : `Not quite. ${mistakes.join('. ')}.`), h('ul', {}, h('li', {}, ruleText(chart, q.dr, 'DR' as Side)), h('li', {}, ruleText(chart, q.cr, 'CR' as Side))), h('p', { class: 'hint' }, q.why));
      announce(ok ? 'Correct' : 'Not quite');
    };
    mount(root, head(), h('section', { class: 'panel' }, h('p', { class: 'eyebrow' }, `Question ${i + 1} of ${order.length} · score ${score}`), h('p', { class: 'stem' }, q.text),
      h('form', { onsubmit: (e: Event) => { e.preventDefault(); check(); } }, h('div', { class: 'field' }, h('label', { for: 'dr' }, 'Debit (Dr.)'), dr), h('div', { class: 'field' }, h('label', { for: 'cr' }, 'Credit (Cr.)'), cr), h('div', { class: 'actions' }, h('button', { type: 'submit', class: 'primary' }, 'Check'), next)), out));
  }
  const head = () => h('header', { class: 'labhead' }, h('p', { class: 'eyebrow' }, 'Class XI'), h('h2', {}, 'Debit & Credit Trainer'), h('p', { class: 'lead' }, 'For each transaction choose the account to debit and the account to credit. After you answer you see the rule that decides it.'),
    h('p', { class: 'hint' }, 'Rule of thumb: assets and expenses (and drawings) increase on the DEBIT side; liabilities, capital and income increase on the CREDIT side. Decreases are the opposite.'));
  draw();
  return root;
}
