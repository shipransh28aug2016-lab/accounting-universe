import { KINDS, NOTES, SUBJECTS, audienceOf, canOpen, counts, filterNotes, redeemCode, type Filter, type NoteItem, type Plan } from '../../../../packages/curriculum/src';
import { h, mount } from '../dom';
import { icon } from '../icons';
import { announce } from '../ui';

const KEY = 'au-plan';
export const getPlan = (): Plan => { try { return localStorage.getItem(KEY) === 'PRO' ? 'PRO' : 'FREE'; } catch { return 'FREE'; } };
const setPlan = (p: Plan) => { try { localStorage.setItem(KEY, p); } catch { /* storage blocked: unlock lasts until reload */ memoryPlan = p; } };
let memoryPlan: Plan | null = null;
const plan = (): Plan => memoryPlan ?? getPlan();

const filter: Filter = {};
const chips = <T extends string>(label: string, key: keyof Filter, opts: readonly (readonly [T | '', string])[], redraw: () => void) =>
  h('div', { class: 'modes', role: 'group', 'aria-label': label }, ...opts.map(([v, text]) => {
    const on = (filter[key] ?? '') === v;
    return h('button', { type: 'button', 'aria-pressed': String(on), class: on ? 'on' : '', onclick: () => { if (v) (filter as Record<string, string>)[key] = v; else delete filter[key]; redraw(); } }, text);
  }));

function card(n: NoteItem, p: Plan): HTMLElement {
  const g = canOpen(n, p), locked = !g.ok;
  return h('a', { class: 'card note-card' + (locked ? ' locked' : ''), href: `#/notes/${n.id}`, 'data-note': n.id, 'data-locked': String(locked) },
    h('div', { class: 'note-top' }, h('span', { class: 'chip' }, `${n.subject} · ${n.cls}`), h('span', { class: 'tier ' + (locked ? 'pro' : 'free') }, locked ? 'Pro' : n.tier === 'FREE' ? 'Free' : 'Pro ✓')),
    h('h3', {}, n.title), h('p', {}, n.summary), h('small', { class: 'note-meta' }, `${KINDS[n.kind]} · ${n.size}`));
}

const PLANS = [
  ['Free', '₹0', ['Sample notes for every subject', 'Free classroom deck & lesson plan', 'All labs, practice and progress']],
  ['Student Pro', '₹199 / month', ['Every chapter’s full notes', 'Worksheets with answer keys', 'Download as PDF']],
  ['Teacher Pro', '₹499 / month', ['Every PPT & lesson plan', 'Editable files', 'Class-wise unit plans']],
] as const;

export function notesPage(id?: string): HTMLElement {
  if (id) return notePage(id);
  const grid = h('div', { class: 'cards' }), bar = h('div', { class: 'notes-filters' }), status = h('p', { class: 'note', role: 'status' });
  const draw = () => {
    const p = plan(), list = filterNotes(NOTES, filter), c = counts(NOTES);
    mount(bar,
      chips('Class', 'cls', [['', 'All classes'], ['XI', 'Class XI'], ['XII', 'Class XII']], draw),
      chips('Subject', 'subject', [['', 'All subjects'], ...(Object.entries(SUBJECTS).map(([k, v]) => [k, v] as const))] as never, draw),
      chips('For', 'audience', [['', 'Everything'], ['STUDENT', 'Student notes'], ['TEACHER', 'Teacher resources']], draw));
    mount(grid, ...list.map(n => card(n, p)));
    status.textContent = list.length ? `${list.length} item${list.length === 1 ? '' : 's'} · ${c.free} free, ${c.pro} Pro in the library` : 'Nothing matches these filters. Try “All subjects”.';
  };
  const search = h('input', { type: 'search', placeholder: 'Search notes, e.g. depreciation', 'aria-label': 'Search notes', oninput: (e: Event) => { filter.q = (e.target as HTMLInputElement).value; draw(); } });
  const code = h('input', { type: 'text', placeholder: 'AU-XXXX-XXXX', 'aria-label': 'Access code', autocomplete: 'off' });
  const codeOut = h('p', { class: 'note', 'aria-live': 'polite' });
  const unlock = h('form', { class: 'unlock', onsubmit: (e: Event) => {
    e.preventDefault(); const g = redeemCode(code.value);
    if (!g.ok) { mount(codeOut, h('span', { class: 'bad', role: 'alert' }, g.reason)); return; }
    setPlan('PRO'); mount(codeOut, h('span', { class: 'good' }, '✓ Pro unlocked on this device.')); announce('Pro unlocked'); draw(); drawPlan();
  } }, code, h('button', { type: 'submit' }, 'Unlock'));
  const planNote = h('p', { class: 'note' });
  const drawPlan = () => { planNote.textContent = plan() === 'PRO' ? 'You are on Pro: everything is open.' : 'You are on the Free plan.'; };
  drawPlan(); draw();
  return h('div', { 'data-plan': plan() },
    h('header', { class: 'hero notes-hero' }, h('p', { class: 'eyebrow' }, 'Notes & teaching resources'), h('h2', {}, 'Notes that teach. Slides that save your Sunday.'),
      h('p', { class: 'lead' }, 'Chapter-wise notes for Accountancy, Business Studies and Entrepreneurship (Class XI & XII), plus ready PPTs and lesson plans for teachers. Start free; unlock the full library when you are ready.'), h('div', { class: 'notes-search' }, search)),
    bar, status, grid,
    h('section', { class: 'panel pricing', id: 'pricing', 'aria-labelledby': 'pricing-h' }, h('h3', { id: 'pricing-h' }, 'Pricing'),
      h('p', { class: 'note warn' }, 'Pre-launch preview: prices are illustrative and online payment is not live yet. Have an access code? Unlock below.'),
      h('div', { class: 'plans' }, ...PLANS.map(([name, price, feats], i) => h('div', { class: 'plan' + (i === 1 ? ' pick' : '') }, h('h4', {}, name), h('p', { class: 'price' }, price), h('ul', {}, ...feats.map(f => h('li', {}, f)))))),
      h('h4', {}, 'Have an access code?'), unlock, codeOut, planNote));
}

function notePage(id: string): HTMLElement {
  const n = NOTES.find(x => x.id === id), back = h('p', {}, h('a', { href: '#/notes' }, '← All notes'));
  if (!n) return h('div', { class: 'panel' }, h('h2', {}, 'Note not found'), back);
  const g = canOpen(n, plan()), body = h('div', { class: 'prose', 'aria-live': 'polite' });
  void import('../notes-bodies').then(({ BODIES, PRO_PLACEHOLDER }) => {
    const paras = BODIES[n.id] ?? PRO_PLACEHOLDER;
    mount(body, ...(g.ok ? paras : paras.slice(0, 1)).map(t => h('p', {}, t)));
    if (!g.ok) body.appendChild(h('div', { class: 'paywall', 'data-why': g.reason }, h('p', { class: 'fade' }, '…'), h('p', {}, h('b', {}, icon('lock', 16), ' The rest is Pro. ')), h('p', { class: 'note' }, g.reason), h('a', { class: 'btn', href: '#/notes' }, 'See plans and unlock')));
  });
  const head = h('header', { class: 'labhead' }, h('p', { class: 'eyebrow' }, `${SUBJECTS[n.subject]} · Class ${n.cls} · ${KINDS[n.kind]} · ${audienceOf(n.kind) === 'TEACHER' ? 'Teacher' : 'Student'}`), h('h2', {}, n.title), h('p', { class: 'lead' }, n.summary));
  const dl = g.ok && n.file ? h('p', {}, h('a', { class: 'btn', href: `./notes/${n.file}`, download: '' }, `Download (${n.size})`)) : null;
  return h('article', { class: 'labpage', 'data-note-open': g.ok ? 'open' : 'locked' }, head, h('section', { class: 'panel' }, body, dl), back);
}
