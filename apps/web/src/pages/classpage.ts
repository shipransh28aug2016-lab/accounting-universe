import { UNITS, CLAUSES, type ClassLevel } from '../../../../packages/curriculum/src';
import { h } from '../dom';
import { PAGES, ALL_LABS, labsOfClause, hrefOf, titleOf, isCard } from '../labs';
import { state } from '../state';


export function classPage(cls: ClassLevel): HTMLElement {
  const route = state.profile.route;
  return h('div', { class: 'classpage' },
    h('header', { class: 'labhead' }, h('p', { class: 'eyebrow' }, 'CBSE 2026-27'), h('h2', {}, `Class ${cls} syllabus`), h('p', { class: 'lead' }, 'Each topic links to the lab that teaches it. Interactive labs are blue pills, short theory cards are green, and anything not built is shown plainly — nothing here is claimed unless it works.')),
    ...UNITS.filter(u => u.cls === cls).map(u => {
      const inRoute = u.route === 'COMMON' || u.route === route;
      const clauses = CLAUSES.filter(c => c.unit === u.id);
      return h('section', { class: 'panel unit' + (inRoute ? '' : ' dim') },
        h('h3', {}, `${u.title}`, h('span', { class: 'chip' }, `${u.marks} marks`), u.route !== 'COMMON' ? h('span', { class: 'chip alt' }, u.route === 'OPTION_I_ANALYSIS' ? 'Option I' : 'Option II') : null),
        !inRoute ? h('p', { class: 'hint' }, 'This unit belongs to the other Class XII option. You can still open it.') : null,
        h('ul', { class: 'clauselist' }, ...clauses.map(c => {
          const labs = labsOfClause(c.id);
          return h('li', {}, h('div', {}, h('span', { class: 'cid' }, c.id), ' ', c.title, c.limit ? h('em', { class: 'limit' }, ` — Limit: ${c.limit}`) : null),
            labs.length ? h('div', { class: 'labs' }, ...labs.map(id => h('a', { class: 'pill' + (isCard(id) ? ' card-pill' : ''), href: hrefOf(id) }, titleOf(id)))) : h('span', { class: 'pill none' }, 'Not built yet'));
        })));
    }));
}

export function labsIndex(): HTMLElement {
  const cls = state.profile.cls;
  const mine = ALL_LABS.filter(l => l.cls === cls);
  const others = ALL_LABS.filter(l => l.cls !== cls);
  const card = (l: { id: string; title: string; summary: string; cls: string }, href: string) => h('a', { class: 'card', href }, h('h3', {}, l.title), h('p', {}, l.summary), h('span', { class: 'chip' }, `Class ${l.cls}`));
  return h('div', { class: 'labsindex' },
    h('header', { class: 'labhead' }, h('p', { class: 'eyebrow' }, 'Visual labs'), h('h2', {}, 'Change the numbers, see the books respond'), h('p', { class: 'lead' }, `Showing Class ${cls} first. Switch class on the Home page.`)),
    h('div', { class: 'cards' }, ...PAGES.filter(p => p.cls === cls).map(p => card(p, p.href)), ...mine.map(l => card(l, `#/lab/${l.id}`))),
    h('h3', { class: 'blockhead' }, `Class ${cls === 'XI' ? 'XII' : 'XI'} labs`),
    h('div', { class: 'cards' }, ...PAGES.filter(p => p.cls !== cls).map(p => card(p, p.href)), ...others.map(l => card(l, `#/lab/${l.id}`))));
}
