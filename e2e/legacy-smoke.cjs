/* Smoke + regression suite for the legacy single-file app (index.html).
 * Covers: clean load, every screen opens, and the accounting fixes made so far
 *   - M1 goods sold reduces Stock by cost and adds only the margin to P&L
 *   - Final Accounts: depreciation typed as expense; boss-fight adjustments keep the sheet balanced
 *     and hit the right lines; Reset restores the pristine data
 *
 * Run:  NODE_PATH="$(npm root -g)" node e2e/legacy-smoke.cjs [path/to/index.html]
 * Set CHROMIUM_PATH if Playwright's own browser is not installed.
 */
const path = require('path');
const { chromium } = require('playwright');

let failures = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : '  -> ' + JSON.stringify(detail)}`);
  if (!ok) failures++;
};

(async () => {
  const file = path.resolve(process.argv[2] || path.join(__dirname, '..', 'index.html'));
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());           // the app uses alert() for blocked transactions

  await page.goto('file://' + file);
  await page.waitForTimeout(500);
  check('loads with no console/page errors', errors.length === 0, errors);

  // ---- every screen opens without throwing -----------------------------------------------
  const ids = await page.$$eval('section.screen', els => els.map(e => e.id).filter(Boolean));
  for (const id of ids) {
    await page.evaluate(i => go(i), id);
    await page.waitForTimeout(120);
  }
  check(`all ${ids.length} screens open without errors`, errors.length === 0, errors);

  // ---- M1: goods sold -------------------------------------------------------------------
  const m1 = await page.evaluate(() => {
    go('m1'); document.querySelector('#txReset').click();
    const apply = (tpl, amt, cost) => {
      document.querySelector('#txTemplate').value = tpl;
      document.querySelector('#txTemplate').dispatchEvent(new Event('change'));
      document.querySelector('#txAmt').value = amt;
      document.querySelector('#txCost').value = cost || '';
      document.querySelector('#txApply').click();
    };
    apply('credit-purchase', 10000);
    apply('cash-sale', 2000, 1500);                       // sale 2,000 at cost 1,500
    const ok = { cash: M1_ACCTS.Cash, stock: M1_ACCTS.Stock, pl: M1_ACCTS['P&L Profit'] };
    apply('cash-sale', 25000, 20000);                     // more stock than we hold -> must be blocked
    const after = { cash: M1_ACCTS.Cash, stock: M1_ACCTS.Stock, pl: M1_ACCTS['P&L Profit'] };
    apply('credit-sale', 3000, '');                       // cost missing -> must be rejected
    return { ok, after, debtors: M1_ACCTS.Debtors, A: m1GetA(), L: m1GetL(), C: m1GetC() };
  });
  check('cash sale: Cash +sale, Stock -cost, P&L +margin', m1.ok.cash === 2000 && m1.ok.stock === 8500 && m1.ok.pl === 500, m1.ok);
  check('selling more than the stock held is blocked and rolled back', JSON.stringify(m1.after) === JSON.stringify(m1.ok), m1);
  check('a sale without a cost is rejected', m1.debtors === 0, m1.debtors);
  check('equation still balances (A = C + L)', m1.A === m1.C + m1.L, m1);

  // ---- Final Accounts ----------------------------------------------------------------------
  const fa = await page.evaluate(() => {
    go('m12');
    const reset = () => { FA_ITEMS.length = 0; FA_ITEMS.push(...FA_ITEMS_BASE.map(i => ({ ...i }))); };
    const find = n => FA_ITEMS.find(i => i.n === n);
    const out = { deprM: AcctEngine.classify('Depr. Machinery'), deprF: AcctEngine.classify('Depr. Furniture') };

    reset(); const csAdj = FA_ADJUSTMENTS.find(a => a.desc.includes('Closing Stock'));
    applyFaBossImpact(csAdj.ans1); applyFaBossImpact(csAdj.ans2); faPrepare();
    out.cs = { count: FA_ITEMS.filter(i => i.n === 'Closing Stock').length, amt: find('Closing Stock').amt, bs: document.querySelector('#faBSTot').textContent };

    reset(); const pi = FA_ADJUSTMENTS.find(a => a.desc.includes('Prepaid Insurance'));
    applyFaBossImpact(pi.ans1); applyFaBossImpact(pi.ans2); faPrepare();
    out.pi = { salary: find('Salary').amt, insurance: find('Insurance Premium').amt, prepaid: FA_ITEMS.filter(i => i.n === 'Prepaid Insurance').map(i => i.amt), bs: document.querySelector('#faBSTot').textContent };

    reset(); FA_ADJUSTMENTS.forEach(a => { applyFaBossImpact(a.ans1); applyFaBossImpact(a.ans2); }); faPrepare();
    out.all = document.querySelector('#faBSTot').textContent;

    FA_ITEMS.push({ n: 'Rogue', amt: 1, h: 'pl-dr' }); document.querySelector('#faReset').click();
    out.reset = { n: FA_ITEMS.length, base: FA_ITEMS_BASE.length, rogue: !!find('Rogue') };
    return out;
  });
  check('Depr. Machinery / Furniture are Expenses', fa.deprM === 'E' && fa.deprF === 'E', [fa.deprM, fa.deprF]);
  check('Closing Stock adjustment merges (one row, 60,000) and the sheet balances', fa.cs.count === 1 && fa.cs.amt === 60000 && /Balanced/.test(fa.cs.bs), fa.cs);
  check('Prepaid Insurance reduces Insurance Premium, not Salary', fa.pi.salary === 20000 && fa.pi.insurance === 5000 && fa.pi.prepaid.length === 1 && fa.pi.prepaid[0] === 3000 && /Balanced/.test(fa.pi.bs), fa.pi);
  check('all 5 adjustments stacked still balance', /Balanced/.test(fa.all), fa.all);
  check('Reset restores the pristine item set', fa.reset.n === fa.reset.base && !fa.reset.rogue, fa.reset);

  check('no errors during the whole run', errors.length === 0, errors);
  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : '\nall passed');
  process.exit(failures ? 1 : 0);
})();
