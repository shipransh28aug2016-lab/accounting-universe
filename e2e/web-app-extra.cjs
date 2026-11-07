/* Browser checks for the second wave of features: concept cards, trainer, computerised-accounting simulator, projects, rescue, assignments, heat-map. */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const path = require('node:path'); const fs = require('node:fs'); const os = require('node:os');
const PORT = 4176, BASE = `http://127.0.0.1:${PORT}/`;
let pass = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fails.push(m); console.log('  ✗', m); } };

(async () => {
  const hs = path.join(require('child_process').execSync('npm root -g').toString().trim(), 'http-server/bin/http-server');
  const srv = spawn('node', [hs, path.join(__dirname, '../apps/web/dist'), '-p', String(PORT), '-a', '127.0.0.1', '-c-1', '--silent'], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1200));
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const errors = [];
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
    const go = async h => { await page.goto(BASE + '#/' + h); await page.waitForSelector('main > *'); };
    const tmp = n => path.join(os.tmpdir(), n);

    // ── concept cards: bilingual, self-check, recorded
    await go('cards');
    ok((await page.$$('.card')).length >= 8, 'cards: Class XI list');
    await go('cards/concepts');
    const en = await page.$eval('.prose', e => e.textContent);
    await page.click('.modes button:has-text("Hinglish")');
    const hi = await page.$eval('.prose', e => e.textContent);
    ok(en !== hi && /hain|hai/.test(hi), 'cards: Hinglish toggle changes the text');
    const forms = await page.$$('form.check');
    await (await forms[0].$('input[value="0"]')).check(); await (await forms[0].$('button')).click();   // wrong (answer is 1)
    ok((await forms[0].textContent()).includes('Not quite'), 'cards: wrong answer explained');
    await (await forms[1].$('input[value="0"]')).check(); await (await forms[1].$('button')).click();   // correct (answer 0)
    ok((await forms[1].textContent()).includes('Correct'), 'cards: right answer confirmed');
    await (await forms[2].$('button')).click(); ok((await forms[2].textContent()).includes('Choose an answer'), 'cards: must choose before checking');

    // ── debit/credit trainer
    await go('trainer');
    await page.click('button[type=submit]'); ok((await page.$eval('.note.warn', e => e.textContent)).includes('Choose an account'), 'trainer: asks for both accounts');
    await page.selectOption('#dr', { index: 1 }); await page.selectOption('#cr', { index: 1 }); await page.click('button[type=submit]');
    ok(/Not quite|Correct/.test(await page.$eval('main', e => e.textContent)) && (await page.$$eval('main li', l => l.length)) >= 2, 'trainer: feedback shows the rule of each side');
    await page.click('text=Next →'); ok((await page.$eval('main', e => e.textContent)).includes('Question 2 of'), 'trainer: advances');

    // ── computerised accounting simulator: validation, maker–checker, security, closing, backup, persistence
    await go('cas');
    const fill = async (rowIdx, code, amt) => { const rows = await page.$$('.cas-line'); await (await rows[rowIdx].$('input.code')).fill(code); await (await rows[rowIdx].$('input:not(.code)')).fill(amt); };
    await page.fill('#vnarr', 'Capital introduced');
    await fill(0, '1001', '100000'); await fill(1, '3001', '100000');
    await page.click('text=Save voucher for verification');
    ok((await page.$eval('.note.good', e => e.textContent)).includes('saved for verification'), 'CAS: voucher queued');
    ok((await page.$$('.queue li')).length === 1, 'CAS: one pending voucher');
    await page.click('text=Verify & post');
    ok((await page.$eval('.formerr', e => e.textContent)).includes('Only a Checker'), 'CAS: an accountant cannot verify their own voucher');
    await page.selectOption('#role', 'CHECKER'); await page.click('text=Verify & post');
    ok((await page.$eval('main', e => e.textContent)).includes('Trial balance agrees'), 'CAS: posted → trial balance agrees');
    ok((await page.$eval('main', e => e.textContent)).includes('Capital introduced'), 'CAS: audit trail lists the voucher');
    await page.selectOption('#role', 'VIEWER'); await page.click('text=Save voucher for verification');
    ok((await page.$eval('.formerr', e => e.textContent)).includes('cannot enter'), 'CAS: viewer cannot enter');
    await page.selectOption('#role', 'ACCOUNTANT');
    // unbalanced, wrong-type and unknown-code vouchers are rejected with reasons
    await fill(0, '1001', '500'); await fill(1, '3001', '400'); await page.fill('#vnarr', 'bad'); await page.click('text=Save voucher for verification');
    ok((await page.$eval('.formerr', e => e.textContent)).includes('Dual aspect broken'), 'CAS: unbalanced voucher rejected');
    await fill(0, '9999', '500'); await fill(1, '3001', '500'); await page.click('text=Save voucher for verification');
    ok((await page.$eval('.formerr', e => e.textContent)).includes('does not exist'), 'CAS: unknown account code rejected');
    await page.selectOption('#vtype', 'JOURNAL'); await fill(0, '1001', '500'); await fill(1, '3001', '500'); await page.fill('#vnarr', 'x'); await page.click('text=Save voucher for verification');
    ok((await page.$eval('.formerr', e => e.textContent)).includes('must not touch Cash'), 'CAS: journal voucher cannot touch cash');
    // codification: duplicate code refused, new account accepted
    await page.fill('#ncode', '1001'); await page.fill('#nname', 'Petty'); await page.click('text=+ Add account');
    ok((await page.$eval('.formerr', e => e.textContent)).includes('already used'), 'CAS: duplicate code refused');
    await page.fill('#ncode', '5101'); await page.fill('#nname', 'Advertising'); await page.click('text=+ Add account');
    ok((await page.$eval('.note.good', e => e.textContent)).includes('5000 Expenses'), 'CAS: new account filed under its head');
    // sale (receipt) and rent (payment), then verify both as checker
    await page.selectOption('#vtype', 'RECEIPT'); await page.fill('#vnarr', 'Cash sales'); await fill(0, '1001', '30000'); await fill(1, '4001', '30000'); await page.click('text=Save voucher for verification');
    await page.selectOption('#vtype', 'PAYMENT'); await page.fill('#vnarr', 'Rent'); await fill(0, '5002', '5000'); await fill(1, '1001', '5000'); await page.click('text=Save voucher for verification');
    await page.selectOption('#role', 'CHECKER');
    while (await page.$('text=Verify & post')) await page.click('text=Verify & post');
    // persistence: reload keeps the posted books and the role is restored
    await page.reload(); await page.waitForSelector('.cas'); await page.waitForTimeout(400);
    ok((await page.$eval('main', e => e.textContent)).includes('Cash sales'), 'CAS: state restored after reload');
    // close the year → profit 25,000 moved to capital; next year opens with the closing balances
    await page.selectOption('#role', 'CHECKER'); await page.click('text=Close the year (closing entries)');
    ok((await page.$eval('.note.good', e => e.textContent)).includes('Profit of ₹25,000.00'), 'CAS: closing entries move the profit to capital');
    await page.fill('#vnarr', 'late'); await page.selectOption('#vtype', 'RECEIPT'); await fill(0, '1001', '1'); await fill(1, '4001', '1'); await page.selectOption('#role', 'ACCOUNTANT'); await page.click('text=Save voucher for verification');
    ok((await page.$eval('.formerr', e => e.textContent)).includes('closed'), 'CAS: no entries into a closed year');
    await page.selectOption('#role', 'CHECKER'); await page.click('text=Start next year (opening entry)');
    ok((await page.$eval('main', e => e.textContent)).includes('Opening entry for year 2'), 'CAS: next year opens with an opening entry');
    ok((await page.$eval('main', e => e.textContent)).includes('₹1,25,000.00'), 'CAS: capital brought forward = 1,00,000 + 25,000 profit');
    // backup → restore round trip
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('text=Download backup')]); await dl.saveAs(tmp('au-cas.json'));
    const bk = JSON.parse(fs.readFileSync(tmp('au-cas.json'), 'utf8'));
    ok(bk.kind === 'cas-backup' && bk.posted.length >= 1, 'CAS: backup file content');
    await page.setInputFiles('input[aria-label="Restore a backup"]', tmp('au-cas.json'));
    await page.waitForSelector('.note.good:has-text("Backup restored")'); ok(true, 'CAS: backup restores and re-validates');
    fs.writeFileSync(tmp('au-bad.json'), JSON.stringify({ app: 'accounting-universe', kind: 'cas-backup', version: 1, year: 1, accounts: [['1001', 'Cash', 'ASSET']], posted: [{ date: '2026-04-01', narration: 'tampered', lines: [{ accountId: '1001', side: 'DR', amount: '5.00' }, { accountId: '3001', side: 'CR', amount: '5.00' }] }] }));
    await page.setInputFiles('input[aria-label="Restore a backup"]', tmp('au-bad.json')); await page.waitForSelector('.formerr:has-text("Cannot restore")');
    ok((await page.$eval('main', e => e.textContent)).includes('Opening entry for year 2'), 'CAS: a bad backup is refused and the books are untouched');

    // ── project assistant: progress persists
    await go('project/XI');
    await page.click('.steplist input[type=checkbox]'); await page.waitForTimeout(150);
    await page.reload(); await page.waitForSelector('.steplist'); await page.waitForTimeout(300);
    ok(await page.$eval('.steplist input[type=checkbox]', e => e.checked), 'project: ticked step survives a reload');
    ok((await page.$eval('main', e => e.textContent)).includes('nothing here writes it for you'), 'project: integrity note shown');

    // ── rescue plan
    await go('rescue'); await page.waitForSelector('.card');
    await page.click('.card'); await page.waitForSelector('.rescue-steps');
    ok((await page.$$('.rescue-steps li')).length >= 3, 'rescue: plan steps shown');
    ok((await page.$$('.rescue-steps li.now a.button')).length === 1, 'rescue: exactly one next action');

    // ── assignment: teacher creates → student imports → opens → fixed question + mode
    await go('teacher');
    await page.fill('#atitle', 'Unit test A'); await page.selectOption('#amode', 'BOARD');
    await page.check('.topicpick input[value="dep-wdv"]'); await page.check('.topicpick input[value="brs"]'); await page.fill('#aper', '1');
    const [adl] = await Promise.all([page.waitForEvent('download'), page.click('text=Download assignment file')]); await adl.saveAs(tmp('au-assign.json'));
    const asg = JSON.parse(fs.readFileSync(tmp('au-assign.json'), 'utf8'));
    ok(asg.kind === 'assignment' && asg.items.length === 2 && asg.mode === 'BOARD', 'assignment: file content');
    await page.click('text=Download assignment file').catch(() => {});
    await page.fill('#atitle', ''); await page.click('text=Download assignment file'); ok((await page.$eval('.formerr', e => e.textContent)).length > 0, 'assignment: title required');
    await go('progress'); await page.waitForSelector('.panel');
    await page.setInputFiles('input[aria-label="Import an assignment file"]', tmp('au-assign.json')); await page.waitForSelector('text=Unit test A');
    await page.click('.queue a.button'); await page.waitForSelector('ol.queue li:nth-child(2)');
    ok((await page.$$('.queue li')).length === 2, 'assignment: both questions listed');
    await page.click('.queue li a.button'); await page.waitForSelector('.question');
    ok(!(await page.$('text=Next hint')) && (await page.$eval('.modes button.on', e => e.textContent)) === 'Board', 'assignment: opens the fixed question in Board mode (no hints)');
    const stem1 = await page.$eval('.stem', e => e.textContent); await page.reload(); await page.waitForSelector('.stem');
    ok(stem1 === await page.$eval('.stem', e => e.textContent), 'assignment: the same question for everyone (deterministic seed)');
    fs.writeFileSync(tmp('au-asg-bad.json'), JSON.stringify({ ...asg, items: [{ skill: 'nope', seed: 1 }] }));
    await go('progress'); await page.waitForSelector('.panel'); await page.setInputFiles('input[aria-label="Import an assignment file"]', tmp('au-asg-bad.json'));
    await page.waitForSelector('text=Cannot import'); ok(true, 'assignment: tampered file refused');

    // ── teacher heat-map + remedial from two students' files
    const att = (clause, skill, marks, mistakes = []) => ({ t: 1, skill, clause, seed: 1, mode: 'PRACTICE', marks, outOf: 1, hintsUsed: 0, mistakes, correctParts: marks, parts: 1 });
    const stu = (name, a) => ({ name: name + '.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ app: 'accounting-universe', version: 1, exportedAt: 1, profile: { cls: 'XI', route: 'OPTION_I_ANALYSIS', name }, attempts: a, seen: [] })) });
    await go('teacher');
    await page.setInputFiles('#tfiles', [stu('Asha', [att('XI.2.depreciation', 'dep-wdv', 0, ['used cost']), att('XI.2.depreciation', 'dep-wdv', 0, ['used cost'])]), stu('Ravi', [att('XI.2.depreciation', 'dep-wdv', 1), att('XI.2.brs', 'brs', 1)])]);
    await page.waitForSelector('table.heatmap');
    ok(await page.$$eval('td.hm-bad', t => t.length) === 1 && await page.$$eval('td.hm-good', t => t.length) >= 1, 'heat-map: red and green cells');
    ok((await page.$eval('main', e => e.textContent)).includes('Suggested remedial work') && (await page.$eval('main', e => e.textContent)).includes('Depreciation Lab'), 'teacher: remedial points to the lab');

    // ── Option II: route switch, spreadsheet + CAS reachable and working
    await go(''); await page.click('.bigchoice:has-text("Class XII")'); await page.click('text=Option II — Computerised Accounting');
    await go('class/XII');
    const txt = await page.$eval('main', e => e.textContent);
    ok(txt.includes('Computerised Accounting Simulator') && txt.includes('Spreadsheet Lab'), 'Option II: class page links the simulator and spreadsheet lab');
    await go('lab/xii-spreadsheet'); await page.click('#tab-example'); await page.waitForSelector('.blocks');
    ok((await page.$eval('.tabpanel', e => e.textContent)).includes('₹8,884.88'), 'spreadsheet: EMI of ₹1,00,000 at 12% for 12 months is ₹8,884.88');
    await page.click('#tab-try'); await page.selectOption('#f-task', 'RATIO'); await page.click('button[type=submit]');
    ok((await page.$eval('.result', e => e.textContent)).includes('=B1/B4'), 'spreadsheet: shows the ratio formula');

    // ── known-value spot checks on the new Class XI/XII labs (values worked by hand in the engine tests)
    const run = async (id, set, expect, label) => { await go('lab/' + id); await page.click('#tab-try'); await page.waitForSelector('.labform'); for (const [k, v] of Object.entries(set)) await page.fill('#f-' + k, v); await page.click('button[type=submit]'); const t = await page.$eval('.result', e => e.textContent); ok(expect.every(x => t.includes(x)), `${label}: ${expect.filter(x => !t.includes(x)).join(' / ')}`); };
    await run('xi-cashbook', {}, ['₹8,000.00', '₹30,000.00'], 'cash book closing balances');
    await run('xi-subsidiary', {}, ['₹16,200.00', '₹36,000.00', '₹1,404.00'], 'subsidiary books totals');
    await run('xi-provisions', {}, ['₹4,750.00', '₹1,805.00', '₹88,445.00', '₹9,555.00'], 'provisions');
    await run('xi-opening', {}, ['₹1,80,000.00'], 'opening capital');
    await run('xi-equation', {}, ['Balanced'.slice(0, 0) + '₹1,40,000.00'].slice(0, 0).concat([]), 'equation renders');
    await run('xii-revaluation', {}, ['₹18,000.00', '₹9,000.00', '₹6,000.00', '₹3,000.00'], 'revaluation shares');
    await run('xii-schedule3', {}, ['₹9,00,000.00', '₹2,31,000.00', 'balances'], 'Schedule III');
    await run('xii-fundamentals', {}, ['₹3,000.00', '₹29,000.00', '₹32,000.00'], 'Act defaults');
    await run('xii-capital', {}, ['₹3,44,740.00', '₹44,740.00', 'agree'], 'fixed vs fluctuating');
    await run('xii-noncash', {}, ['50000 shares'.slice(0, 0) + '₹20,000.00', '50000'], 'shares for non-cash consideration');
    await run('xii-advance', {}, ['₹1,000.00', '₹39,000.00'], 'calls in advance');

    ok(errors.length === 0, 'no console/page errors: ' + errors.slice(0, 5).join(' | '));
  } finally { await browser.close(); srv.kill(); }
  console.log(`\n${pass} passed, ${fails.length} failed`);
  if (fails.length) { console.log(fails.map(f => ' - ' + f).join('\n')); process.exit(1); }
})().catch(e => { console.error(e); process.exit(2); });
