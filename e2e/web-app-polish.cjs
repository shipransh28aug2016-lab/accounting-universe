/* Phase 1 "professional look": the home page speaks to learners and shows one clear first step, the labs index is grouped by unit with search and a
   class filter, the class map leads with topic titles, icons replace emoji, projector mode lives in a Display menu, and "AI Tutor" is now "Help". */
const { chromium } = require('playwright');
const { spawn, execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const PORT = 4185,
  BASE = `http://127.0.0.1:${PORT}/`;
let pass = 0;
const fails = [];
const ok = (c, m) => {
  if (c) pass++;
  else {
    fails.push(m);
    console.log('  ✗', m);
  }
};
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js', { paths: [path.join(__dirname, '../apps/web'), path.join(__dirname, '..')] }), 'utf8');
const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}]/u;

(async () => {
  const hs = path.join(execSync('npm root -g').toString().trim(), 'http-server/bin/http-server');
  const srv = spawn('node', [hs, path.join(__dirname, '../apps/web/dist'), '-p', String(PORT), '-a', '127.0.0.1', '-c-1', '--silent'], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1200));
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => {
    if (m.type() === 'error') errors.push('console: ' + m.text());
  });
  const go = async hash => {
    await page.goto(BASE + '#/');
    await page.goto(BASE + hash);
    await page.waitForSelector('html[data-app="ready"]');
    await page.waitForSelector('main[data-route]');
  };
  const axe = async label => {
    await page.evaluate(AXE);
    const r = await page.evaluate(async () =>
      (await window.axe.run(document, { resultTypes: ['violations'] })).violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => `${v.id}: ${v.nodes[0].target.join(' ')}`),
    );
    ok(r.length === 0, `axe ${label}: no serious/critical violations — ${r.join('; ')}`);
  };
  const text = sel => page.$eval(sel, e => e.innerText);
  try {
    // ── home: for learners, one clear first step, a door for teachers, no developer words, no emoji
    await go('#/');
    const home = await text('main');
    ok(!/bigint|paise|engine computes|apps\/|proxy|D4\b/i.test(home), 'home: no developer jargon in the visible text');
    ok(!EMOJI.test(home), 'home: no emoji (an icon set is used instead)');
    ok((await page.$$eval('.step3', e => e.length)) === 3, 'home: three-step "how a session works" row');
    ok((await page.$$eval('.card .icon svg', e => e.length)) >= 4, 'home: cards carry SVG icons');
    ok((await page.$('.hero-scene')) === null && (await page.$('.hero canvas')) === null, 'home: no decorative 3D layer behind the text');
    ok(/Start here: Journal → Ledger → Trial Balance/.test(await text('[data-start]')), 'home: Class XI first step is named on the button: ' + (await text('[data-start]')));
    await page.click('[data-start]');
    await page.waitForSelector('main[data-route="ledger"]');
    ok(true, 'home: the Class XI first step opens the ledger page');
    await go('#/');
    await page.click('.bigchoice:has-text("Class XII")');
    ok(/Appropriation/.test(await text('[data-start]')), 'home: Class XII Option I first step is the Profit & Loss Appropriation lab (first partnership topic): ' + (await text('[data-start]')));
    await page.click('text=Option II — Computerised Accounting');
    ok(/Computerised Accounting Simulator/.test(await text('[data-start]')), 'home: Class XII Option II first step is the simulator');
    await page.click('[data-start]');
    await page.waitForSelector('main[data-route="cas"]');
    ok(true, 'home: Option II first step opens the simulator');
    await go('#/');
    await page.click('.bigchoice:has-text("Class XI")');
    ok((await page.getAttribute('.teacher-band a.button', 'href')) === '#/teacher', 'home: teachers have their own entry');
    await axe('home');

    // ── nav and header
    const nav = await page.$$eval('nav a', as => as.map(a => a.textContent));
    ok(nav.includes('Help') && !nav.includes('AI tutor'), 'nav: "AI TUTOR" is now "HELP": ' + nav.join(','));
    ok(await page.isHidden('#display-panel'), 'header: Display panel starts closed');
    await page.click('.display-btn');
    ok((await page.isVisible('#display-panel')) && (await page.getAttribute('.display-btn', 'aria-expanded')) === 'true', 'header: Display button opens the panel and says so (aria-expanded)');
    ok(
      (await page.getAttribute('.projector-toggle', 'role')) === 'switch' && (await page.getAttribute('.projector-toggle', 'aria-checked')) === 'false',
      'header: projector mode is a labelled switch, off by default',
    );
    await page.click('.projector-toggle');
    ok((await page.getAttribute('.projector-toggle', 'aria-checked')) === 'true' && (await page.$eval('html', e => e.classList.contains('projector'))), 'header: the switch turns projector mode on');
    await page.reload();
    await page.waitForSelector('html[data-app="ready"]');
    ok(await page.$eval('html', e => e.classList.contains('projector')), 'header: projector mode is remembered after a reload');
    await page.click('.display-btn');
    await page.click('.projector-toggle');
    await page.keyboard.press('Escape');
    ok(
      (await page.isHidden('#display-panel')) && (await page.evaluate(() => document.activeElement?.classList.contains('display-btn'))),
      'header: Escape closes the panel and returns focus to the Display button',
    );
    await page.click('.display-btn');
    await page.click('h2');
    ok(await page.isHidden('#display-panel'), 'header: clicking elsewhere closes the panel');
    ok(!(await page.$eval('html', e => e.classList.contains('projector'))), 'header: projector mode is off again');

    // ── labs index: grouped by unit, searchable, class filter
    await go('#/labs');
    const total = await page.$$eval('a.card', e => e.length);
    ok((await page.$$eval('details.unit-group', e => e.length)) >= 3, 'labs: tools are grouped into syllabus units');
    ok(!EMOJI.test(await text('main')), 'labs: no emoji');
    ok((await page.$$eval('.card .icon svg', e => e.length)) === total, `labs: every card has an icon (${total})`);
    ok(/\d+ labs shown/.test(await text('#labcount')), 'labs: the count is announced: ' + (await text('#labcount')));
    ok((await page.$$eval('[data-class="XII"]', e => e.length)) === 0, 'labs: Class XI view does not list Class XII groups');
    await page.click('[data-filter="ALL"]');
    ok((await page.$$eval('[data-class="XII"]', e => e.length)) === 1, 'labs: "Both classes" adds the Class XII groups');
    const both = await page.$$eval('a.card', e => e.length);
    ok(both > total, `labs: both classes show more tools (${total} → ${both})`);
    ok((await page.$$eval('details.unit-group', ds => ds.filter(d => !d.open).length)) >= 1, 'labs: the other class starts collapsed');
    await page.fill('#labsearch', 'depreciation');
    const hits = await page.$$eval('a.card', e => e.map(a => a.textContent));
    ok(hits.length >= 1 && hits.length <= 3 && hits.every(t => /depreciation/i.test(t)), 'labs: searching "depreciation" narrows the list: ' + hits.length);
    ok(await page.$$eval('details.unit-group', ds => ds.every(d => d.open)), 'labs: matching groups open while searching');
    await page.fill('#labsearch', 'zzzzqqq');
    ok((await page.$$eval('a.card', e => e.length)) === 0 && /No lab matches/.test(await text('#labcount')), 'labs: an empty search explains itself');
    await page.fill('#labsearch', '');
    ok((await page.$$eval('a.card', e => e.length)) === both, 'labs: clearing the search brings everything back');
    await page.$eval('summary', s => s.focus());
    await page.keyboard.press('Enter');
    ok(await page.$eval('details.unit-group', d => !d.open), 'labs: a unit group can be toggled from the keyboard');
    await axe('labs');

    // ── class map: topic titles lead, syllabus codes are secondary
    await go('#/class/XI');
    const li = await page.$eval('.clauselist li > div', d => [...d.children].map(c => c.tagName + '.' + c.className).join(' | '));
    ok(/^B\./.test(li) && /SPAN\.cid/.test(li), 'class map: the title comes first and the code after it: ' + li);
    ok(!EMOJI.test(await text('main')), 'class map: no emoji');
    await axe('class map');

    // ── help page speaks to students
    await go('#/tutor');
    ok(/help/i.test(await text('.eyebrow')) && !/apps\/tutor-proxy|API key|decision D4|language model/i.test(await text('main')), 'help: no developer or deployment talk for students');
    await axe('help');

    // ── practice/ledger icons replace emoji too
    await go('#/practice/dep-wdv/5/practice');
    await page.waitForSelector('.question');
    ok(!EMOJI.test(await text('.practice')), 'practice: no emoji on its buttons');
    ok((await page.$('text=Next hint')) !== null, 'practice: the hint button still works by its label');

    // ── phones: no sideways scroll on the redesigned pages
    for (const w of [390, 360, 320])
      for (const h of ['#/', '#/labs', '#/class/XI']) {
        await page.setViewportSize({ width: w, height: 800 });
        await go(h);
        ok((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 1, `phone ${w}px: no sideways scroll on ${h}`);
      }
    await page.setViewportSize({ width: 390, height: 844 });
    await go('#/labs');
    ok(
      (await page.evaluate(() => document.documentElement.scrollHeight)) < 6500,
      'phone: the labs page is far shorter than the old 10,000 px wall: ' + (await page.evaluate(() => document.documentElement.scrollHeight)),
    );
    await axe('labs (phone)');
  } catch (e) {
    fails.push('crash: ' + ((e && e.stack) || e));
  }
  ok(errors.length === 0, 'no console errors: ' + errors.join(' | '));
  await browser.close();
  srv.kill();
  console.log(`web-app-polish: ${pass} passed, ${fails.length} failed`);
  if (fails.length) {
    for (const f of fails) console.log(' -', f);
    process.exit(1);
  }
})();
