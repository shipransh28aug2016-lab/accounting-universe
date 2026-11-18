/* Phase 2: ONE language switch drives the whole app. In Hindi mode the header, navigation, home, labs index, class map and practice shell are in
   Devanagari with no English left over (English content such as lab names is marked lang="en"); every other page says it is English-only; a single
   draft notice is shown; the page language is set for screen readers; and switching back restores the English wording exactly. */
const { chromium } = require('playwright');
const { spawn, execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const PORT = 4186,
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
const DEV = /[ऀ-ॿ]/;
/** words that may stay English inside Hindi text: the board's name, and the example search words in the labs search hint */
const ALLOWED = new Set(['CBSE', 'depreciation', 'goodwill', 'ratio', 'XI', 'XII']);

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
    await page.waitForTimeout(150);
  };
  const axe = async label => {
    await page.evaluate(AXE);
    const r = await page.evaluate(async () =>
      (await window.axe.run(document, { resultTypes: ['violations'] })).violations.filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => `${v.id}: ${v.nodes[0].target.join(' ')}`),
    );
    ok(r.length === 0, `axe ${label}: no serious/critical violations — ${r.join('; ')}`);
  };
  /** every English word of 3+ letters that sits in text which is not marked lang="en" (header, nav, banner and main) */
  const leftovers = () =>
    page.evaluate(
      allowed => {
        const out = [];
        for (const root of [document.querySelector('header.top'), document.querySelector('nav#nav'), document.querySelector('main')]) {
          const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
          for (let n = w.nextNode(); n; n = w.nextNode()) {
            const el = n.parentElement;
            if (!el || el.closest('[lang="en"]') || el.closest('script,style')) continue;
            if (getComputedStyle(el).display === 'none') continue;
            for (const m of n.textContent.matchAll(/[A-Za-z]{3,}/g)) if (!allowed.includes(m[0])) out.push(`${m[0]} in “${n.textContent.trim().slice(0, 50)}”`);
          }
        }
        return out;
      },
      [...ALLOWED],
    );
  try {
    // ── English first: nothing changes for English users
    await go('#/');
    ok((await page.$eval('html', e => e.getAttribute('lang'))) === 'en', 'English: html lang is en');
    const navEn = await page.$$eval('nav a', as => as.map(a => a.textContent));
    ok(
      JSON.stringify(navEn) === JSON.stringify(['HOME', 'CLASS XI', 'CLASS XII', 'VISUAL LABS', 'PRACTICE', 'HELP', 'MY PROGRESS', 'TEACHER DASHBOARD']),
      'English: navigation wording unchanged: ' + navEn.join(','),
    );
    const h2En = await page.$eval('main h2', e => e.textContent);
    ok(h2En === 'Learn Accounting by Doing Accounting.', 'English: home heading unchanged: ' + h2En);
    ok(await page.isHidden('[data-hindi-draft]'), 'English: the draft notice is hidden');

    // ── switch to Hindi
    await page.click('[data-lang-toggle]');
    await page.waitForSelector('html[data-lang="hi"]');
    ok((await page.$eval('html', e => e.getAttribute('lang'))) === 'hi', 'Hindi: html lang is hi');
    ok((await page.$$eval('[data-hindi-draft]', e => e.length)) === 1 && (await page.isVisible('[data-hindi-draft="draft"]')), 'Hindi: exactly one draft notice, visible');
    const navHi = await page.$$eval('nav a', as => as.map(a => a.textContent));
    ok(navHi.length === 8 && navHi.every(t => DEV.test(t)), 'Hindi: all 8 navigation labels are Devanagari: ' + navHi.join(' | '));
    ok(
      DEV.test(await page.textContent('header .menu')) && DEV.test(await page.textContent('.skip')) && DEV.test(await page.textContent('.net')),
      'Hindi: menu, skip link and online status are Devanagari',
    );
    ok((await page.getAttribute('.display-btn', 'aria-label')).startsWith('प्रदर्शन') && DEV.test(await page.textContent('.display-btn')), 'Hindi: Display button label contains its visible text');
    await page.click('.display-btn');
    ok(DEV.test(await page.textContent('.projector-toggle')), 'Hindi: projector switch text is Devanagari');
    await page.keyboard.press('Escape');

    const checkPage = async (hash, label) => {
      await go(hash);
      ok((await page.$$eval('[data-hindi-draft]', e => e.length)) === 1, `${label}: still exactly one draft notice`);
      ok((await page.$('[data-english-only]')) === null, `${label}: no "English only" notice (this page is translated)`);
      const left = await leftovers();
      ok(left.length === 0, `${label}: no English left in the page chrome — ${left.slice(0, 6).join('; ')}`);
    };
    await checkPage('#/', 'home');
    ok(DEV.test(await page.textContent('main h2')), 'Hindi home: heading in Devanagari: ' + (await page.textContent('main h2')));
    ok(DEV.test(await page.textContent('[data-start]')) && DEV.test(await page.textContent('.teacher-band')), 'Hindi home: start button and teacher band are Hindi');
    ok((await page.$$eval('.card h3[lang="en"], .card h3 [lang="en"]', e => e.length)) >= 3, 'Hindi home: lab names stay English and are marked lang="en"');
    await axe('home (HI)');
    await checkPage('#/labs', 'labs');
    ok(
      DEV.test(await page.getAttribute('#labsearch', 'placeholder')) && /प्रयोगशाला/.test(await page.textContent('#labcount')),
      'Hindi labs: search hint and result count in Hindi: ' + (await page.textContent('#labcount')),
    );
    ok(await page.$$eval('details.unit-group .unit-name', e => e.every(x => /[\u0900-\u097F]/.test(x.textContent))), 'Hindi labs: unit titles are Hindi');
    await page.fill('#labsearch', 'zzzzqq');
    ok(DEV.test(await page.textContent('#labcount')), 'Hindi labs: the empty-search message is Hindi');
    await page.fill('#labsearch', '');
    await axe('labs (HI)');
    await checkPage('#/class/XI', 'class map');
    ok(
      DEV.test(await page.textContent('main h2')) && (await page.$$eval('.clauselist b > [lang="en"]', e => e.length)) >= 10,
      'Hindi class map: heading Hindi, topic titles stay English and are marked',
    );
    await axe('class map (HI)');
    await checkPage('#/practice', 'practice');
    ok(await page.$$eval('.modes button', bs => bs.every(b => /[ऀ-ॿ]/.test(b.textContent))), 'Hindi practice: the three mode buttons are Hindi');
    await page.selectOption('#skillsel', 'ledger-balance');
    ok(DEV.test(await page.textContent('.question .stem')) && DEV.test(await page.textContent('.question button[type=submit]')), 'Hindi practice: a V1 question and its Check button are Hindi');
    await axe('practice (HI)');
    await go('#/crisis/7');
    ok((await page.$$eval('[data-hindi-draft]', e => e.length)) === 1, 'crisis: one draft notice, not one per block');

    // ── pages that are not translated yet say so, and are marked English for screen readers
    for (const [hash, name] of [
      ['#/ledger', 'ledger'],
      ['#/progress', 'progress'],
      ['#/teacher', 'teacher'],
      ['#/lab/xi-depreciation', 'a lab'],
      ['#/tutor', 'help'],
    ]) {
      await go(hash);
      ok((await page.isVisible('[data-english-only]')) && DEV.test(await page.textContent('[data-english-only]')), `${name}: shows a Hindi "this page is English-only" notice`);
      ok((await page.$eval('main', e => e.getAttribute('lang'))) === 'en', `${name}: main is marked lang="en"`);
    }
    await go('#/crisis/7');
    ok((await page.$eval('main', e => e.getAttribute('lang'))) === null, 'crisis: main is not forced to English (it is translated)');

    // ── the choice is remembered
    await go('#/');
    await page.reload();
    await page.waitForSelector('html[data-app="ready"]');
    await page.waitForSelector('main[data-route]');
    ok((await page.$eval('html', e => e.getAttribute('lang'))) === 'hi' && DEV.test(await page.textContent('nav')), 'Hindi is remembered after a reload');

    // ── phones: Devanagari is wider, so check the narrow widths
    for (const w of [390, 360, 320])
      for (const h of ['#/', '#/labs', '#/class/XI', '#/practice']) {
        await page.setViewportSize({ width: w, height: 800 });
        await go(h);
        ok((await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) <= 1, `Hindi, phone ${w}px: no sideways scroll on ${h}`);
      }
    await page.setViewportSize({ width: 1280, height: 900 });

    // ── back to English: exactly the old wording
    await go('#/');
    await page.click('[data-lang-toggle]');
    await page.waitForSelector('html[data-lang="en"]');
    ok(
      (await page.$eval('html', e => e.getAttribute('lang'))) === 'en' && (await page.$eval('main h2', e => e.textContent)) === 'Learn Accounting by Doing Accounting.',
      'English again: html lang and heading restored',
    );
    ok(JSON.stringify(await page.$$eval('nav a', as => as.map(a => a.textContent))) === JSON.stringify(navEn), 'English again: navigation wording restored');
    ok((await page.isHidden('[data-hindi-draft]')) && (await page.$('[data-english-only]')) === null, 'English again: no draft or English-only notices');
    await go('#/ledger');
    ok((await page.$eval('main', e => e.getAttribute('lang'))) === null, 'English again: main carries no forced language');
  } catch (e) {
    fails.push('crash: ' + ((e && e.stack) || e));
  }
  ok(errors.length === 0, 'no console errors: ' + errors.join(' | '));
  await browser.close();
  srv.kill();
  console.log(`web-app-lang: ${pass} passed, ${fails.length} failed`);
  if (fails.length) {
    for (const f of fails) console.log(' -', f);
    process.exit(1);
  }
})();
