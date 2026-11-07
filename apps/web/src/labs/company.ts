import {
  CASH_FLOW_CLASSIFICATION, Money, ShareError, cashFlowStatement, commonSize, comparative, costOfRevenueFromOperations, currentRatio, debentureInterest, debtEquityRatio, debtToCapitalEmployed,
  fixedAssetTurnoverRatio, forfeit, grossProfitRatio, interestCoverageRatio, inventoryTurnoverRatio, issueDebentures, issueShares, netAssetTurnoverRatio, netProfitRatio, operatingProfitRatio,
  operatingRatio, payablesTurnoverRatio, profitAfterTax, proprietaryRatio, quickRatio, receivablesTurnoverRatio, reissue, returnOnInvestment, shareCapitalNote, totalAssetsToDebtRatio,
  workingCapitalTurnoverRatio, writeOffIssueLosses, type Instalment, type RatioResult,
} from '../../../../packages/engine/src';
import { InputError, type Block, type Lab } from '../spec';
import { money, num, optMoney, percent, whole } from '../inputs';
import { bar, note, R } from './common';

// ───────────────────────────── Share issue → forfeiture → re-issue ─────────────────────────────
export const shares: Lab = {
  id: 'xii-shares', cls: 'XII', title: 'Share Capital Lab', clauses: ['XII.2.issue', 'XII.2.forfeiture', 'XII.2.disclosure', 'XII.2.fundamentals'], skills: ['pro-rata', 'forfeit', 'reissue'],
  summary: 'Follow an issue of shares from application to re-issue: pro-rata allotment, calls in arrears, forfeiture, re-issue and the balance-sheet note.',
  concept: [
    'A company raises money by issuing shares, usually in instalments: application, allotment and calls. Shares may be issued at par or at a premium (the premium goes to Securities Premium, not share capital).',
    'If applications exceed the shares offered, some are rejected and the rest are allotted pro-rata. Money paid on shares NOT allotted is refunded or adjusted against allotment.',
    'A shareholder who does not pay a call can have the shares forfeited: share capital is debited with the amount called, and the money already received on it is kept in the Share Forfeited account. When the shares are re-issued, any gain left in that account becomes Capital Reserve. Syllabus limit: interest on calls in arrears/advance is excluded.',
  ],
  realWorld: 'A start-up offers 1,00,000 shares. Investors apply for 1,60,000. Some are turned away, the rest get two-thirds of what they asked for, and their extra application money is used towards the next instalment.',
  fields: [
    { id: 'face', label: 'Face value per share (₹)', type: 'money' }, { id: 'offered', label: 'Shares offered', type: 'int' },
    { id: 'appT', label: 'Application money per share, total (₹)', type: 'money', group: 'Instalments (per share, each including its premium part)' }, { id: 'appP', label: '… of which premium (₹)', type: 'money' },
    { id: 'alT', label: 'Allotment money, total (₹)', type: 'money' }, { id: 'alP', label: '… of which premium (₹)', type: 'money' },
    { id: 'caT', label: 'Call money, total (₹)', type: 'money' }, { id: 'caP', label: '… of which premium (₹)', type: 'money' },
    { id: 'rej', label: 'Applications rejected outright (shares)', type: 'int', group: 'Applications' }, { id: 'pro', label: 'Applications allotted pro-rata (shares applied for)', type: 'int' },
    { id: 'arrCall', label: 'Calls in arrears on the CALL (₹)', type: 'money', group: 'Non-payment' }, { id: 'arrAllot', label: 'Calls in arrears on ALLOTMENT (₹)', type: 'money' },
    { id: 'fShares', label: 'Shares forfeited', type: 'int', group: 'Forfeiture' },
    { id: 'rApp', label: 'Total received on those shares — application (₹)', type: 'money' }, { id: 'rAl', label: '… allotment (₹)', type: 'money' }, { id: 'rCa', label: '… call (₹)', type: 'money' },
    { id: 'reShares', label: 'Forfeited shares re-issued', type: 'int', group: 'Re-issue' }, { id: 'rePrice', label: 'Re-issue price per share (₹, as fully paid)', type: 'money' },
  ],
  example: { face: '10', offered: '100000', appT: '5', appP: '1', alT: '5', alP: '1', caT: '3', caP: '1', rej: '10000', pro: '150000', arrCall: '4500', arrAllot: '0', fShares: '1500', rApp: '7500', rAl: '7500', rCa: '0', reShares: '1000', rePrice: '12' },
  walkthrough: [
    'Applications: 10,000 shares rejected; the other 1,50,000 share the 1,00,000 shares offered, so each applicant gets 2/3 of what he asked for.',
    'Money on shares not allotted is first used against allotment; the rest is refunded.',
    '1,500 shares are forfeited because the call was unpaid: share capital is debited with the ₹10 called (₹15,000), Securities Premium with the unpaid ₹1 premium on call, and the ₹12,000 received on share capital goes to Share Forfeited.',
    '1,000 shares are re-issued at ₹12 as fully paid: ₹10 to share capital, ₹2 premium. Forfeited amount on them is ₹8 × 1,000 = ₹8,000, all of it Capital Reserve (no discount was given).',
  ],
  compute: v => {
    const face = money(v, 'face', 'Face value');
    const inst = (name: string, t: string, p: string): Instalment => { const tot = money(v, t, `${name} money`), pr = money(v, p, `${name} premium`); if (pr.cmp(tot) > 0) throw new InputError(`${name}: the premium part cannot exceed the instalment.`, p); return { name, face: tot.sub(pr), premium: pr }; };
    const instalments = [inst('Application', 'appT', 'appP'), inst('Allotment', 'alT', 'alP'), inst('First & Final Call', 'caT', 'caP')];
    const faceSum = Money.sum(instalments.map(i => i.face));
    if (!faceSum.equals(face)) throw new InputError(`The face parts of the instalments add up to ${R(faceSum)} but the face value is ${R(face)}. Check the premium parts.`);
    const offered = whole(v, 'offered', 'Shares offered', 1), rej = whole(v, 'rej', 'Rejected applications', 0), pro = whole(v, 'pro', 'Pro-rata applications', 1);
    const arrears: Record<number, Money> = {};
    const ac = optMoney(v, 'arrCall', 'Arrears on call'), aa = optMoney(v, 'arrAllot', 'Arrears on allotment');
    if (ac.isPositive()) arrears[2] = ac; if (aa.isPositive()) arrears[1] = aa;
    let r;
    try { r = issueShares({ company: 'Company', faceValue: face, instalments, offered: BigInt(offered), categories: [...(rej ? [{ label: 'rejected', applied: BigInt(rej), treatment: 'REJECT' as const }] : []), { label: 'pro-rata', applied: BigInt(pro), treatment: 'PRORATA' as const }], arrearsAmount: arrears }); }
    catch (e) { if (e instanceof ShareError) throw new InputError(e.message + ' Adjust the shares offered / applied for so that pro-rata allotment gives whole shares.'); throw e; }
    const blocks: Block[] = [];
    const subscribed = r.plan.accepted;
    blocks.push({ kind: 'lifecycle', stages: [
      { name: 'Application', detail: `${r.applicationReceived.format()} received on ${pro + rej} shares`, state: 'done' },
      { name: 'Allotment', detail: `${subscribed} shares allotted${r.plan.proRataRatio.toString() === '1' ? '' : ` (pro-rata ${r.plan.proRataRatio.toString()})`}; refund ${R(r.refund)}`, state: 'done' },
      { name: 'Call', detail: `due on ${subscribed} shares`, state: 'done' },
      { name: 'Payment status', detail: r.callsInArrears.isZero() ? 'all paid' : `calls in arrears ${R(r.callsInArrears)}`, state: r.callsInArrears.isZero() ? 'done' : 'issue' },
      { name: 'Forfeiture', detail: (v.fShares ?? '0') === '0' ? 'none' : `${v.fShares} shares forfeited`, state: (v.fShares ?? '0') === '0' ? 'skip' : 'issue' },
      { name: 'Re-issue', detail: (v.reShares ?? '0') === '0' ? 'none' : `${v.reShares} shares re-issued`, state: (v.reShares ?? '0') === '0' ? 'skip' : 'done' },
    ] });
    blocks.push({ kind: 'heading', text: 'Journal entries for the issue' });
    blocks.push({ kind: 'journal', entries: r.entries });
    blocks.push({ kind: 'table', caption: 'Totals after the issue', head: ['', '₹'], numeric: [1], rows: [['Share capital called up', R(r.shareCapital)], ['Securities premium', R(r.securitiesPremium)], ['Calls in arrears', R(r.callsInArrears)]] });
    const fN = whole(v, 'fShares', 'Shares forfeited', 0);
    let fRes: ReturnType<typeof forfeit> | undefined;
    if (fN > 0) {
      fRes = forfeit({ shares: BigInt(fN), called: instalments, receivedByInstalment: [optMoney(v, 'rApp', 'Application received'), optMoney(v, 'rAl', 'Allotment received'), optMoney(v, 'rCa', 'Call received')] });
      blocks.push({ kind: 'heading', text: 'Forfeiture' });
      blocks.push({ kind: 'journal', entries: [fRes.entry] });
      blocks.push(note(`Premium received on these shares (${R(fRes.premiumReceived)}) stays in Securities Premium; only the amount received on SHARE CAPITAL, ${R(fRes.forfeitedCredit)}, is credited to Share Forfeited.`, 'info'));
    }
    const reN = whole(v, 'reShares', 'Shares re-issued', 0);
    if (reN > 0) {
      if (!fRes) throw new InputError('Enter the shares forfeited before re-issuing any.', 'fShares');
      if (reN > fN) throw new InputError('You cannot re-issue more shares than were forfeited.', 'reShares');
      let re; try { re = reissue({ reissued: BigInt(reN), price: money(v, 'rePrice', 'Re-issue price'), faceValue: face, forfeitedPerShare: fRes.forfeitedCredit.mulRatio(1n, BigInt(fN), 'HALF_UP') }); } catch (e) { if (e instanceof ShareError) throw new InputError(e.message, 'rePrice'); throw e; }
      blocks.push({ kind: 'heading', text: 'Re-issue' });
      blocks.push({ kind: 'journal', entries: re.entries });
      blocks.push(note(re.discount.isPositive() ? `Discount of ${R(re.discount)} was allowed, so Capital Reserve is ${R(re.capitalReserve)} (forfeited amount on these shares − discount).` : `No discount was given, so the whole forfeited amount on these shares, ${R(re.capitalReserve)}, becomes Capital Reserve.`, 'good'));
    }
    const note1 = shareCapitalNote({ authorisedShares: BigInt(offered), face, issuedShares: BigInt(offered), fullyPaidShares: subscribed - BigInt(fN) + BigInt(reN), ...(fRes ? { forfeitedReceived: fRes.forfeitedCredit.mulRatio(BigInt(fN - reN), BigInt(fN), 'HALF_UP') } : {}) });
    blocks.push({ kind: 'table', caption: 'Share capital in the balance sheet (note)', head: ['', '₹'], numeric: [1], rows: [['Issued capital', R(note1.issued)], ['Subscribed and fully paid up', R(note1.subscribedAndPaid)], ['Add: forfeited shares (amount received)', R(note1.forfeitedAdded)]], foot: ['Total', R(note1.total)] });
    return blocks;
  },
};

// ───────────────────────────── Debentures ─────────────────────────────
export const debentures: Lab = {
  id: 'xii-debentures', cls: 'XII', title: 'Debentures Lab', clauses: ['XII.2.debentures'], skills: ['debenture-issue'],
  summary: 'Issue debentures at par, premium or discount, with terms of redemption — and see the discount, loss and premium on redemption.',
  concept: [
    'A debenture is a loan to the company, repayable later, carrying fixed interest. It can be issued at par, at a premium, or at a discount.',
    'If the debenture will be redeemed at a premium, that extra payment is a liability created NOW: credit "Premium on Redemption of Debentures", and debit "Loss on Issue of Debentures" for the same amount. A discount on issue is a separate debit.',
    'Official note: discount and loss on issue are written off in the year of allotment, first from Securities Premium (if any), then from the Statement of P&L as finance cost. Syllabus limits: TDS is excluded, and journal entries for the REDEMPTION itself are not prescribed — so this lab deliberately stops at issue.',
  ],
  realWorld: 'A company borrows by issuing 10% debentures of ₹100 at ₹90 each (a discount), promising to repay ₹105 later. The company will eventually pay back more than it received — that gap is recorded up front.',
  fields: [
    { id: 'rate', label: 'Interest rate on debentures (%)', type: 'percent' }, { id: 'count', label: 'Number of debentures', type: 'int' }, { id: 'face', label: 'Face value (₹)', type: 'money' },
    { id: 'issue', label: 'Issue price (% of face value)', type: 'int', help: '90 = 10% discount, 100 = at par, 120 = 20% premium.' }, { id: 'redeem', label: 'Redemption price (% of face value)', type: 'int', help: '100 = at par, 105 = 5% premium.' },
    { id: 'months', label: 'Months for which interest is calculated', type: 'int' }, { id: 'sp', label: 'Balance in Securities Premium (₹)', type: 'money' },
  ],
  example: { rate: '12', count: '750', face: '100', issue: '90', redeem: '105', months: '6', sp: '0' },
  walkthrough: ['750 debentures at ₹90 = ₹67,500 received for debentures with face value ₹75,000.', 'Discount on issue = ₹10 × 750 = ₹7,500.', 'Redeemable at ₹105: premium on redemption = ₹5 × 750 = ₹3,750 — credited as a liability, and debited as Loss on Issue.', 'Interest for 6 months at 12% on ₹75,000 = ₹4,500 (interest is on FACE value).'],
  compute: v => {
    const count = BigInt(whole(v, 'count', 'Number of debentures', 1)), face = money(v, 'face', 'Face value'), rate = percent(v, 'rate', 'Interest rate');
    const issuePct = whole(v, 'issue', 'Issue price %', 50, 200), redPct = whole(v, 'redeem', 'Redemption price %', 100, 200);
    const d = issueDebentures({ rate: `${rate}%`, count, face, issuePrice: face.mulRatio(BigInt(issuePct), 100n, 'HALF_UP'), redemptionPrice: face.mulRatio(BigInt(redPct), 100n, 'HALF_UP') });
    const faceTotal = face.mulRatio(count, 1n, 'HALF_UP');
    const months = BigInt(whole(v, 'months', 'Months', 1, 12)), interest = debentureInterest(faceTotal, rate, months);
    const blocks: Block[] = [
      { kind: 'table', caption: 'What the issue does', head: ['', '₹'], numeric: [1], rows: [['Face value of debentures', R(faceTotal)], ['Cash received', R(d.received)], ['Discount on issue', R(d.discountOnIssue)], ['Premium received (Securities Premium)', R(d.premiumOnIssue)], ['Premium payable on redemption', R(d.premiumOnRedemption)], ['Loss on issue of debentures', R(d.lossOnIssue)]] },
      { kind: 'journal', entries: d.entries },
      { kind: 'bars', title: 'Face value vs cash received vs amount to be repaid', items: [bar('Cash received', d.received, 'a'), bar('Face value', faceTotal, 'b'), bar('To be repaid', faceTotal.add(d.premiumOnRedemption), 'c')] },
      { kind: 'table', head: ['Interest on debentures', '₹'], numeric: [1], rows: [[`${rate}% on face value ${R(faceTotal)} for ${months} months`, R(interest)]] },
    ];
    const loss = d.discountOnIssue.add(d.lossOnIssue);
    if (loss.isPositive()) { blocks.push({ kind: 'heading', text: 'Writing off discount and loss (year of allotment)' }); blocks.push({ kind: 'journal', entries: [writeOffIssueLosses(d.discountOnIssue, d.lossOnIssue, optMoney(v, 'sp', 'Securities premium'))] }); }
    blocks.push(note('Redemption entries are outside the 2026-27 syllabus, so this lab stops at issue and write-off.', 'info'));
    return blocks;
  },
};

// ───────────────────────────── Ratios ─────────────────────────────
export const ratios: Lab = {
  id: 'xii-ratios', cls: 'XII', title: 'Ratio Analysis Lab', clauses: ['XII.3.liquidity', 'XII.3.solvency', 'XII.3.activity', 'XII.3.profitability'], skills: ['ratio-liquidity', 'ratio-solvency', 'ratio-activity'], route: 'OPTION_I_ANALYSIS',
  summary: 'Enter a company\'s figures once and get every prescribed ratio — with the formula, the substitution and what the answer means.',
  concept: ['Accounting ratios turn raw figures into comparable measures of liquidity (can it pay short-term dues), solvency (can it survive long-term), activity (how efficiently it uses assets) and profitability (how much it earns).', 'Each ratio is shown with its formula, your numbers substituted in, the result, and a plain-language reading. A ratio on its own proves little — compare it over years or with similar firms.'],
  realWorld: 'A bank deciding whether to lend to a factory looks at its current ratio (can it pay suppliers?), debt-equity ratio (is it already over-borrowed?) and interest coverage (can profit pay the interest?).',
  fields: [
    { id: 'rev', label: 'Revenue from operations (net credit sales) (₹)', type: 'money', group: 'Profit & loss' }, { id: 'oi', label: 'Opening inventory (₹)', type: 'money' }, { id: 'pur', label: 'Purchases (net) (₹)', type: 'money' }, { id: 'dir', label: 'Direct expenses (₹)', type: 'money' }, { id: 'ci', label: 'Closing inventory (₹)', type: 'money' },
    { id: 'opex', label: 'Operating expenses (₹)', type: 'money' }, { id: 'int', label: 'Interest on long-term borrowings (₹)', type: 'money' }, { id: 'tax', label: 'Tax rate (%)', type: 'percent' },
    { id: 'ca', label: 'Current assets (₹)', type: 'money', group: 'Balance sheet' }, { id: 'pre', label: '… of which prepaid expenses (₹)', type: 'money' }, { id: 'cl', label: 'Current liabilities (₹)', type: 'money' },
    { id: 'ltd', label: 'Long-term debt (₹)', type: 'money' }, { id: 'sf', label: 'Shareholders\' funds (₹)', type: 'money' }, { id: 'nfa', label: 'Net fixed assets (₹)', type: 'money' },
    { id: 'or', label: 'Opening trade receivables (₹)', type: 'money' }, { id: 'cr', label: 'Closing trade receivables (₹)', type: 'money' }, { id: 'op', label: 'Opening trade payables (₹)', type: 'money' }, { id: 'cp', label: 'Closing trade payables (₹)', type: 'money' },
  ],
  example: { rev: '1000000', oi: '60000', pur: '600000', dir: '100000', ci: '80000', opex: '150000', int: '30000', tax: '30', ca: '400000', pre: '10000', cl: '200000', ltd: '300000', sf: '700000', nfa: '600000', or: '90000', cr: '110000', op: '70000', cp: '90000' },
  walkthrough: ['Cost of revenue = 60,000 + 6,00,000 + 1,00,000 − 80,000 = ₹6,80,000, so gross profit = ₹3,20,000.', 'Operating profit = ₹3,20,000 − ₹1,50,000 = ₹1,70,000; after interest ₹30,000, profit before tax is ₹1,40,000.', 'Current ratio = 4,00,000 ÷ 2,00,000 = 2 : 1. Quick assets exclude inventory and prepaid expenses.'],
  compute: v => {
    const m = (id: string, label: string) => money(v, id, label);
    const rev = m('rev', 'Revenue'), oi = m('oi', 'Opening inventory'), ci = m('ci', 'Closing inventory'), pur = m('pur', 'Purchases'), dir = m('dir', 'Direct expenses'), opex = m('opex', 'Operating expenses'), intr = m('int', 'Interest'), taxR = percent(v, 'tax', 'Tax rate');
    const ca = m('ca', 'Current assets'), pre = m('pre', 'Prepaid expenses'), cl = m('cl', 'Current liabilities'), ltd = m('ltd', 'Long-term debt'), sf = m('sf', "Shareholders' funds"), nfa = m('nfa', 'Net fixed assets');
    const cost = costOfRevenueFromOperations({ openingInventory: oi, purchases: pur, directExpenses: dir, closingInventory: ci });
    const gp = rev.sub(cost), opProfit = gp.sub(opex), pbt = opProfit.sub(intr), { profitAfterTax: pat } = profitAfterTax(pbt, taxR);
    const ce = sf.add(ltd), totalAssets = ce.add(cl), wc = ca.sub(cl);
    const R_ = (fn: () => RatioResult): RatioResult | string => { try { return fn(); } catch (e) { return (e as Error).message; } };
    const list: (RatioResult | string)[] = [
      R_(() => currentRatio(ca, cl)), R_(() => quickRatio(ca, ci, pre, cl)),
      R_(() => debtEquityRatio(ltd, sf)), R_(() => totalAssetsToDebtRatio(totalAssets, ltd)), R_(() => proprietaryRatio(sf, totalAssets)), R_(() => interestCoverageRatio(opProfit, intr)), R_(() => debtToCapitalEmployed(ltd, ce)),
      R_(() => inventoryTurnoverRatio(cost, oi, ci)), R_(() => receivablesTurnoverRatio(rev, m('or', 'Opening receivables'), m('cr', 'Closing receivables'))), R_(() => payablesTurnoverRatio(pur, m('op', 'Opening payables'), m('cp', 'Closing payables'))),
      R_(() => fixedAssetTurnoverRatio(rev, nfa)), R_(() => netAssetTurnoverRatio(rev, ce)), R_(() => workingCapitalTurnoverRatio(rev, wc)),
      R_(() => grossProfitRatio(gp, rev)), R_(() => operatingRatio(cost, opex, rev)), R_(() => operatingProfitRatio(opProfit, rev)), R_(() => netProfitRatio(pbt, rev, 'BEFORE_TAX')), R_(() => netProfitRatio(pat, rev, 'AFTER_TAX')), R_(() => returnOnInvestment(opProfit, ce)),
    ];
    const ok = list.filter((x): x is RatioResult => typeof x !== 'string');
    const errs = list.filter((x): x is string => typeof x === 'string');
    const cats = ['LIQUIDITY', 'SOLVENCY', 'ACTIVITY', 'PROFITABILITY'] as const;
    const blocks: Block[] = [{ kind: 'table', caption: 'Figures derived from your inputs', head: ['', '₹'], numeric: [1], rows: [['Cost of revenue from operations', R(cost)], ['Gross profit', R(gp)], ['Operating profit', R(opProfit)], ['Profit before tax', R(pbt)], ['Profit after tax', R(pat)], ['Capital employed (shareholders\' funds + long-term debt)', R(ce)], ['Working capital (current assets − current liabilities)', R(wc)]] }];
    for (const c of cats) {
      const rs = ok.filter(r => r.category === c);
      blocks.push({ kind: 'table', caption: c.charAt(0) + c.slice(1).toLowerCase() + ' ratios', head: ['Ratio', 'Formula', 'Working', 'Result', 'What it tells you'], numeric: [3], rows: rs.map(r => [r.name, r.formula, r.working, r.display, r.reading]) });
    }
    for (const e of errs) blocks.push(note(e, 'warn'));
    return blocks;
  },
};

// ───────────────────────────── Comparative & common-size ─────────────────────────────
export const statements: Lab = {
  id: 'xii-statements', cls: 'XII', title: 'Comparative & Common-size Statements Lab', clauses: ['XII.3.comparative', 'XII.3.common-size', 'XII.3.statements'], skills: [], route: 'OPTION_I_ANALYSIS',
  summary: 'Compare two years line by line, and express every item as a percentage of revenue.',
  concept: ['A comparative statement puts two years side by side with the absolute change and the percentage change (change ÷ previous year × 100). If the previous figure is zero there is no base, so no percentage is shown.', 'A common-size statement expresses every item as a percentage of one base — revenue for the Statement of Profit and Loss — so firms of different sizes can be compared.'],
  realWorld: 'Revenue doubled — but did profit double too? A comparative statement shows costs may have grown faster than sales.',
  fields: [
    { id: 'rev1', label: 'Revenue — previous year (₹)', type: 'money' }, { id: 'rev2', label: 'Revenue — current year (₹)', type: 'money' },
    { id: 'cost1', label: 'Cost of revenue — previous year (₹)', type: 'money' }, { id: 'cost2', label: 'Cost of revenue — current year (₹)', type: 'money' },
    { id: 'exp1', label: 'Other expenses (e.g. wages) — previous year (₹)', type: 'money' }, { id: 'exp2', label: 'Other expenses — current year (₹)', type: 'money' },
    { id: 'int1', label: 'Interest — previous year (₹)', type: 'money' }, { id: 'int2', label: 'Interest — current year (₹)', type: 'money' }, { id: 'tax', label: 'Tax rate (%)', type: 'percent' },
  ],
  example: { rev1: '2000000', rev2: '4000000', cost1: '200000', cost2: '400000', exp1: '400000', exp2: '600000', int1: '100000', int2: '100000', tax: '50' },
  walkthrough: ['Revenue rises ₹20,00,000, i.e. 100%.', 'Expenses rise too, so profit before tax rises by a different percentage — compute each row\'s change ÷ its previous-year figure.', 'Common-size: every current-year item ÷ revenue × 100.'],
  compute: v => {
    const g = (id: string, label: string) => money(v, id, label), tax = percent(v, 'tax', 'Tax rate');
    const line = (a: string, b: string, label: string) => ({ label, previous: g(a, label + ' (previous)'), current: g(b, label + ' (current)') });
    const rev = line('rev1', 'rev2', 'Revenue from operations'), cost = line('cost1', 'cost2', 'Cost of revenue'), exp = line('exp1', 'exp2', 'Other expenses'), it = line('int1', 'int2', 'Interest');
    const tot = { label: 'Total expenses', previous: cost.previous.add(exp.previous).add(it.previous), current: cost.current.add(exp.current).add(it.current) };
    const pbt = { label: 'Profit before tax', previous: rev.previous.sub(tot.previous), current: rev.current.sub(tot.current) };
    const t1 = profitAfterTax(pbt.previous, tax), t2 = profitAfterTax(pbt.current, tax);
    const taxL = { label: 'Income tax', previous: t1.tax, current: t2.tax }, pat = { label: 'Profit after tax', previous: t1.profitAfterTax, current: t2.profitAfterTax };
    const rows = comparative([rev, cost, exp, it, tot, pbt, taxL, pat]);
    if (rev.current.isZero()) throw new InputError('Current-year revenue cannot be zero (it is the base of the common-size statement).', 'rev2');
    const cs = commonSize([rev, cost, exp, it, tot, pbt, taxL, pat].map(x => ({ label: x.label, amount: x.current })), rev.current);
    return [
      { kind: 'table', caption: 'Comparative Statement of Profit and Loss', head: ['Particulars', 'Previous year', 'Current year', 'Absolute change', '% change'], numeric: [1, 2, 3, 4], rows: rows.map(r => [r.label, R(r.previous), R(r.current), R(r.change), r.percentChange === null ? '— (no base)' : `${r.percentChange}%`]) },
      { kind: 'table', caption: 'Common-size Statement (current year, % of revenue)', head: ['Particulars', 'Amount', '% of revenue'], numeric: [1, 2], rows: cs.map(c => [c.label, R(c.amount), `${c.percent}%`]) },
      { kind: 'bars', title: 'Where each ₹100 of revenue goes (current year)', items: cs.filter(c => ['Cost of revenue', 'Other expenses', 'Interest', 'Income tax', 'Profit after tax'].includes(c.label)).map(c => ({ label: c.label, value: Number(c.percent), text: `${c.percent}%` })) },
    ];
  },
};

// ───────────────────────────── Cash flow ─────────────────────────────
export const cashflow: Lab = {
  id: 'xii-cashflow', cls: 'XII', title: 'Cash Flow Statement Lab', clauses: ['XII.4.classification', 'XII.4.preparation'], skills: ['cfo'], route: 'OPTION_I_ANALYSIS',
  summary: 'Prepare a cash flow statement by the indirect method and see cash move through operating, investing and financing streams.',
  concept: ['A cash flow statement explains why cash changed. Cash flows are grouped into operating (running the business), investing (buying/selling long-term assets and investments) and financing (raising or repaying capital and borrowings).', 'Indirect method (the only one in the syllabus): start from profit before tax, add back non-cash items (depreciation) and non-operating losses, deduct non-operating gains, then adjust for changes in working capital. Current investments count as cash equivalents; bank overdraft and cash credit are short-term borrowings (financing).'],
  realWorld: 'A firm shows a healthy profit yet struggles to pay wages. The cash flow statement reveals the profit is tied up in unpaid customer bills and new machinery.',
  fields: [
    { id: 'pbt', label: 'Net profit before tax (₹)', type: 'money', group: 'Operating activities' }, { id: 'dep', label: 'Depreciation & amortisation (₹)', type: 'money' }, { id: 'gl', label: 'Loss (+) / gain (−) on sale of assets (₹)', type: 'money' }, { id: 'ie', label: 'Interest expense (₹)', type: 'money' },
    { id: 'rec', label: 'Increase (+) / decrease (−) in trade receivables (₹)', type: 'money' }, { id: 'inv', label: 'Increase (+) / decrease (−) in inventory (₹)', type: 'money' }, { id: 'pay', label: 'Increase (+) / decrease (−) in trade payables (₹)', type: 'money' }, { id: 'tax', label: 'Income tax paid (₹)', type: 'money' },
    { id: 'buy', label: 'Purchase of fixed assets (₹)', type: 'money', group: 'Investing activities' }, { id: 'sell', label: 'Sale proceeds of fixed assets (₹)', type: 'money' },
    { id: 'sh', label: 'Issue of shares (₹)', type: 'money', group: 'Financing activities' }, { id: 'rep', label: 'Repayment of borrowings (₹)', type: 'money' }, { id: 'ip', label: 'Interest paid (₹)', type: 'money' }, { id: 'div', label: 'Dividend paid (₹)', type: 'money' },
    { id: 'open', label: 'Cash and cash equivalents — opening (₹)', type: 'money', group: 'Check' }, { id: 'close', label: 'Cash and cash equivalents — closing per balance sheet (₹)', type: 'money' },
  ],
  example: { pbt: '200000', dep: '40000', gl: '-15000', ie: '12000', rec: '25000', inv: '-10000', pay: '8000', tax: '30000', buy: '120000', sell: '40000', sh: '50000', rep: '30000', ip: '12000', div: '20000', open: '100000', close: '208000' },
  walkthrough: ['Start with ₹2,00,000. Add back depreciation ₹40,000 and interest ₹12,000 (non-cash / financing); deduct the ₹15,000 gain on sale (it belongs in investing). Operating profit before working capital = ₹2,37,000.', 'Receivables rose ₹25,000 (cash tied up: deduct); inventory fell ₹10,000 (cash freed: add); payables rose ₹8,000 (add). After tax paid ₹30,000, operating cash flow = ₹2,00,000.', 'Investing: −₹1,20,000 + ₹40,000 = −₹80,000. Financing: +50,000 − 30,000 − 12,000 − 20,000 = −₹12,000.', 'Net change +₹1,08,000: opening ₹1,00,000 → closing ₹2,08,000, which agrees with the balance sheet.'],
  compute: v => {
    const g = (id: string, label: string) => money(v, id, label, { allowNegative: true, allowBlank: true });
    const input = {
      netProfitBeforeTaxAndExtraordinary: g('pbt', 'Profit before tax'),
      adjustments: [{ label: 'Depreciation and amortisation', amount: g('dep', 'Depreciation') }, { label: 'Loss / (gain) on sale of assets', amount: g('gl', 'Loss/gain') }, { label: 'Interest expense', amount: g('ie', 'Interest expense') }],
      workingCapitalChanges: [{ label: 'Trade receivables', amount: g('rec', 'Receivables').neg() }, { label: 'Inventory', amount: g('inv', 'Inventory').neg() }, { label: 'Trade payables', amount: g('pay', 'Payables') }],
      taxPaid: g('tax', 'Tax paid'),
      investing: [{ label: 'Purchase of fixed assets', amount: g('buy', 'Purchase').neg() }, { label: 'Sale of fixed assets', amount: g('sell', 'Sale') }],
      financing: [{ label: 'Issue of shares', amount: g('sh', 'Shares') }, { label: 'Repayment of borrowings', amount: g('rep', 'Repayment').neg() }, { label: 'Interest paid', amount: g('ip', 'Interest paid').neg() }, { label: 'Dividend paid', amount: g('div', 'Dividend').neg() }],
      openingCashEquivalents: g('open', 'Opening cash'), ...((v.close ?? '').trim() ? { closingCashEquivalents: g('close', 'Closing cash') } : {}),
    };
    const r = cashFlowStatement(input);
    const sec = (title: string, items: { label: string; amount: Money }[], total: Money): string[][] => [[title, ''], ...items.map(i => [`   ${i.label}`, i.amount.isNegative() ? `(${R(i.amount.neg())})` : R(i.amount)]), [`Net cash from ${title.toLowerCase()}`, R(total)]];
    const blocks: Block[] = [
      { kind: 'streams', items: [{ label: 'Operating', value: num(r.cashFromOperating), text: R(r.cashFromOperating.abs()) }, { label: 'Investing', value: num(r.cashFromInvesting), text: R(r.cashFromInvesting.abs()) }, { label: 'Financing', value: num(r.cashFromFinancing), text: R(r.cashFromFinancing.abs()) }], net: `Net change in cash: ${r.netChange.isNegative() ? '−' : '+'}${R(r.netChange.abs())}` },
      { kind: 'table', caption: 'Cash Flow Statement (indirect method)', head: ['Particulars', '₹'], numeric: [1], rows: [
        ['Profit before tax', R(input.netProfitBeforeTaxAndExtraordinary)], ...input.adjustments.map(a => [`   ${a.amount.isNegative() ? 'Less' : 'Add'}: ${a.label}`, R(a.amount.abs())]),
        ['Operating profit before working capital changes', R(r.operatingProfitBeforeWorkingCapital)], ...input.workingCapitalChanges.map((a, i) => { const isAsset = i < 2; const cashUp = !a.amount.isNegative(); return [`   ${cashUp ? 'Add' : 'Less'}: ${isAsset ? (cashUp ? 'decrease' : 'increase') : (cashUp ? 'increase' : 'decrease')} in ${a.label.toLowerCase()}`, R(a.amount.abs())]; }),
        ['Cash generated from operations', R(r.cashGeneratedFromOperations)], ['   Less: income tax paid', R(input.taxPaid)],
        ...sec('Operating activities', [], r.cashFromOperating).slice(-1), ...sec('Investing activities', input.investing, r.cashFromInvesting), ...sec('Financing activities', input.financing, r.cashFromFinancing),
        ['Net increase / (decrease) in cash', R(r.netChange)], ['Opening cash and cash equivalents', R(input.openingCashEquivalents)]], foot: ['Closing cash and cash equivalents', R(r.closing)] },
    ];
    if (r.reconciles === true) blocks.push(note(`✓ Reconciled: closing cash ${R(r.closing)} agrees with the balance sheet.`, 'good'));
    else if (r.reconciles === false) blocks.push(note(`✗ Does not reconcile: the balance sheet shows ${R(Money.parse((v.close ?? '0').replace(/[₹,\s]/g, '')))} but the statement gives ${R(r.closing)} — a difference of ${R(r.difference!.abs())}. An item is missing, mis-signed or in the wrong section.`, 'bad'));
    blocks.push({ kind: 'table', caption: 'Where does each transaction go?', head: ['Transaction', 'Activity', 'Why'], rows: CASH_FLOW_CLASSIFICATION.map(c => [c.transaction, c.activity === 'NONE' ? 'Not a cash flow' : c.activity.charAt(0) + c.activity.slice(1).toLowerCase(), c.why]) });
    return blocks;
  },
};
export const COMPANY_LABS: Lab[] = [shares, debentures, ratios, statements, cashflow];
void whole;
