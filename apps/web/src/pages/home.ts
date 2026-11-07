import { SOURCE, UNITS, CLAUSES, type ClassLevel } from '../../../../packages/curriculum/src';
import { h } from '../dom';
import { ALL_LABS, PAGES, coverage } from '../labs';
import { state } from '../state';
import { storageMode, setProfile } from '../store';
import { navigate } from '../router';

export function homePage(rerender: () => void): HTMLElement {
  const cls = state.profile.cls;
  const choose = (c: ClassLevel) => { state.profile = { ...state.profile, cls: c }; void setProfile(state.profile); rerender(); };
  const cov = coverage(cls);
  const route = state.profile.route;
  return h('div', { class: 'home' },
    h('section', { class: 'hero' },
      h('p', { class: 'eyebrow' }, 'CBSE Accountancy (055) · 2026-27'),
      h('h2', {}, 'Learn Accounting by Doing Accounting.'),
      h('p', { class: 'lead' }, 'Pick your class, open a lab, change the numbers and watch the books respond. Every figure comes from one exact accounting engine — never from guesswork.'),
      h('div', { class: 'classpick', role: 'radiogroup', 'aria-label': 'Choose your class' },
        ...(['XI', 'XII'] as ClassLevel[]).map(c => h('button', { type: 'button', role: 'radio', 'aria-checked': String(c === cls), class: 'bigchoice' + (c === cls ? ' on' : ''), onclick: () => choose(c) }, h('b', {}, `Class ${c}`), h('span', {}, c === 'XI' ? 'Accounting process, final accounts' : 'Partnerships, companies, analysis')))),
      cls === 'XII' ? h('fieldset', { class: 'routebox' }, h('legend', {}, 'Your Class XII option (as in the syllabus)'),
        ...([['OPTION_I_ANALYSIS', 'Option I — Analysis of Financial Statements + Cash Flow'], ['OPTION_II_COMPUTERISED', 'Option II — Computerised Accounting']] as const).map(([v, label]) =>
          h('label', { class: 'radio' }, h('input', { type: 'radio', name: 'route', value: v, ...(route === v ? { checked: true } : {}), onchange: () => { state.profile = { ...state.profile, route: v }; void setProfile(state.profile); rerender(); } }), ' ', label)),
        route === 'OPTION_II_COMPUTERISED' ? h('p', { class: 'note info' }, 'Option II replaces the Analysis and Cash Flow units. Use the Computerised Accounting Simulator and the Spreadsheet Lab; Partnership and Company labs are shared by both options.') : null) : null,
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'primary', onclick: () => navigate(`#/class/${cls}`) }, `Open Class ${cls} syllabus`), h('button', { type: 'button', onclick: () => navigate('#/practice') }, 'Start practising'))),
    h('section', { class: 'cards' },
      ...PAGES.filter(p => p.cls === cls && (!p.route || route === p.route)).slice(0, 2).map(p => h('a', { class: 'card', href: p.href }, h('h3', {}, p.title), h('p', {}, p.summary), h('span', { class: 'chip' }, `Class ${p.cls}`))),
      ...ALL_LABS.filter(l => l.cls === cls && (!l.route || route === l.route)).slice(0, 4).map(l => h('a', { class: 'card', href: `#/lab/${l.id}` }, h('h3', {}, l.title), h('p', {}, l.summary), h('span', { class: 'chip' }, `Class ${l.cls}`)))),
    h('section', { class: 'panel' }, h('h3', {}, 'What is built — honestly'),
      h('p', {}, `Class ${cls} has ${cov.total} syllabus topics: ${cov.interactive} have an interactive lab or page, ${cov.cardsOnly} are covered by concept cards only (theory), and ${cov.none} are not built yet.`),
      h('div', { class: 'meter', role: 'img', 'aria-label': `${cov.interactive} of ${cov.total} topics have an interactive lab` }, h('div', { class: 'meterfill', style: `width:${Math.round(cov.interactive / cov.total * 100)}%` })),
      h('div', { class: 'actions' }, h('a', { class: 'button', href: '#/cards' }, 'Concept cards'), h('a', { class: 'button', href: '#/rescue' }, 'I am stuck — rescue plan'))),
    h('footer', { class: 'srcnote' },
      h('p', {}, 'Syllabus source: ', h('a', { href: SOURCE.url, rel: 'noopener' }, SOURCE.document), ` (SHA-256 ${SOURCE.sha256.slice(0, 12)}…). ${UNITS.length} units and ${CLAUSES.length} topics are modelled; nothing outside it is taught.`),
      h('p', {}, storageMode === 'indexeddb' ? 'Your progress is saved on this device only.' : 'Storage is unavailable in this browser mode, so progress lasts until you close the tab. Use “Export” on My Progress to keep it.')));
}
