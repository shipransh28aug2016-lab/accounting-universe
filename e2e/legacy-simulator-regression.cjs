/* Regression test for legacy defect F-1 (docs/EXISTING_APP_AUDIT.md).
 *
 * Before the fix, Simulator ledger accounts were stored untyped and accounts outside a tiny
 * dictionary got the wrong sign, so the Simulator balance sheet was empty and the "balanced"
 * badge / A=C+L pill compared 0 with 0.
 *
 * Run:  NODE_PATH="$(npm root -g)" node e2e/legacy-simulator-regression.cjs [path/to/index.html]
 * Needs the `playwright` package and a Chromium (set CHROMIUM_PATH if not the Playwright default).
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
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  await page.goto('file://' + file);
  await page.waitForTimeout(400);

  // ---- 1. Types and signs after normal postings -------------------------------------------
  const r1 = await page.evaluate(() => {
    sessionStorage.clear(); SIM_ACTIONS.reset();
    SIM_ACTIONS.capital();     // Dr Cash 50,000   Cr Capital 50,000
    SIM_ACTIONS.creditSale();  // Dr Debtors 7,000 Cr Sales 7,000
    SIM_ACTIONS.cashP();       // Dr Purchases 4,000 Cr Cash 4,000
    const L = SIM.ledger, st = AUState();
    return {
      types: Object.fromEntries(Object.entries(L).map(([k, v]) => [k, v.type])),
      bal: Object.fromEntries(Object.entries(L).map(([k, v]) => [k, v.bal])),
      st, pill: document.getElementById('auSyncPill').textContent,
      bsAst: document.getElementById('bsAstT').textContent,
      bsLia: document.getElementById('bsLiaT').textContent,
      status: document.getElementById('simStatus').textContent,
    };
  });
  check('every ledger account has a type', Object.values(r1.types).every(Boolean), r1.types);
  check('Debtors is an Asset with a POSITIVE balance', r1.types.Debtors === 'A' && r1.bal.Debtors === 7000, [r1.types.Debtors, r1.bal.Debtors]);
  check('Purchases is an Expense with a POSITIVE balance', r1.types.Purchases === 'E' && r1.bal.Purchases === 4000, [r1.types.Purchases, r1.bal.Purchases]);
  // Assets = Cash 46,000 + Debtors 7,000 = 53,000. Capital 50,000 + Sales 7,000 - Purchases 4,000 = 53,000.
  check('state bus reports real totals (assets 53,000)', r1.st.assets === 53000 && r1.st.adjCap === 53000 && r1.st.balanced === true, r1.st);
  check('A=C+L pill shows the real figure, not 0', /53,000/.test(r1.pill), r1.pill);
  check('Simulator balance sheet is populated and balanced', r1.bsAst === '53,000' && r1.bsLia === '53,000' && /Balanced/.test(r1.status), [r1.bsAst, r1.bsLia, r1.status]);

  // ---- 2. The check can now FAIL (it used to compare 0 with 0) -----------------------------
  const r2 = await page.evaluate(() => {
    SIM.ledger.Cash.bal += 1000;          // corrupt the books on purpose
    simRender();
    const out = { balanced: AUState().balanced, status: document.getElementById('simStatus').textContent };
    SIM.ledger.Cash.bal -= 1000; simRender();
    return out;
  });
  check('a deliberate imbalance is detected', r2.balanced === false && /Off by/.test(r2.status), r2);

  // ---- 3. Session saved before the fix (untyped, wrong sign) is rebuilt from the journal ----
  const r3 = await page.evaluate(() => {
    SIM_ACTIONS.reset();
    SIM_ACTIONS.capital(); SIM_ACTIONS.creditSale();
    const legacy = {
      journal: SIM.journal,
      ledger: { Cash: { bal: 50000 }, Capital: { bal: 50000 }, Debtors: { bal: -7000 }, Sales: { bal: 7000 } }, // no types, bad sign
      n: SIM.n,
    };
    sessionStorage.setItem('au:sim:v1', JSON.stringify(legacy));
    return legacy.journal.length;
  });
  await page.reload(); await page.waitForTimeout(400);
  const r3b = await page.evaluate(() => ({ L: SIM.ledger, st: AUState() }));
  check('restored legacy session is retyped', Object.values(r3b.L).every(o => o.type), r3b.L);
  check('restored legacy session has corrected signs', r3b.L.Debtors && r3b.L.Debtors.bal === 7000, r3b.L.Debtors);
  check('restored legacy session balances', r3b.st.assets === 57000 && r3b.st.balanced, r3b.st);
  check('(journal had 2 entries)', r3 === 2, r3);

  // ---- 4. Equation mirror stays coherent when M1 already holds manual balances -------------
  const r4 = await page.evaluate(async () => {
    sessionStorage.clear(); SIM_ACTIONS.reset();
    M1_ACCTS.Machinery = 20000; M1_ACCTS.Capital = 20000;   // the student's own M1 work
    // pretend the student has not touched M1 recently so the mirror is allowed to run
    await new Promise(r => setTimeout(r, 3200));
    SIM_ACTIONS.capital();                                   // Sim: Cash 50,000 / Capital 50,000
    await new Promise(r => setTimeout(r, 200));
    return { A: m1GetA(), L: m1GetL(), C: m1GetC(), machinery: M1_ACCTS.Machinery };
  });
  check('M1 mirror carries no stale manual balances', r4.machinery === 0, r4);
  check('M1 mirror is balanced (A = C + L)', r4.A === r4.C + r4.L && r4.A === 50000, r4);

  check('no page errors', pageErrors.length === 0, pageErrors);
  await browser.close();
  console.log(failures ? `\n${failures} FAILED` : '\nall passed');
  process.exit(failures ? 1 : 0);
})();
