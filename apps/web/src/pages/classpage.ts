import { UNITS, CLAUSES, type ClassLevel } from '../../../../packages/curriculum/src';
import { h, mount } from '../dom';
import { PAGES, ALL_LABS, labsOfClause, hrefOf, titleOf, isCard } from '../labs';
import { icon, iconForLab } from '../icons';
import { en, tr } from '../i18n';
import type { Key } from '../../../../packages/curriculum/src/i18n';
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
        h('h3', { style: 'margin:0' }, tr(`unit.${u.id}` as Key)),
        h('div', { style: 'display:flex;gap:.4rem;flex-wrap:wrap' },
          h('span', { class: 'chip' }, tr('ui.marks', { n: u.marks })),
          u.route !== 'COMMON' ? h('span', { class: 'chip alt' }, tr(u.route === 'OPTION_I_ANALYSIS' ? 'ui.optionI' : 'ui.optionII')) : null,
          h('span', { class: 'chip', style: 'background:var(--good-bg);color:var(--good);border-color:color-mix(in srgb,var(--good) 16%, transparent)' }, tr('cls.labsOf', { a: interactiveCount, b: clauses.length })))),
      !inRoute ? h('p', { class: 'hint', style: 'margin:.4rem 0 .6rem;padding:.5rem .7rem;background:var(--accent-soft);border:1px solid var(--line-2);border-radius:8px' }, tr('cls.otherOption')) : null,
      h('ul', { class: 'clauselist' }, ...clauses.map(c => {
        const labs = labsOfClause(c.id);
        const labsNode = labs.length
          ? h('div', { class: 'labs', style: 'margin-top:.35rem;display:flex;flex-wrap:wrap;gap:.3rem' }, ...labs.map(id => h('a', { class: 'pill' + (isCard(id) ? ' card-pill' : ''), href: hrefOf(id) }, en(titleOf(id)))))
          : h('span', { class: 'pill none' }, tr('cls.notBuilt'));
        return h('li', {},
          h('div', {}, h('b', { style: 'font-weight:650' }, en(c.title)), ' ', h('span', { class: 'cid', lang: 'en', title: tr('cls.code') }, c.id), c.limit ? h('em', { class: 'limit' }, tr('cls.limit'), en(c.limit)) : null),
          labsNode);
      })));
  });

  return h('div', { class: 'classpage' },
    h('header', { class: 'labhead' },
      h('nav', { class: 'breadcrumb', 'aria-label': 'Breadcrumb' }, h('a', { href: '#/' }, tr('ui.home')), h('span', { 'aria-hidden': 'true' }, ' \u203A '), h('span', { 'aria-current': 'page' }, tr('ui.class', { cls }))),
      h('p', { class: 'eyebrow' }, tr('cls.eyebrow')),
      h('h2', {}, tr('cls.h2', { cls })),
      h('p', { class: 'lead' }, tr('cls.lead')),
      h('p', { class: 'experience-note' }, icon('compass', 18), h('span', {}, h('b', {}, tr('cls.howto')), tr('cls.howto.d')))),
    h('div', { style: 'display:flex;gap:.6rem;flex-wrap:wrap;margin:0 0 1.2rem' },
      h('a', { class: 'button primary', href: '#/labs' }, tr('cls.openLabs')),
      h('a', { class: 'button', href: '#/practice' }, tr('cls.practise')),
      h('a', { class: 'button', href: '#/cards' }, tr('home.cards'))),
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

  const searchBox = h('input', { type: 'search', id: 'labsearch', placeholder: tr('labs.placeholder'), autocomplete: 'off', 'aria-describedby': 'labcount' });
  const count = h('p', { id: 'labcount', class: 'status', role: 'status', 'aria-live': 'polite' });
  const body = h('div', { class: 'labs-body' });
  const filterBtns = (['MINE', 'ALL'] as const).map(v =>
    h('button', { type: 'button', role: 'radio', 'data-filter': v, 'aria-checked': String(v === show), class: v === show ? 'on' : '', onclick: () => { show = v; draw(); } }, v === 'MINE' ? tr('ui.class', { cls: mine }) : tr('labs.filter.both')),
  );

  const card = (t: Tool) =>
    h('a', { class: 'card', href: t.href, 'data-tool': t.id }, h('div', { class: 'card-icon' }, icon(iconForLab(t.id, t.title), 22)), h('h3', {}, en(t.title)), h('p', {}, en(t.summary)), h('span', { class: 'chip' }, tr('ui.class', { cls: t.cls })));

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
          h('summary', {}, h('span', { class: 'unit-name' }, tr(`unit.${u.id}` as Key)), h('span', { class: 'chip' }, list.length === 1 ? tr('labs.group.one') : tr('labs.group.n', { n: list.length })), inRoute ? null : h('span', { class: 'chip alt' }, tr(u.route === 'OPTION_I_ANALYSIS' ? 'ui.optionI' : 'ui.optionII'))),
          h('div', { class: 'cards' }, ...list.map(card)));
      }).filter(Boolean) as HTMLElement[];
      return blocks.length ? [h('h3', { class: 'blockhead class-head', 'data-class': cls }, tr('ui.class', { cls })), ...blocks] : [];
    });
    count.textContent = total === 0 ? tr('labs.count.none') : total === 1 ? tr('labs.count.one') : tr('labs.count.n', { n: total });
    mount(body, ...sections);
  }
  searchBox.addEventListener('input', () => { query = (searchBox as HTMLInputElement).value; draw(); });
  draw();

  return h('div', { class: 'labsindex' },
    h('header', { class: 'labhead' },
      h('nav', { class: 'breadcrumb', 'aria-label': 'Breadcrumb' }, h('a', { href: '#/' }, tr('ui.home')), h('span', { 'aria-hidden': 'true' }, ' \u203A '), h('span', { 'aria-current': 'page' }, tr('labs.crumb'))),
      h('p', { class: 'eyebrow' }, tr('labs.eyebrow')),
      h('h2', {}, tr('labs.h2')),
      h('p', { class: 'lead' }, tr('labs.lead'))),
    h('div', { class: 'lab-tools' },
      h('div', { class: 'field grow' }, h('label', { for: 'labsearch' }, tr('labs.search')), searchBox),
      h('div', { class: 'modes', role: 'radiogroup', 'aria-label': tr('labs.filter.aria') }, ...filterBtns)),
    count,
    body,
    h('p', { class: 'experience-note' }, icon('lightbulb', 18), h('span', {}, tr('labs.tip'))));
}
