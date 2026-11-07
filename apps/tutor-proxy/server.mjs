/**
 * Accounting Universe — tutor proxy. Zero dependencies (Node 18+). The browser NEVER sees the API key: it only talks to this server.
 *   ANTHROPIC_API_KEY   required (server-side only)
 *   TUTOR_MODEL         default claude-haiku-5-5 (cheapest suitable model; override if you prefer)
 *   TUTOR_ORIGIN        allowed browser origin for CORS (default: none, same-origin only)
 *   TUTOR_RPH           requests per IP per hour (default 20)
 *   TUTOR_DAILY_CAP     total requests per day across everyone — the cost ceiling (default 500)
 *   TUTOR_MAX_TOKENS    max output tokens (default 400)
 *   ANTHROPIC_BASE_URL  for tests only
 */
import http from 'node:http';
import { checkReply } from './guard.mjs';

const LIMITS = { question: 500, factLines: 60, factLen: 300, chapter: 120 };
export const SYSTEM = (chapter, mode, lang) => `You are a patient CBSE Class XI/XII Accountancy tutor inside a learning app. Rules you must follow:
1. The app's accounting engine has already done every calculation. You are given its results as FACTS. Explain them; NEVER calculate, estimate, round or invent any figure. Use only numbers that appear in the FACTS or the student's question.
2. Stay inside the current chapter: "${chapter}". Teach only what the 2026-27 CBSE syllabus prescribes for it. If something is outside the syllabus, say it is outside the syllabus (supplementary) before mentioning it.
3. Mode "${mode}": ${mode === 'hint' ? 'give ONE short nudge or guiding question. Do NOT reveal the final answer or the full working.' : 'explain the reasoning step by step in simple words, using the FACTS.'}
4. Keep it under 150 words. Be encouraging. ${lang === 'hi' ? 'Reply in simple Hinglish (Hindi written in Roman letters) mixed with the standard English accounting terms.' : 'Reply in simple English.'}
5. If asked anything unrelated to accounting, politely decline.`;

const clip = (s, n) => String(s ?? '').slice(0, n);
export function validate(body) {
  if (!body || typeof body !== 'object') return 'Send a JSON object.';
  if (typeof body.question !== 'string' || !body.question.trim()) return 'Missing question.';
  if (body.question.length > LIMITS.question) return `Question is too long (max ${LIMITS.question} characters).`;
  if (!Array.isArray(body.facts) || body.facts.length === 0) return 'Missing engine facts — the tutor only explains what the engine computed.';
  if (body.facts.length > LIMITS.factLines || body.facts.some(f => typeof f !== 'string' || f.length > LIMITS.factLen)) return 'Facts too large.';
  if (typeof body.chapter !== 'string' || !body.chapter.trim() || body.chapter.length > LIMITS.chapter) return 'Missing chapter.';
  if (!['hint', 'explain'].includes(body.mode)) return 'mode must be "hint" or "explain".';
  return null;
}

export function createServer(env = process.env, fetchImpl = fetch) {
  const key = env.ANTHROPIC_API_KEY, model = env.TUTOR_MODEL || 'claude-haiku-5-5', maxTokens = Number(env.TUTOR_MAX_TOKENS || 400);
  const rph = Number(env.TUTOR_RPH || 20), dailyCap = Number(env.TUTOR_DAILY_CAP || 500), base = env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
  const hits = new Map(); let day = new Date().toDateString(), today = 0;
  const cors = h => { if (env.TUTOR_ORIGIN) { h['access-control-allow-origin'] = env.TUTOR_ORIGIN; h['access-control-allow-headers'] = 'content-type'; h['access-control-allow-methods'] = 'POST, OPTIONS'; h['vary'] = 'origin'; } return h; };
  const send = (res, code, obj) => { res.writeHead(code, cors({ 'content-type': 'application/json', 'cache-control': 'no-store' })); res.end(JSON.stringify(obj)); };

  return http.createServer(async (req, res) => {
    try {
      if (req.method === 'OPTIONS') { res.writeHead(204, cors({})); return res.end(); }
      if (req.url === '/api/health') return send(res, 200, { ok: true, configured: !!key });
      if (req.url !== '/api/tutor' || req.method !== 'POST') return send(res, 404, { error: 'Not found' });
      if (!key) return send(res, 503, { error: 'The tutor is not configured on this server.' });
      let raw = ''; for await (const c of req) { raw += c; if (raw.length > 40_000) return send(res, 413, { error: 'Request too large.' }); }
      let body; try { body = JSON.parse(raw); } catch { return send(res, 400, { error: 'Invalid JSON.' }); }
      const bad = validate(body); if (bad) return send(res, 400, { error: bad });
      // cost controls: per-IP hourly limit and a global daily ceiling
      const now = Date.now(), ip = req.socket.remoteAddress ?? 'x', list = (hits.get(ip) ?? []).filter(t => now - t < 3_600_000);
      if (new Date().toDateString() !== day) { day = new Date().toDateString(); today = 0; }
      if (list.length >= rph) return send(res, 429, { error: 'Too many questions this hour. Try again later.' });
      if (today >= dailyCap) return send(res, 429, { error: 'The tutor has reached its daily limit. Everything else in the app still works.' });
      list.push(now); hits.set(ip, list); today++;
      const up = await fetchImpl(`${base}/v1/messages`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: maxTokens, system: SYSTEM(clip(body.chapter, LIMITS.chapter), body.mode, body.lang === 'hi' ? 'hi' : 'en'),
          messages: [{ role: 'user', content: `FACTS from the accounting engine (authoritative):\n${body.facts.map(f => `- ${f}`).join('\n')}\n\nStudent's question: ${body.question}` }] }) });
      if (!up.ok) return send(res, 502, { error: 'The tutor is unavailable right now.' });
      const data = await up.json();
      const text = (data.content ?? []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
      if (!text) return send(res, 502, { error: 'The tutor gave no answer.' });
      const g = checkReply(text, body.facts, body.question);
      if (!g.ok) return send(res, 200, { text: 'I can only explain the numbers the app has already worked out, and my answer included a figure that is not in them, so I have withheld it. Please re-read the working shown on the page, or ask me about the reasoning instead.', withheld: true });
      return send(res, 200, { text });
    } catch { return send(res, 500, { error: 'Something went wrong.' }); }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT || 8787);
  createServer().listen(port, () => console.log(`tutor proxy on :${port} (${process.env.ANTHROPIC_API_KEY ? 'key configured' : 'NO KEY — will answer 503'})`));
}
