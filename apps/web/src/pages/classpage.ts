import { UNITS, CLAUSES, type ClassLevel } from '../../../../packages/curriculum/src';
import { h, mount } from '../dom';
import { PAGES, ALL_LABS, labsOfClause, hrefOf, titleOf, isCard } from '../labs';
import { icon, iconForLab } from '../icons';
import { state } from '../state';

export function classPage(cls: ClassLevel): HTMLElement {
  const route = state.profile.route;
  const unitSections = UNITS.filter(u => u.cls === cls).map(u => {
    const inRoute = u.route === 'COMMON' || u.route === route;
    const clauses = CLAUSES.filter(c => c.unit === u.id);
    const interactiveCount = clauses.filter(c => labsOfClause(c.id).some(id => !isCard(id))).length;
    return h('section', { class: 'panel unit' + (inRoute ? '' : ' dim'), style: 'position:relative;overflow:hidden' },
      h('div', { style: `position:absolute;top:0;left:0;right:0;height:3px;background:${inRoute ? 'linear-gradient(90deg,var(--brand),var(--accent))' : 'var(--line)'};opacity:${inRoute ? 1 : .4}` }),
      h('div', { style: 'display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:.6rem;margin-bottom:.2rem' },
        h('h3', { style: 'margin:0' }, u.title),
        h('div', { style: 'display:flex;gap:.4rem;flex-wrap:wrap' },
          h('span', { class: 'chip' }, `${u.marks} marks`),
          u.route !== 'COMMON' ? h('span', { class: 'chip alt' }, u.route === 'OPTION_I_ANALYSIS' ? 'Option I' : 'Option II') : null,
          h('span', { class: 'chip', style: 'background:var(--good-bg);color:var(--good);border-color:color-mix(in srgb,var(--good) 16%, transparent)' }, `${interactiveCount}/${clauses.length} labs`))),
      !inRoute ? h('p', { class: 'hint', style: 'margin:.4rem 0 .6rem;padding:.5rem .7rem;background:var(--accent-soft);border:1px solid var(--line-2);border-radius:8px' }, 'This unit belongs to the other Class XII option. You can still open it.') : null,
      h('ul', { class: 'clauselist' }, ...clauses.map(c => {
        const labs = labsOfClause(c.id);
        const labsNode = labs.length
          ? h('div', { class: 'labs', style: 'margin-top:.35rem;display:flex;flex-wrap:wrap;gap:.3rem' }, ...labs.map(id => h('a', { class: 'pill' + (isCard(id) ? ' card-pill' : ''), href: hrefOf(id) }, titleOf(id))))
          : h('span', { class: 'pill none' }, 'Not built yet - theory card coming');
        return h('li', {},
          h('div', {}, h('b', { style: 'font-weight:650' }, c.title), ' ', h('span', { class: 'cid', title: 'Syllabus code' }, c.id), c.limit ? h('em', { class: 'limit' }, ` - Limit: ${c.limit}`) : null),
          labsNode);
      })));
  });

  return h('div', { class: 'classpage' },
    h('header', { class: 'labhead' },
      h('nav', { class: 'breadcrumb', 'aria-label': 'Breadcrumb' }, h('a', { href: '#/' }, 'Home'), h('span', { 'aria-hidden': 'true' }, ' \u203A '), h('span', { 'aria-current': 'page' }, `Class ${cls}`)),
      h('p', { class: 'eyebrow' }, 'CBSE 2026-27 \u00B7 Syllabus map'),
      h('h2', {}, `Class ${cls} syllabus`),
      h('p', { class: 'lead' }, 'Every topic maps to exactly what CBSE prescribes. Labs are the dark pills and theory cards the green ones. Anything not built yet is marked plainly.'),
      h('p', { class: 'experience-note' }, icon('compass', 18), h('span', {}, h('b', {}, 'How to use: '), 'Start with the first unit. Open a lab, do the Worked Example, then Try it with your own numbers. Use Practice for exam-style questions.'))),
    h('div', { style: 'display:flex;gap:.6rem;flex-wrap:wrap;margin:0 0 1.2rem' },
      h('a', { class: 'button primary', href: '#/labs' }, 'Open visual labs \u2192'),
      h('a', { class: 'button', href: '#/practice' }, 'Practise questions \u2192'),
      h('a', { class: 'button', href: '#/cards' }, 'Concept cards')),
    ...unitSections);
}

interface Tool { id: string; title: string; summary: string; cls: ClassLevel; href: string; unit: string }
const unitOf = (clauses: readonly string[]) => CLAUSES.find(c => c.id === clauses[0])?.unit ?? '';

export function labsIndex(): HTMLElement {
  const mine = state.profile.cls;
  const route = state.profile.route;
  // every page and lab as one list, each placed in the syllabus unit of its first topic
  const tools: Tool[] = [
    ...PAGES.map(p => ({ id: p.id, title: p.title, summary: p.summary, cls: p.cls, href: p.href, unit: unitOf(p.clauses) })),
    ...ALL_LABS.map(l => ({ id: l.id, title: l.title, summary: l.summary, cls: l.cls, href: `#/lab/${l.id}`, unit: unitOf(l.clauses) })),
  ];
  let query = '';
  let show: 'MINE' | 'ALL' = 'MINE';

  const searchBox = h('input', { type: 'search', id: 'labsearch', placeholder: 'Search labs: e.g. depreciation, goodwill, ratio', autocomplete: 'off', 'aria-describedby': 'labcount' });
  const count = h('p', { id: 'labcount', class: 'status', role: 'status', 'aria-live': 'polite' });
  const body = h('div', { class: 'labs-body' });
  const filterBtns = (['MINE', 'ALL'] as const).map(v =>
    h('button', { type: 'button', role: 'radio', 'data-filter': v, 'aria-checked': String(v === show), class: v === show ? 'on' : '', onclick: () => { show = v; draw(); } }, v === 'MINE' ? `Class ${mine}` : 'Both classes'),
  );

  const card = (t: Tool) =>
    h('a', { class: 'card', href: t.href, 'data-tool': t.id }, h('div', { class: 'card-icon' }, icon(iconForLab(t.id, t.title), 22)), h('h3', {}, t.title), h('p', {}, t.summary), h('span', { class: 'chip' }, `Class ${t.cls}`));

  function draw() {
    const q = query.trim().toLowerCase();
    filterBtns.forEach(b => { const on = b.getAttribute('data-filter') === show; b.setAttribute('aria-checked', String(on)); b.classList.toggle('on', on); });
    const classes: ClassLevel[] = show === 'MINE' ? [mine] : [mine, mine === 'XI' ? 'XII' : 'XI'];
    let total = 0;
    const sections = classes.flatMap(cls => {
      const units = UNITS.filter(u => u.cls === cls);
      const blocks = units.map(u => {
        const inRoute = u.route === 'COMMON' || u.route === route;
        const list = tools.filter(t => t.unit === u.id && (!q || `${t.title} ${t.summary} ${u.title}`.toLowerCase().includes(q)));
        if (!list.length) return null;
        total += list.length;
        return h('details', { class: 'unit-group', 'data-unit': u.id, ...(q || cls === mine ? { open: true } : {}) },
          h('summary', {}, h('span', { class: 'unit-name' }, u.title), h('span', { class: 'chip' }, `${list.length} ${list.length === 1 ? 'lab' : 'labs'}`), inRoute ? null : h('span', { class: 'chip alt' }, u.route === 'OPTION_I_ANALYSIS' ? 'Option I' : 'Option II')),
          h('div', { class: 'cards' }, ...list.map(card)));
      }).filter(Boolean) as HTMLElement[];
      return blocks.length ? [h('h3', { class: 'blockhead class-head', 'data-class': cls }, `Class ${cls}`), ...blocks] : [];
    });
    count.textContent = total === 0 ? 'No lab matches that. Try a topic word such as “depreciation” or clear the search.' : `${total} ${total === 1 ? 'lab' : 'labs'} shown`;
    mount(body, ...sections);
  }
  searchBox.addEventListener('input', () => { query = (searchBox as HTMLInputElement).value; draw(); });
  draw();

  return h('div', { class: 'labsindex' },
    h('header', { class: 'labhead' },
      h('nav', { class: 'breadcrumb', 'aria-label': 'Breadcrumb' }, h('a', { href: '#/' }, 'Home'), h('span', { 'aria-hidden': 'true' }, ' \u203A '), h('span', { 'aria-current': 'page' }, 'Visual labs')),
      h('p', { class: 'eyebrow' }, 'Experiential labs'),
      h('h2', {}, 'Change the numbers, see the books respond'),
      h('p', { class: 'lead' }, 'Each lab teaches in three steps: Learn the idea, see a Worked example, then Try it with your own numbers. Pick a unit below or search.')),
    h('div', { class: 'lab-tools' },
      h('div', { class: 'field grow' }, h('label', { for: 'labsearch' }, 'Search labs'), searchBox),
      h('div', { class: 'modes', role: 'radiogroup', 'aria-label': 'Which classes to show' }, ...filterBtns)),
    count,
    body,
    h('p', { class: 'experience-note' }, icon('lightbulb', 18), h('span', {}, 'Tip: in the Ledger lab, try posting an unbalanced entry to see exactly why it is refused.')));
}
