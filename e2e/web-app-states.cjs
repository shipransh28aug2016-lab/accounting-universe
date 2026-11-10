/* Browser checks for the explicit state machines: states are readable (data-machine / data-state / window.__AU__), illegal actions are refused with a reason, and the defects found while inventorying the implicit machines stay fixed. */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const path = require('node:path');
const PORT = 4178, BASE = `http://127.0.0.1:${PORT}/`;
let pass = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fails.push(m); console.log('  ✗', m); } };

(async () => {
  const hs = path.join(require('child_process').execSync('npm root -g').toString().trim(), 'http-server/bin/http-server');
  const srv = spawn('node', [hs, path.join(__dirname, '../apps/web/dist'), '-p', String(PORT), '-a', '127.0.0.1', '-c-1', '--silent'], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1200));
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const errors = [];
  const newPage = async (init) => { const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); if (init) await p.addInitScript(init); p.on('pageerror', e => errors.push('pageerror: ' + e.message)); p.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); }); return p; };
  const state = (page, sel) => page.$eval(sel, e => e.getAttribute('data-state'));
  const machines = page => page.evaluate(() => window.__AU__ && window.__AU__.machines().map(m => `${m.id}:${m.state}`));
  try {
    // ── shell: the app announces its own state
    const page = await newPage(() => { window.__timers = new Set(); const si = window.setInterval, ci = window.clearInterval; window.setInterval = (...a) => { const id = si(...a); window.__timers.add(id); return id; }; window.clearInterval = id => { window.__timers.delete(id); return ci(id); }; });
    await page.goto(BASE); await page.waitForSelector('html[data-app="ready"]');
    ok(await page.$eval('html', e => e.getAttribute('data-net')) === 'online', 'shell: data-net=online');
    ok(await page.$eval('main', e => e.getAttribute('data-route')) === 'home', 'shell: main[data-route] names the page');
    const ms = await machines(page);
    ok(ms.includes('app-boot:READY') && ms.includes('storage:INDEXEDDB') && ms.includes('network:ONLINE'), 'shell: window.__AU__ lists app-boot, storage, network: ' + ms);
    ok(!(await page.$('.banner:not([hidden])')), 'shell: no storage banner when IndexedDB works');

    // ── ledger player: states, replay, reasons, and the timer-leak fix
    await page.goto(BASE + '#/ledger'); await page.waitForSelector('[data-machine="ledger-player"]');
    ok(await state(page, '[data-machine="ledger-player"]') === 'IDLE', 'player: starts IDLE');
    await page.selectOption('select[aria-label="Speed"]', '2');
    await page.click('text=▶ Play'); await page.waitForSelector('[data-machine="ledger-player"][data-state="PLAYING"]');
    ok(await page.evaluate(() => window.__timers.size) === 1, 'player: exactly one timer while playing');
    await page.click('text=⏸ Pause'); await page.waitForSelector('[data-state="PAUSED"]');
    ok(await page.evaluate(() => window.__timers.size) === 0, 'player: pausing clears the timer');
    await page.click('text=▶ Play'); await page.waitForSelector('[data-machine="ledger-player"][data-state="FINISHED"]', { timeout: 30000 });
    ok(await page.$eval('.controls button.primary', e => e.textContent) === '↺ Replay', 'player: finished ⇒ the button becomes Replay (it used to be a dead Play button)');
    ok(await page.evaluate(() => window.__timers.size) === 0, 'player: finished ⇒ no timer left');
    await page.click('text=⏭ Step'); ok((await page.$eval('.status', e => e.textContent)).includes('finished'), 'player: Step after the end explains why instead of doing nothing');
    ok(await page.$eval('.controls button:nth-child(2)', e => e.classList.contains('unavailable')), 'player: Step is visibly unavailable when finished');
    const rowsBefore = await page.$$eval('.journal-list tr:not(.narr)', r => r.length);
    await page.click('text=↺ Replay'); await page.waitForSelector('[data-state="PLAYING"]');
    ok((await page.$$eval('.journal-list tr:not(.narr)', r => r.length)) < rowsBefore, 'player: Replay starts the story again from empty books');
    // leaving the page while playing must stop the timer (this leaked before)
    ok(await page.evaluate(() => window.__timers.size) === 1, 'player: playing again ⇒ one timer');
    await page.goto(BASE + '#/'); await page.waitForSelector('[data-route="home"]');
    ok(await page.evaluate(() => window.__timers.size) === 0, 'LEAK FIX: navigating away stops the ledger timer');
    ok(!(await machines(page)).some(m => m.startsWith('ledger-player')), 'LEAK FIX: the player machine is unregistered after leaving');

    // ── practice: a question can only be answered once; help follows the state
    await page.goto(BASE + '#/practice/dep-wdv/4242/practice'); await page.waitForSelector('.question[data-machine="practice-question"]');
    ok(await state(page, '.question') === 'ANSWERING', 'practice: ANSWERING at first');
    await page.click('button[type=submit]'); await page.waitForSelector('.question[data-state="SUBMITTED"]');
    ok(await page.$eval('button[type=submit]', e => e.disabled), 'practice: Check is disabled once submitted');
    ok(await page.$eval('text=Next hint', e => e.disabled), 'practice: hints stop after submission');
    ok(await page.$eval('text=Next question', e => !e.hidden), 'practice: Next appears from state');
    await page.goto(BASE + '#/progress'); await page.waitForSelector('.lead');
    const n1 = Number((await page.$eval('.lead', e => e.textContent)).match(/(\d+) practice attempts/)[1]);
    await page.goto(BASE + '#/practice/dep-wdv/4242/practice'); await page.waitForSelector('.question');
    await page.click('button[type=submit]'); await page.waitForSelector('[data-state="SUBMITTED"]'); await page.evaluate(() => document.querySelector('form').requestSubmit()); await page.evaluate(() => document.querySelector('form').requestSubmit());
    await page.goto(BASE + '#/progress'); await page.waitForSelector('.lead');
    const n2 = Number((await page.$eval('.lead', e => e.textContent)).match(/(\d+) practice attempts/)[1]);
    ok(n2 === n1 + 1, `practice: three submits record ONE attempt (${n1} → ${n2})`);
    // beginner: wrong answers can be retried; help is limited and says why
    await page.goto(BASE + '#/practice/dep-wdv/4242/beginner'); await page.waitForSelector('.question');
    await page.click('button[type=submit]'); await page.waitForSelector('.question[data-state="RETRYING"]');
    ok(!(await page.$eval('button[type=submit]', e => e.disabled)), 'practice (beginner): a wrong answer stays retryable');
    let guard = 0; while (!(await page.$eval('text=Next hint', e => e.disabled)) && guard++ < 6) await page.click('text=Next hint');
    ok(await page.$eval('text=Next hint', e => e.title) === 'No more hints for this question.', 'practice: exhausted hints explain themselves');
    guard = 0; while (!(await page.$eval('text=Show next step', e => e.disabled)) && guard++ < 8) await page.click('text=Show next step');
    ok(await page.$eval('text=Show next step', e => e.title) === 'You have seen every step.', 'practice: exhausted steps explain themselves');
    await page.goto(BASE + '#/practice/dep-wdv/4242/board'); await page.waitForSelector('.question');
    ok(!(await page.$('text=Next hint')), 'practice (board): no hints at all');
    await page.click('button[type=submit]'); ok(await state(page, '.question') === 'SUBMITTED', 'practice (board): first check is final');

    // ── trainer, cards, lab result area expose their state
    await page.goto(BASE + '#/trainer'); await page.waitForSelector('[data-machine="trainer-round"]');
    ok(await state(page, '[data-machine="trainer-round"]') === 'ASKING', 'trainer: ASKING');
    await page.click('button[type=submit]'); ok(await state(page, '[data-machine="trainer-round"]') === 'ASKING' && (await page.$eval('.note.warn', e => e.textContent)).includes('Choose an account'), 'trainer: refused answer stays ASKING with a reason');
    await page.selectOption('#dr', { index: 1 }); await page.selectOption('#cr', { index: 2 }); await page.click('button[type=submit]');
    ok(await state(page, '[data-machine="trainer-round"]') === 'ANSWERED', 'trainer: ANSWERED');
    const scoreText = await page.$eval('.eyebrow', e => e.textContent); await page.evaluate(() => document.querySelector('form').requestSubmit());
    ok((await page.$eval('.eyebrow', e => e.textContent)) === scoreText, 'trainer: a second Check cannot score twice');
    await page.goto(BASE + '#/cards/gst'); await page.waitForSelector('form.check[data-machine="card-check"]');
    ok(await page.$eval('form.check', e => e.getAttribute('data-state')) === 'UNANSWERED', 'cards: UNANSWERED');
    await (await page.$('form.check input[value="1"]')).check(); await (await page.$('form.check button')).click();
    ok(await page.$eval('form.check', e => e.getAttribute('data-state')) === 'ANSWERED', 'cards: ANSWERED');
    await page.goto(BASE + '#/lab/xi-cashbook'); await page.click('#tab-try'); await page.waitForSelector('.result[data-machine="lab-run"]');
    ok(await page.$eval('article', e => e.getAttribute('data-tab')) === 'try', 'lab: data-tab');
    await page.waitForSelector('.result[data-state="OK"]'); ok(true, 'lab: result OK');
    await page.click('text=Clear all'); await page.click('button[type=submit]'); await page.waitForSelector('.result[data-state="ERROR"]'); ok(true, 'lab: result ERROR on bad input');

    // ── Computerised Accounting: unavailable actions say why, up front
    await page.goto(BASE + '#/cas'); await page.waitForSelector('[data-machine="cas-year"]');
    ok(await state(page, '[data-machine="cas-year"]') === 'OPEN', 'cas: year OPEN');
    const why1 = await page.$eval('.why-list', e => e.textContent);
    ok(why1.includes('Only a Checker can close the year.') && why1.includes('Close the year first.'), 'cas: both unavailable year actions are explained before clicking: ' + why1);
    ok(await page.$eval('text=Close the year (closing entries)', e => e.classList.contains('unavailable')), 'cas: Close is visibly unavailable for an Accountant');
    await page.selectOption('#role', 'CHECKER');
    const why2 = await page.$eval('.why-list', e => e.textContent);
    ok(!why2.includes('Only a Checker') && why2.includes('Close the year first.'), 'cas: as Checker only "close the year first" remains');
    ok(await page.$eval('text=Save voucher for verification', e => e.classList.contains('unavailable')), 'cas: a Checker cannot enter vouchers (Save is unavailable, with a reason)');
    // post a sale, close, then a Viewer may not start the next year (this was possible before)
    await page.selectOption('#role', 'ACCOUNTANT'); await page.fill('#vnarr', 'Capital');
    const rows = await page.$$('.cas-line'); await (await rows[0].$('input.code')).fill('1001'); await (await rows[0].$('input:not(.code)')).fill('100'); await (await rows[1].$('input.code')).fill('3001'); await (await rows[1].$('input:not(.code)')).fill('100');
    await page.click('text=Save voucher for verification');
    await page.fill('#vnarr', 'Sale'); const r2 = await page.$$('.cas-line'); await (await r2[0].$('input.code')).fill('1001'); await (await r2[0].$('input:not(.code)')).fill('50'); await (await r2[1].$('input.code')).fill('4001'); await (await r2[1].$('input:not(.code)')).fill('50');
    await page.click('text=Save voucher for verification'); await page.selectOption('#role', 'CHECKER');
    while (await page.$('text=Verify & post')) await page.click('text=Verify & post');
    await page.click('text=Close the year (closing entries)'); await page.waitForSelector('[data-machine="cas-year"][data-state="CLOSED"]');
    ok(true, 'cas: closing moves the year machine to CLOSED');
    await page.click('text=Close the year (closing entries)'); ok((await page.$eval('.formerr', e => e.textContent)) === 'This year is already closed.', 'cas: closing twice is refused');
    await page.selectOption('#role', 'VIEWER'); await page.click('text=Start next year (opening entry)');
    ok((await page.$eval('.formerr', e => e.textContent)) === 'Only a Checker can start the next year.', 'cas: a Viewer can no longer start the next year');
    await page.selectOption('#role', 'CHECKER'); await page.click('text=Start next year (opening entry)'); await page.waitForSelector('[data-machine="cas-year"][data-state="OPEN"]'); ok(true, 'cas: next year ⇒ OPEN again');

    // ── share lifecycle: impossible stories are refused in words
    await page.goto(BASE + '#/lab/xii-shares'); await page.click('#tab-try'); await page.waitForSelector('.labform');
    await page.fill('#f-arrCall', '0'); await page.click('button[type=submit]');
    ok((await page.$eval('.result', e => e.textContent)).includes('Shares can only be forfeited after a call was not paid.'), 'share lab: forfeiture without unpaid calls is refused with an explanation');
    await page.click('text=Reset to example'); await page.click('button[type=submit]'); await page.waitForSelector('.lifecycle');
    ok((await page.$$eval('.lifecycle li.issue', l => l.length)) === 2, 'share lab: example shows arrears + forfeiture as issues (derived from the machine)');

    // ── storage fallback: private-mode style — nothing is saved, and the student is TOLD
    const mem = await newPage(() => { Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true }); });
    await mem.goto(BASE); await mem.waitForSelector('html[data-app="ready"]');
    await mem.waitForSelector('.banner:not([hidden])'); ok((await mem.$eval('.banner', e => e.textContent)).includes('cannot be saved'), 'storage: a banner warns that progress cannot be saved');
    ok((await machines(mem)).includes('storage:MEMORY'), 'storage: machine is MEMORY');
    ok(await mem.$eval('.banner a', e => e.getAttribute('href')) === '#/progress', 'storage: banner links to Export');
    await mem.goto(BASE + '#/practice/dep-wdv/4242/practice'); await mem.waitForSelector('.question'); await mem.click('button[type=submit]');
    await mem.goto(BASE + '#/progress'); await mem.waitForSelector('.lead');
    ok(/\b1 practice attempts/.test(await mem.$eval('.lead', e => e.textContent)), 'storage: the app still works from memory');
    ok(!!(await mem.$('.banner:not([hidden])')), 'storage: banner stays on every page');

    ok(errors.length === 0, 'no console/page errors: ' + errors.slice(0, 5).join(' | '));
  } finally { await browser.close(); srv.kill(); }
  console.log(`\n${pass} passed, ${fails.length} failed`);
  if (fails.length) { console.log(fails.map(f => ' - ' + f).join('\n')); process.exit(1); }
})().catch(e => { console.error(e); process.exit(2); });
