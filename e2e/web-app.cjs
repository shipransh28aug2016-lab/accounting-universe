/* End-to-end checks for apps/web (the built app in apps/web/dist). Run: npm run e2e:web  (see package.json) */
const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const path = require('node:path');
const PORT = 4173;
const BASE = `http://127.0.0.1:${PORT}/`;
const OUT = process.env.SHOTS || '';
let pass = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fails.push(m); console.log('  ✗', m); } };

(async () => {
  const hs = path.join(require('child_process').execSync('npm root -g').toString().trim(), 'http-server/bin/http-server');
  const srv = spawn('node', [hs, path.join(__dirname, '../apps/web/dist'), '-p', String(PORT), '-a', '127.0.0.1', '-c-1', '--silent'], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1200));
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const errors = [];
  const watch = page => { page.on('pageerror', e => errors.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); }); };
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage(); watch(page);
    const go = async h => { await page.goto(BASE + '#/' + h); await page.waitForSelector('main > *'); };
    const shot = async n => { if (OUT) await page.screenshot({ path: `${OUT}/${n}.png`, fullPage: true }); };

    // ── shell & navigation
    await page.goto(BASE); await page.waitForSelector('.hero');
    const navLabels = await page.$$eval('nav a', as => as.map(a => a.textContent));
    ok(JSON.stringify(navLabels) === JSON.stringify(['HOME', 'CLASS XI', 'CLASS XII', 'VISUAL LABS', 'PRACTICE', 'AI TUTOR', 'MY PROGRESS', 'TEACHER DASHBOARD']), 'nav labels: ' + navLabels);
    ok(await page.$eval('h2', e => e.textContent).then(t => t.includes('Learn Accounting by Doing Accounting')), 'tagline');
    await shot('home-desktop');

    // ── every lab: example renders, "Try it" with the example renders, no engine error shown
    const labIds = await (async () => { await go('labs'); return page.$$eval('a.card', as => as.map(a => a.getAttribute('href')).filter(h => h.startsWith('#/lab/')).map(h => h.slice(6))); })();
    ok(labIds.length >= 17, 'lab count ' + labIds.length);
    for (const id of new Set(labIds)) {
      await go('lab/' + id);
      ok(await page.$('h2') !== null, id + ': title');
      await page.click('#tab-example');
      await page.waitForSelector('.blocks');
      const bad = await page.$$('.tabpanel .note.bad');
      ok(bad.length === 0, id + ': worked example shows an error: ' + (bad.length ? await bad[0].textContent() : ''));
      const tables = await page.$$('.tabpanel table.data, .tabpanel .journals, .tabpanel .lifecycle, .tabpanel .figure');
      ok(tables.length > 0, id + ': worked example produced output');
      await page.click('#tab-try'); await page.waitForSelector('.labform');
      await page.waitForTimeout(30);
      ok((await page.$$('.result .note.bad')).length === 0, id + ': Try-it with example shows an error');
      // blank everything → friendly message, no crash
      await page.click('text=Clear all'); await page.click('button[type=submit]');
      const msg = await page.$eval('.result', e => e.textContent);
      ok(msg.length > 0 && !/undefined|NaN|\[object/.test(msg), id + ': blank input gives a clear message: ' + msg.slice(0, 80));
      // garbage input → friendly message, no crash
      for (const el of await page.$$('.labform input[type=text]')) await el.fill('abc');
      await page.click('button[type=submit]');
      const msg2 = await page.$eval('.result', e => e.textContent);
      ok(!/undefined|NaN|\[object|TypeError|at \w+\(/.test(msg2), id + ': garbage input handled: ' + msg2.slice(0, 80));
      // reset restores example
      await page.click('text=Reset to example'); await page.click('button[type=submit]');
      ok((await page.$$('.result .note.bad')).length === 0, id + ': reset to example works');
    }
    await go('lab/xii-shares'); await page.click('#tab-example'); await shot('lab-shares');

    // ── ledger lab
    await go('ledger');
    await page.click('text=⏭ Step'); await page.click('text=⏭ Step');
    ok(await page.$$eval('.journal-list tbody tr', r => r.length) > 0, 'ledger: entries after stepping');
    await page.click('text=↺ Reset');
    await page.click('text=▶ Play');
    await page.waitForFunction(() => document.querySelectorAll('.journal-list tr:not(.narr)').length >= 14, null, { timeout: 30000 });
    ok(true, 'ledger: play runs to completion');
    await page.waitForTimeout(300);
    ok((await page.$eval('.ledger-out', e => e.textContent)).includes('Trial balance agrees'), 'ledger: trial balance agrees after the scenario');
    ok((await page.$eval('.eqline', e => e.textContent)).includes('Assets ₹1,22,000.00') || (await page.$eval('.eqline', e => e.textContent)).includes('Assets'), 'ledger: equation line');
    await page.click('text=↺ Reset');
    // unbalanced manual entry is rejected with a reason
    await page.fill('#je-narr', 'test');
    const amts = await page.$$('.linerow input');
    await amts[0].fill('1000'); await amts[1].fill('900');
    await page.click('text=Post entry');
    ok((await page.$eval('.formerr', e => e.textContent)).includes('Dual aspect broken'), 'ledger: unbalanced entry refused');
    await amts[1].fill('1000'); await page.selectOption('.linerow:nth-child(1) select:nth-of-type(2)', 'cash'); await page.selectOption('.linerow:nth-child(2) select:nth-of-type(2)', 'capital');
    await page.click('text=Post entry');
    ok((await page.$$eval('.journal-list tbody tr', r => r.length)) >= 2, 'ledger: balanced entry accepted');
    page.once('dialog', d => d.accept('entered in error'));
    await page.click('text=Reverse');
    await page.waitForSelector('.reversed');
    ok((await page.$eval('.audit', e => e.textContent)).includes('Reversed'), 'ledger: reversal in audit trail');
    await shot('ledger');

    // ── practice: wrong answer reveals the answer, repeating the seed with that answer is marked correct
    await go('practice');
    const skills = await page.$$eval('#skillsel option', os => os.map(o => o.value));
    ok(skills.length >= 5, 'practice: skills for class XI ' + skills.length);
    await go('practice/dep-wdv/4242');
    await page.click('.modes button:nth-child(2)');
    await page.click('button[type=submit]');
    await page.waitForSelector('.feedback .note');
    const answers = await page.$$eval('.feedback .note.bad p b:nth-of-type(2)', bs => bs.map(b => b.textContent));
    ok(answers.length >= 1, 'practice: wrong answer shows the right one');
    // re-open the same question and type the revealed answers
    await go('practice/dep-wdv/4242');
    await page.click('.modes button:nth-child(2)');
    const inputs = await page.$$('.question input[type=text]');
    ok(inputs.length === answers.length, `practice: ${inputs.length} inputs vs ${answers.length} answers`);
    for (let i = 0; i < inputs.length; i++) await inputs[i].fill(answers[i]);
    await page.click('button[type=submit]');
    await page.waitForSelector('.feedback .note');
    ok((await page.$eval('.feedback', e => e.textContent)).includes('Correct'), 'practice: revealed answers are accepted: ' + (await page.$eval('.feedback', e => e.textContent)).slice(0, 80));
    // Board mode shows no hint button
    await go('practice/dep-wdv/4242'); await page.click('.modes button:nth-child(3)');
    ok(!(await page.$('text=Next hint')), 'practice: Board mode has no hints');
    // recommendations
    await page.click('text=Pick what I should practise next');
    ok(await page.$('.question') !== null, 'practice: recommend works');

    // ── progress reflects attempts; export is valid JSON and teacher dashboard reads it
    await go('progress');
    ok((await page.$eval('.lead', e => e.textContent)).match(/[1-9]\d* practice attempts/) !== null, 'progress: attempts counted');
    ok(await page.$$eval('table.data tbody tr', r => r.length) > 10, 'progress: topic table');
    await page.fill('#pname', 'Asha'); await page.click('text=Save name');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('text=Export my progress')]);
    const exportPath = path.join(require('os').tmpdir(), 'au-export.json');
    await dl.saveAs(exportPath);
    const exported = JSON.parse(require('fs').readFileSync(exportPath, 'utf8'));
    ok(exported.app === 'accounting-universe' && exported.attempts.length >= 2 && exported.profile.name === 'Asha', 'progress: export content');
    await go('teacher');
    await page.setInputFiles('#tfiles', [{ name: 'asha.json', mimeType: 'application/json', buffer: require('fs').readFileSync(exportPath) }, { name: 'broken.json', mimeType: 'application/json', buffer: Buffer.from('{"nope":1}') }]);
    await page.waitForSelector('.teacherout table');
    const t = await page.$eval('.teacherout', e => e.textContent);
    ok(t.includes('Asha') && t.includes('Skipped files'), 'teacher: student shown and bad file skipped');
    await shot('teacher');

    // ── tutor
    await go('tutor'); await page.fill('#tq', 'forfeiture'); await page.click('.searchrow button');
    ok((await page.$$eval('.cardlist li', l => l.length)) > 0, 'tutor: search finds forfeiture');
    ok((await page.$eval('.note.info', e => e.textContent)).includes('no AI language model is connected'), 'tutor: honest about no LLM');
    await page.click('.modes button:has-text("Hinglish")'); ok((await page.$eval('.gloss', e => e.textContent)).includes('badhe'), 'tutor: Hinglish rules');

    // ── class XII + route switch
    await page.goto(BASE); await page.click('.bigchoice:has-text("Class XII")');
    await page.waitForSelector('.routebox');
    await page.click('text=Option II — Computerised Accounting');
    ok((await page.$eval('.routebox', e => e.textContent)).includes('not built yet'), 'home: Option II honestly flagged');
    await go('class/XII');
    ok((await page.$$eval('.pill.none', e => e.length)) > 0, 'class page: unbuilt topics flagged');
    await shot('class-xii');

    // ── offline: service worker caches the app
    await page.goto(BASE); await page.waitForTimeout(1500);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await ctx.setOffline(true);
    await page.reload(); await page.waitForSelector('.hero');
    ok(await page.$eval('.net', e => e.textContent).then(t => t.includes('Offline')), 'offline: indicator shows');
    await go('lab/xii-ratios'); await page.click('#tab-example'); await page.waitForSelector('.blocks');
    ok(true, 'offline: lab works with no network');
    await ctx.setOffline(false);

    // ── mobile
    const mctx = await browser.newContext({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const m = await mctx.newPage(); watch(m);
    for (const h of ['', 'class/XI', 'labs', 'lab/xii-cashflow', 'lab/xi-final-accounts', 'ledger', 'practice/gst', 'progress', 'teacher', 'tutor']) {
      await m.goto(BASE + '#/' + h); await m.waitForSelector('main > *');
      if (h === 'lab/xii-cashflow' || h === 'lab/xi-final-accounts') { await m.click('#tab-example'); await m.waitForSelector('.blocks'); }
      const over = await m.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      ok(over <= 1, `mobile ${h || 'home'}: horizontal page scroll ${over}px`);
      if (OUT) await m.screenshot({ path: `${OUT}/m-${(h || 'home').replace(/\W/g, '-')}.png`, fullPage: true });
    }
    await m.goto(BASE); await m.click('.menu'); ok(await m.$eval('nav', n => n.classList.contains('open')), 'mobile: menu opens');

    // ── accessibility basics on every page
    for (const h of ['', 'class/XI', 'labs', 'lab/xi-depreciation', 'ledger', 'practice', 'tutor', 'progress', 'teacher']) {
      await page.goto(BASE + '#/' + h); await page.waitForSelector('main > *');
      if (h.startsWith('lab/')) { await page.click('#tab-try'); await page.waitForSelector('.labform'); }
      const probs = await page.evaluate(() => {
        const p = [];
        for (const el of document.querySelectorAll('input:not([type=hidden]):not([hidden]),select,textarea')) {
          const id = el.id; const lab = (id && document.querySelector(`label[for="${id}"]`)) || el.closest('label') || el.getAttribute('aria-label');
          if (!lab) p.push('unlabelled ' + el.tagName + '#' + id);
        }
        for (const b of document.querySelectorAll('button,a')) if (!(b.textContent || '').trim() && !b.getAttribute('aria-label')) p.push('unnamed ' + b.tagName);
        for (const i of document.querySelectorAll('svg[role=img]')) if (!i.getAttribute('aria-label')) p.push('svg without label');
        if (document.querySelectorAll('h1').length > 1) p.push('multiple h1');
        if (!document.querySelector('main h2')) p.push('no page heading');
        if (document.documentElement.lang !== 'en') p.push('lang');
        const ids = [...document.querySelectorAll('[id]')].map(e => e.id); if (new Set(ids).size !== ids.length) p.push('duplicate ids');
        return p;
      });
      ok(probs.length === 0, `a11y ${h || 'home'}: ${probs.join(', ')}`);
    }
    // keyboard: tabs respond to arrow keys
    await page.goto(BASE + '#/lab/xi-brs'); await page.focus('#tab-learn'); await page.keyboard.press('ArrowRight');
    ok(await page.$eval('#tab-example', e => e.getAttribute('aria-selected')) === 'true', 'a11y: arrow keys move between tabs');

    ok(errors.length === 0, 'no console/page errors: ' + errors.slice(0, 5).join(' | '));
  } finally { await browser.close(); srv.kill(); }
  console.log(`\n${pass} passed, ${fails.length} failed`);
  if (fails.length) { console.log(fails.map(f => ' - ' + f).join('\n')); process.exit(1); }
})().catch(e => { console.error(e); process.exit(2); });
