import subprocess, shutil, os, sys
ENG=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
W=os.path.join(ENG,'.mutation-work')
muts=[
 ("finalAccounts: interest on capital not added to capital","src/finalAccounts.ts","capital.add(netProfit).add(interestOnCapital)","capital.add(netProfit)"),
 ("finalAccounts: discount provision ignores PDD base","src/finalAccounts.ts","debtorsAfterBad.sub(newPDD).mulRatio(pdRate","debtorsAfterBad.mulRatio(pdRate"),
 ("finalAccounts: commission AFTER uses 100","src/finalAccounts.ts","preCommission.mulRatio(mc.ratePercent, 100n + mc.ratePercent, R)","preCommission.mulRatio(mc.ratePercent, 100n, R)"),
 ("finalAccounts: sales returns ignored","src/finalAccounts.ts","total('SALES').neg().sub(total('SALES_RETURNS'))","total('SALES').neg()"),
 ("finalAccounts: abnormal-loss claim ignored","src/finalAccounts.ts","const abnormalNet = abnormalGoods.sub(claim);","const abnormalNet = abnormalGoods;"),
 ("partnership: insufficient profit paid in full","src/partnership.ts","} else if (available.cmp(totalDue) < 0) {","} else if (false) {"),
 ("partnership: super-profit sign flipped","src/partnership.ts","const superProfit = avg.sub(normalProfit);","const superProfit = normalProfit.sub(avg);"),
 ("partnership: guarantee shortfall ignored","src/partnership.ts","if (shortfall.isPositive()) {","if (false) {"),
 ("partnership: new partner capital uses share not share/(1-share)","src/partnership.ts","oldTotal.mulRatio(np.share.num * oldShareTotal.den, np.share.den * oldShareTotal.num, R)","oldTotal.mulRatio(np.share.num, np.share.den, R)"),
 ("partnership: realisation expenses never credit the paying partner","src/partnership.ts","else outsideCapital[e.paidBy] = outsideCapital[e.paidBy]!.add(e.amount);","else { /* dropped */ }"),
 ("company: rejected money adjusted to allotment","src/company.ts","const proRataExcess = received.sub(appDue).sub(rejectedMoney);","const proRataExcess = received.sub(appDue);"),
 ("company: forfeiture debits full premium","src/company.ts","const spDr = premCalled.sub(premRecv);","const spDr = premCalled;"),
 ("company: capital reserve ignores discount","src/company.ts","const reserve = forfeitedAmt.sub(discount);","const reserve = forfeitedAmt;"),
 ("company: loss on issue omitted","src/company.ts","dr('Loss on Issue of Debentures A/c', redPremium),",""),
 ("analysis: quick ratio keeps prepaid","src/analysis.ts","currentAssets.sub(inventory).sub(prepaid)","currentAssets.sub(inventory)"),
 ("analysis: percent change on current year","src/analysis.ts","fixed(change.paise * 100n, i.previous.paise, 2)","fixed(change.paise * 100n, i.current.paise, 2)"),
 ("cashflow: loss on sale sign","src/cashflow.ts","profitOrLossOnSale: sp.sub(bv)","profitOrLossOnSale: bv.sub(sp)"),
 ("cashflow: tax not deducted","src/cashflow.ts","const cfo = generated.sub(i.taxPaid);","const cfo = generated;"),
 ("brs: sign of unpresented cheques","src/classxi.ts","CHEQUE_ISSUED_NOT_PRESENTED: { sign: 1,","CHEQUE_ISSUED_NOT_PRESENTED: { sign: -1,"),
 ("brs: pass-book start not reversed","src/classxi.ts","(startFrom === 'CASH_BOOK' ? 1 : -1)","1"),
 ("rectify: suspense on wrong side","src/classxi.ts","suspenseSide = dr > cr ? 'CR' : 'DR';","suspenseSide = dr > cr ? 'DR' : 'CR';"),
 ("depreciation: WDV charged on original cost","src/depreciation.ts","o.rate!.of_(open, R)","o.rate!.of_(o.cost, R)"),
 ("depreciation: part-year ignored","src/depreciation.ts","const part = (k: number) => (k === 1 ? Fraction.of(fm, 12) : Fraction.ONE);","const part = (_k: number) => Fraction.ONE;"),
 ("gst: freight not taxed","src/classxi.ts","const taxable = o.listPrice.sub(td).add(freight);","const taxable = o.listPrice.sub(td);"),
 ("money: HALF_EVEN becomes HALF_UP","src/money.ts","return q % 2n === 0n ? q : away;","return away;"),
]
killed=0; survived=[]
for name,f,a,b in muts:
    shutil.rmtree(W,ignore_errors=True); os.makedirs(W)
    for d in ('src','test'): shutil.copytree(f'{ENG}/{d}',f'{W}/{d}')
    for x in ('package.json','tsconfig.json'): shutil.copy(f'{ENG}/{x}',W)
    os.symlink(f'{ENG}/node_modules',f'{W}/node_modules')
    p=f'{W}/{f}'; t=open(p).read()
    if a not in t: print('NOT APPLIED:',name); survived.append(name+' (not applied)'); continue
    open(p,'w').write(t.replace(a,b,1))
    r=subprocess.run(['npx','vitest','run'],cwd=W,capture_output=True,text=True)
    ok = r.returncode!=0
    print(('KILLED   ' if ok else 'SURVIVED ')+name)
    if ok: killed+=1
    else: survived.append(name)
print(f'\n{killed}/{len(muts)} killed'); 
if survived: print('survivors:',survived)
