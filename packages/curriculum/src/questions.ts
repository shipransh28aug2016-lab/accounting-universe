/**
 * Practice questions. Every answer is COMPUTED by the engine from the generated numbers — never typed in — so there is
 * one source of truth. Stems are original (not copied from CBSE papers); the engine's behaviour on the real CBSE sample
 * paper is verified separately in packages/engine/test.
 */
import {
  Fraction, Money, admission, appropriate, averageProfit, currentRatio, debtEquityRatio, depreciationSchedule, disposeAsset, dissolve, forfeit, goodwillAverageProfit,
  goodwillSuperProfit, interestPA, invoice, issueDebentures, issueShares, inventoryTurnoverRatio, pct, profitByStatementOfAffairs, quickRatio, ratioChange, reconcile,
  reissue, suspenseFromTrialBalance, allotmentPayable, allotmentPlan, exitSettlement, newSharesAfterExit, cashFlowStatement, interestCoverageRatio,
  costOfRevenueFromOperations, goodwillOnRatioChange, cashBook, provisionDoubtful, openingEntry, revaluation, loanSchedule, callsInAdvance, type BrsKind,
} from '../../engine/src';
import { Rng } from './rng';

export type PartKind = 'MONEY' | 'FRACTION' | 'TEXT';
export interface Part { readonly label: string; readonly kind: PartKind; readonly answer: string; readonly marks: number; readonly unit?: string; }
export interface Distractor { readonly part: number; readonly value: string; readonly mistake: string; readonly fix: string; }
export interface Question {
  readonly id: string; readonly skill: string; readonly clause: string; readonly seed: number;
  readonly stem: string; readonly parts: readonly Part[];
  /** Hint ladder, gentlest first. Never contains the final answer. */
  readonly hints: readonly string[];
  /** Full worked solution, shown after answering (or in Observe mode). */
  readonly working: readonly string[];
  readonly distractors: readonly Distractor[];
  readonly marks: number;
}

type Gen = { skill: string; clause: string; title: string; make: (r: Rng, seed: number) => Omit<Question, 'id' | 'skill' | 'clause' | 'seed' | 'marks'> };
const M = (n: number | string) => (typeof n === 'number' ? Money.rupees(n) : Money.parse(n));
const R = (m: Money) => m.format();
const part = (label: string, answer: string, marks = 1, kind: PartKind = 'MONEY', unit?: string): Part => (unit ? { label, kind, answer, marks, unit } : { label, kind, answer, marks });
const ans = (m: Money) => m.toString();
const names = ['A', 'B', 'C'];

export const GENERATORS: readonly Gen[] = [
  // ───────────────────────────── Class XI ─────────────────────────────
  {
    skill: 'dep-wdv', clause: 'XI.2.depreciation', title: 'Written Down Value method',
    make: r => {
      const years = r.int(2, 3), rate = r.pick([10, 15, 20]), cost = r.multiple(20000, 200000, 10 ** (2 * years - 2));
      const rows = depreciationSchedule({ cost: M(cost), method: 'WDV', rate: pct(rate), years });
      const slm = M(cost).sub(pct(rate).of_(M(cost), 'HALF_UP').mulRatio(BigInt(years), 1n, 'HALF_UP'));
      return {
        stem: `A machine costing ${R(M(cost))} is depreciated at ${rate}% per annum on the Written Down Value method. What is its book value at the end of year ${years}?`,
        parts: [part(`Book value at end of year ${years}`, ans(rows[years - 1]!.closing))],
        hints: ['WDV means each year\'s depreciation is charged on the balance left AFTER the previous years\' depreciation — not on the original cost.', `Year 1: ${rate}% of ${R(M(cost))}. Year 2 starts from the closing value of year 1.`],
        working: rows.map(x => `Year ${x.year}: opening ${R(x.opening)}, depreciation ${rate}% = ${R(x.depreciation)}, closing ${R(x.closing)}`),
        distractors: [{ part: 0, value: ans(slm), mistake: 'You charged depreciation on the original cost every year (that is the Straight Line method).', fix: 'Under WDV the base shrinks each year: use the opening book value of that year.' }],
      };
    },
  },
  {
    skill: 'dep-slm', clause: 'XI.2.depreciation', title: 'Straight Line method',
    make: r => {
      const life = r.pick([4, 5, 8, 10]), cost = r.multiple(50000, 400000, 10000), scrap = r.multiple(0, 20000, 5000);
      const annual = M(cost).sub(M(scrap)).mulRatio(1n, BigInt(life), 'HALF_UP');
      return {
        stem: `An asset costs ${R(M(cost))}, has an estimated life of ${life} years and a scrap value of ${R(M(scrap))}. Find the annual depreciation by the Straight Line method.`,
        parts: [part('Annual depreciation', ans(annual))],
        hints: ['Depreciable amount = cost − scrap value. The scrap value is what you expect to recover, so it is never depreciated.', `Divide the depreciable amount by ${life} years.`],
        working: [`Depreciable amount = ${R(M(cost))} − ${R(M(scrap))} = ${R(M(cost).sub(M(scrap)))}`, `Annual depreciation = ${R(M(cost).sub(M(scrap)))} ÷ ${life} = ${R(annual)}`],
        distractors: scrap ? [{ part: 0, value: ans(M(cost).mulRatio(1n, BigInt(life), 'HALF_UP')), mistake: 'You divided the full cost by the life and forgot to deduct the scrap value first.', fix: 'Subtract the scrap value, then divide.' }] : [],
      };
    },
  },
  {
    skill: 'disposal', clause: 'XI.2.depreciation', title: 'Sale of an asset',
    make: r => {
      const cost = r.multiple(60000, 300000, 10000), rate = r.pick([10, 20]), years = 2;
      const rows = depreciationSchedule({ cost: M(cost), method: 'WDV', rate: pct(rate), years });
      const bv = rows[1]!.closing;
      const sale = bv.add(M(r.pick([-4000, -2500, 3000, 5000])));
      const acc = M(cost).sub(bv);
      const d = disposeAsset({ name: 'Machinery', cost: M(cost), accumulated: acc, saleProceeds: sale, method: 'ASSET_ACCOUNT' });
      return {
        stem: `Machinery bought for ${R(M(cost))} was depreciated at ${rate}% WDV for 2 years and then sold for ${R(sale)}. Find the book value at the date of sale and the profit (+) or loss (−) on sale.`,
        parts: [part('Book value at date of sale', ans(d.bookValue)), part('Profit (+) / Loss (−) on sale', ans(d.profitOrLoss))],
        hints: ['Book value = cost − depreciation charged so far.', 'Profit or loss = sale price − book value. Negative means a loss.'],
        working: [...rows.map(x => `Year ${x.year}: depreciation ${R(x.depreciation)}, closing ${R(x.closing)}`), `Profit/(loss) = ${R(sale)} − ${R(d.bookValue)} = ${R(d.profitOrLoss)}`],
        distractors: [{ part: 1, value: ans(M(cost).sub(sale)), mistake: 'You compared the sale price with the ORIGINAL cost.', fix: 'Compare it with the book value — the cost after depreciation.' }],
      };
    },
  },
  {
    skill: 'brs', clause: 'XI.2.brs', title: 'Bank reconciliation',
    make: r => {
      const cb = r.multiple(40000, 120000, 1000), unpres = r.multiple(2000, 12000, 500), charges = r.multiple(100, 900, 50);
      const items = [{ kind: 'CHEQUE_ISSUED_NOT_PRESENTED' as BrsKind, amount: M(unpres) }, { kind: 'BANK_CHARGES_NOT_IN_CASH_BOOK' as BrsKind, amount: M(charges) }];
      const res = reconcile(M(cb), 'CASH_BOOK', items);
      return {
        stem: `Bank balance as per the cash book is ${R(M(cb))}. Cheques issued for ${R(M(unpres))} have not yet been presented, and the bank has charged ${R(M(charges))} which is not yet entered in the cash book. Find the balance as per the pass book.`,
        parts: [part('Balance as per pass book', ans(res.end))],
        hints: ['A cheque you issued has reduced YOUR cash book but the bank has not paid it yet — so the bank still shows the higher balance.', 'Bank charges have already reduced the bank\'s balance but not yet yours.'],
        working: [`Cash book balance ${R(M(cb))}`, `Add: cheques issued but not presented ${R(M(unpres))}`, `Less: bank charges ${R(M(charges))}`, `Pass book balance = ${R(res.end)}`],
        distractors: [{ part: 0, value: ans(M(cb).sub(M(unpres)).sub(M(charges))), mistake: 'You deducted the unpresented cheques again.', fix: 'The cash book already deducted them; the bank has not, so ADD them back.' }],
      };
    },
  },
  {
    skill: 'gst', clause: 'XI.2.subsidiary', title: 'Invoice with trade discount, freight and GST',
    make: r => {
      const list = r.multiple(10000, 80000, 1000), td = r.pick([5, 10, 20]), g = r.pick([5, 12, 18]);
      let fr = r.multiple(200, 1500, 100);
      if (fr === list * td / 100) fr += 100;                  // else taxable == list price and 'GST on list price' would be CORRECT
      const inv = invoice({ listPrice: M(list), tradeDiscountPercent: BigInt(td), freight: M(fr), gstPercent: BigInt(g) });
      const wrong = M(list).sub(inv.tradeDiscount).add(M(fr)).add(M(list).mulRatio(BigInt(g), 100n, 'HALF_UP'));
      return {
        stem: `Goods are listed at ${R(M(list))} less ${td}% trade discount. Freight of ${R(M(fr))} is billed to the buyer. GST is charged at ${g}% (intra-state). What is the total invoice value?`,
        parts: [part('Taxable value', ans(inv.taxable)), part('Total invoice value', ans(inv.total))],
        hints: ['Trade discount comes off the list price first; freight billed is added. That is the taxable value.', `GST (${g}%) is charged on the taxable value, not on the list price.`],
        working: [`Trade discount = ${R(inv.tradeDiscount)}`, `Taxable value = ${R(M(list))} − ${R(inv.tradeDiscount)} + ${R(M(fr))} = ${R(inv.taxable)}`, `GST ${g}% = ${R(inv.totalTax)} (CGST ${R(inv.cgst)} + SGST ${R(inv.sgst)})`, `Invoice total = ${R(inv.total)}`],
        distractors: [{ part: 1, value: ans(wrong), mistake: 'You calculated GST on the list price instead of the taxable value.', fix: 'Deduct trade discount and add freight BEFORE applying GST.' }],
      };
    },
  },
  {
    skill: 'suspense', clause: 'XI.2.errors', title: 'Suspense account',
    make: r => {
      const dr = r.multiple(300000, 900000, 1000), diff = r.multiple(500, 9000, 500), debitShort = r.next() < 0.5;
      const d = debitShort ? dr - diff : dr, c = debitShort ? dr : dr - diff;
      const s = suspenseFromTrialBalance(M(d), M(c))!;
      return {
        stem: `A trial balance shows debit total ${R(M(d))} and credit total ${R(M(c))}. A suspense account is opened to make it agree. What is the amount of the suspense account and on which side does it appear?`,
        parts: [part('Suspense account amount', ans(s.amount)), part('Side (Debit/Credit)', s.side === 'DR' ? 'Debit' : 'Credit', 1, 'TEXT')],
        hints: ['Find which side of the trial balance is SHORT.', 'The suspense account is placed on the short side so that both totals become equal.'],
        working: [`Difference = ${R(s.amount)}`, `${debitShort ? 'Debit' : 'Credit'} side is short, so the suspense account is shown on the ${s.side === 'DR' ? 'debit' : 'credit'} side.`],
        distractors: [{ part: 1, value: s.side === 'DR' ? 'Credit' : 'Debit', mistake: 'You put the suspense account on the larger side.', fix: 'It goes on the SHORT side, which makes the totals equal.' }],
      };
    },
  },
  {
    skill: 'pdd', clause: 'XI.3.adjustments', title: 'Provision for doubtful debts',
    make: r => {
      const debtors = r.multiple(80000, 300000, 10000), bad = r.multiple(2000, 10000, 1000), rate = r.pick([2, 5, 10]), old = r.multiple(1000, 5000, 500);
      const base = M(debtors).sub(M(bad));
      const newP = base.mulRatio(BigInt(rate), 100n, 'HALF_UP');
      const charge = newP.sub(M(old));
      return {
        stem: `Debtors are ${R(M(debtors))}. Further bad debts of ${R(M(bad))} are to be written off, and a provision for doubtful debts of ${rate}% is to be kept on the remaining debtors. The existing provision is ${R(M(old))}. Find the new provision and the amount to be debited (+) or credited (−) to the Profit & Loss account for the provision.`,
        parts: [part('New provision', ans(newP)), part('Charge (+) / credit (−) to P&L for the provision', ans(charge))],
        hints: ['The provision is calculated on debtors AFTER deducting the further bad debts.', 'The P&L bears only the CHANGE: new provision − old provision.'],
        working: [`Debtors after bad debts = ${R(M(debtors))} − ${R(M(bad))} = ${R(base)}`, `New provision = ${rate}% × ${R(base)} = ${R(newP)}`, `P&L effect = ${R(newP)} − ${R(M(old))} = ${R(charge)}`],
        distractors: [
          { part: 0, value: ans(M(debtors).mulRatio(BigInt(rate), 100n, 'HALF_UP')), mistake: 'You applied the rate to the gross debtors.', fix: 'Deduct the further bad debts first.' },
          { part: 1, value: ans(newP), mistake: 'You charged the whole new provision to P&L and ignored the old one.', fix: 'Subtract the existing provision — only the increase (or decrease) is an expense.' },
        ],
      };
    },
  },
  {
    skill: 'soa', clause: 'XI.3.incomplete', title: 'Profit by Statement of Affairs',
    make: r => {
      const open = r.multiple(100000, 300000, 10000), close = open + r.multiple(20000, 90000, 5000), drawings = r.multiple(10000, 40000, 5000);
      let fresh = r.multiple(0, 30000, 10000);
      if (fresh === drawings) fresh += 5000;                    // otherwise 'profit = increase in capital' would be CORRECT, not a mistake
      const p = profitByStatementOfAffairs({ openingCapital: M(open), closingCapital: M(close), drawings: M(drawings), additionalCapital: M(fresh) });
      return {
        stem: `A trader keeps incomplete records. Capital at the start was ${R(M(open))} and at the end ${R(M(close))}. During the year he withdrew ${R(M(drawings))} and brought in ${R(M(fresh))} of fresh capital. Find the profit for the year.`,
        parts: [part('Profit for the year', ans(p))],
        hints: ['Closing capital = opening capital + profit − drawings + fresh capital.', 'Rearrange to find profit.'],
        working: [`Increase in capital = ${R(M(close))} − ${R(M(open))} = ${R(M(close).sub(M(open)))}`, `Add back drawings ${R(M(drawings))}; deduct fresh capital ${R(M(fresh))}`, `Profit = ${R(p)}`],
        distractors: [{ part: 0, value: ans(M(close).sub(M(open))), mistake: 'You took the increase in capital as the profit.', fix: 'Drawings reduced capital and fresh capital increased it — adjust for both.' }],
      };
    },
  },
  // ───────────────────────────── Class XII · Partnership ─────────────────────────────
  {
    skill: 'guarantee', clause: 'XII.1.guarantee', title: 'Guarantee of profit',
    make: r => {
      const w = r.pick([[4, 3, 3], [5, 3, 2], [2, 2, 1]]), profit = r.multiple(30000, 60000, 5000), min = profit + r.multiple(10000, 30000, 5000);
      const sh = Object.fromEntries(names.map((n, i) => [n, Fraction.fromRatio(w)[i]!]));
      const a = appropriate({ partners: names.map(n => ({ id: n, name: n })), netProfit: M(profit), shares: sh, guarantee: { partner: 'C', minimum: M(min), bornBy: ['A', 'B'], borneRatio: { A: Fraction.of(1, 2), B: Fraction.of(1, 2) } } });
      const cShare = a.shareOfResidual.C!;
      return {
        stem: `A, B and C share profits ${w.join(':')}. C is guaranteed a minimum profit of ${R(M(min))} a year; any deficiency is borne by A and B equally. The profit for the year is ${R(M(profit))}. How much deficiency does each of A and B bear?`,
        parts: [part('Deficiency borne by A', ans(a.guaranteeBorne.A!)), part('Deficiency borne by B', ans(a.guaranteeBorne.B!))],
        hints: ['First find C\'s ordinary share of the profit.', 'Deficiency = guaranteed amount − C\'s ordinary share. Then split it as the deed says (equally here).'],
        working: [`C\'s share = ${R(cShare)}`, `Deficiency = ${R(M(min))} − ${R(cShare)} = ${R(M(min).sub(cShare))}`, `A bears ${R(a.guaranteeBorne.A!)} and B bears ${R(a.guaranteeBorne.B!)}`],
        distractors: [{ part: 0, value: ans(M(min).sub(cShare)), mistake: 'You made A bear the whole deficiency.', fix: 'Split the deficiency between A and B in the ratio the question gives.' }],
      };
    },
  },
  {
    skill: 'int-drawings', clause: 'XII.1.appropriation', title: 'Interest on drawings',
    make: r => {
      const dr = r.multiple(20000, 120000, 10000), rate = r.pick([6, 8, 10, 12]);
      const i = interestPA(M(dr), BigInt(rate), 6n);
      return {
        stem: `A partner withdrew ${R(M(dr))} during the year at different dates (no dates are given). Interest on drawings is charged at ${rate}% per annum. Calculate the interest.`,
        parts: [part('Interest on drawings', ans(i))],
        hints: ['When dates are not given, the average period is taken as 6 months.', 'Interest = drawings × rate × 6/12.'],
        working: [`Interest = ${R(M(dr))} × ${rate}% × 6/12 = ${R(i)}`],
        distractors: [{ part: 0, value: ans(interestPA(M(dr), BigInt(rate), 12n)), mistake: 'You charged a full year\'s interest.', fix: 'Without dates, assume the money was drawn on average for 6 months.' }],
      };
    },
  },
  {
    skill: 'goodwill-avg', clause: 'XII.1.goodwill', title: 'Goodwill — average profit',
    make: r => {
      // exam-style numbers: the three profits add up to a multiple of 3, so the average is exact (no paise ambiguity)
      const p1 = r.multiple(80000, 200000, 10000), p2 = r.multiple(80000, 200000, 10000);
      let p3 = r.multiple(80000, 200000, 10000);
      while ((p1 + p2 + p3) % 30000 !== 0) p3 += 10000;
      const ps = [p1, p2, p3];
      const yrs = r.pick([2, 3]);
      const avg = averageProfit(ps.map(M)), gw = goodwillAverageProfit(avg, BigInt(yrs));
      return {
        stem: `The profits of the last three years were ${ps.map(p => R(M(p))).join(', ')}. Goodwill is valued at ${yrs} years' purchase of the average profit. Find the goodwill.`,
        parts: [part('Average profit', ans(avg)), part('Goodwill', ans(gw))],
        hints: ['Average profit = total profit ÷ number of years.', 'Goodwill = average profit × number of years\' purchase.'],
        working: [`Average profit = ${R(M(ps[0]! + ps[1]! + ps[2]!))} ÷ 3 = ${R(avg)}`, `Goodwill = ${R(avg)} × ${yrs} = ${R(gw)}`],
        distractors: [{ part: 1, value: ans(M(ps[0]! + ps[1]! + ps[2]!).mulRatio(BigInt(yrs), 1n, 'HALF_UP')), mistake: 'You multiplied the TOTAL profit instead of the average.', fix: 'Divide by the number of years first.' }],
      };
    },
  },
  {
    skill: 'goodwill-super', clause: 'XII.1.goodwill', title: 'Goodwill — super profit',
    make: r => {
      const ce = r.multiple(500000, 1500000, 100000), nr = r.pick([8, 10, 12]), avg = Math.round(ce * nr / 100) + r.multiple(20000, 80000, 10000), yrs = r.pick([2, 3, 4]);
      const g = goodwillSuperProfit(M(avg), M(ce), BigInt(nr), BigInt(yrs));
      return {
        stem: `A firm\'s average profit is ${R(M(avg))}. Capital employed is ${R(M(ce))} and the normal rate of return is ${nr}%. Goodwill is valued at ${yrs} years\' purchase of super profit. Find the goodwill.`,
        parts: [part('Normal profit', ans(g.normalProfit)), part('Super profit', ans(g.superProfit)), part('Goodwill', ans(g.goodwill))],
        hints: ['Normal profit = capital employed × normal rate of return.', 'Super profit = average profit − normal profit. Goodwill = super profit × years\' purchase.'],
        working: [`Normal profit = ${nr}% × ${R(M(ce))} = ${R(g.normalProfit)}`, `Super profit = ${R(M(avg))} − ${R(g.normalProfit)} = ${R(g.superProfit)}`, `Goodwill = ${R(g.superProfit)} × ${yrs} = ${R(g.goodwill)}`],
        distractors: [{ part: 2, value: ans(M(avg).mulRatio(BigInt(yrs), 1n, 'HALF_UP')), mistake: 'You used the whole average profit instead of the super profit.', fix: 'Only the profit ABOVE the normal return counts as super profit.' }],
      };
    },
  },
  {
    skill: 'sacrifice', clause: 'XII.1.ratio-change', title: 'Sacrificing and gaining ratio',
    make: r => {
      const oldW = r.pick([[4, 3, 3], [5, 3, 2], [3, 2, 1]]); let newW = r.pick([[3, 2, 5], [1, 1, 1], [2, 3, 5]]);
      if (oldW.join() === newW.join()) newW = [1, 1, 1];
      const os = Object.fromEntries(names.map((n, i) => [n, Fraction.fromRatio(oldW)[i]!])), ns = Object.fromEntries(names.map((n, i) => [n, Fraction.fromRatio(newW)[i]!]));
      const ch = ratioChange(os, ns);
      const gainer = names.find(n => ch.gain[n]) ?? 'A';
      return {
        stem: `A, B and C share profits ${oldW.join(':')}. They decide to share future profits ${newW.join(':')}. Find the sacrifice (or gain) of ${gainer} as a fraction. (Give a gain as a positive fraction.)`,
        parts: [part(`${gainer}'s gain`, (ch.gain[gainer] ?? Fraction.ZERO).toString(), 1, 'FRACTION')],
        hints: ['Write each partner\'s old and new share as a fraction.', 'New share − old share: negative = sacrifice, positive = gain.'],
        working: names.map(n => `${n}: ${os[n]!.toString()} → ${ns[n]!.toString()} = ${ch.delta[n]!.isNegative() ? 'sacrifices ' + ch.delta[n]!.neg().toString() : 'gains ' + ch.delta[n]!.toString()}`),
        distractors: [],
      };
    },
  },
  {
    skill: 'admission-premium', clause: 'XII.1.admission', title: 'Admission — premium for goodwill',
    make: r => {
      const gw = r.multiple(60000, 240000, 20000), sh = r.pick([[1, 4], [1, 5], [1, 6]]), w = r.pick([[3, 2], [2, 1], [3, 1]]);
      const a = admission({
        partners: [{ id: 'X', name: 'X' }, { id: 'Y', name: 'Y' }], oldShares: { X: Fraction.fromRatio(w)[0]!, Y: Fraction.fromRatio(w)[1]! },
        capitals: { X: M(0), Y: M(0) }, newPartner: { id: 'Z', name: 'Z', share: Fraction.of(sh[0]!, sh[1]!) }, goodwillOfFirm: M(gw),
      });
      return {
        stem: `X and Y share profits ${w.join(':')}. Z is admitted for ${sh[0]}/${sh[1]} share. The goodwill of the firm is valued at ${R(M(gw))}. Z brings his share of goodwill in cash. How much goodwill premium does Z bring, and how much of it is credited to X?`,
        parts: [part('Z\'s premium', ans(a.premium)), part('Credited to X', ans(a.premiumShare.X!))],
        hints: ['Z brings his SHARE of the firm\'s goodwill: his fraction × total goodwill.', 'The premium is shared by the old partners in their SACRIFICING ratio. Z takes from X and Y in their old ratio, so the sacrificing ratio equals the old ratio.'],
        working: [`Premium = ${sh[0]}/${sh[1]} × ${R(M(gw))} = ${R(a.premium)}`, `Sacrificing ratio = old ratio ${w.join(':')}`, `X receives ${R(a.premiumShare.X!)}, Y receives ${R(a.premiumShare.Y!)}`],
        distractors: [{ part: 0, value: ans(M(gw)), mistake: 'You took the whole goodwill as Z\'s premium.', fix: 'Z pays only for the share he is getting.' }],
      };
    },
  },
  {
    skill: 'exit-goodwill', clause: 'XII.1.retirement', title: 'Retirement — goodwill paid by gaining partners',
    make: r => {
      const w = r.pick([[5, 3, 2], [3, 2, 1], [5, 4, 1]]), gw = r.multiple(60000, 300000, 30000);   // B ≠ C, so 'split equally' is genuinely wrong
      const os = Object.fromEntries(names.map((n, i) => [n, Fraction.fromRatio(w)[i]!]));
      const ns = { ...newSharesAfterExit(os, 'A'), A: Fraction.ZERO } as Record<string, Fraction>;
      const e = exitSettlement({ oldShares: os, newShares: ns, exiting: 'A', capitals: { A: M(0), B: M(0), C: M(0) }, goodwillOfFirm: M(gw) });
      return {
        stem: `A, B and C share profits ${w.join(':')}. A retires and B and C continue in their old ratio. Goodwill of the firm is ${R(M(gw))}. How much goodwill is due to A, and how much does B pay?`,
        parts: [part('Goodwill due to A', ans(e.goodwillCompensation.A!)), part('Paid by B', ans(e.goodwillCompensation.B!.neg()))],
        hints: ['A is compensated for his share of goodwill: his old fraction × total goodwill.', 'B and C pay it in their GAINING ratio. Because they continue in the old ratio, the gaining ratio = their old ratio.'],
        working: [`A's share = ${os.A!.toString()} × ${R(M(gw))} = ${R(e.goodwillCompensation.A!)}`, `B pays ${R(e.goodwillCompensation.B!.neg())}, C pays ${R(e.goodwillCompensation.C!.neg())}`],
        distractors: [{ part: 1, value: ans(e.goodwillCompensation.A!.mulRatio(1n, 2n, 'HALF_UP')), mistake: 'You split A\'s goodwill equally between B and C.', fix: 'Use the gaining ratio, not equal shares.' }],
      };
    },
  },
  {
    skill: 'dissolution', clause: 'XII.1.dissolution', title: 'Dissolution — realisation',
    make: r => {
      const book = r.multiple(200000, 400000, 20000), loss = r.multiple(10000, 40000, 10000), w = r.pick([[3, 2], [1, 1], [2, 1]]);
      const cap = { A: M(150000), B: M(100000) };
      const d = dissolve({ partners: [{ id: 'A', name: 'A' }, { id: 'B', name: 'B' }], shares: { A: Fraction.fromRatio(w)[0]!, B: Fraction.fromRatio(w)[1]! }, capitals: cap, cashAtStart: M(0), assets: [{ name: 'Assets', book: M(book), realised: M(book - loss), tangible: true }], liabilities: [] });
      return {
        stem: `A and B share profits ${w.join(':')}. On dissolution, assets with a book value of ${R(M(book))} realised ${R(M(book - loss))}; there were no outside liabilities. Capitals were A ${R(cap.A)} and B ${R(cap.B)}. Find the loss on realisation and the final amount paid to A.`,
        parts: [part('Loss on realisation', ans(d.profitOnRealisation.neg())), part('Final payment to A', ans(d.finalCapital.A!))],
        hints: ['Loss on realisation = book value of assets − amount realised.', 'The loss is shared in the profit-sharing ratio and deducted from each partner\'s capital; what is left is paid to him.'],
        working: [`Loss = ${R(M(book))} − ${R(M(book - loss))} = ${R(d.profitOnRealisation.neg())}`, `A's share of loss = ${R(d.profitShare.A!.neg())}`, `Paid to A = ${R(cap.A)} − ${R(d.profitShare.A!.neg())} = ${R(d.finalCapital.A!)}`],
        distractors: [],
      };
    },
  },
  // ───────────────────────────── Class XII · Companies ─────────────────────────────
  {
    skill: 'pro-rata', clause: 'XII.2.issue', title: 'Pro-rata allotment',
    make: r => {
      // choose numbers that give WHOLE shares: ratio = offered ÷ pro-rata applications, applicant applies for a multiple of its denominator
      const [offered, pro] = r.pick([[50000, 60000], [80000, 100000], [30000, 40000], [60000, 80000]] as const);
      const reject = r.pick([5000, 10000]), app = r.pick([2, 3]), allot = r.pick([3, 4, 5]);
      const plan = allotmentPlan(BigInt(offered), [{ label: 'rejected', applied: BigInt(reject), treatment: 'REJECT' }, { label: 'rest', applied: BigInt(pro), treatment: 'PRORATA' }]);
      const applied = Number(plan.proRataRatio.den) * r.int(100, 600);
      const q = allotmentPayable(BigInt(applied), plan.proRataRatio, M(app), M(allot));
      const due = M(allot).mulRatio(q.allotted, 1n, 'HALF_UP');
      return {
        stem: `A company offered ${offered} shares of ₹10 each. Applications for ${reject} shares were rejected outright. The remaining applicants, who had applied for ${pro} shares in all, were allotted ${offered} shares on a pro-rata basis. Application money was ₹${app} and allotment money ₹${allot} per share. One applicant had applied for ${applied} shares. How many shares is he allotted, and how much must he pay on allotment?`,
        parts: [part('Shares allotted', q.allotted.toString(), 1, 'TEXT'), part('Amount payable on allotment', ans(q.payable))],
        hints: [`The pro-rata ratio is shares available ÷ shares applied for = ${offered} : ${pro}, i.e. ${plan.proRataRatio.toString()}.`, 'Excess application money (paid on shares NOT allotted) is adjusted against the allotment money due.'],
        working: [`Ratio = ${offered} : ${pro} = ${plan.proRataRatio.toString()}`, `Shares allotted = ${applied} × ${plan.proRataRatio.toString()} = ${q.allotted}`, `Allotment due = ${q.allotted} × ₹${allot} = ${R(due)}`, `Less excess application money (${applied} − ${q.allotted} shares × ₹${app}) = ${R(q.excessApplication)}`, `Payable = ${R(q.payable)}`],
        distractors: [{ part: 1, value: ans(due), mistake: 'You ignored the excess application money.', fix: 'Deduct the application money paid on shares that were not allotted.' }],
      };
    },
  },
  {
    skill: 'forfeit', clause: 'XII.2.forfeiture', title: 'Forfeiture of shares',
    make: r => {
      const n = r.pick([100, 200, 500, 1000]), prem = r.pick([1, 2]), appPer = r.pick([3, 4]);
      const called = [{ name: 'Application', face: M(appPer), premium: M(prem) }, { name: 'Allotment', face: M(4), premium: M(0) }];
      const f = forfeit({ shares: BigInt(n), called, receivedByInstalment: [M(appPer + prem).mulRatio(BigInt(n), 1n, 'HALF_UP'), M(0)] });
      return {
        stem: `${n} shares of ₹10 each (issued at a premium of ₹${prem}) are forfeited because the holder did not pay the allotment money of ₹4. He had paid only the application money of ₹${appPer + prem} per share (including the ₹${prem} premium). What amount is credited to the Share Forfeited account?`,
        parts: [part('Share Forfeited A/c credit', ans(f.forfeitedCredit))],
        hints: ['Only the amount received on SHARE CAPITAL is credited to Share Forfeited.', 'Premium already received stays in the Securities Premium account — do not forfeit it.'],
        working: [`Received per share on application = ₹${appPer + prem}, of which premium ₹${prem}`, `Credited to Share Forfeited = ${n} × ₹${appPer} = ${R(f.forfeitedCredit)}`],
        distractors: [{ part: 0, value: ans(M(appPer + prem).mulRatio(BigInt(n), 1n, 'HALF_UP')), mistake: 'You included the premium received.', fix: 'Premium received is not forfeited.' }],
      };
    },
  },
  {
    skill: 'reissue', clause: 'XII.2.forfeiture', title: 'Re-issue of forfeited shares',
    make: r => {
      const n = r.pick([2000, 3000, 4000]), re = n / 2, forf = r.pick([3, 4, 5]), price = r.pick([8, 9]);
      const x = reissue({ reissued: BigInt(re), price: M(price), faceValue: M(10), forfeitedPerShare: M(forf) });
      return {
        stem: `${n} shares of ₹10, on which ₹${forf} per share had been received, were forfeited. Of these, ${re} shares were re-issued as fully paid at ₹${price} per share. What amount is transferred to Capital Reserve?`,
        parts: [part('Discount allowed on re-issue', ans(x.discount)), part('Capital Reserve', ans(x.capitalReserve))],
        hints: ['Discount on re-issue = face value − price received (per share × shares re-issued).', 'Capital reserve = forfeited amount on the shares re-issued − discount allowed.'],
        working: [`Discount = (₹10 − ₹${price}) × ${re} = ${R(x.discount)}`, `Forfeited amount on these shares = ${re} × ₹${forf} = ${R(M(forf).mulRatio(BigInt(re), 1n, 'HALF_UP'))}`, `Capital reserve = ${R(M(forf).mulRatio(BigInt(re), 1n, 'HALF_UP'))} − ${R(x.discount)} = ${R(x.capitalReserve)}`],
        distractors: [{ part: 1, value: ans(M(forf).mulRatio(BigInt(n), 1n, 'HALF_UP').sub(x.discount)), mistake: 'You used the forfeiture on ALL the shares, not just those re-issued.', fix: 'Only the forfeiture relating to the re-issued shares can be transferred.' }],
      };
    },
  },
  {
    skill: 'debenture-issue', clause: 'XII.2.debentures', title: 'Issue of debentures with terms of redemption',
    make: r => {
      const n = r.pick([500, 750, 1000]), disc = r.pick([5, 10]), rp = disc === 5 ? 10 : r.pick([5, 15]);   // discount ≠ redemption premium, so the two answers differ
      const d = issueDebentures({ rate: '10%', count: BigInt(n), face: M(100), issuePrice: M(100 - disc), redemptionPrice: M(100 + rp) });
      return {
        stem: `A company issues ${n} 10% debentures of ₹100 each at a discount of ${disc}%, redeemable at a premium of ${rp}%. Find the discount on issue and the loss on issue of debentures.`,
        parts: [part('Discount on issue', ans(d.discountOnIssue)), part('Loss on issue of debentures', ans(d.lossOnIssue))],
        hints: ['Discount on issue = (face − issue price) × number of debentures.', 'The premium payable on redemption is a loss now: it is debited as "Loss on issue of debentures" and credited as "Premium on redemption of debentures".'],
        working: [`Discount = ₹${disc} × ${n} = ${R(d.discountOnIssue)}`, `Premium on redemption = ₹${rp} × ${n} = ${R(d.premiumOnRedemption)} (= loss on issue)`],
        distractors: [{ part: 1, value: ans(d.discountOnIssue), mistake: 'You called the discount the "loss on issue".', fix: 'Discount and loss are separate: the loss equals the premium on redemption.' }],
      };
    },
  },
  // ───────────────────────────── Class XII · Analysis & cash flow ─────────────────────────────
  {
    skill: 'ratio-liquidity', clause: 'XII.3.liquidity', title: 'Current and quick ratio',
    make: r => {
      const cl = r.multiple(40000, 120000, 10000), inv = r.multiple(20000, 80000, 10000), pre = r.multiple(2000, 8000, 1000), liquid = r.multiple(60000, 200000, 10000);
      const ca = liquid + inv + pre;
      const c = currentRatio(M(ca), M(cl)), q = quickRatio(M(ca), M(inv), M(pre), M(cl));
      return {
        stem: `Current liabilities are ${R(M(cl))}. Current assets are ${R(M(ca))}, including inventory ${R(M(inv))} and prepaid expenses ${R(M(pre))}. Calculate the current ratio and the quick ratio (to 2 decimal places, as x : 1).`,
        parts: [part('Current ratio (x : 1)', c.display.replace(' : 1', ''), 1, 'TEXT'), part('Quick ratio (x : 1)', q.display.replace(' : 1', ''), 1, 'TEXT')],
        hints: ['Current ratio = current assets ÷ current liabilities.', 'Quick assets exclude inventory AND prepaid expenses.'],
        working: [c.working, q.working, c.reading],
        distractors: [{ part: 1, value: quickRatio(M(ca), M(inv), M(0), M(cl)).display.replace(' : 1', ''), mistake: 'You left the prepaid expenses in the quick assets.', fix: 'Quick assets = current assets − inventory − prepaid expenses.' }],
      };
    },
  },
  {
    skill: 'ratio-activity', clause: 'XII.3.activity', title: 'Inventory turnover',
    make: r => {
      const open = r.multiple(10000, 40000, 5000), close = open + r.multiple(5000, 20000, 5000), purchases = r.multiple(200000, 500000, 50000), direct = r.multiple(10000, 50000, 10000);
      const cost = costOfRevenueFromOperations({ openingInventory: M(open), purchases: M(purchases), directExpenses: M(direct), closingInventory: M(close) });
      const t = inventoryTurnoverRatio(cost, M(open), M(close));
      return {
        stem: `Opening inventory ${R(M(open))}, closing inventory ${R(M(close))}, purchases ${R(M(purchases))}, direct expenses ${R(M(direct))}. Find the cost of revenue from operations and the inventory turnover ratio (2 decimals).`,
        parts: [part('Cost of revenue from operations', ans(cost)), part('Inventory turnover (times)', t.display.replace(' times', ''), 1, 'TEXT')],
        hints: ['Cost of revenue = opening inventory + purchases + direct expenses − closing inventory.', 'Turnover = cost of revenue ÷ AVERAGE inventory (average of opening and closing).'],
        working: [`Cost of revenue = ${R(cost)}`, t.working, t.reading],
        distractors: [],
      };
    },
  },
  {
    skill: 'ratio-solvency', clause: 'XII.3.solvency', title: 'Debt-equity and interest coverage',
    make: r => {
      const debt = r.multiple(200000, 600000, 50000), eq = r.multiple(400000, 1000000, 100000), pbit = r.multiple(100000, 300000, 20000), int = r.multiple(20000, 60000, 10000);
      const de = debtEquityRatio(M(debt), M(eq)), ic = interestCoverageRatio(M(pbit), M(int));
      return {
        stem: `Long-term debt is ${R(M(debt))} and shareholders' funds are ${R(M(eq))}. Profit before interest and tax is ${R(M(pbit))} and interest on long-term borrowings is ${R(M(int))}. Find the debt-equity ratio (x : 1) and the interest coverage ratio (times).`,
        parts: [part('Debt-equity ratio (x : 1)', de.display.replace(' : 1', ''), 1, 'TEXT'), part('Interest coverage (times)', ic.display.replace(' times', ''), 1, 'TEXT')],
        hints: ['Debt-equity = long-term debt ÷ shareholders\' funds.', 'Interest coverage = profit BEFORE interest and tax ÷ interest.'],
        working: [de.working, ic.working, ic.reading],
        distractors: [],
      };
    },
  },
  {
    skill: 'cfo', clause: 'XII.4.preparation', title: 'Cash from operating activities (indirect method)',
    make: r => {
      const pbt = r.multiple(100000, 300000, 10000), dep = r.multiple(10000, 40000, 5000), gain = r.multiple(5000, 20000, 5000), rec = r.multiple(5000, 25000, 5000), tax = r.multiple(10000, 40000, 5000);
      const c = cashFlowStatement({
        netProfitBeforeTaxAndExtraordinary: M(pbt), adjustments: [{ label: 'Depreciation', amount: M(dep) }, { label: 'Gain on sale of machinery', amount: M(gain).neg() }],
        workingCapitalChanges: [{ label: 'Increase in receivables', amount: M(rec).neg() }], taxPaid: M(tax), investing: [], financing: [], openingCashEquivalents: M(0),
      });
      return {
        stem: `Net profit before tax is ${R(M(pbt))} after charging depreciation of ${R(M(dep))} and crediting a gain on sale of machinery of ${R(M(gain))}. Trade receivables increased by ${R(M(rec))}. Tax paid was ${R(M(tax))}. Find the cash flow from operating activities (indirect method).`,
        parts: [part('Operating profit before working capital changes', ans(c.operatingProfitBeforeWorkingCapital)), part('Cash flow from operating activities', ans(c.cashFromOperating))],
        hints: ['Add back non-cash expenses (depreciation). Deduct gains that belong to INVESTING (sale of machinery).', 'An INCREASE in receivables means cash was tied up — deduct it. Then deduct tax paid.'],
        working: [`Operating profit before WC changes = ${R(M(pbt))} + ${R(M(dep))} − ${R(M(gain))} = ${R(c.operatingProfitBeforeWorkingCapital)}`, `Cash generated = ${R(c.cashGeneratedFromOperations)}`, `Less tax ${R(M(tax))} ⇒ ${R(c.cashFromOperating)}`],
        distractors: [{ part: 1, value: ans(c.cashFromOperating.add(M(gain).mulRatio(2n, 1n, 'HALF_UP'))), mistake: 'You ADDED the gain on sale instead of deducting it.', fix: 'A gain is already inside profit but its cash belongs to investing, so it is deducted here.' }],
      };
    },
  },
  // ───────────────────────────── added: remaining practice skills ─────────────────────────────
  {
    skill: 'pdd-provision', clause: 'XI.2.provisions', title: 'Provision for doubtful debts',
    make: r => {
      const debtors = r.multiple(100000, 500000, 10000), bad = r.multiple(2000, 10000, 1000), rate = r.pick([5, 10]), old = r.multiple(2000, 9000, 1000);
      const res = provisionDoubtful({ debtors: M(debtors), additionalBadDebts: M(bad), pddPercent: BigInt(rate), oldPdd: M(old) });
      const wrong = M(debtors).mulRatio(BigInt(rate), 100n, 'HALF_UP');
      return {
        stem: `Debtors at the end of the year are ${R(M(debtors))}. Further bad debts of ${R(M(bad))} are to be written off, and a provision for doubtful debts of ${rate}% is to be maintained. The existing provision is ${R(M(old))}. Find (a) the new provision and (b) the total charge to the Profit and Loss Account for bad debts and provision (the bad debts account has no other balance).`,
        parts: [part('(a) New provision', ans(res.newPdd)), part('(b) Total charge to P&L', ans(res.totalCharge))],
        hints: ['Write off the further bad debts FIRST; the provision is a percentage of the debtors that are left.', 'The P&L is charged with the new bad debts plus the INCREASE in provision (new provision minus the old one still in the books).'],
        working: [`Debtors after bad debts = ${R(M(debtors))} − ${R(M(bad))} = ${R(res.debtorsAfterBadDebts)}`, `New provision = ${rate}% × ${R(res.debtorsAfterBadDebts)} = ${R(res.newPdd)}`, `Increase = ${R(res.newPdd)} − ${R(M(old))} = ${R(res.pddCharge)}`, `Charge = ${R(M(bad))} + (${R(res.pddCharge)}) = ${R(res.totalCharge)}`],
        distractors: [{ part: 0, value: ans(wrong), mistake: 'You took the provision on the debtors BEFORE writing off the further bad debts.', fix: 'Deduct further bad debts first, then apply the percentage.' }],
      };
    },
  },
  {
    skill: 'cashbook', clause: 'XI.2.cashbook', title: 'Cash book with bank column',
    make: r => {
      const cash = r.multiple(20000, 50000, 5000), bank = r.multiple(30000, 90000, 5000), recv = r.multiple(5000, 20000, 5000), dep = r.multiple(5000, 15000, 5000), pay = r.multiple(10000, 40000, 5000), wd = r.multiple(2000, 6000, 1000);
      const cb = cashBook({ cash: M(cash), bank: M(bank) }, [
        { particulars: 'Cash sales', kind: 'RECEIPT_CASH', amount: M(recv) }, { particulars: 'Deposited into bank', kind: 'DEPOSIT', amount: M(dep) },
        { particulars: 'Supplier paid by cheque', kind: 'PAYMENT_BANK', amount: M(pay) }, { particulars: 'Cash withdrawn from bank', kind: 'WITHDRAWAL', amount: M(wd) }]);
      return {
        stem: `A trader starts with cash ${R(M(cash))} and a bank balance of ${R(M(bank))}. During the month: cash sales ${R(M(recv))}; cash deposited into the bank ${R(M(dep))}; a supplier paid by cheque ${R(M(pay))}; cash withdrawn from the bank ${R(M(wd))}. Find the closing balances in the cash and bank columns (a negative bank balance means an overdraft).`,
        parts: [part('Closing cash', ans(cb.closingCash)), part('Closing bank', ans(cb.closingBank))],
        hints: ['Depositing and withdrawing are CONTRA entries: each one appears in both columns, on opposite sides.', 'Cash column: add receipts and withdrawals, subtract payments and deposits. Bank column does the opposite for deposits and withdrawals.'],
        working: cb.rows.map(x => `${x.txn.particulars}: cash ${R(x.cashBalance)}, bank ${R(x.bankBalance)}`),
        distractors: [{ part: 1, value: ans(cb.closingBank.sub(M(dep))), mistake: 'You forgot the contra entry: a deposit raises the bank column as well as lowering the cash column.', fix: 'Record every contra entry on both sides (cash and bank).' }],
      };
    },
  },
  {
    skill: 'opening-capital', clause: 'XI.3.concepts', title: 'Opening entry and capital',
    make: r => {
      const cash = r.multiple(10000, 60000, 5000), stock = r.multiple(40000, 150000, 10000), furn = r.multiple(20000, 80000, 10000), cred = r.multiple(10000, 60000, 5000), loan = r.multiple(20000, 90000, 10000);
      const o = openingEntry({ assets: [{ name: 'Cash', amount: M(cash) }, { name: 'Stock', amount: M(stock) }, { name: 'Furniture', amount: M(furn) }], liabilities: [{ name: 'Creditors', amount: M(cred) }, { name: 'Bank Loan', amount: M(loan) }] });
      const total = M(cash).add(M(stock)).add(M(furn));
      return {
        stem: `On 1 April a trader has: cash ${R(M(cash))}, stock ${R(M(stock))}, furniture ${R(M(furn))}; creditors ${R(M(cred))} and a bank loan of ${R(M(loan))}. Find the capital that goes in the opening entry.`,
        parts: [part('Capital', ans(o.capital))],
        hints: ['Capital is the owner’s claim: Assets − Liabilities (the accounting equation rearranged).', 'Add all the assets, add all the outside liabilities, then subtract.'],
        working: [`Assets = ${R(total)}`, `Liabilities = ${R(M(cred).add(M(loan)))}`, `Capital = ${R(total)} − ${R(M(cred).add(M(loan)))} = ${R(o.capital)}`],
        distractors: [{ part: 0, value: ans(total), mistake: 'You took total assets as capital and ignored what the business owes outsiders.', fix: 'Capital = Assets − Liabilities.' }],
      };
    },
  },
  {
    skill: 'revaluation', clause: 'XII.1.ratio-change', title: 'Revaluation account',
    make: r => {
      const stockDown = r.multiple(2000, 9000, 1000), buildUp = r.multiple(10000, 30000, 5000), owing = r.multiple(1000, 4000, 1000), a = r.pick([3, 2, 5]), b = r.pick([2, 1, 3]);
      const rv = revaluation([{ name: 'Stock', kind: 'ASSET', before: M(60000), after: M(60000 - stockDown) }, { name: 'Building', kind: 'ASSET', before: M(200000), after: M(200000 + buildUp) }, { name: 'Outstanding expenses', kind: 'LIABILITY', before: M(0), after: M(owing) }], { A: Fraction.of(a, a + b), B: Fraction.of(b, a + b) });
      const noLiab = M(buildUp).sub(M(stockDown));
      return {
        stem: `At a change in the firm, stock is reduced by ${R(M(stockDown))}, the building is revalued upward by ${R(M(buildUp))} and an unrecorded expense of ${R(M(owing))} is brought into the books as a liability. Partners A and B share profits ${a}:${b}. Find (a) the profit or loss on revaluation (write a loss with a minus sign) and (b) A’s share of it.`,
        parts: [part('(a) Profit (+) or loss (−)', ans(rv.profit)), part('(b) A’s share', ans(rv.partnerShare.A!))],
        hints: ['A fall in an asset and a NEW liability are both losses; a rise in an asset is a gain. Net them.', 'The net amount is shared in the OLD profit-sharing ratio. Share with the largest-remainder rule so no paisa is lost.'],
        working: rv.rows.map(x => `${x.item.name}: ${x.effect.isNegative() ? 'loss' : 'gain'} ${R(x.effect.abs())}`).concat([`Net = ${R(rv.profit)}`, `A’s share = ${R(rv.partnerShare.A!)}`]),
        distractors: [{ part: 0, value: ans(noLiab), mistake: 'You left out the newly recorded liability, which is a loss on revaluation.', fix: 'An increase in a liability is debited to Revaluation Account.' }],
      };
    },
  },
  {
    skill: 'loan-emi', clause: 'XII.C.spreadsheet', title: 'Loan instalment (EMI)',
    make: r => {
      const principal = r.multiple(100000, 1000000, 50000), rate = r.pick([6, 9, 12]), months = r.pick([12, 24]);
      const ls = loanSchedule({ principal: M(principal), ratePercent: Fraction.of(rate), months });
      const simple = M(principal).add(M(principal).mulRatio(BigInt(rate * months), 1200n, 'HALF_UP')).mulRatio(1n, BigInt(months), 'HALF_UP');
      return {
        stem: `A loan of ${R(M(principal))} at ${rate}% per annum is repaid in ${months} equal monthly instalments (reducing balance). In a spreadsheet you would use PMT. Find (a) the monthly instalment and (b) the interest part of the FIRST instalment.`,
        parts: [part('(a) Monthly instalment', ans(ls.emi)), part('(b) Interest in month 1', ans(ls.rows[0]!.interest))],
        hints: ['Interest each month is the monthly rate (annual rate ÷ 12) on the balance at the start of that month.', 'The instalment is the same every month and is worked out so that the balance ends at exactly zero (PMT).'],
        working: [`Monthly rate = ${rate}% ÷ 12`, `Instalment (PMT) = ${R(ls.emi)}`, `Month 1 interest = ${R(M(principal))} × ${rate}% ÷ 12 = ${R(ls.rows[0]!.interest)}`],
        distractors: [{ part: 0, value: ans(simple), mistake: 'You used simple interest on the full loan for the whole period.', fix: 'On a reducing-balance loan interest falls as the principal is repaid.' }],
      };
    },
  },
  {
    skill: 'calls-advance', clause: 'XII.2.issue', title: 'Calls in advance',
    make: r => {
      const shares = r.multiple(2000, 10000, 1000), call = r.pick([3, 4, 5]), advShares = r.multiple(200, 1000, 100), advPer = r.pick([1, 2]);
      const ca = callsInAdvance({ shares: BigInt(advShares), advancePerShare: M(advPer) });
      const total = M(call).mulRatio(BigInt(shares), 1n, 'HALF_UP');
      return {
        stem: `A company has ${shares} shares on which a final call of ₹${call} per share is due. Shareholders holding ${advShares} shares pay ₹${advPer} per share in advance, before the call is made. (No interest is allowed on calls in advance.) Find (a) the amount of Calls in Advance and (b) the cash still to be collected when the call falls due, assuming every other shareholder pays in full.`,
        parts: [part('(a) Calls in Advance', ans(ca.received)), part('(b) Cash still due on the call', ans(total.sub(ca.received)))],
        hints: ['Money received before it is due is a liability — it sits in Calls in Advance until the call is made.', 'When the call falls due, the advance is adjusted against what those holders owe; only the remainder is collected in cash.'],
        working: [`Calls in Advance = ${advShares} × ₹${advPer} = ${R(ca.received)}`, `Total call due = ${shares} × ₹${call} = ${R(total)}`, `Cash still due = ${R(total)} − ${R(ca.received)} = ${R(total.sub(ca.received))}`],
        distractors: [{ part: 1, value: ans(total), mistake: 'You collected the full call again, forgetting that part of it was already received in advance.', fix: 'Adjust the advance against the call before working out the cash due.' }],
      };
    },
  },
];

export const SKILLS = GENERATORS.map(g => ({ skill: g.skill, clause: g.clause, title: g.title }));

/** The generator's output exactly as written (no safety filtering) — used by tests to keep the generators themselves honest. */
export function makeQuestionUnfiltered(skill: string, seed: number): Question {
  const g = GENERATORS.find(x => x.skill === skill);
  if (!g) throw new Error(`Unknown skill "${skill}"`);
  const q = g.make(new Rng(seed * 2654435761 + g.skill.length), seed);
  return { id: `${skill}#${seed}`, skill, clause: g.clause, seed, marks: q.parts.reduce((a, p) => a + p.marks, 0), ...q };
}

export function makeQuestion(skill: string, seed: number): Question {
  const q = makeQuestionUnfiltered(skill, seed);
  // A distractor equal to the correct answer would tell a CORRECT student they made a mistake — never let one through.
  return { ...q, distractors: q.distractors.filter(d => d.value !== q.parts[d.part]?.answer) };
}

/** Compare a student's text with an expected answer: money ignores ₹, commas and spacing; fractions are compared in lowest terms. */
export function checkAnswer(p: Part, input: string): boolean {
  const t = input.trim();
  if (!t) return false;
  if (p.kind === 'TEXT') return t.replace(/[,\s₹]/g, '').toLowerCase() === p.answer.replace(/[,\s₹]/g, '').toLowerCase();
  if (p.kind === 'FRACTION') {
    const m = /^(-?\d+)\s*\/\s*(\d+)$/.exec(t) ?? /^(-?\d+)$/.exec(t);
    if (!m) return false;
    try { return Fraction.of(BigInt(m[1]!), BigInt(m[2] ?? 1)).toString() === p.answer; } catch { return false; }
  }
  try { return Money.parse(t.replace(/[₹,\s]/g, '')).toString() === Money.parse(p.answer).toString(); } catch { return false; }
}
