import { UNITS, CLAUSES, type ClassLevel } from '../../../../packages/curriculum/src';
import { h } from '../dom';
import { ALL_LABS, LEDGER_LAB, labsOfClause } from '../labs';
import { state } from '../state';

const labTitle = (id: string) => id === LEDGER_LAB.id ? LEDGER_LAB.title : ALL_LABS.find(l => l.id === id)?.title ?? id;
const labHref = (id: string) => id === LEDGER_LAB.id ? '#/ledger' : `#/lab/${id}`;

export function classPage(cls: ClassLevel): HTMLElement {
  const route = state.profile.route;
  return h('div', { class: 'classpage' },
    h('header', { class: 'labhead' }, h('p', { class: 'eyebrow' }, 'CBSE 2026-27'), h('h2', {}, `Class ${cls} syllabus`), h('p', { class: 'lead' }, 'Each topic links to the lab that teaches it. Topics without a lab are shown plainly — nothing here is claimed unless it works.')),
    ...UNITS.filter(u => u.cls === cls).map(u => {
      const inRoute = u.route === 'COMMON' || u.route === route;
      const clauses = CLAUSES.filter(c => c.unit === u.id);
      return h('section', { class: 'panel unit' + (inRoute ? '' : ' dim') },
        h('h3', {}, `${u.title}`, h('span', { class: 'chip' }, `${u.marks} marks`), u.route !== 'COMMON' ? h('span', { class: 'chip alt' }, u.route === 'OPTION_I_ANALYSIS' ? 'Option I' : 'Option II') : null),
        !inRoute ? h('p', { class: 'hint' }, 'This unit belongs to the other Class XII option. You can still open it.') : null,
        h('ul', { class: 'clauselist' }, ...clauses.map(c => {
          const labs = labsOfClause(c.id);
          return h('li', {}, h('div', {}, h('span', { class: 'cid' }, c.id), ' ', c.title, c.limit ? h('em', { class: 'limit' }, ` — Limit: ${c.limit}`) : null),
            labs.length ? h('div', { class: 'labs' }, ...labs.map(id => h('a', { class: 'pill', href: labHref(id) }, labTitle(id)))) : h('span', { class: 'pill none' }, 'Lab not built yet'));
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
    h('div', { class: 'cards' }, ...(cls === 'XI' ? [card({ ...LEDGER_LAB, summary: 'Watch debit and credit move through the journal, ledger and trial balance.', cls: 'XI' }, '#/ledger')] : []), ...mine.map(l => card(l, `#/lab/${l.id}`))),
    h('h3', { class: 'blockhead' }, `Class ${cls === 'XI' ? 'XII' : 'XI'} labs`),
    h('div', { class: 'cards' }, ...(cls === 'XII' ? [card({ ...LEDGER_LAB, summary: 'Watch debit and credit move through the journal, ledger and trial balance.', cls: 'XI' }, '#/ledger')] : []), ...others.map(l => card(l, `#/lab/${l.id}`))));
}
