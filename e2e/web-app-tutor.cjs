/* Browser ↔ tutor-proxy integration against a MOCK upstream (never the live API). Builds a second bundle with VITE_TUTOR_URL set. */
const { chromium } = require('playwright');
const { spawn, execSync } = require('node:child_process');
const http = require('node:http'); const path = require('node:path'); const os = require('node:os'); const fs = require('node:fs');
const WEB = 4179, PROXY = 4180, UP = 4181;
let pass = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fails.push(m); console.log('  ✗', m); } };
(async () => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'au-tutor-'));
  execSync(`npx vite build --outDir ${out} --emptyOutDir`, { cwd: path.join(__dirname, '../apps/web'), env: { ...process.env, VITE_TUTOR_URL: `http://127.0.0.1:${PROXY}/api/tutor` }, stdio: 'ignore' });
  let reply = 'Cash is 8,000 because the deposit moved ₹8,000 to the bank.';
  const upstream = http.createServer((req, res) => { req.resume(); req.on('end', () => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify({ content: [{ type: 'text', text: reply }] })); }); }).listen(UP);
  const proxy = spawn('node', [path.join(__dirname, '../apps/tutor-proxy/server.mjs')], { env: { ...process.env, PORT: String(PROXY), ANTHROPIC_API_KEY: 'test-key', ANTHROPIC_BASE_URL: `http://127.0.0.1:${UP}`, TUTOR_ORIGIN: `http://127.0.0.1:${WEB}` }, stdio: 'ignore' });
  const hs = path.join(execSync('npm root -g').toString().trim(), 'http-server/bin/http-server');
  const web = spawn('node', [hs, out, '-p', String(WEB), '-a', '127.0.0.1', '-c-1', '--silent'], { stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 1500));
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    const page = await (await browser.newContext()).newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(`http://127.0.0.1:${WEB}/#/tutor`); await page.waitForSelector('#aiq');
    const st = () => page.$eval('section[data-machine="ai-ask"]', e => e.getAttribute('data-state'));
    ok(await st() === 'IDLE', 'ai: IDLE');
    ok((await page.$eval('main', e => e.textContent)).includes('An AI tutor is connected'), 'ai: page says a tutor is connected');
    await page.selectOption('#ailab', 'xi-cashbook'); await page.click('section[data-machine="ai-ask"] button.primary');
    ok(await st() === 'IDLE' && (await page.$eval('.note.warn', e => e.textContent)) === 'Type your question first.', 'ai: empty question refused with a reason, state unchanged');
    await page.fill('#aiq', 'Why is cash 8,000?'); await page.click('section[data-machine="ai-ask"] button.primary'); await page.waitForSelector('section[data-state="ANSWERED"]');
    ok((await page.$eval('section[data-machine="ai-ask"] .note', e => e.textContent)).includes('deposit moved'), 'ai: ANSWERED shows the reply');
    reply = 'So your closing cash should really be 9,999.';
    await page.click('section[data-machine="ai-ask"] button.primary'); await page.waitForSelector('section[data-state="WITHHELD"]');
    ok(!(await page.$eval('section', e => e.textContent)).includes('9,999'), 'ai: WITHHELD — the invented figure never reaches the page');
    proxy.kill(); await new Promise(r => setTimeout(r, 400));
    await page.click('section[data-machine="ai-ask"] button.primary'); await page.waitForSelector('section[data-state="FAILED"]');
    ok((await page.$eval('main', e => e.textContent)).includes('not reachable') && !!(await page.$('input#tq')), 'ai: FAILED says so, and the offline helper is still on the page');
    ok(!(await page.$eval('section[data-machine="ai-ask"] button.primary', e => e.disabled)), 'ai: the Ask button is usable again after a failure');
    ok(errs.length === 0, 'no page errors: ' + errs.join(' | '));
  } finally { await browser.close(); web.kill(); proxy.kill(); upstream.close(); fs.rmSync(out, { recursive: true, force: true }); }
  console.log(`\n${pass} passed, ${fails.length} failed`);
  if (fails.length) { console.log(fails.map(f => ' - ' + f).join('\n')); process.exit(1); }
})().catch(e => { console.error(e); process.exit(2); });
