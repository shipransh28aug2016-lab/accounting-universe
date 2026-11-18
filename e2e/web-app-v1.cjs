/* Browser checks for the P0 "V1 slice" (handoff T0.2–T0.8): new practice skills (incl. CHOICE parts), the Hindi DRAFT toggle,
   official learning outcomes on the Learn tab, the teacher report by learning outcome, mobile width, and axe-core accessibility. */
const { chromium } = require('playwright');
const { spawn, execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const PORT = 4181, BASE = `http://127.0.0.1:${PORT}/`;
let pass = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fails.push(m); console.log('  ✗', m); } };
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js', { paths: [path.join(__dirname, '../apps/web')] }), 'utf8');
const SKILLS = ['eq-impact', 'eq-balance', 'drcr-choose', 'journal-entry', 'journal-error', 'ledger-balance', 'ledger-side', 'tb-agree', 'tb-side', 'case-ledger'];

(async () => {
  const hs = path.join(execSync('npm root -g').toString().trim(), 'http-server/bin/http-server');
  const srv = spawn('node', [hs, path.join(__dirname, '../apps/web/dist'), '-p', String(PORT), '-a', '127.0.0.1', '-c-1', '--silent'], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1200));
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message)); page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const go = async hash => { await page.goto(BASE + hash); await page.waitForSelector('html[data-app="ready"]'); await page.waitForSelector('main[data-route]'); };
  const axe = async (label) => {
    await page.evaluate(AXE);
    const r = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => `${v.id} (${v.nodes.length}): ${v.nodes[0].target.join(' ')}`));
    ok(r.length === 0, `axe ${label}: no serious/critical violations — ${r.join('; ')}`);
  };
  try {
    // ── every V1 skill: answer blank (board) → see the right answers → answer them → full marks
    for (const skill of SKILLS) {
      const hash = `#/practice/${skill}/7/board`;
      await go(hash); await page.waitForSelector('.question');
      ok((await page.textContent('.question .eyebrow')).match(/Remembering|Applying|Analysing/), `${skill}: typology chip shown`);
      const kinds = await page.$$eval('.question .field select, .question .field input', els => els.map(e => e.tagName));
      await page.click('.question button[type=submit]');
      await page.waitForSelector('.question[data-state="SUBMITTED"]');
      const answers = await page.$$eval('.note.bad p', ps => ps.map(p => { const b = p.querySelectorAll('b'); return b[b.length - 1].textContent; }));
      ok(answers.length === kinds.length, `${skill}: blank answer ⇒ every part shows its right answer (${answers.length}/${kinds.length})`);
      await page.reload(); await page.waitForSelector('html[data-app="ready"]'); await page.waitForSelector('.question[data-state="ANSWERING"], .question[data-state]');
      for (let i = 0; i < kinds.length; i++) {
        if (kinds[i] === 'SELECT') await page.selectOption(`#ans-${i}`, { label: answers[i] });
        else await page.fill(`#ans-${i}`, answers[i].replace(/[₹,\s]/g, '').replace('−', '-'));
      }
      await page.click('.question button[type=submit]');
      await page.waitForSelector('.question[data-state="SUBMITTED"]');
      const fb = await page.textContent('.question [role=status]');
      ok(/✓ Correct/.test(fb), `${skill}: entering the shown answers scores full marks — ${fb}`);
      if (skill === 'ledger-balance' || skill === 'tb-agree') ok(kinds.includes('SELECT'), `${skill}: has a CHOICE part rendered as a select`);
    }
    // a wrong CHOICE triggers rule-based feedback (the swap distractor) in practice mode
    await go('#/practice/tb-agree/11/practice'); await page.waitForSelector('.question');
    const opts = await page.$$eval('#ans-1 option', os => os.map(o => o.value).filter(Boolean));
    ok(opts.length === 2, 'tb-agree: side has exactly two options');
    await axe('practice (EN)');

    ok((await page.getAttribute('[data-lang-toggle]', 'aria-label')).includes(await page.textContent('[data-lang-toggle]')), 'language button: accessible name contains its visible text (WCAG 2.5.3)');
    // ── Hindi draft toggle: persists, renders Devanagari with a draft badge, values stay English
    await page.click('[data-lang-toggle]');
    await page.waitForSelector('html[data-lang="hi"]');
    await go('#/practice/ledger-balance/7/board'); await page.waitForSelector('.question');
    ok(await page.$('html[data-lang="hi"]') !== null, 'hindi: language choice survives a reload (saved in the profile)');
    ok(/[ऀ-ॿ]/.test(await page.textContent('.question .stem')), 'hindi: stem is in Devanagari');
    ok(await page.$('[data-hindi-draft="draft"]') !== null, 'hindi: DRAFT — not yet reviewed badge is shown');
    const hiOpts = await page.$$eval('select#ans-1 option', os => os.filter(o => o.value).map(o => [o.value, o.textContent]));
    ok(hiOpts.length === 2 && hiOpts.every(([v, t]) => /^[A-Za-z ]+$/.test(v) && /[ऀ-ॿ]/.test(t)), 'hindi: option labels in Hindi, values unchanged: ' + JSON.stringify(hiOpts));
    await page.click('.question button[type=submit]'); await page.waitForSelector('.question[data-state="SUBMITTED"]');
    ok(/अंक/.test(await page.textContent('.question [role=status]')), 'hindi: result line in Hindi');
    await axe('practice (HI)');
    await page.click('[data-lang-toggle]'); await page.waitForSelector('html[data-lang="en"]');
    ok(await page.isHidden('[data-hindi-draft]') && (await page.$eval('html', e => e.getAttribute('lang'))) === 'en', 'hindi: switching back to English hides the draft notice and sets the page language back to en');

    // header controls are really on the page (the projector button used to be created but never inserted)
    await go('#/'); ok(await page.isVisible('header .display-btn') && await page.isVisible('header [data-lang-toggle]'), 'header: display and language buttons are visible'); await page.click('header .display-btn');
    await page.click('header .projector-toggle'); ok(await page.$eval('html', e => e.classList.contains('projector')), 'projector mode switches on'); await page.click('header .projector-toggle');
    // choosing Hinglish on a concept card must not switch practice questions to Hindi (regression)
    await go('#/cards'); await page.click('a.card'); await page.waitForSelector('[role=radiogroup]');
    await page.click('button[role=radio]:has-text("Hinglish")');
    await go('#/practice/ledger-side/5/board'); await page.waitForSelector('.question');
    ok(await page.isHidden('[data-hindi-draft]') && await page.$('html[data-lang="hi"]') === null, 'hinglish card toggle does not change the app language');
    // Trainer: rounds are 15 questions drawn from hand-written + migrated scenes
    await go('#/trainer'); await page.waitForSelector('[data-machine="trainer-round"]');
    ok(/Question 1 of 15/.test(await page.textContent('main')), 'trainer: a round is 15 questions');

    // ── Learn tab shows the official learning outcomes for the lab's clauses
    await go('#/lab/xi-equation'); await page.waitForSelector('article[data-tab="learn"]');
    const los = await page.$$eval('[data-outcome]', e => e.map(x => x.getAttribute('data-outcome')));
    ok(los.includes('LO-XI.2-01') && los.includes('LO-XI.2-02'), 'learn tab: equation lab lists LO-XI.2-01/02: ' + los);
    ok(/pending academic review/.test(await page.textContent('article')), 'learn tab: says the mapping is pending review');
    await axe('lab learn tab');

    // ── teacher report by learning outcome from a hand-made student file
    const now = Date.now();
    const file = { app: 'accounting-universe', version: 1, exportedAt: now, profile: { cls: 'XI', route: 'OPTION_I_ANALYSIS', name: 'Asha' },
      attempts: [ { t: now, skill: 'ledger-balance', clause: 'XI.2.ledger', seed: 1, mode: 'PRACTICE', marks: 1, outOf: 3, hintsUsed: 0, mistakes: [], correctParts: 1, parts: 2 },
                  { t: now + 1, skill: 'ledger-balance', clause: 'XI.2.ledger', seed: 2, mode: 'PRACTICE', marks: 0, outOf: 3, hintsUsed: 0, mistakes: [], correctParts: 0, parts: 2 } ], seen: [] };
    const tmp = path.join(require('os').tmpdir(), `au-v1-${process.pid}.json`); fs.writeFileSync(tmp, JSON.stringify(file));
    await go('#/teacher'); await page.setInputFiles('#tfiles', tmp);
    await page.waitForSelector('[data-report="outcomes"] tr[data-outcome]');
    fs.unlinkSync(tmp);   // only after the page has read it (deleting first raced with the read on a busy machine)
    const row = await page.$eval('[data-report="outcomes"] tr[data-outcome="LO-XI.2-09"]', r => Array.from(r.querySelectorAll('td')).map(td => td.textContent));
    ok(JSON.stringify(row) === JSON.stringify(['1', '2', '17%', '1']), 'teacher: LO-XI.2-09 row = 1 student, 2 attempts, 1/6 = 17%, 1 struggling: ' + row);
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('text=⬇ Download outcome CSV')]);
    const csv = fs.readFileSync(await dl.path(), 'utf8');
    ok(csv.split('\n')[0].startsWith('outcome,unit,topics') && /LO-XI\.2-09,XI\.2,XI\.2\.ledger,1,2,17,1,/.test(csv), 'teacher: outcome CSV has the same figures');
    await axe('teacher');

    // ── mobile 390px: no horizontal scroll on the new screens
    await page.setViewportSize({ width: 390, height: 844 });
    for (const hsh of ['#/practice/tb-agree/7/practice', '#/lab/xi-equation', '#/teacher']) {
      await go(hsh);
      ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `mobile 390: no horizontal scroll on ${hsh}`);
    }
    await axe('home (mobile)');
    // CI found a 14px sideways scroll at 390px once the real web fonts loaded: emulate wider text and narrower phones
    for (const w of [390, 360, 320]) for (const spacing of ['0', '0.06em', '0.12em']) {
      await page.setViewportSize({ width: w, height: 800 }); await go('#/');
      const tag = await page.addStyleTag({ content: `* { letter-spacing: ${spacing} !important; }` });
      const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      ok(over <= 1, `phone header ${w}px, letter-spacing ${spacing}: sideways scroll ${over}px`);
      await tag.evaluate(n => n.remove());
    }
    await page.setViewportSize({ width: 1280, height: 900 }); await go('#/');
    const btn = sel => page.$eval(sel, e => { const s = getComputedStyle(e); return s.backgroundColor + '|' + s.color; });
    ok(!(await btn('header .display-btn')).startsWith('rgb(255, 255, 255)|') && !(await btn('header [data-lang-toggle]')).startsWith('rgb(255, 255, 255)|'), 'header buttons are not white boxes on the dark bar: ' + await btn('header .display-btn'));
    await go('#/crisis/7'); await page.waitForSelector('.crisis-hud');
    ok(await page.$eval('.crisis-hud', e => getComputedStyle(e).display) === 'flex', 'crisis page styles are present (lost once in a merge)');
  } catch (e) { fails.push('crash: ' + (e && e.stack || e)); }
  ok(errors.length === 0, 'no console errors: ' + errors.join(' | '));
  await browser.close(); srv.kill();
  console.log(`web-app-v1: ${pass} passed, ${fails.length} failed`);
  if (fails.length) { for (const f of fails) console.log(' -', f); process.exit(1); }
})();
