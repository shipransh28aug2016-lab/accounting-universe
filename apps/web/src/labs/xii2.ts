import {
  ExtrasError, Fraction, Money, actDefaults, allocate, appropriate, balanceSheet, callsInAdvance, currentRatio, debtEquityRatio, depreciationSchedule, interestPA, isBalanced, loanSchedule,
  partnerAccounts, pct, purchaseOfBusiness, quickRatio, reconcile, revaluation, statementOfProfitAndLoss, type Illustration, type RevalItem, type BrsKind,
} from '../../../../packages/engine/src';
import { InputError, type Block, type Field, type Lab } from '../spec';
import { money, num, optMoney, percent, ratio, whole } from '../inputs';
import { note, R, names } from './common';

const guard = <T>(fn: () => T): T => { try { return fn(); } catch (e) { if (e instanceof ExtrasError) throw new InputError(e.message); throw e; } };
const ids2 = (n: number) => names(n) as string[];
const shareMap = (ids: readonly string[], fr: Fraction[]) => Object.fromEntries(ids.map((id, i) => [id, fr[i]!])) as Record<string, Fraction>;
const decimalRate = (v: Record<string, string>, id: string, label: string): Fraction => {
  const m = /^\s*(\d+)(?:\.(\d{1,2}))?\s*%?\s*$/.exec(v[id] ?? '');
  if (!m) throw new InputError(`${label} must be a number like 12 or 8.5.`, id);
  const frac = m[2] ?? ''; return Fraction.of(BigInt(m[1]! + frac), 10n ** BigInt(frac.length));
};

// ───────────────────────────── Partnership fundamentals ─────────────────────────────
export const fundamentals: Lab = {
  id: 'xii-fundamentals', cls: 'XII', title: 'Partnership Fundamentals Lab', clauses: ['XII.1.fundamentals'], skills: [],
  summary: 'What happens when the partnership deed is silent? Apply the Indian Partnership Act’s default rules and compare them with a deed.',
  concept: [
    'A partnership deed can fix the profit-sharing ratio, interest on capital, salaries and so on. Where the deed says nothing, the Indian Partnership Act, 1932 fills the gap.',
    'Default rules used in this course: profits and losses are shared EQUALLY; no partner gets a salary; no interest on capital; no interest is charged on drawings; a partner who lends money to the firm gets 6% per annum interest, and that interest is a charge against profit — paid before profit is shared.',
  ],
  realWorld: 'Three friends open a café on a handshake with no written deed. One of them also lends the café ₹50,000. At the end of the year the law, not their conversation, decides how profit is split.',
  fields: [
    { id: 'profit', label: 'Net profit / (loss) before the partner’s loan interest (₹)', type: 'money' },
    { id: 'n', label: 'Number of partners', type: 'select', options: [{ value: '2', label: '2' }, { value: '3', label: '3' }] },
    { id: 'lp', label: 'Partner who lent money to the firm', type: 'select', group: 'Loan from a partner', options: [{ value: '', label: 'None' }, { value: 'A', label: 'A' }, { value: 'B', label: 'B' }, { value: 'C', label: 'C' }] },
    { id: 'la', label: 'Loan amount (₹)', type: 'money' }, { id: 'lm', label: 'Months the loan was outstanding', type: 'int' },
    { id: 'deed', label: 'For comparison: ratio the partners THOUGHT they had (optional, e.g. 3:2:1)', type: 'ratio', group: 'Compare' },
  ],
  example: { profit: '90000', n: '3', lp: 'C', la: '50000', lm: '12', deed: '3:2:1' },
  walkthrough: ['The loan interest is 6% × ₹50,000 × 12/12 = ₹3,000. It is a charge, so profit to share = ₹90,000 − ₹3,000 = ₹87,000.', 'Under the Act each of the 3 partners gets one third: ₹29,000.', 'Partner C also receives the ₹3,000 loan interest, so C’s total is ₹32,000.', 'Had the partners agreed 3:2:1, shares would differ — but with no deed, the Act’s equal sharing applies.'],
  compute: v => {
    const n = whole(v, 'n', 'Partners', 2, 3), ids = ids2(n), lp = (v.lp ?? '').trim();
    const la = optMoney(v, 'la', 'Loan');
    if (lp && (!la.isPositive() || !/^\d+$/.test(v.lm ?? ''))) throw new InputError('Enter the loan amount and the months it was outstanding.', 'la');
    if (lp && !ids.includes(lp)) throw new InputError(`Partner ${lp} is not one of the ${n} partners.`, 'lp');
    const r = guard(() => actDefaults({ netProfit: money(v, 'profit', 'Net profit', { allowNegative: true }), partners: ids, loans: lp ? [{ partner: lp, amount: la, months: whole(v, 'lm', 'Months', 1, 1200) }] : [] }));
    const total = (i: string) => r.shares[i]!.add(r.loanInterest[i] ?? Money.ZERO);
    const blocks: Block[] = [
      { kind: 'table', caption: 'Division under the Partnership Act, 1932 (no deed)', head: ['', ...ids, 'Total'], numeric: ids.map((_, k) => k + 1).concat(ids.length + 1),
        rows: [['Interest on partner’s loan (6% p.a.)', ...ids.map(i => R(r.loanInterest[i] ?? Money.ZERO)), R(Money.sum(Object.values(r.loanInterest)))], ['Share of profit (equal)', ...ids.map(i => R(r.shares[i]!)), R(r.distributable)], ['Total to each partner', ...ids.map(i => R(total(i))), R(Money.sum(ids.map(total)))]] },
      { kind: 'ratio', title: 'Profit shared by the Act', rows: [{ label: 'Act', segments: ids.map(i => ({ name: i, value: 1 / n, text: `1/${n}` })) }] },
      note('Interest on the loan is paid even if the firm makes a loss — it is a charge, not a share of profit. No salary, interest on capital or interest on drawings exists unless the deed provides for it.', 'info'),
    ];
    if ((v.deed ?? '').trim()) {
      const fr = ratio(v, 'deed', 'Ratio', n), deedShares = allocate(r.distributable.abs(), fr).map(m => (r.distributable.isNegative() ? m.neg() : m));
      blocks.push({ kind: 'table', caption: 'If the partners had agreed their ratio in a deed', head: ['', ...ids], numeric: ids.map((_, k) => k + 1), rows: [['Share under the deed', ...deedShares.map(R)], ['Share under the Act (no deed)', ...ids.map(i => R(r.shares[i]!))], ['Difference', ...ids.map((i, k) => R(deedShares[k]!.sub(r.shares[i]!)))]] });
    }
    return blocks;
  },
};

// ───────────────────────────── Fixed vs fluctuating capital ─────────────────────────────
export const capitalMethods: Lab = {
  id: 'xii-capital', cls: 'XII', title: 'Fixed vs Fluctuating Capital Lab', clauses: ['XII.1.capital'], skills: [],
  summary: 'Run the same year through both capital methods and see the capital and current accounts — the totals always agree.',
  concept: [
    'Fluctuating capital: all items of the year (interest, salary, drawings, profit) go through the single capital account, so its balance changes each year.',
    'Fixed capital: the capital account stays at the agreed amount. Interest, salary, drawings and profit go to a separate Current Account, and the partner’s total claim is capital + current account.',
    'If a question does not say, assume fluctuating. Both methods always give the same total for each partner.',
  ],
  realWorld: 'A firm keeps each partner’s ₹5,00,000 investment untouched in a fixed capital account, while the yearly ups and downs of profit and drawings are tracked in a current account — so the original investment is always visible.',
  fields: [
    { id: 'profit', label: 'Net profit before appropriations (₹)', type: 'money' }, { id: 'ratio', label: 'Profit-sharing ratio A:B', type: 'ratio' },
    { id: 'capA', label: 'Opening capital of A (₹)', type: 'money', group: 'Partners' }, { id: 'capB', label: 'Opening capital of B (₹)', type: 'money' },
    { id: 'drA', label: 'Drawings of A (₹)', type: 'money' }, { id: 'drB', label: 'Drawings of B (₹)', type: 'money' }, { id: 'salA', label: 'Salary to A (₹)', type: 'money' }, { id: 'salB', label: 'Salary to B (₹)', type: 'money' },
    { id: 'ioc', label: 'Interest on capital (% p.a., blank = none)', type: 'percent', group: 'Rates' }, { id: 'iod', label: 'Interest on drawings (% p.a., 6 months average; blank = none)', type: 'percent' },
  ],
  example: { profit: '100000', ratio: '3:2', capA: '300000', capB: '200000', drA: '20000', drB: '10000', salA: '12000', salB: '0', ioc: '10', iod: '6' },
  walkthrough: ['Interest on capital at 10%: A ₹30,000, B ₹20,000. Interest on drawings (6 months at 6%): A ₹600, B ₹300 — charged to the partners.', 'Profit to share = 1,00,000 + 900 − 50,000 − 12,000 salary = ₹38,900 → A (3/5) ₹23,340, B (2/5) ₹15,560.', 'Fluctuating: A’s capital = 3,00,000 + 30,000 + 12,000 + 23,340 − 20,000 − 600 = ₹3,44,740.', 'Fixed: A’s capital stays ₹3,00,000 and the current account shows ₹44,740 — the same total.'],
  compute: v => {
    const ids = ids2(2), shares = shareMap(ids, ratio(v, 'ratio', 'Ratio', 2));
    const get = (p: string, l: string) => Object.fromEntries(ids.map(i => [i, optMoney(v, p + i, `${l} of ${i}`)])) as Record<string, Money>;
    const ioc = (v.ioc ?? '').trim() ? percent(v, 'ioc', 'Interest on capital') : 0n, iod = (v.iod ?? '').trim() ? percent(v, 'iod', 'Interest on drawings') : 0n;
    const cap = get('cap', 'Capital'), dr = get('dr', 'Drawings'), sal = get('sal', 'Salary');
    const r = appropriate({ partners: ids.map(id => ({ id, name: id })), netProfit: money(v, 'profit', 'Net profit', { allowNegative: true }), shares, interestOnCapital: ioc > 0n ? { ratePercent: ioc, capital: cap } : undefined, interestOnDrawings: iod > 0n ? { ratePercent: iod, drawings: dr } : undefined, salary: sal });
    const py = (id: string) => ({ id, openingCapital: cap[id]!, drawings: dr[id]!, interestOnCapital: r.interestOnCapital[id]!, interestOnDrawings: r.interestOnDrawings[id]!, salary: r.salary[id]!, profitShare: r.shareOfResidual[id]! });
    const fl = partnerAccounts('FLUCTUATING', ids.map(py)), fx = partnerAccounts('FIXED', ids.map(py));
    const row = (label: string, f: (i: string) => Money) => [label, ...ids.map(i => R(f(i)))];
    const items: [string, (i: string) => Money][] = [['Opening capital', i => cap[i]!], ['Add: interest on capital', i => r.interestOnCapital[i]!], ['Add: salary', i => r.salary[i]!], ['Add: share of profit', i => r.shareOfResidual[i]!], ['Less: drawings', i => dr[i]!], ['Less: interest on drawings', i => r.interestOnDrawings[i]!]];
    const fixedClosing = (i: string) => fx.find(x => x.id === i)!, flClosing = (i: string) => fl.find(x => x.id === i)!;
    return [
      { kind: 'table', caption: 'Appropriation — what each partner is credited / debited', head: ['', ...ids], numeric: [1, 2], rows: items.map(([l, f]) => row(l, f)) },
      { kind: 'table', caption: 'A. Fluctuating capital — Capital Account (closing)', head: ['', ...ids], numeric: [1, 2], rows: [row('Closing capital', i => flClosing(i).capital)] },
      { kind: 'table', caption: 'B. Fixed capital — Capital Account and Current Account', head: ['', ...ids], numeric: [1, 2], rows: [row('Capital account (unchanged)', i => fixedClosing(i).capital), row('Current account: credits (interest + salary + profit)', i => fixedClosing(i).credits), row('Current account: debits (drawings + interest on drawings)', i => fixedClosing(i).debits), row('Current account balance', i => fixedClosing(i).current!)], foot: ['Capital + current account', ...ids.map(i => R(fixedClosing(i).capital.add(fixedClosing(i).current!)))] },
      note(ids.every(i => flClosing(i).capital.equals(fixedClosing(i).capital.add(fixedClosing(i).current!))) ? '✓ The two methods agree for every partner: fluctuating capital = fixed capital + current account.' : '✗ The two methods disagree — this should never happen.', ids.every(i => flClosing(i).capital.equals(fixedClosing(i).capital.add(fixedClosing(i).current!))) ? 'good' : 'bad'),
      ...(r.scaledDown ? [note('Profit was too small to pay all fixed entitlements in full, so they were scaled down in the ratio of the amounts due.', 'warn') as Block] : []),
    ];
  },
};

// ───────────────────────────── Revaluation ─────────────────────────────
export const revalLab: Lab = {
  id: 'xii-revaluation', cls: 'XII', title: 'Revaluation Account Lab', clauses: ['XII.1.ratio-change', 'XII.1.admission', 'XII.1.retirement'], skills: ['revaluation'],
  summary: 'Revalue assets and liabilities when partners change, find the profit or loss, share it in the old ratio and see the journal entries.',
  concept: [
    'When the partners change (admission, retirement, change of ratio) assets and liabilities are restated to their true values. The Revaluation Account collects the gains and losses.',
    'An INCREASE in an asset or a DECREASE in a liability is a gain (credit). A DECREASE in an asset or an INCREASE in a liability — including a newly recorded one — is a loss (debit).',
    'The net profit or loss is shared by the OLD partners in their OLD profit-sharing ratio and credited/debited to their capital accounts.',
  ],
  realWorld: 'Before a new partner joins, the firm’s stock is found to be worth less than its book value and its building is worth more. The old partners should bear or enjoy those changes — not the newcomer.',
  fields: [
    { id: 'ratio', label: 'Old profit-sharing ratio A:B:C', type: 'ratio' },
    { id: 'stockB', label: 'Stock — book value (₹)', type: 'money', group: 'Assets' }, { id: 'stockA', label: 'Stock — revalued (₹)', type: 'money' },
    { id: 'debB', label: 'Debtors — book value (₹)', type: 'money' }, { id: 'debA', label: 'Debtors — revalued (₹)', type: 'money' },
    { id: 'bldB', label: 'Building — book value (₹)', type: 'money' }, { id: 'bldA', label: 'Building — revalued (₹)', type: 'money' },
    { id: 'crB', label: 'Creditors — book value (₹)', type: 'money', group: 'Liabilities' }, { id: 'crA', label: 'Creditors — revalued (₹)', type: 'money' },
    { id: 'outB', label: 'Outstanding expenses — book value (₹)', type: 'money' }, { id: 'outA', label: 'Outstanding expenses — revalued (₹)', type: 'money' },
  ],
  example: { ratio: '3:2:1', stockB: '60000', stockA: '54000', debB: '40000', debA: '38000', bldB: '200000', bldA: '230000', crB: '50000', crA: '50000', outB: '0', outA: '4000' },
  walkthrough: ['Stock falls ₹6,000 and debtors ₹2,000 — losses. The building rises ₹30,000 — a gain. Outstanding expenses of ₹4,000 are newly recorded — a loss.', 'Net = 30,000 − 6,000 − 2,000 − 4,000 = profit ₹18,000.', 'Shared 3:2:1 → A ₹9,000, B ₹6,000, C ₹3,000 (credited to capital accounts).'],
  compute: v => {
    const ids = ids2(3), shares = shareMap(ids, ratio(v, 'ratio', 'Ratio', 3));
    const mk = (name: string, kind: 'ASSET' | 'LIABILITY', b: string, a: string): RevalItem => ({ name, kind, before: optMoney(v, b, `${name} book value`), after: optMoney(v, a, `${name} revalued`) });
    const items = [mk('Stock', 'ASSET', 'stockB', 'stockA'), mk('Debtors', 'ASSET', 'debB', 'debA'), mk('Building', 'ASSET', 'bldB', 'bldA'), mk('Creditors', 'LIABILITY', 'crB', 'crA'), mk('Outstanding expenses', 'LIABILITY', 'outB', 'outA')];
    const r = revaluation(items, shares);
    const losses = r.rows.filter(x => x.effect.isNegative()), gains = r.rows.filter(x => x.effect.isPositive());
    const lossRows = [...losses.map(x => [`${x.item.kind === 'ASSET' ? 'Loss on' : 'Increase in'} ${x.item.name}`, R(x.effect.abs())]), ...(r.profit.isPositive() ? ids.map(i => [`Profit to ${i}’s capital`, R(r.partnerShare[i]!)]) : [])];
    const gainRows = [...gains.map(x => [`${x.item.kind === 'ASSET' ? 'Increase in' : 'Decrease in'} ${x.item.name}`, R(x.effect)]), ...(r.profit.isNegative() ? ids.map(i => [`Loss to ${i}’s capital`, R(r.partnerShare[i]!.abs())]) : [])];
    const n = Math.max(lossRows.length, gainRows.length);
    const rows = Array.from({ length: n }, (_, k) => [lossRows[k]?.[0] ?? '', lossRows[k]?.[1] ?? '', gainRows[k]?.[0] ?? '', gainRows[k]?.[1] ?? '']);
    const blocks: Block[] = [
      { kind: 'table', caption: 'Revaluation Account', head: ['Particulars (Dr.)', '₹', 'Particulars (Cr.)', '₹'], numeric: [1, 3], rows, foot: ['Total', R(Money.sum([...losses.map(x => x.effect.abs()), ...(r.profit.isPositive() ? [r.profit] : [])])), 'Total', R(Money.sum([...gains.map(x => x.effect), ...(r.profit.isNegative() ? [r.profit.abs()] : [])]))] },
      { kind: 'bars', title: 'Gains and losses', items: r.rows.filter(x => !x.effect.isZero()).map(x => ({ label: x.item.name, value: num(x.effect), text: R(x.effect), tone: x.effect.isNegative() ? 'neg' as const : 'a' as const })) },
      { kind: 'table', caption: r.profit.isNegative() ? 'Loss shared in the old ratio' : 'Profit shared in the old ratio', head: ['', ...ids, 'Total'], numeric: [1, 2, 3, 4], rows: [['Share', ...ids.map(i => R(r.partnerShare[i]!)), R(r.profit)]] },
      { kind: 'journal', entries: r.entries },
    ];
    if (r.entries.length === 0) blocks.push(note('Nothing changed in value, so there is no revaluation entry.', 'info'));
    if (!r.entries.every(isBalanced)) blocks.push(note('Entries do not balance — please report this.', 'bad'));
    return blocks;
  },
};

// ───────────────────────────── Shares for consideration other than cash ─────────────────────────────
export const otherThanCash: Lab = {
  id: 'xii-noncash', cls: 'XII', title: 'Shares for Consideration Other Than Cash', clauses: ['XII.2.concepts'], skills: [],
  summary: 'A company buys a business and pays in shares: find goodwill or capital reserve and the shares issued.',
  concept: [
    'A company may issue shares to a vendor instead of paying cash — for example when it buys a business. First record the purchase at the agreed values: the difference between the price and the net assets taken over is GOODWILL (if price is higher) or CAPITAL RESERVE (if lower).',
    'Then discharge the vendor: debit the vendor, credit Share Capital with the face value of the shares issued and Securities Premium with any amount above face. Any part paid in cash is credited to Bank.',
  ],
  realWorld: 'A start-up buys a rival bakery. Instead of paying ₹6,00,000 in cash it gives the owner shares worth that much, so the owner becomes a shareholder.',
  fields: [
    { id: 'assets', label: 'Assets taken over — agreed value (₹)', type: 'money' }, { id: 'liabs', label: 'Liabilities taken over (₹)', type: 'money' }, { id: 'price', label: 'Purchase consideration (₹)', type: 'money' },
    { id: 'cash', label: 'Part paid in cash (₹)', type: 'money' }, { id: 'face', label: 'Face value of a share (₹)', type: 'money' }, { id: 'issue', label: 'Issue price of a share (₹)', type: 'money' },
  ],
  example: { assets: '700000', liabs: '100000', price: '620000', cash: '20000', face: '10', issue: '12' },
  walkthrough: ['Net assets = 7,00,000 − 1,00,000 = ₹6,00,000; price ₹6,20,000, so goodwill = ₹20,000.', 'Paid in shares: 6,20,000 − 20,000 cash = ₹6,00,000 ÷ ₹12 issue price = 50,000 shares.', 'Share capital = 50,000 × ₹10 = ₹5,00,000; securities premium = 50,000 × ₹2 = ₹1,00,000.'],
  compute: v => {
    const assets = money(v, 'assets', 'Assets'), liabs = money(v, 'liabs', 'Liabilities'), price = money(v, 'price', 'Consideration'), cash = optMoney(v, 'cash', 'Cash part'), face = money(v, 'face', 'Face value'), issue = money(v, 'issue', 'Issue price');
    if (!face.isPositive() || !issue.isPositive()) throw new InputError('Face value and issue price must be more than zero.', 'face');
    if (issue.cmp(face) < 0) throw new InputError('Shares cannot be issued below face value here (a discount is allowed only for sweat equity, which is not worked in this lab).', 'issue');
    if (cash.cmp(price) > 0) throw new InputError('The cash part cannot be more than the consideration.', 'cash');
    const inShares = price.sub(cash);
    if (inShares.paise % issue.paise !== 0n) throw new InputError(`The part paid in shares (${R(inShares)}) is not a whole number of shares at ${R(issue)}. Change the cash part or the issue price.`, 'issue');
    const count = inShares.paise / issue.paise;
    const p = purchaseOfBusiness({ assets, liabilities: liabs, consideration: price }, 'Vendor');
    const cap = face.mulRatio(count, 1n, 'HALF_UP'), prem = issue.sub(face).mulRatio(count, 1n, 'HALF_UP');
    const settle: Illustration = { narration: `Vendor discharged: ${count} shares issued${cash.isPositive() ? ' and the balance paid in cash' : ''}`, lines: [{ account: 'Vendor A/c', side: 'DR', amount: price }, { account: 'Share Capital A/c', side: 'CR', amount: cap }, ...(prem.isPositive() ? [{ account: 'Securities Premium A/c', side: 'CR' as const, amount: prem }] : []), ...(cash.isPositive() ? [{ account: 'Bank A/c', side: 'CR' as const, amount: cash }] : [])] };
    return [
      { kind: 'steps', title: 'Working', steps: [`Net assets taken over = ${R(p.netAssets)}`, p.goodwill.isPositive() ? `Price ${R(price)} is MORE than net assets ⇒ goodwill ${R(p.goodwill)}` : p.capitalReserve.isPositive() ? `Price ${R(price)} is LESS than net assets ⇒ capital reserve ${R(p.capitalReserve)}` : 'Price equals net assets ⇒ no goodwill or reserve', `Shares issued = ${R(inShares)} ÷ ${R(issue)} = ${count}`] },
      { kind: 'journal', entries: [p.entry, settle] },
      { kind: 'table', head: ['Effect', '₹'], numeric: [1], rows: [['Share capital', R(cap)], ['Securities premium', R(prem)], ['Goodwill', R(p.goodwill)], ['Capital reserve', R(p.capitalReserve)]] },
    ];
  },
};

// ───────────────────────────── Calls in advance ─────────────────────────────
export const callsAdvanceLab: Lab = {
  id: 'xii-advance', cls: 'XII', title: 'Calls in Advance Lab', clauses: ['XII.2.issue'], skills: ['calls-advance'],
  summary: 'Some shareholders pay a call before it is made. See where that money sits and how it is adjusted when the call falls due.',
  concept: ['If a shareholder pays part or all of a call before it is made, the amount is not yet share capital — it is a liability of the company and is credited to Calls in Advance Account.', 'When the call is made, the advance is adjusted against what those shareholders owe, and only the balance is collected in cash. Syllabus limit: no interest is calculated on calls in advance.'],
  realWorld: 'Before the final call is announced, an investor who expects a rate rise pays ₹2 per share early. The company holds the money as a liability until the call is actually due.',
  fields: [{ id: 'shares', label: 'Total shares on which the call is due', type: 'int' }, { id: 'call', label: 'Call per share (₹)', type: 'money' }, { id: 'adv', label: 'Shares whose holders paid in advance', type: 'int' }, { id: 'per', label: 'Advance paid per share (₹)', type: 'money' }],
  example: { shares: '10000', call: '4', adv: '500', per: '2' },
  walkthrough: ['Advance received = 500 × ₹2 = ₹1,000 → credited to Calls in Advance.', 'Call due on all 10,000 shares = ₹40,000.', 'On the due date ₹1,000 is transferred from Calls in Advance to the Call Account; the remaining ₹39,000 is collected in cash.'],
  compute: v => {
    const shares = whole(v, 'shares', 'Shares', 1), adv = whole(v, 'adv', 'Shares paid in advance', 1), call = money(v, 'call', 'Call'), per = money(v, 'per', 'Advance per share');
    if (adv > shares) throw new InputError('Shares paid in advance cannot be more than the total shares.', 'adv');
    if (per.cmp(call) > 0) throw new InputError('The advance per share cannot be more than the call per share (an advance beyond the call would be a later call).', 'per');
    const r = guard(() => callsInAdvance({ shares: BigInt(adv), advancePerShare: per })), total = call.mulRatio(BigInt(shares), 1n, 'HALF_UP');
    return [
      { kind: 'table', head: ['', '₹'], numeric: [1], rows: [['Call due on all shares', R(total)], ['Received in advance (liability until due)', R(r.received)]], foot: ['Still to collect in cash on the due date', R(total.sub(r.received))] },
      { kind: 'journal', entries: r.entries },
      note('Calls in Advance is not part of share capital. It is shown separately (as a liability) until it is adjusted. No interest is allowed on it in this syllabus.', 'info'),
    ];
  },
};

// ───────────────────────────── Schedule III statements ─────────────────────────────
const SIII: Field[] = [
  { id: 'sc', label: 'Share capital (₹)', type: 'money', group: 'Equity and liabilities' }, { id: 'rs', label: 'Reserves and surplus (₹, minus if a debit balance)', type: 'money' },
  { id: 'ltb', label: 'Long-term borrowings (₹)', type: 'money' }, { id: 'oncl', label: 'Other non-current liabilities (₹)', type: 'money' },
  { id: 'stb', label: 'Short-term borrowings (₹)', type: 'money' }, { id: 'tp', label: 'Trade payables (₹)', type: 'money' }, { id: 'ocl', label: 'Other current liabilities (₹)', type: 'money' }, { id: 'stp', label: 'Short-term provisions (₹)', type: 'money' },
  { id: 'ppe', label: 'Tangible assets (₹)', type: 'money', group: 'Assets' }, { id: 'ia', label: 'Intangible assets (₹)', type: 'money' }, { id: 'nci', label: 'Non-current investments (₹)', type: 'money' }, { id: 'onca', label: 'Other non-current assets (₹)', type: 'money' },
  { id: 'ci', label: 'Current investments (₹)', type: 'money' }, { id: 'inv', label: 'Inventories (₹)', type: 'money' }, { id: 'tr', label: 'Trade receivables (₹)', type: 'money' }, { id: 'cash', label: 'Cash and cash equivalents (₹)', type: 'money' }, { id: 'oca', label: 'Other current assets (₹)', type: 'money' },
  { id: 'rev', label: 'Revenue from operations (₹)', type: 'money', group: 'Statement of Profit and Loss' }, { id: 'oi', label: 'Other income (₹)', type: 'money' }, { id: 'mat', label: 'Cost of materials consumed (₹)', type: 'money' }, { id: 'pst', label: 'Purchases of stock-in-trade (₹)', type: 'money' },
  { id: 'oinv', label: 'Opening inventories of finished goods / stock-in-trade (₹)', type: 'money' }, { id: 'cinv', label: 'Closing inventories of finished goods / stock-in-trade (₹)', type: 'money' },
  { id: 'emp', label: 'Employee benefit expense (₹)', type: 'money' }, { id: 'fin', label: 'Finance costs (₹)', type: 'money' }, { id: 'dep', label: 'Depreciation and amortisation (₹)', type: 'money' }, { id: 'oe', label: 'Other expenses (₹)', type: 'money' }, { id: 'tax', label: 'Tax rate (%)', type: 'percent' },
];
export const scheduleIII: Lab = {
  id: 'xii-schedule3', cls: 'XII', title: 'Company Statements in Schedule III Format', clauses: ['XII.3.statements'], skills: [], route: 'OPTION_I_ANALYSIS',
  summary: 'Arrange a company’s figures under the Schedule III headings and check that the Balance Sheet balances.',
  concept: ['A company’s Balance Sheet is prepared in a prescribed vertical format (Schedule III): Equity and Liabilities (shareholders’ funds, non-current liabilities, current liabilities) and Assets (non-current assets, current assets). The Statement of Profit and Loss lists revenue and expenses under standard heads.', 'Items must go under the right head: a long-term loan is a non-current liability, trade payables are current, cash equivalents include current investments. Exceptional/extraordinary items and discontinued operations are outside this course.'],
  realWorld: 'Every listed company publishes its Balance Sheet in this one format, which is why an analyst can compare two companies’ numbers line by line.',
  fields: SIII,
  example: { sc: '500000', rs: '100000', ltb: '200000', oncl: '0', stb: '0', tp: '80000', ocl: '0', stp: '20000', ppe: '600000', ia: '0', nci: '0', onca: '0', ci: '0', inv: '150000', tr: '100000', cash: '50000', oca: '0',
    rev: '1000000', oi: '20000', mat: '400000', pst: '0', oinv: '50000', cinv: '70000', emp: '150000', fin: '30000', dep: '50000', oe: '80000', tax: '30' },
  walkthrough: ['Shareholders’ funds = 5,00,000 + 1,00,000 = ₹6,00,000; non-current liabilities ₹2,00,000; current liabilities = 80,000 + 20,000 = ₹1,00,000. Total ₹9,00,000.', 'Assets: non-current ₹6,00,000; current = 1,50,000 + 1,00,000 + 50,000 = ₹3,00,000. Total ₹9,00,000 — it balances.', 'P&L: total revenue ₹10,20,000; expenses include the change in inventories (50,000 − 70,000 = −20,000, a reduction in expense) ⇒ ₹6,90,000; profit before tax ₹3,30,000; tax at 30% ₹99,000; profit after tax ₹2,31,000.'],
  compute: v => {
    const m = (id: string, label: string) => optMoney(v, id, label.replace(/ \(.*\)/, '')), neg = (id: string, label: string) => money(v, id, label, { allowNegative: true, allowBlank: true });
    const b = balanceSheet({ shareCapital: m('sc', 'Share capital'), reservesAndSurplus: neg('rs', 'Reserves'), longTermBorrowings: m('ltb', 'Long-term borrowings'), otherNonCurrentLiabilities: m('oncl', 'Other non-current liabilities'), shortTermBorrowings: m('stb', 'Short-term borrowings'), tradePayables: m('tp', 'Trade payables'), otherCurrentLiabilities: m('ocl', 'Other current liabilities'), shortTermProvisions: m('stp', 'Short-term provisions'),
      tangibleAssets: m('ppe', 'Tangible assets'), intangibleAssets: m('ia', 'Intangible assets'), nonCurrentInvestments: m('nci', 'Non-current investments'), otherNonCurrentAssets: m('onca', 'Other non-current assets'), currentInvestments: m('ci', 'Current investments'), inventories: m('inv', 'Inventories'), tradeReceivables: m('tr', 'Trade receivables'), cashAndEquivalents: m('cash', 'Cash'), otherCurrentAssets: m('oca', 'Other current assets') });
    const tax = (v.tax ?? '').trim() ? percent(v, 'tax', 'Tax rate') : 0n;
    const p = statementOfProfitAndLoss({ revenueFromOperations: money(v, 'rev', 'Revenue'), otherIncome: m('oi', 'Other income'), costOfMaterialsConsumed: m('mat', 'Materials'), purchasesOfStockInTrade: m('pst', 'Purchases'), openingInventory: m('oinv', 'Opening inventories'), closingInventory: m('cinv', 'Closing inventories'), employeeBenefits: m('emp', 'Employee benefit'), financeCosts: m('fin', 'Finance costs'), depreciation: m('dep', 'Depreciation'), otherExpenses: m('oe', 'Other expenses'), taxRatePercent: tax });
    const g = (id: string) => m(id, id);
    const line = (label: string, x: Money): string[] => [label, R(x)];
    return [
      { kind: 'table', caption: 'Balance Sheet (Schedule III)', head: ['Particulars', '₹'], numeric: [1], rows: [
        ['I. EQUITY AND LIABILITIES', ''], ['1. Shareholders’ funds', R(b.shareholdersFunds)], line('   (a) Share capital', g('sc')), line('   (b) Reserves and surplus', neg('rs', 'rs')),
        ['2. Non-current liabilities', R(b.nonCurrentLiabilities)], line('   (a) Long-term borrowings', g('ltb')), line('   (b) Other non-current liabilities', g('oncl')),
        ['3. Current liabilities', R(b.currentLiabilities)], line('   (a) Short-term borrowings', g('stb')), line('   (b) Trade payables', g('tp')), line('   (c) Other current liabilities', g('ocl')), line('   (d) Short-term provisions', g('stp')),
        ['II. ASSETS', ''], ['1. Non-current assets', R(b.nonCurrentAssets)], line('   (a) Tangible assets', g('ppe')), line('   (b) Intangible assets', g('ia')), line('   (c) Non-current investments', g('nci')), line('   (d) Other non-current assets', g('onca')),
        ['2. Current assets', R(b.currentAssets)], line('   (a) Current investments', g('ci')), line('   (b) Inventories', g('inv')), line('   (c) Trade receivables', g('tr')), line('   (d) Cash and cash equivalents', g('cash')), line('   (e) Other current assets', g('oca'))],
        foot: ['Total equity and liabilities  |  Total assets', `${R(b.totalEquityAndLiabilities)}  |  ${R(b.totalAssets)}`] },
      b.balanced ? note('✓ The Balance Sheet balances: total equity and liabilities = total assets.', 'good') : note(`✗ The Balance Sheet does NOT balance — assets exceed equity and liabilities by ${R(b.difference)}. An item is missing, on the wrong side, or in the wrong head.`, 'bad'),
      { kind: 'table', caption: 'Statement of Profit and Loss', head: ['Particulars', '₹'], numeric: [1], rows: [
        line('I. Revenue from operations', g('rev')), line('II. Other income', g('oi')), line('III. Total revenue (I + II)', p.totalRevenue),
        line('IV. Expenses: cost of materials consumed', g('mat')), line('   Purchases of stock-in-trade', g('pst')), line('   Changes in inventories (opening − closing)', p.changesInInventories), line('   Employee benefit expense', g('emp')), line('   Finance costs', g('fin')), line('   Depreciation and amortisation', g('dep')), line('   Other expenses', g('oe')), line('   Total expenses', p.totalExpenses),
        line('V. Profit before tax (III − IV)', p.profitBeforeTax), line('VI. Tax expense', p.tax)], foot: ['Profit after tax', R(p.profitAfterTax)] },
      { kind: 'table', caption: 'Useful totals for analysis', head: ['', '₹'], numeric: [1], rows: [['Working capital (current assets − current liabilities)', R(b.workingCapital)], ['Capital employed (shareholders’ funds + non-current liabilities)', R(b.capitalEmployed)]] },
    ];
  },
};

// ───────────────────────────── Spreadsheet applications ─────────────────────────────
const sheetRows = (rows: [string, string, string, string][]): Block => ({ kind: 'table', caption: 'The cells — what you would type', head: ['Cell', 'Holds', 'Formula', 'Value'], numeric: [3], rows });
export const spreadsheet: Lab = {
  id: 'xii-spreadsheet', cls: 'XII', title: 'Spreadsheet Lab: loan, depreciation, ratios, BRS', clauses: ['XII.C.spreadsheet'], skills: ['loan-emi'], route: 'OPTION_II_COMPUTERISED',
  summary: 'See the formulas you would type in a spreadsheet for a loan schedule, an asset-depreciation schedule, ratio analysis and a bank reconciliation — with the values the engine gets.',
  concept: ['A spreadsheet recalculates every dependent cell when an input changes. Accounting uses it for repetitive schedules: loan repayment, depreciation, ratios and reconciliations.', 'This lab shows, for each task, which cells are inputs, the formula for each calculated cell, and the exact value. (A real spreadsheet shows unrounded decimals unless you wrap formulas in ROUND; here each paisa is rounded and the last loan instalment absorbs the difference.)'],
  realWorld: 'A small business owner keeps a loan sheet: change the interest rate and every month’s interest and closing balance updates at once.',
  fields: [
    { id: 'task', label: 'Task', type: 'select', options: [{ value: 'LOAN', label: 'Loan repayment schedule' }, { value: 'DEP', label: 'Asset depreciation schedule' }, { value: 'RATIO', label: 'Ratio analysis' }, { value: 'BRS', label: 'Bank reconciliation statement' }] },
    { id: 'p', label: 'Loan amount (₹)', type: 'money', group: 'Loan' }, { id: 'r', label: 'Annual interest rate (%)', type: 'text' }, { id: 'n', label: 'Months', type: 'int' },
    { id: 'cost', label: 'Asset cost (₹)', type: 'money', group: 'Depreciation' }, { id: 'scrap', label: 'Scrap value (₹)', type: 'money' }, { id: 'life', label: 'Life (years)', type: 'int' }, { id: 'method', label: 'Method', type: 'select', options: [{ value: 'SLM', label: 'Straight line' }, { value: 'WDV', label: 'Written down value' }] }, { id: 'rate', label: 'WDV rate (%)', type: 'percent' },
    { id: 'ca', label: 'Current assets (₹)', type: 'money', group: 'Ratios' }, { id: 'inv', label: 'Inventory (₹)', type: 'money' }, { id: 'pre', label: 'Prepaid expenses (₹)', type: 'money' }, { id: 'cl', label: 'Current liabilities (₹)', type: 'money' }, { id: 'debt', label: 'Long-term debt (₹)', type: 'money' }, { id: 'eq', label: 'Shareholders’ funds (₹)', type: 'money' },
    { id: 'cb', label: 'Balance as per cash book (₹)', type: 'money', group: 'Bank reconciliation' }, { id: 'iss', label: 'Cheques issued, not yet presented (₹)', type: 'money' }, { id: 'dep', label: 'Cheques deposited, not yet collected (₹)', type: 'money' }, { id: 'chg', label: 'Bank charges not in cash book (₹)', type: 'money' },
  ],
  example: { task: 'LOAN', p: '100000', r: '12', n: '12', cost: '100000', scrap: '10000', life: '5', method: 'SLM', rate: '20', ca: '400000', inv: '80000', pre: '10000', cl: '200000', debt: '300000', eq: '700000', cb: '50000', iss: '10000', dep: '3000', chg: '500' },
  walkthrough: ['Loan: B1 = amount, B2 = annual rate, B3 = months; B4 = monthly rate (=B2/12); B5 = instalment (=PMT(B4,B3,-B1)).', 'Each month: interest = opening balance × B4; principal = instalment − interest; closing = opening − principal.', 'Change the amount or the rate above and press the button: every row is recalculated, exactly as a spreadsheet would.'],
  compute: v => {
    const task = v.task ?? 'LOAN';
    if (task === 'LOAN') {
      const principal = money(v, 'p', 'Loan'), rate = decimalRate(v, 'r', 'Annual rate'), n = whole(v, 'n', 'Months', 1, 120);
      const ls = guard(() => loanSchedule({ principal, ratePercent: rate, months: n }));
      return [
        sheetRows([['B1', 'Loan amount', 'input', R(principal)], ['B2', 'Annual interest rate', 'input', `${v.r}%`], ['B3', 'Number of months', 'input', String(n)], ['B4', 'Monthly rate', '=B2/12', `${v.r}% ÷ 12`], ['B5', 'Monthly instalment', '=PMT(B4,B3,-B1)', R(ls.emi)]]),
        { kind: 'table', caption: 'Schedule — row formulas: Interest =ROUND(Opening*$B$4,2) · Principal =$B$5−Interest · Closing =Opening−Principal', head: ['Month', 'Opening', 'Interest', 'Principal', 'Instalment', 'Closing'], numeric: [0, 1, 2, 3, 4, 5], rows: ls.rows.map(x => [String(x.month), R(x.opening), R(x.interest), R(x.principal), R(x.payment), R(x.closing)]), foot: ['Total', '', R(ls.totalInterest), R(principal), R(ls.totalPaid), ''] },
        { kind: 'bars', title: 'Interest vs principal in each instalment (first 12 months)', items: ls.rows.slice(0, 12).map(x => ({ label: `M${x.month} interest`, value: num(x.interest), text: R(x.interest), tone: 'b' as const })) },
        note('Interest falls every month because it is charged on a shrinking balance; the instalment stays the same.', 'info'),
      ];
    }
    if (task === 'DEP') {
      const cost = money(v, 'cost', 'Cost'), scrap = optMoney(v, 'scrap', 'Scrap'), life = whole(v, 'life', 'Life', 1, 100), method = v.method === 'WDV' ? 'WDV' : 'SLM';
      const rate = method === 'WDV' ? percent(v, 'rate', 'WDV rate') : 0n;
      const rows = guard(() => depreciationSchedule(method === 'SLM' ? { cost, scrap, method: 'SLM', lifeYears: life, years: life } : { cost, scrap, method: 'WDV', rate: pct(rate), years: life }));
      return [
        sheetRows([['B1', 'Cost', 'input', R(cost)], ['B2', 'Scrap value', 'input', R(scrap)], ['B3', 'Life (years)', 'input', String(life)], ...(method === 'SLM' ? [['B4', 'Annual depreciation', '=SLN(B1,B2,B3)', R(rows[0]!.depreciation)] as [string, string, string, string]] : [['B4', 'WDV rate', 'input', `${rate}%`] as [string, string, string, string]])]),
        { kind: 'table', caption: method === 'SLM' ? 'Row formulas: Depreciation =$B$4 · Closing =Opening−Depreciation' : 'Row formulas: Depreciation =Opening*$B$4 · Closing =Opening−Depreciation', head: ['Year', 'Opening', 'Depreciation', 'Closing'], numeric: [0, 1, 2, 3], rows: rows.map(x => [String(x.year), R(x.opening), R(x.depreciation), R(x.closing)]) },
      ];
    }
    if (task === 'RATIO') {
      const ca = money(v, 'ca', 'Current assets'), inv = money(v, 'inv', 'Inventory'), pre = optMoney(v, 'pre', 'Prepaid'), cl = money(v, 'cl', 'Current liabilities'), debt = money(v, 'debt', 'Debt'), eq = money(v, 'eq', 'Equity');
      const cr = guard(() => { try { return currentRatio(ca, cl); } catch (e) { throw new InputError((e as Error).message, 'cl'); } }), qr = quickRatio(ca, inv, pre, cl), de = debtEquityRatio(debt, eq);
      return [sheetRows([['B1', 'Current assets', 'input', R(ca)], ['B2', 'Inventory', 'input', R(inv)], ['B3', 'Prepaid expenses', 'input', R(pre)], ['B4', 'Current liabilities', 'input', R(cl)], ['B5', 'Long-term debt', 'input', R(debt)], ['B6', 'Shareholders’ funds', 'input', R(eq)], ['B8', 'Current ratio', '=B1/B4', cr.display], ['B9', 'Quick ratio', '=(B1-B2-B3)/B4', qr.display], ['B10', 'Debt-equity ratio', '=B5/B6', de.display]]),
        { kind: 'table', head: ['Ratio', 'Working', 'Reads as'], rows: [cr, qr, de].map(x => [x.name, x.working, x.reading]) }];
    }
    const cb = money(v, 'cb', 'Cash book balance', { allowNegative: true }), items = ([['CHEQUE_ISSUED_NOT_PRESENTED', 'iss'], ['CHEQUE_DEPOSITED_NOT_COLLECTED', 'dep'], ['BANK_CHARGES_NOT_IN_CASH_BOOK', 'chg']] as [BrsKind, string][]).map(([kind, id]) => ({ kind, amount: optMoney(v, id, id) })).filter(i => i.amount.isPositive());
    if (items.length === 0) throw new InputError('Enter at least one reconciling item.', 'iss');
    const r = reconcile(cb, 'CASH_BOOK', items);
    return [sheetRows([['B1', 'Balance as per cash book', 'input', R(cb)], ['B2', 'Cheques issued, not presented', 'input', R(optMoney(v, 'iss', 'iss'))], ['B3', 'Cheques deposited, not collected', 'input', R(optMoney(v, 'dep', 'dep'))], ['B4', 'Bank charges', 'input', R(optMoney(v, 'chg', 'chg'))], ['B6', 'Balance as per pass book', '=B1+B2-B3-B4', R(r.end)]]),
      { kind: 'table', head: ['Item', 'Add / Less', '₹'], numeric: [2], rows: r.rows.map(x => [x.label, x.effect === 'ADD' ? 'Add' : 'Less', R(x.amount)]), foot: ['Balance as per pass book', '', R(r.end)] }];
  },
};
export const XII2_LABS: Lab[] = [fundamentals, capitalMethods, revalLab, callsAdvanceLab, otherThanCash, scheduleIII, spreadsheet];
