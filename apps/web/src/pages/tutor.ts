import { Machine } from '../../../../packages/engine/src';
import { AI_ASK } from '../../../../packages/curriculum/src';
import { onDispose, track, unregister } from '../machine-dom';
import { CLAUSES, mistakeTally, SKILLS } from '../../../../packages/curriculum/src';
import { h, mount } from '../dom';
import { ALL_LABS, LEDGER_LAB } from '../labs';
import { attempts } from '../store';
import { blocksToFacts } from '../facts';
import { runLabFacts } from './lab';
import { state } from '../state';
import { loading } from '../ui';

interface Gloss { term: string; en: string; hi: string }
// Short bilingual rule cards. These are hand-written reminders, NOT a translation of the course.
const GLOSSARY: Gloss[] = [
  { term: 'Debit / Credit', en: 'Debit is the left side, Credit the right. Assets and expenses increase on the debit side; liabilities, capital and income increase on the credit side.', hi: 'Debit left side hai, Credit right side. Asset aur expense badhe to Debit; liability, capital aur income badhe to Credit.' },
  { term: 'Accounting equation', en: 'Assets = Liabilities + Capital. Every transaction keeps both sides equal.', hi: 'Assets = Liabilities + Capital. Har transaction ke baad dono taraf barabar rehta hai.' },
  { term: 'Drawings', en: 'Money or goods the owner takes for personal use. It reduces capital; it is not an expense.', hi: 'Owner apne personal use ke liye jo paisa ya maal le, wo drawings hai. Ye capital kam karta hai, expense nahi hai.' },
  { term: 'Depreciation', en: 'The fall in value of a fixed asset from use or time. SLM charges the same amount each year; WDV charges a rate on the opening book value.', hi: 'Fixed asset ki value use ya time se kam hoti hai. SLM mein har saal same amount; WDV mein opening book value par rate lagta hai.' },
  { term: 'Sacrificing ratio', en: 'Old share − new share. The partner who gives up profit share is compensated by the others.', hi: 'Sacrificing ratio = Old share − New share. Jo partner share chhodta hai, use baaki partners compensate karte hain.' },
  { term: 'Goodwill', en: 'The extra value of a firm because of its reputation and customers. Valued only by average profit, super profit or capitalisation (in this syllabus).', hi: 'Firm ki reputation aur customers ki wajah se extra value. Is syllabus mein sirf average profit, super profit ya capitalisation se nikalte hain.' },
  { term: 'Securities premium', en: 'The amount received above face value of shares. It is credited to Securities Premium, never to share capital.', hi: 'Share ki face value se upar jo paisa mile wo Securities Premium mein jata hai, share capital mein nahi.' },
  { term: 'Forfeiture', en: 'Cancelling shares when a call is unpaid. Share capital is debited with what was CALLED; the money already received stays as Share Forfeited.', hi: 'Call ka paisa na dene par shares cancel hote hain. Share capital mein jitna CALL hua wo debit; jo paisa mil chuka wo Share Forfeited mein.' },
  { term: 'Current ratio', en: 'Current assets ÷ current liabilities: can the firm pay its short-term dues?', hi: 'Current assets ÷ current liabilities: kya firm apne short-term dues chuka sakti hai?' },
  { term: 'Cash flow activities', en: 'Operating = running the business; Investing = buying/selling long-term assets; Financing = raising or repaying capital and borrowings.', hi: 'Operating = business chalana; Investing = long-term asset kharidna/bechna; Financing = capital ya loan lena/chukana.' },
];

interface Doc { title: string; text: string; href: string; kind: string }
const DOCS: Doc[] = [
  ...ALL_LABS.map(l => ({ title: l.title, text: `${l.title} ${l.summary} ${l.concept.join(' ')} ${l.realWorld}`, href: `#/lab/${l.id}`, kind: 'Lab' })),
  { title: LEDGER_LAB.title, text: 'journal ledger trial balance debit credit rules of debit and credit accounting equation T account posting reversal', href: '#/ledger', kind: 'Lab' },
  ...CLAUSES.map(c => ({ title: c.title, text: c.title + ' ' + (c.limit ?? ''), href: `#/class/${c.id.split('.')[0]}`, kind: 'Syllabus topic' })),
];
const tok = (s: string) => s.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2);
export function search(q: string): Doc[] {
  const qs = new Set(tok(q)); if (qs.size === 0) return [];
  return DOCS.map(d => { const t = new Set(tok(d.text)); let s = 0; for (const w of qs) if (t.has(w)) s += tok(d.title).includes(w) ? 3 : 1; return { d, s }; })
    .filter(x => x.s > 0).sort((a, b) => b.s - a.s || a.d.title.localeCompare(b.d.title)).slice(0, 6).map(x => x.d);
}

const TUTOR_URL: string = (import.meta.env.VITE_TUTOR_URL as string | undefined) ?? '';

function aiPanel(): HTMLElement {
  const labSel = h('select', { id: 'ailab' }, ...ALL_LABS.map(l => h('option', { value: l.id }, `Class ${l.cls} · ${l.title}`)));
  const mode = h('select', { id: 'aimode' }, h('option', { value: 'hint' }, 'Give me a hint (no answer)'), h('option', { value: 'explain' }, 'Explain the worked example'));
  const q = h('textarea', { id: 'aiq', rows: 3, maxlength: 500, placeholder: 'What are you stuck on?' });
  const out = h('div', { 'aria-live': 'polite' }), am = new Machine(AI_ASK, { hasQuestion: false });
  onDispose(() => unregister(am));
  const ask = async () => {
    const lab = ALL_LABS.find(l => l.id === labSel.value)!;
    am.ctx.hasQuestion = !!q.value.trim();
    const sent = am.send('ASK');                                          // refused: empty question, or already asking
    if (!sent.ok) { mount(out, h('p', { class: 'note warn', role: 'alert' }, sent.reason!)); return; }
    askBtn.disabled = true; mount(out, loading('Thinking…'));
    try {
      const facts = blocksToFacts(runLabFacts(lab));
      const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 20000);
      const r = await fetch(TUTOR_URL, { method: 'POST', headers: { 'content-type': 'application/json' }, signal: ctl.signal, body: JSON.stringify({ question: q.value.trim(), facts, chapter: lab.title, mode: mode.value, lang: state.lang }) });
      clearTimeout(t);
      const j = (await r.json()) as { text?: string; error?: string; withheld?: boolean };
      am.send(j.text ? (j.withheld ? 'WITHHOLD' : 'RESOLVE') : 'REJECT');
      mount(out, j.text ? h('div', { class: 'note ' + (j.withheld ? 'warn' : 'info') }, j.text) : h('p', { class: 'note warn', role: 'alert' }, (j.error ?? 'The tutor could not answer.') + ' You can still use the search and rule cards below.'));
    } catch { am.send('REJECT'); mount(out, h('p', { class: 'note warn', role: 'alert' }, 'The tutor is not reachable (you may be offline). The search and rule cards below still work.')); }
    finally { askBtn.disabled = false; }
  };
  const askBtn = h('button', { type: 'button', class: 'primary', onclick: () => { void ask(); } }, 'Ask');
  const panel = h('section', { class: 'panel' }, h('h3', {}, 'Ask the AI tutor'), h('div', { class: 'field' }, h('label', { for: 'ailab' }, 'About which lab?'), labSel), h('div', { class: 'field' }, h('label', { for: 'aimode' }, 'What do you want?'), mode), h('div', { class: 'field' }, h('label', { for: 'aiq' }, 'Your question'), q), askBtn, out);
  track(panel, am);
  return panel;
}

export function tutorPage(): HTMLElement {
  const results = h('div', { 'aria-live': 'polite' });
  const gloss = h('div', {});
  let lang: 'en' | 'hi' = 'en';
  const drawGloss = () => mount(gloss, h('dl', { class: 'gloss' }, ...GLOSSARY.flatMap(g => [h('dt', {}, g.term), h('dd', {}, lang === 'en' ? g.en : g.hi)])));
  const mist = h('div', {});
  void attempts().then(a => {
    const t = mistakeTally(a).slice(0, 4);
    mount(mist, t.length ? h('ul', {}, ...t.map(m => { const lab = ALL_LABS.find(l => l.skills.includes(m.skill)); return h('li', {}, m.mistake, lab ? h('span', {}, ' → ', h('a', { href: `#/lab/${lab.id}` }, lab.title)) : null, ` (×${m.count})`); })) : h('p', { class: 'empty' }, 'No mistakes recorded yet — they appear here after you practise.'));
  });
  const input = h('input', { type: 'search', id: 'tq', placeholder: 'e.g. forfeiture, sacrificing ratio, cash flow', autocomplete: 'off' });
  const ask = () => {
    const r = search(input.value);
    mount(results, input.value.trim() === '' ? null : r.length ? h('ul', { class: 'cardlist' }, ...r.map(d => h('li', {}, h('a', { href: d.href }, d.title), h('span', { class: 'chip' }, d.kind)))) : h('p', { class: 'empty' }, 'Nothing matched. Try a syllabus word like “goodwill”, “depreciation” or “ratio”.'));
  };
  drawGloss();
  void SKILLS;
  return h('div', { class: 'tutor' },
    h('header', { class: 'labhead' }, h('p', { class: 'eyebrow' }, 'AI tutor'), h('h2', {}, 'Find help, fast'),
      TUTOR_URL ? h('p', { class: 'note info' }, 'An AI tutor is connected through a server. It only explains figures the accounting engine has already worked out; it never calculates and cannot see your name or progress. The search and rule cards below work without it.')
        : h('p', { class: 'note info' }, 'No AI language model is connected in this build. The server code is ready (apps/tutor-proxy) but needs an API key and a deployed address (see docs/IMPLEMENTATION_ROADMAP.md, decision D4). Until then this page is an offline helper: it finds the right lab and explains your repeated mistakes. It never calculates your numbers — the accounting engine does.')),
    TUTOR_URL ? aiPanel() : null,
    h('section', { class: 'panel' }, h('h3', {}, 'Search the course'), h('form', { class: 'searchrow', onsubmit: (e: Event) => { e.preventDefault(); ask(); } }, h('label', { for: 'tq', class: 'sr-only' }, 'Search the course'), input, h('button', { type: 'submit', class: 'primary' }, 'Search')), results),
    h('section', { class: 'panel' }, h('h3', {}, 'Your repeated mistakes'), mist),
    h('section', { class: 'panel' }, h('h3', {}, 'Key rules in plain words'),
      h('div', { class: 'modes', role: 'radiogroup', 'aria-label': 'Language' }, ...([['en', 'English'], ['hi', 'Hinglish']] as const).map(([v, label]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(lang === v), class: lang === v ? 'on' : '', onclick: (e: Event) => { lang = v; for (const b of Array.from((e.currentTarget as HTMLElement).parentElement!.children)) { b.classList.toggle('on', b === e.currentTarget); b.setAttribute('aria-checked', String(b === e.currentTarget)); } drawGloss(); } }, label))),
      h('p', { class: 'hint' }, 'Hinglish covers these rule cards only; the labs themselves are in English.'), gloss));
}
