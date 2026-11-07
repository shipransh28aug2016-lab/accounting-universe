import {
  Fraction, Money, admission, allocate, appropriate, averageProfit, dissolve, executorSchedule, exitSettlement, goodwillAverageProfit, goodwillCapitalisation, goodwillOnRatioChange,
  goodwillSuperProfit, newSharesAfterExit, ratioChange, type Partner,
} from '../../../../packages/engine/src';
import { InputError, type Block, type Lab } from '../spec';
import { fraction, frac, money, moneyList, num, optMoney, percent, ratio, whole } from '../inputs';
import { bar, names, note, R, sh } from './common';

const partners = (n: number): Partner[] => names(n).map(id => ({ id, name: id }));
const shareMap = (ids: readonly string[], fr: Fraction[]) => Object.fromEntries(ids.map((id, i) => [id, fr[i]!])) as Record<string, Fraction>;
const ratioRow = (label: string, ids: readonly string[], m: Record<string, Fraction>) => ({ label, segments: ids.map(id => ({ name: id, value: frac(m[id] ?? Fraction.ZERO), text: (m[id] ?? Fraction.ZERO).toString() })) });
const optPercent = (v: Record<string, string>, id: string, label: string) => ((v[id] ?? '').trim() === '' ? 0n : percent(v, id, label));

// ───────────────────────────── Appropriation ─────────────────────────────
export const appropriation: Lab = {
  id: 'xii-appropriation', cls: 'XII', title: 'Profit & Loss Appropriation Lab', clauses: ['XII.1.appropriation', 'XII.1.guarantee', 'XII.1.past-adjustments', 'XII.1.capital'], skills: ['guarantee', 'int-drawings'],
  summary: 'Divide a firm\'s profit among partners after interest, salary, commission and a guarantee — and see what happens when profit is too small.',
  concept: [
    'Net profit is not simply split in the ratio. First the deed\'s items are credited to partners: interest on capital, salary, commission. Interest charged on drawings is deducted. What remains is shared in the profit-sharing ratio.',
    'If profit is too small to pay all the salary and interest, the available profit is divided in the ratio of the amounts due. If there is a loss, no salary or interest is allowed — the loss is simply shared in the ratio.',
    'Guarantee: when a partner is assured a minimum, any shortfall is borne by the partner(s) who gave the guarantee. Interest on a partner\'s LOAN is a charge against profit, so deduct it before this account.',
  ],
  realWorld: 'Three friends run a design studio. B does most of the work, so the deed gives B a ₹24,000 salary before profit is shared. In a poor year the profit cannot cover everyone\'s fixed entitlements, so the shortfall is spread in proportion.',
  fields: [
    { id: 'profit', label: 'Net profit / (loss) before appropriations (₹)', type: 'money' },
    { id: 'ratio', label: 'Profit-sharing ratio A:B:C', type: 'ratio' },
    { id: 'iocRate', label: 'Interest on capital (% p.a., blank = none)', type: 'percent', group: 'Capitals' },
    { id: 'capA', label: 'Capital of A (₹)', type: 'money' }, { id: 'capB', label: 'Capital of B (₹)', type: 'money' }, { id: 'capC', label: 'Capital of C (₹)', type: 'money' },
    { id: 'iodRate', label: 'Interest on drawings (% p.a., blank = none)', type: 'percent', group: 'Drawings (average period 6 months when dates are not given)' },
    { id: 'drA', label: 'Drawings of A (₹)', type: 'money' }, { id: 'drB', label: 'Drawings of B (₹)', type: 'money' }, { id: 'drC', label: 'Drawings of C (₹)', type: 'money' },
    { id: 'salA', label: 'Salary to A (₹)', type: 'money', group: 'Salary and commission' }, { id: 'salB', label: 'Salary to B (₹)', type: 'money' }, { id: 'salC', label: 'Salary to C (₹)', type: 'money' },
    { id: 'commC', label: 'Commission to C (₹)', type: 'money' },
    { id: 'gPartner', label: 'Guaranteed partner', type: 'select', group: 'Guarantee', options: [{ value: '', label: 'None' }, { value: 'A', label: 'A' }, { value: 'B', label: 'B' }, { value: 'C', label: 'C' }] },
    { id: 'gMin', label: 'Guaranteed minimum (₹)', type: 'money' },
  ],
  example: { profit: '40000', ratio: '4:3:3', iocRate: '', capA: '0', capB: '0', capC: '0', iodRate: '', drA: '0', drB: '0', drC: '0', salA: '0', salB: '0', salC: '0', commC: '0', gPartner: 'C', gMin: '50000' },
  walkthrough: [
    'Profit ₹40,000 shared 4:3:3 gives A ₹16,000, B ₹12,000, C ₹12,000.',
    'C was guaranteed ₹50,000, so he is ₹38,000 short.',
    'A and B bear the shortfall in their ratio 4:3 (the engine applies the default: the other partners, in their profit-sharing ratio).',
    'Note how the total still adds up to the profit: guarantees move money between partners, they never create it.',
  ],
  compute: v => {
    const ids = names(3);
    const profit = money(v, 'profit', 'Net profit', { allowNegative: true });
    const sharesF = shareMap(ids, ratio(v, 'ratio', 'Profit-sharing ratio', 3));
    const get = (prefix: string, label: string) => Object.fromEntries(ids.map(i => [i, optMoney(v, prefix + i, `${label} of ${i}`)])) as Record<string, Money>;
    const iocR = optPercent(v, 'iocRate', 'Interest on capital rate'), iodR = optPercent(v, 'iodRate', 'Interest on drawings rate');
    const salary = get('sal', 'Salary'), commissionC = optMoney(v, 'commC', 'Commission');
    const gp = (v.gPartner ?? '').trim(), gMin = optMoney(v, 'gMin', 'Guaranteed minimum');
    if (gp && !gMin.isPositive()) throw new InputError('Enter the guaranteed minimum amount.', 'gMin');
    const r = appropriate({
      partners: partners(3), netProfit: profit, shares: sharesF,
      interestOnCapital: iocR > 0n ? { ratePercent: iocR, capital: get('cap', 'Capital') } : undefined,
      interestOnDrawings: iodR > 0n ? { ratePercent: iodR, drawings: get('dr', 'Drawings') } : undefined,
      salary, commission: { C: commissionC },
      guarantee: gp ? { partner: gp, minimum: gMin } : undefined,
    });
    const row = (label: string, m: Record<string, Money>, neg = false): string[] => [label, ...ids.map(i => (neg && !m[i]!.isZero() ? `(${R(m[i]!)})` : R(m[i]!))), R(Money.sum(ids.map(i => m[i]!)))];
    const resid = r.residual;
    const blocks: Block[] = [
      { kind: 'table', caption: 'Profit & Loss Appropriation — partners\' shares', head: ['', ...ids.map(i => `Partner ${i}`), 'Total'], numeric: [1, 2, 3, 4],
        rows: [row('Interest on capital', r.interestOnCapital), row('Salary', r.salary), row('Commission', r.commission), row(resid.isNegative() ? 'Share of loss' : 'Share of remaining profit', r.shareOfResidual), row('Less: interest on drawings', r.interestOnDrawings, true), ...(gp ? [row('Guarantee adjustment', Object.fromEntries(ids.map(i => [i, r.guaranteeBorne[i]!.neg()])))] : [])],
        foot: ['Total credited to partner', ...ids.map(i => R(r.totalPerPartner[i]!)), R(Money.sum(ids.map(i => r.totalPerPartner[i]!)))] },
      { kind: 'ratio', title: 'Agreed ratio vs what each partner actually received', rows: [ratioRow('Agreed ratio', ids, sharesF), ...(profit.isPositive() ? [{ label: 'Actual', segments: ids.map(i => ({ name: i, value: Math.max(0, num(r.totalPerPartner[i]!) / Math.max(1, num(profit))), text: R(r.totalPerPartner[i]!) })) }] : [])] },
      { kind: 'steps', title: 'Working notes', steps: [
        `Profit to appropriate: ${R(profit)}${iodR > 0n ? ` + interest charged on drawings ${R(Money.sum(ids.map(i => r.interestOnDrawings[i]!)))}` : ''}`,
        `Fixed entitlements (interest + salary + commission) = ${R(Money.sum(ids.map(i => r.interestOnCapital[i]!.add(r.salary[i]!).add(r.commission[i]!))))}`,
        `Remaining to share in the ratio ${ids.map(i => sh(sharesF[i]!)).join(' : ')} = ${R(resid)}`,
      ] },
    ];
    if (r.scaledDown) blocks.push(note(profit.isNegative() || profit.isZero() ? 'There is a loss, so NO salary, interest or commission is allowed. The loss is shared in the profit-sharing ratio.' : 'Profit is smaller than the fixed entitlements, so the available profit is divided in the RATIO OF THE AMOUNTS DUE — not in the profit-sharing ratio.', 'warn'));
    const shortfall = Money.sum(ids.filter(i => r.guaranteeBorne[i]!.isPositive()).map(i => r.guaranteeBorne[i]!));
    if (gp && shortfall.isZero()) blocks.push(note(`${gp} already receives at least ${R(gMin)} without help, so nobody has to make up a shortfall.`, 'good'));
    if (gp && shortfall.isPositive()) blocks.push(note(`${gp} would receive less than the guaranteed ${R(gMin)}, so the other partners make up ${R(shortfall)}. Guarantees move money between partners; the total never changes.`, 'info'));
    return blocks;
  },
};

// ───────────────────────────── Goodwill ─────────────────────────────
export const goodwill: Lab = {
  id: 'xii-goodwill', cls: 'XII', title: 'Goodwill Valuation Lab', clauses: ['XII.1.goodwill'], skills: ['goodwill-avg', 'goodwill-super'],
  summary: 'Value goodwill three ways — average profit, super profit, capitalisation — and compare them.',
  concept: [
    'Goodwill is the extra value a firm has because of its reputation, location and customers: the ability to earn more than a normal return.',
    'Average profit method: goodwill = average profit × years\' purchase. Super profit method: only the profit ABOVE a normal return on capital employed counts. Capitalisation method: capitalised value of average profit − net assets (capital employed).',
    'The syllabus names only these three methods. Adjust past profits for abnormal items first (e.g. a fire loss is added back).',
  ],
  realWorld: 'Two sweet shops have the same shop, stock and furniture. One earns far more because people queue for its name. That difference in earning power is goodwill, and a new partner must pay for a share of it.',
  fields: [
    { id: 'profits', label: 'Profits of past years (comma separated, ADJUSTED for abnormal items)', type: 'text' },
    { id: 'years', label: 'Years\' purchase (for average / super profit)', type: 'int' },
    { id: 'ce', label: 'Capital employed (₹)', type: 'money' }, { id: 'nrr', label: 'Normal rate of return (%)', type: 'percent' },
  ],
  example: { profits: '120000, 150000, 135000', years: '3', ce: '800000', nrr: '10' },
  walkthrough: ['Average profit = (1,20,000 + 1,50,000 + 1,35,000) ÷ 3 = ₹1,35,000.', 'Average-profit goodwill = ₹1,35,000 × 3 = ₹4,05,000.', 'Normal profit = 10% of ₹8,00,000 = ₹80,000; super profit = ₹55,000; goodwill = ₹55,000 × 3 = ₹1,65,000.', 'Capitalisation: ₹1,35,000 × 100/10 = ₹13,50,000 − ₹8,00,000 = ₹5,50,000.'],
  compute: v => {
    const ps = moneyList(v, 'profits', 'Profits', 1), years = BigInt(whole(v, 'years', 'Years\' purchase', 1, 20)), ce = money(v, 'ce', 'Capital employed'), nrr = percent(v, 'nrr', 'Normal rate');
    if (nrr === 0n) throw new InputError('Normal rate of return cannot be 0%.', 'nrr');
    const avg = averageProfit(ps), a = goodwillAverageProfit(avg, years), s = goodwillSuperProfit(avg, ce, nrr, years), c = goodwillCapitalisation(avg, nrr, ce);
    return [
      { kind: 'table', caption: 'Goodwill by the three methods', head: ['Method', 'Working', 'Goodwill'], numeric: [2], rows: [
        ['Average profit', `${R(avg)} × ${years}`, R(a)],
        ['Super profit', `(${R(avg)} − normal profit ${R(s.normalProfit)}) × ${years}`, R(s.goodwill)],
        ['Capitalisation', `${R(avg)} × 100/${nrr} = ${R(c.capitalisedValue)}, less capital employed ${R(ce)}`, R(c.goodwill)]] },
      { kind: 'bars', title: 'Same firm, three valuations', items: [bar('Average profit', a, 'a'), bar('Super profit', s.goodwill, 'b'), bar('Capitalisation', c.goodwill, 'c')] },
      { kind: 'steps', title: 'Working notes', steps: [`Average profit = ${ps.map(R).join(' + ')} ÷ ${ps.length} = ${R(avg)}`, `Normal profit = ${nrr}% × ${R(ce)} = ${R(s.normalProfit)}`, `Super profit = ${R(avg)} − ${R(s.normalProfit)} = ${R(s.superProfit)}${s.superProfit.isNegative() ? ' (negative: no goodwill by this method)' : ''}`] },
      note('The three methods answer slightly different questions, so they rarely agree. The question or the partnership deed tells you which one to use.', 'info'),
    ];
  },
};

// ───────────────────────────── Change of ratio ─────────────────────────────
export const ratioChangeLab: Lab = {
  id: 'xii-ratio-change', cls: 'XII', title: 'Change in Profit-Sharing Ratio Lab', clauses: ['XII.1.ratio-change'], skills: ['sacrifice'],
  summary: 'When existing partners change their ratio, find who gains, who sacrifices, and settle goodwill, reserves and revaluation.',
  concept: [
    'Sacrificing ratio = old share − new share (for a partner whose share falls). Gaining ratio = new share − old share (for a partner whose share rises).',
    'The gaining partners compensate the sacrificing partners for goodwill, in the gaining ratio. Reserves, accumulated profits and revaluation gains/losses belong to the OLD partners, so they are shared in the OLD ratio.',
  ],
  realWorld: 'A, B and C shared 4:3:3. C starts bringing in more clients and is given a bigger share, 3:2:5. A and B give up part of their future profit — so C must pay them for the goodwill they are giving up.',
  fields: [
    { id: 'old', label: 'Old ratio A:B:C', type: 'ratio' }, { id: 'new', label: 'New ratio A:B:C', type: 'ratio' },
    { id: 'gw', label: 'Goodwill of the firm (₹)', type: 'money' }, { id: 'res', label: 'Reserves + credit balance of P&L (₹)', type: 'money' }, { id: 'loss', label: 'Accumulated losses / debit P&L (₹)', type: 'money' }, { id: 'reval', label: 'Net revaluation gain (+) or loss (−) (₹)', type: 'money' },
    { id: 'capA', label: 'Capital of A (₹)', type: 'money' }, { id: 'capB', label: 'Capital of B (₹)', type: 'money' }, { id: 'capC', label: 'Capital of C (₹)', type: 'money' },
  ],
  example: { old: '4:3:3', new: '3:2:5', gw: '150000', res: '150000', loss: '0', reval: '25000', capA: '300000', capB: '250000', capC: '200000' },
  walkthrough: ['A: 4/10 → 3/10 sacrifices 1/10. B: 3/10 → 2/10 sacrifices 1/10. C: 3/10 → 5/10 gains 1/5.', 'Goodwill ₹1,50,000: C gains 1/5, so pays ₹30,000; A and B receive ₹15,000 each (their sacrifices are equal).', 'Reserves ₹1,50,000 and revaluation gain ₹25,000 are shared in the OLD ratio 4:3:3.', 'C\'s capital = 2,00,000 − 30,000 + 45,000 + 7,500 = ₹2,22,500.'],
  compute: v => {
    const ids = names(3), o = shareMap(ids, ratio(v, 'old', 'Old ratio', 3)), n = shareMap(ids, ratio(v, 'new', 'New ratio', 3));
    const ch = ratioChange(o, n), gw = goodwillOnRatioChange(optMoney(v, 'gw', 'Goodwill'), ch);
    const reserves = optMoney(v, 'res', 'Reserves'), loss = optMoney(v, 'loss', 'Losses'), reval = money(v, 'reval', 'Revaluation', { allowNegative: true, allowBlank: true });
    const pool = reserves.sub(loss).add(reval);
    const idsF = ids.map(i => o[i]!);
    const sp = pool.isZero() ? ids.map(() => Money.ZERO) : allocate(pool, idsF);
    const cap = Object.fromEntries(ids.map(i => [i, money(v, `cap${i}`, `Capital of ${i}`)])) as Record<string, Money>;
    const close = ids.map((i, k) => cap[i]!.add(gw[i]!).add(sp[k]!));
    return [
      { kind: 'table', caption: 'Who sacrifices and who gains', head: ['Partner', 'Old share', 'New share', 'Change'], numeric: [1, 2, 3], rows: ids.map(i => [i, sh(o[i]!), sh(n[i]!), ch.gain[i] ? `gains ${sh(ch.gain[i]!)}` : ch.sacrifice[i] ? `sacrifices ${sh(ch.sacrifice[i]!)}` : 'no change']) },
      { kind: 'ratio', title: 'Old ratio → new ratio', rows: [ratioRow('Old', ids, o), ratioRow('New', ids, n)] },
      { kind: 'table', caption: 'Adjusting the capital accounts', head: ['Partner', 'Capital before', 'Goodwill (+ receives / − pays)', 'Reserves & revaluation (old ratio)', 'Capital after'], numeric: [1, 2, 3, 4], rows: ids.map((i, k) => [i, R(cap[i]!), R(gw[i]!), R(sp[k]!), R(close[k]!)]), foot: ['Total', R(Money.sum(ids.map(i => cap[i]!))), R(Money.sum(ids.map(i => gw[i]!))), R(Money.sum(sp)), R(Money.sum(close))] },
      note('Goodwill adjustments cancel out (what gainers pay equals what sacrificers receive), so the firm\'s total capital is unchanged by them.', 'info'),
    ];
  },
};

// ───────────────────────────── Admission ─────────────────────────────
export const admissionLab: Lab = {
  id: 'xii-admission', cls: 'XII', title: 'Admission of a Partner Lab', clauses: ['XII.1.admission'], skills: ['admission-premium'],
  summary: 'Admit a new partner: premium for goodwill, revaluation, reserves, adjusted capitals and the new partner\'s capital.',
  concept: [
    'The new partner buys a share of the firm\'s goodwill — a premium paid to the OLD partners in their sacrificing ratio (his share comes out of theirs).',
    'Revaluation of assets/liabilities, reserves and accumulated profits/losses belong to the old partners and are shared in the OLD ratio, which changes the old partners\' capitals before he joins.',
    'The new partner\'s capital is set either in proportion to his profit share, or as a stated fraction of the old partners\' adjusted capital — read the question.',
  ],
  realWorld: 'X and Y own a clinic worth more than its books say. Z wants a 1/4 share. He pays X and Y for the goodwill and puts in capital so that his money matches his share.',
  fields: [
    { id: 'old', label: 'Old ratio X:Y', type: 'ratio' }, { id: 'capX', label: 'Capital of X (₹)', type: 'money' }, { id: 'capY', label: 'Capital of Y (₹)', type: 'money' },
    { id: 'share', label: 'New partner Z\'s share (fraction)', type: 'text', help: 'e.g. 1/4' }, { id: 'gw', label: 'Goodwill of the whole firm (₹)', type: 'money' },
    { id: 'reval', label: 'Net revaluation gain (+) / loss (−) (₹)', type: 'money' }, { id: 'res', label: 'General reserve etc. (credit) (₹)', type: 'money' }, { id: 'loss', label: 'Accumulated losses (debit) (₹)', type: 'money' },
    { id: 'rule', label: 'Z\'s capital is', type: 'select', options: [{ value: 'PROP', label: 'in proportion to his profit share' }, { value: 'FRAC', label: 'a fraction of the old partners\' adjusted capital' }] },
    { id: 'frac', label: 'That fraction (if chosen)', type: 'text', help: 'e.g. 1/4' },
  ],
  example: { old: '1:2', capX: '150000', capY: '300000', share: '1/4', gw: '60000', reval: '-36000', res: '6000', loss: '3000', rule: 'FRAC', frac: '1/4' },
  walkthrough: ['Z\'s premium = 1/4 × ₹60,000 = ₹15,000, shared by X and Y in the sacrificing ratio (= old ratio 1:2): X ₹5,000, Y ₹10,000.', 'Revaluation loss ₹36,000, reserve ₹6,000 and losses ₹3,000 are shared in the old ratio.', 'X: 1,50,000 + 5,000 − 12,000 + 2,000 − 1,000 = ₹1,44,000. Y: ₹2,88,000.', 'Z brings 1/4 of the old partners\' adjusted capital = ₹1,08,000.'],
  compute: v => {
    const ids = ['X', 'Y'], old = shareMap(ids, ratio(v, 'old', 'Old ratio', 2)), z = fraction(v, 'share', 'Z\'s share');
    const cap = { X: money(v, 'capX', 'Capital of X'), Y: money(v, 'capY', 'Capital of Y') };
    let r;
    try {
      r = admission({
        partners: [{ id: 'X', name: 'X' }, { id: 'Y', name: 'Y' }], oldShares: old, capitals: cap, newPartner: { id: 'Z', name: 'Z', share: z },
        goodwillOfFirm: optMoney(v, 'gw', 'Goodwill'), revaluation: money(v, 'reval', 'Revaluation', { allowNegative: true, allowBlank: true }), reserves: optMoney(v, 'res', 'Reserves'), accumulatedLosses: optMoney(v, 'loss', 'Losses'),
        ...(v.rule === 'FRAC' ? { newPartnerCapitalFractionOfOld: fraction(v, 'frac', 'The fraction') } : {}),
      });
    } catch (e) { if (e instanceof InputError) throw e; throw new InputError((e as Error).message); }
    const all = ['X', 'Y', 'Z'];
    return [
      { kind: 'table', caption: 'New profit-sharing ratio', head: ['Partner', 'Old share', 'Sacrifices', 'New share'], numeric: [1, 2, 3], rows: [...ids.map(i => [i, sh(old[i]!), sh(old[i]!.sub(r.newShares[i]!)), sh(r.newShares[i]!)]), ['Z', '—', '—', sh(z)]] },
      { kind: 'ratio', title: 'Z\'s share comes out of X and Y', rows: [ratioRow('Before', ids, old), ratioRow('After', all, r.newShares)] },
      { kind: 'table', caption: 'Capital accounts', head: ['Partner', 'Capital before', 'Premium received', 'Adjusted capital'], numeric: [1, 2, 3], rows: [...ids.map(i => [i, R(cap[i as 'X' | 'Y']), R(r.premiumShare[i]!), R(r.adjustedCapital[i]!)]), ['Z', '—', '—', R(r.newPartnerCapital)]], foot: ['Firm\'s total capital', '', '', R(r.firmCapital)] },
      { kind: 'bars', title: 'Capitals after admission', items: all.map(i => bar(i, i === 'Z' ? r.newPartnerCapital : r.adjustedCapital[i]!)) },
      { kind: 'steps', title: 'Working notes', steps: [`Z\'s premium for goodwill = ${sh(z)} × ${R(optMoney(v, 'gw', 'Goodwill'))} = ${R(r.premium)}`, `Sacrificing ratio = ${ids.map(i => sh(r.sacrificeRatio[i]!)).join(' : ')}`, `Z\'s capital = ${R(r.newPartnerCapital)}`] },
      note('The premium is paid to the old partners privately through their capital accounts; it is not a cost to the firm.', 'info'),
    ];
  },
};

// ───────────────────────────── Retirement / death ─────────────────────────────
export const exitLab: Lab = {
  id: 'xii-exit', cls: 'XII', title: 'Retirement & Death of a Partner Lab', clauses: ['XII.1.retirement', 'XII.1.death'], skills: ['exit-goodwill'],
  summary: 'Settle what is due to a retiring or deceased partner and, if it is paid in instalments, prepare the executor\'s (or loan) account.',
  concept: [
    'The remaining partners usually take over the leaving partner\'s share, so their share RISES — the gaining ratio. They pay his share of goodwill, debited to their capitals in the gaining ratio.',
    'Existing goodwill in the books is written off in the old ratio; revaluation, reserves and accumulated profits/losses are shared in the old ratio. The balance of the leaving partner\'s capital is what the firm owes him.',
    'The amount due can be paid at once, or transferred to his loan account (retirement) or his executor\'s account (death), with interest on the unpaid balance.',
  ],
  realWorld: 'A, B and C run a tailoring unit. C retires. A and B keep running it, take over C\'s share, and owe C his capital and his share of goodwill.',
  fields: [
    { id: 'old', label: 'Old ratio A:B:C', type: 'ratio' }, { id: 'exit', label: 'Leaving partner', type: 'select', options: [{ value: 'C', label: 'C' }, { value: 'B', label: 'B' }, { value: 'A', label: 'A' }] },
    { id: 'capA', label: 'Capital of A (₹)', type: 'money' }, { id: 'capB', label: 'Capital of B (₹)', type: 'money' }, { id: 'capC', label: 'Capital of C (₹)', type: 'money' },
    { id: 'gw', label: 'Goodwill of the firm (₹)', type: 'money' }, { id: 'oldgw', label: 'Goodwill already in the books (₹)', type: 'money' }, { id: 'res', label: 'Reserves (credit) (₹)', type: 'money' }, { id: 'reval', label: 'Net revaluation gain (+) / loss (−) (₹)', type: 'money' },
    { id: 'extra', label: 'Other amounts credited (+) / debited (−) to the leaving partner only (₹)', type: 'money', help: 'e.g. share of profit to date of death, interest on capital, drawings.' },
    { id: 'now', label: 'Paid immediately (₹, blank = nothing)', type: 'money', group: 'Payment of the balance (leave "Instalments" blank for a loan/lump sum)' }, { id: 'inst', label: 'Equal yearly instalments', type: 'int' },
    { id: 'rate', label: 'Interest on unpaid balance (% p.a.)', type: 'percent' }, { id: 'months', label: 'Months to the first instalment date', type: 'int' },
  ],
  example: { old: '2:2:1', exit: 'C', capA: '92000', capB: '60000', capC: '40000', gw: '45000', oldgw: '0', res: '10000', reval: '-2000', extra: '0', now: '', inst: '', rate: '', months: '12' },
  walkthrough: ['C held 1/5, so his share of goodwill = ₹9,000. A and B continue equally, so each pays ₹4,500.', 'Reserve ₹10,000 and revaluation loss ₹2,000 are shared in the old ratio 2:2:1.', 'C\'s capital: 40,000 + 9,000 (goodwill) + 2,000 (reserve) − 400 (revaluation) = ₹50,600 — the amount due to C.'],
  compute: v => {
    const ids = names(3), old = shareMap(ids, ratio(v, 'old', 'Old ratio', 3)), ex = (v.exit ?? 'C');
    const next = { ...newSharesAfterExit(old, ex), [ex]: Fraction.ZERO } as Record<string, Fraction>;
    const cap = Object.fromEntries(ids.map(i => [i, money(v, `cap${i}`, `Capital of ${i}`)])) as Record<string, Money>;
    const r = exitSettlement({ oldShares: old, newShares: next, exiting: ex, capitals: cap, goodwillOfFirm: optMoney(v, 'gw', 'Goodwill'), existingGoodwill: optMoney(v, 'oldgw', 'Existing goodwill'), reserves: optMoney(v, 'res', 'Reserves'), revaluation: money(v, 'reval', 'Revaluation', { allowNegative: true, allowBlank: true }), exitingAdjustments: money(v, 'extra', 'Other amounts', { allowNegative: true, allowBlank: true }) });
    const stay = ids.filter(i => i !== ex);
    const blocks: Block[] = [
      { kind: 'ratio', title: 'Profit-sharing before and after', rows: [ratioRow('Old', ids, old), ratioRow('New', ids, next)] },
      { kind: 'table', caption: 'Capital accounts', head: ['Partner', 'Capital before', 'Goodwill (+ receives / − pays)', 'Capital after'], numeric: [1, 2, 3], rows: ids.map(i => [i === ex ? `${i} (leaving)` : i, R(cap[i]!), R(r.goodwillCompensation[i]!), R(r.closingCapital[i]!)]) },
      note(`Amount due to ${ex}: ${R(r.amountDue)}. Gaining ratio of ${stay.join(' and ')}: ${stay.map(i => sh(next[i]!.sub(old[i]!))).join(' : ')}.`, 'good'),
    ];
    const instN = (v.inst ?? '').trim();
    if (instN !== '' && r.amountDue.isPositive()) {
      const n = whole(v, 'inst', 'Instalments', 1, 20), rate = percent(v, 'rate', 'Interest rate'), months = BigInt(whole(v, 'months', 'Months to first instalment', 1, 12));
      const now = optMoney(v, 'now', 'Immediate payment');
      if (now.cmp(r.amountDue) > 0) throw new InputError('The immediate payment cannot be more than the amount due.', 'now');
      const s = executorSchedule({ amountDue: r.amountDue, paidNow: now, instalments: n, ratePercent: rate, firstMonths: months, labels: ['Date of settlement', ...Array.from({ length: n }, (_, k) => `Instalment ${k + 1}`)] });
      blocks.push({ kind: 'table', caption: `${ex}'s Executor's / Loan Account`, head: ['When', 'Particulars', 'Debit (₹)', 'Credit (₹)'], numeric: [2, 3], rows: s.rows.map(x => [x.date, x.particulars, x.debit.isZero() ? '' : R(x.debit), x.credit.isZero() ? '' : R(x.credit)]), foot: ['Total interest', '', '', R(s.interestTotal)] });
      blocks.push(note(`Total paid = ${R(s.paidInTotal)} = amount due ${R(r.amountDue)} + interest ${R(s.interestTotal)}. Interest is charged on the balance still unpaid, so it falls each year.`, 'info'));
    }
    return blocks;
  },
};

// ───────────────────────────── Dissolution ─────────────────────────────
function parseAssets(text: string): { name: string; book: Money; realised?: Money; tangible: boolean }[] {
  return text.split(/\n+/).map(s => s.trim()).filter(Boolean).map((ln, i) => {
    const p = ln.split(':').map(s => s.trim());
    if (p.length < 2) throw new InputError(`Assets, line ${i + 1} ("${ln}"): write  Name : book value : realised value : T or I   (T = tangible, I = intangible; leave realised blank if not given).`, 'assets');
    const clean = (s: string) => s.replace(/[₹,\s]/g, '');
    try {
      const tangible = (p[3] ?? 'T').toUpperCase() !== 'I';
      return { name: p[0]!, book: Money.parse(clean(p[1]!)), tangible, ...(p[2] ? { realised: Money.parse(clean(p[2])) } : {}) };
    } catch { throw new InputError(`Assets, line ${i + 1} ("${ln}"): an amount is not valid.`, 'assets'); }
  });
}
export const dissolutionLab: Lab = {
  id: 'xii-dissolution', cls: 'XII', title: 'Dissolution of a Firm Lab', clauses: ['XII.1.dissolution'], skills: ['dissolution'],
  summary: 'Close a firm: sell assets, pay creditors, record realisation expenses, then settle each partner. Watch cash fall to exactly nil.',
  concept: [
    'On dissolution all assets (except cash/bank) and outside liabilities are moved to a Realisation Account. Assets are sold, liabilities paid, and the resulting profit or loss on realisation is shared in the profit-sharing ratio.',
    'Syllabus notes: if the realised value of a TANGIBLE asset is not given, take book value; for an INTANGIBLE asset, take nil. Scope excludes piecemeal distribution, sale to a company and insolvency of a partner.',
    'Reserves and accumulated profits/losses are shared first; a partner\'s loan is repaid with his capital. The cash left must equal what is paid out — if not, something was missed.',
  ],
  realWorld: 'Two friends close their shop. They sell the stock and furniture, pay the supplier, and whatever cash remains goes back to them according to their capital accounts.',
  fields: [
    { id: 'ratio', label: 'Profit-sharing ratio A:B', type: 'ratio' }, { id: 'capA', label: 'Capital of A (₹)', type: 'money' }, { id: 'capB', label: 'Capital of B (₹)', type: 'money' },
    { id: 'res', label: 'General reserve / P&L credit (₹)', type: 'money' }, { id: 'loanA', label: 'Loan from A (₹)', type: 'money' }, { id: 'cash', label: 'Cash and bank at start (₹)', type: 'money' },
    { id: 'assets', label: 'Assets: Name : book : realised : T/I  (one per line)', type: 'textarea' },
    { id: 'liabs', label: 'Outside liabilities: Name : book : paid  (paid blank = at book)', type: 'textarea' },
    { id: 'expFirm', label: 'Realisation expenses paid by the firm (₹)', type: 'money' }, { id: 'expB', label: 'Realisation expenses paid by B, borne by the firm (₹)', type: 'money' },
  ],
  example: { ratio: '3:2', capA: '80000', capB: '60000', res: '20000', loanA: '0', cash: '10000', assets: 'Debtors : 40000 : 35000 : T\nStock : 50000 : 45000 : T\nMachinery : 80000 : 70000 : T\nGoodwill : 10000 : 5000 : I', liabs: 'Creditors : 30000', expFirm: '3000', expB: '0' },
  walkthrough: ['Assets with book value ₹1,80,000 are moved to Realisation; they realise ₹1,55,000. Creditors ₹30,000 are paid in full.', 'Realisation Dr: ₹1,80,000 + ₹30,000 (paid) + ₹3,000 expenses = ₹2,13,000. Cr: ₹30,000 (liability transferred) + ₹1,55,000 = ₹1,85,000. Loss ₹28,000.', 'Shared 3:2: A ₹16,800, B ₹11,200. Reserve ₹20,000 is added first (A ₹12,000, B ₹8,000).', 'A is paid ₹75,200 and B ₹56,800 = ₹1,32,000 — exactly the cash left.'],
  compute: v => {
    const ids = ['A', 'B'], sh2 = shareMap(ids, ratio(v, 'ratio', 'Profit-sharing ratio', 2));
    const assets = parseAssets(v.assets ?? ''), liabs = (v.liabs ?? '').split(/\n+/).map(s => s.trim()).filter(Boolean).map((ln, i) => {
      const p = ln.split(':').map(s => s.trim()); if (p.length < 2) throw new InputError(`Liabilities, line ${i + 1} ("${ln}"): write  Name : book value : amount paid (optional).`, 'liabs');
      try { return { name: p[0]!, book: Money.parse(p[1]!.replace(/[₹,\s]/g, '')), ...(p[2] ? { paid: Money.parse(p[2].replace(/[₹,\s]/g, '')) } : {}) }; } catch { throw new InputError(`Liabilities, line ${i + 1} ("${ln}"): an amount is not valid.`, 'liabs'); }
    });
    const expenses = [] as { amount: Money; paidBy: 'FIRM' | string; borneBy: 'FIRM' | string }[];
    const ef = optMoney(v, 'expFirm', 'Expenses paid by firm'), eb = optMoney(v, 'expB', 'Expenses paid by B');
    if (ef.isPositive()) expenses.push({ amount: ef, paidBy: 'FIRM', borneBy: 'FIRM' }); if (eb.isPositive()) expenses.push({ amount: eb, paidBy: 'B', borneBy: 'FIRM' });
    const cap = { A: money(v, 'capA', 'Capital of A'), B: money(v, 'capB', 'Capital of B') };
    const d = dissolve({ partners: partners(2), shares: sh2, capitals: cap, reserves: optMoney(v, 'res', 'Reserves'), partnerLoans: { A: optMoney(v, 'loanA', 'Loan from A') }, assets, liabilities: liabs, cashAtStart: money(v, 'cash', 'Cash'), expenses });
    const realised = (a: (typeof assets)[number]) => a.realised ?? (a.tangible ? a.book : Money.ZERO);
    const rd: [string, Money][] = [...assets.map(a => [`To ${a.name}`, a.book] as [string, Money]), ...liabs.map(l => [`To Bank (${l.name} paid)`, l.paid ?? l.book] as [string, Money]), ...expenses.map(e => ['To expenses', e.amount] as [string, Money])];
    const rc: [string, Money][] = [...liabs.map(l => [`By ${l.name}`, l.book] as [string, Money]), ...assets.map(a => [`By Bank (${a.name} realised)${a.realised ? '' : a.tangible ? ' — at book value' : ' — nil'}`, realised(a)] as [string, Money])];
    const n = Math.max(rd.length, rc.length);
    const final = ids.map(i => d.finalCapital[i]!);
    const reserves = optMoney(v, 'res', 'Reserves');
    const resShare = reserves.isZero() ? ids.map(() => Money.ZERO) : allocate(reserves, ids.map(i => sh2[i]!));
    const loanA = optMoney(v, 'loanA', 'Loan from A');
    // whatever is left once capital, reserve, loan and the realisation result are counted = expenses a partner paid on the firm's behalf
    const other = ids.map((i, k) => final[k]!.sub(cap[i as 'A' | 'B']).sub(resShare[k]!).sub(i === 'A' ? loanA : Money.ZERO).sub(d.profitShare[i]!));
    return [
      { kind: 'table', caption: 'Realisation Account', head: ['Debit', '₹', 'Credit', '₹'], numeric: [1, 3], rows: [...Array.from({ length: n }, (_, i) => [rd[i]?.[0] ?? '', rd[i] ? R(rd[i]![1]) : '', rc[i]?.[0] ?? '', rc[i] ? R(rc[i]![1]) : '']), [d.profitOnRealisation.isNegative() ? '' : 'To Profit (to partners)', d.profitOnRealisation.isNegative() ? '' : R(d.profitOnRealisation), d.profitOnRealisation.isNegative() ? 'By Loss (to partners)' : '', d.profitOnRealisation.isNegative() ? R(d.profitOnRealisation.neg()) : '']], foot: ['Total', R(d.realisationDebit.add(d.profitOnRealisation.isNegative() ? Money.ZERO : d.profitOnRealisation)), 'Total', R(d.realisationCredit.add(d.profitOnRealisation.isNegative() ? d.profitOnRealisation.neg() : Money.ZERO))] },
      { kind: 'table', caption: 'Partners\' final settlement', head: ['', 'A', 'B'], numeric: [1, 2], rows: [
        ['Capital', R(cap.A), R(cap.B)],
        ['Add: share of reserve', R(resShare[0]!), R(resShare[1]!)],
        ['Add: loan from partner', R(optMoney(v, 'loanA', 'Loan from A')), R(Money.ZERO)],
        [d.profitOnRealisation.isNegative() ? 'Less: share of loss on realisation' : 'Add: share of profit on realisation', R(d.profitShare.A!), R(d.profitShare.B!)],
        ['Add: expenses paid by partner / other adjustments', R(other[0]!), R(other[1]!)]],
        foot: ['Paid to partner', R(final[0]!), R(final[1]!)] },
      { kind: 'bars', title: 'Final payment to each partner', items: ids.map((i, k) => bar(`Partner ${i}`, final[k]!)) },
      note(d.cashEnd.isZero() ? '✓ Cash is exactly used up: what is paid to the partners equals the cash left after paying creditors and expenses.' : `✗ Cash does not agree: ${R(d.cashEnd)} left over (positive) or short (negative). Something was missed.`, d.cashEnd.isZero() ? 'good' : 'bad'),
    ];
  },
};
export const PARTNERSHIP_LABS: Lab[] = [appropriation, goodwill, ratioChangeLab, admissionLab, exitLab, dissolutionLab];
