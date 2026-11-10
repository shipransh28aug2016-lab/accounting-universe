import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, validate } from './server.mjs';
import { checkReply } from './guard.mjs';

const FACTS = ['Closing cash = ₹8,000.00', 'Closing bank = ₹15,000.00'];
const body = (o = {}) => ({ question: 'Why is cash 8,000?', facts: FACTS, chapter: 'Cash book', mode: 'explain', lang: 'en', ...o });

async function withServer(env, upstream, fn) {
  const calls = [];
  const fakeFetch = async (url, init) => { calls.push({ url, init }); return upstream(url, init); };
  const srv = createServer(env, fakeFetch); await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port;
  const post = (b, path = '/api/tutor') => fetch(`http://127.0.0.1:${port}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: typeof b === 'string' ? b : JSON.stringify(b) });
  try { await fn({ post, calls, port }); } finally { srv.close(); }
}
const ok = text => async () => new Response(JSON.stringify({ content: [{ type: 'text', text }] }), { status: 200 });

test('guard: figures that are not in the engine facts are refused', () => {
  assert.equal(checkReply('Cash is 8,000 and bank 15000.', FACTS, '').ok, true);
  const bad = checkReply('Cash is 8,000, so profit is 9,500.', FACTS, '');
  assert.equal(bad.ok, false); assert.deepEqual(bad.rogue, ['9500']);
  assert.equal(checkReply('Step 1, then step 2 and 3.', FACTS, '').ok, true);          // tiny numbers are fine
  assert.equal(checkReply('Your 8000 is right', [], 'I got 8000').ok, true);            // numbers from the student's own question are fine
});
test('validation rejects incomplete or oversized requests', () => {
  assert.ok(validate(null)); assert.ok(validate(body({ question: '' }))); assert.ok(validate(body({ facts: [] })));
  assert.ok(validate(body({ question: 'x'.repeat(501) }))); assert.ok(validate(body({ mode: 'solve' }))); assert.ok(validate(body({ chapter: '' })));
  assert.equal(validate(body()), null);
});
test('no API key ⇒ 503, and the upstream is never called', async () => {
  await withServer({}, ok('hi'), async ({ post, calls }) => { assert.equal((await post(body())).status, 503); assert.equal(calls.length, 0); });
});
test('happy path: key goes to the upstream only, never back to the browser; prompt carries the rules and the facts', async () => {
  await withServer({ ANTHROPIC_API_KEY: 'sk-secret-123' }, ok('Cash fell because 8,000 is what remains after the contra entry.'), async ({ post, calls }) => {
    const r = await post(body()); const t = await r.text();
    assert.equal(r.status, 200); assert.ok(!t.includes('sk-secret-123')); assert.ok(!JSON.stringify([...r.headers]).includes('sk-secret-123'));
    assert.equal(calls.length, 1); assert.equal(calls[0].init.headers['x-api-key'], 'sk-secret-123');
    const sent = JSON.parse(calls[0].init.body);
    assert.equal(sent.max_tokens, 400); assert.match(sent.system, /NEVER calculate/); assert.match(sent.system, /Cash book/); assert.match(sent.messages[0].content, /Closing bank = ₹15,000.00/);
  });
});
test('hint mode instructs the model not to reveal the answer; Hinglish switches the language rule', async () => {
  await withServer({ ANTHROPIC_API_KEY: 'k' }, ok('Think about which side a deposit touches.'), async ({ post, calls }) => {
    await post(body({ mode: 'hint', lang: 'hi' }));
    const sys = JSON.parse(calls[0].init.body).system; assert.match(sys, /Do NOT reveal the final answer/); assert.match(sys, /Hinglish/);
  });
});
test('a reply containing an invented figure is withheld', async () => {
  await withServer({ ANTHROPIC_API_KEY: 'k' }, ok('So your closing cash should really be 9,999.'), async ({ post }) => {
    const j = await (await post(body())).json(); assert.equal(j.withheld, true); assert.ok(!j.text.includes('9,999'));
  });
});
test('cost controls: per-IP hourly limit and the daily ceiling', async () => {
  await withServer({ ANTHROPIC_API_KEY: 'k', TUTOR_RPH: '2' }, ok('Fine, 8,000.'), async ({ post }) => { await post(body()); await post(body()); assert.equal((await post(body())).status, 429); });
  await withServer({ ANTHROPIC_API_KEY: 'k', TUTOR_DAILY_CAP: '1' }, ok('Fine, 8,000.'), async ({ post }) => { await post(body()); assert.equal((await post(body())).status, 429); });
});
test('upstream failure is reported without leaking details; bad JSON and unknown paths are handled', async () => {
  await withServer({ ANTHROPIC_API_KEY: 'k' }, async () => new Response('boom secret detail', { status: 500 }), async ({ post }) => { const r = await post(body()); assert.equal(r.status, 502); assert.ok(!(await r.text()).includes('secret detail')); });
  await withServer({ ANTHROPIC_API_KEY: 'k' }, ok('x'), async ({ post }) => { assert.equal((await post('{not json')).status, 400); assert.equal((await post(body(), '/other')).status, 404); });
});
test('CORS is closed unless an origin is configured', async () => {
  await withServer({ ANTHROPIC_API_KEY: 'k' }, ok('Fine, 8,000.'), async ({ post }) => { assert.equal((await post(body())).headers.get('access-control-allow-origin'), null); });
  await withServer({ ANTHROPIC_API_KEY: 'k', TUTOR_ORIGIN: 'https://school.example' }, ok('Fine, 8,000.'), async ({ post }) => { assert.equal((await post(body())).headers.get('access-control-allow-origin'), 'https://school.example'); });
});

import { createLimiter } from './limits.mjs';
test('limiter: hourly window slides; each client is separate', () => {
  let t = Date.UTC(2026, 10, 9, 10, 0, 0); const L = createLimiter({ rph: 2, dailyCap: 100, now: () => t });
  assert.equal(L.check('a').ok, true); assert.equal(L.check('a').ok, true);
  const third = L.check('a'); assert.equal(third.ok, false); assert.equal(third.reason, 'IP_THROTTLED'); assert.equal(L.check('b').ok, true);
  t += 3_600_001; assert.equal(L.check('a').ok, true);                                   // the first two aged out
});
test('limiter: the daily ceiling resets at UTC midnight (previously untested)', () => {
  let t = Date.UTC(2026, 10, 9, 23, 59, 0); const L = createLimiter({ rph: 100, dailyCap: 2, now: () => t });
  L.check('a'); L.check('b'); const capped = L.check('c'); assert.equal(capped.ok, false); assert.equal(capped.reason, 'DAILY_CAP');
  t += 2 * 60_000; assert.equal(L.check('c').ok, true); assert.equal(L.stats().day, '2026-11-10');
});
test('limiter: idle clients are swept so memory cannot grow without bound', () => {
  let t = 0; const L = createLimiter({ rph: 5, dailyCap: 1_000_000, now: () => t });
  for (let i = 0; i < 150; i++) L.check('ip' + i);
  t += 2 * 3_600_000; for (let i = 0; i < 100; i++) L.check('fresh' + i);                 // crosses the 200-call sweep
  assert.ok(L.stats().clients <= 101, `clients=${L.stats().clients}`);
});
