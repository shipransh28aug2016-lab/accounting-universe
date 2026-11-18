import { SOURCE, UNITS, CLAUSES, type ClassLevel } from '../../../../packages/curriculum/src';
import { h } from '../dom';
import { icon, iconForLab } from '../icons';
import { ALL_LABS, PAGES, coverage } from '../labs';
import { state } from '../state';
import { storageMode, setProfile } from '../store';
import { navigate } from '../router';
import { en, tr } from '../i18n';

export function homePage(rerender: () => void): HTMLElement {
  const cls = state.profile.cls;
  const choose = (c: ClassLevel) => {
    state.profile = { ...state.profile, cls: c };
    void setProfile(state.profile);
    rerender();
  };
  const cov = coverage(cls);
  const route = state.profile.route;
  const pct = Math.round((cov.interactive / cov.total) * 100);

  // The one thing a new visitor should do first, per class (and per Class XII option).
  const first =
    cls === 'XI'
      ? PAGES.find(p => p.id === 'xi-ledger')
      : route === 'OPTION_II_COMPUTERISED'
        ? PAGES.find(p => p.id === 'xii-cas')
        : ALL_LABS.find(l => l.cls === 'XII' && !l.route);
  const firstHref = first ? ('href' in first ? first.href : `#/lab/${first.id}`) : `#/class/${cls}`;
  const firstTitle = first ? first.title : `Class ${cls} syllabus`;

  return h(
    'div',
    { class: 'home' },
    // HERO: what this is, who it is for, one obvious first step. No decoration behind the text.
    h(
      'section',
      { class: 'hero' },
      h('p', { class: 'eyebrow' }, tr('home.eyebrow')),
      h('h2', {}, tr('home.h2a'), h('span', { class: 'hero-accent' }, tr('home.h2b')), tr('home.h2c')),
      h('p', { class: 'lead' }, tr('home.lead')),
      h(
        'div',
        { class: 'classpick', role: 'radiogroup', 'aria-label': tr('home.chooseClass') },
        ...(['XI', 'XII'] as ClassLevel[]).map(c =>
          h(
            'button',
            {
              type: 'button',
              role: 'radio',
              'aria-checked': String(c === cls),
              class: 'bigchoice' + (c === cls ? ' on' : ''),
              onclick: () => choose(c),
            },
            h('b', {}, tr('ui.class', { cls: c })),
            h('span', {}, tr(c === 'XI' ? 'home.xi.sub' : 'home.xii.sub')),
          ),
        ),
      ),
      cls === 'XII'
        ? h(
            'fieldset',
            { class: 'routebox' },
            h('legend', {}, tr('home.route.legend')),
            ...(
              [
                ['OPTION_I_ANALYSIS', tr('home.route.1')],
                ['OPTION_II_COMPUTERISED', tr('home.route.2')],
              ] as const
            ).map(([v, label]) =>
              h(
                'label',
                { class: 'radio' },
                h('input', {
                  type: 'radio',
                  name: 'route',
                  value: v,
                  ...(route === v ? { checked: true } : {}),
                  onchange: () => {
                    state.profile = { ...state.profile, route: v };
                    void setProfile(state.profile);
                    rerender();
                  },
                }),
                ' ',
                label,
              ),
            ),
            route === 'OPTION_II_COMPUTERISED'
              ? h('p', { class: 'note info route-note' }, tr('home.route.note'))
              : null,
          )
        : null,
      h(
        'div',
        { class: 'actions hero-actions' },
        h('button', { type: 'button', class: 'primary', 'data-start': '', onclick: () => navigate(firstHref) }, tr('home.start'), en(firstTitle)),
        h('button', { type: 'button', onclick: () => navigate('#/practice') }, tr('home.practise')),
        h('button', { type: 'button', class: 'ghost', onclick: () => navigate(`#/class/${cls}`) }, tr('home.map', { cls })),
      ),
    ),

    // HOW IT WORKS: what a session looks like, in the learner's words.
    h(
      'section',
      { class: 'steps3', 'aria-label': tr('home.steps.aria') },
      ...(
        [
          ['book', tr('home.step1.t'), tr('home.step1.d')],
          ['flask', tr('home.step2.t'), tr('home.step2.d')],
          ['check-circle', tr('home.step3.t'), tr('home.step3.d')],
        ] as const
      ).map(([ic, title, text]) => h('div', { class: 'step3' }, h('div', { class: 'step3-icon' }, icon(ic, 22)), h('div', {}, h('b', {}, title), h('span', {}, text)))),
    ),

    // START HERE: a handful of good first labs for the chosen class.
    h(
      'div',
      { class: 'section-head' },
      h('h3', {}, tr('home.popular', { cls })),
      h('a', { class: 'button small', href: '#/labs' }, tr('home.allLabs')),
    ),
    h(
      'section',
      { class: 'cards' },
      ...PAGES.filter(p => p.cls === cls && (!p.route || route === p.route))
        .slice(0, 2)
        .map(p =>
          h('a', { class: 'card', href: p.href }, h('div', { class: 'card-icon' }, icon(iconForLab(p.id, p.title), 22)), h('h3', {}, en(p.title)), h('p', {}, en(p.summary)), h('span', { class: 'chip' }, tr('ui.class', { cls: p.cls }))),
        ),
      ...ALL_LABS.filter(l => l.cls === cls && (!l.route || route === l.route))
        .slice(0, 4)
        .map(l =>
          h('a', { class: 'card', href: `#/lab/${l.id}` }, h('div', { class: 'card-icon' }, icon(iconForLab(l.id, l.title), 22)), h('h3', {}, en(l.title)), h('p', {}, en(l.summary)), h('span', { class: 'chip' }, tr('ui.class', { cls: l.cls }))),
        ),
    ),

    // FOR TEACHERS: a clear door for the other main audience.
    h(
      'section',
      { class: 'panel teacher-band', 'aria-labelledby': 'teacher-band-title' },
      h('div', { class: 'teacher-band-icon' }, icon('chalkboard', 26)),
      h(
        'div',
        { class: 'teacher-band-text' },
        h('h3', { id: 'teacher-band-title' }, tr('home.teacher.t')),
        h('p', {}, tr('home.teacher.d')),
      ),
      h('a', { class: 'button primary', href: '#/teacher' }, tr('home.teacher.btn')),
    ),

    // WHAT IS COVERED: one honest line and a meter.
    h(
      'section',
      { class: 'panel' },
      h('h3', { class: 'flush-top' }, tr('home.cover.t', { cls })),
      h('p', { class: 'muted-line' }, tr('home.cover.line', { a: cov.interactive, b: cov.total, c: cov.cardsOnly, d: cov.none })),
      h('div', { class: 'meter', role: 'img', 'aria-label': tr('home.cover.aria', { a: cov.interactive, b: cov.total, pct }) }, h('div', { class: 'meterfill', style: `width:${pct}%` })),
      h('div', { class: 'actions' }, h('a', { class: 'button', href: '#/cards' }, tr('home.cards')), h('a', { class: 'button', href: '#/rescue' }, tr('home.rescue'))),
    ),

    h(
      'footer',
      { class: 'app-footer' },
      h('p', {}, tr('home.foot.syllabus'), h('a', { href: SOURCE.url, rel: 'noopener', target: '_blank', lang: 'en' }, SOURCE.document), tr('home.foot.counts', { units: UNITS.length, topics: CLAUSES.length })),
      h('p', {}, tr(storageMode === 'indexeddb' ? 'home.foot.saved' : 'home.foot.limited')),
    ),
  );
}
