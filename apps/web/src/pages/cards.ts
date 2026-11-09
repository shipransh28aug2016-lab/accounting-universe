import { Machine } from '../../../../packages/engine/src';
import { CARD_CHECK } from '../../../../packages/curriculum/src';
import { onDispose, track, unregister } from '../machine-dom';
import { CARDS, UNITS, type Card } from '../../../../packages/curriculum/src';
import { h, mount } from '../dom';
import { recordAttempt, recordSeen } from '../store';
import { announce } from '../ui';
import { state } from '../state';
import { ALL_LABS, labsOfClause, hrefOf, titleOf, isCard } from '../labs';

export function cardsIndex(): HTMLElement {
  const cls = state.profile.cls;
  const mine = CARDS.filter(c => c.clause.startsWith(cls + '.'));
  return h('div', {},
    h('header', { class: 'labhead' }, h('p', { class: 'eyebrow' }, 'Concept cards'), h('h2', {}, 'The theory, in short cards'), h('p', { class: 'lead' }, `Class ${cls} theory topics: short explanations in English and Hinglish with self-check questions. Change class on the Home page.`)),
    h('div', { class: 'cards' }, ...mine.map(c => h('a', { class: 'card', href: `#/cards/${c.id}` }, h('h3', {}, c.title), h('p', {}, c.en[0]!), h('span', { class: 'chip' }, UNITS.find(u => c.clause.startsWith(u.id + '.'))?.title ?? c.clause)))));
}

export function cardPage(card: Card): HTMLElement {
  let lang: 'en' | 'hi' = state.lang;
  const body = h('div', { class: 'prose' }), checks = h('div', {});
  void recordSeen({ lab: `card:${card.id}`, tab: 'learn', t: Date.now() });
  const answered = new Set<number>();
  const drawBody = () => mount(body, ...(lang === 'en' ? card.en : card.hi).map(p => h('p', {}, p)));
  const related = labsOfClause(card.clause).filter(x => !isCard(x));
  card.checks.forEach((k, qi) => {
    const name = `q${qi}`, out = h('div', { 'aria-live': 'polite' }), cm = new Machine(CARD_CHECK, { hasChoice: false });
    const form = h('form', { class: 'check', onsubmit: (e: Event) => {
      e.preventDefault();
      const sel = form.querySelector<HTMLInputElement>(`input[name=${name}]:checked`);
      cm.ctx.hasChoice = !!sel;
      const sent = cm.send('ANSWER');                                    // refused: no choice yet, or already answered
      if (!sent.ok) { mount(out, h('p', { class: 'note warn', role: 'alert' }, sent.reason!)); return; }
      const ok = Number(sel!.value) === k.answer; answered.add(qi);
      void recordAttempt({ t: Date.now(), skill: `card:${card.id}`, clause: card.clause, seed: qi + 1, mode: 'BEGINNER', marks: ok ? 1 : 0, outOf: 1, hintsUsed: 0, mistakes: ok ? [] : [`${card.title}: chose “${k.options[Number(sel!.value)]}”`], correctParts: ok ? 1 : 0, parts: 1 });
      if (answered.size === card.checks.length) void recordSeen({ lab: `card:${card.id}`, tab: 'example', t: Date.now() });
      for (const i of Array.from(form.querySelectorAll('input'))) (i as HTMLInputElement).disabled = true;
      mount(out, h('p', { class: 'note ' + (ok ? 'good' : 'bad'), role: 'status' }, ok ? '✓ Correct. ' : `Not quite — the answer is “${k.options[k.answer]}”. `, k.why));
      announce(ok ? 'Correct' : 'Incorrect');
    } },
      h('fieldset', {}, h('legend', {}, `${qi + 1}. ${k.q}`), ...k.options.map((o, oi) => h('label', { class: 'radio' }, h('input', { type: 'radio', name, value: oi }), ' ', o))),
      h('button', { type: 'submit' }, 'Check'), out);
    track(form, cm); onDispose(() => unregister(cm));
    checks.append(form);
  });
  drawBody();
  const toggle = h('div', { class: 'modes', role: 'radiogroup', 'aria-label': 'Language' }, ...([['en', 'English'], ['hi', 'Hinglish']] as const).map(([v, label]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(v === lang), class: v === lang ? 'on' : '', onclick: (e: Event) => { lang = v; state.lang = v; for (const b of Array.from((e.currentTarget as HTMLElement).parentElement!.children)) { b.classList.toggle('on', b === e.currentTarget); b.setAttribute('aria-checked', String(b === e.currentTarget)); } drawBody(); } }, label)));
  return h('article', { class: 'labpage' }, h('header', { class: 'labhead' }, h('p', { class: 'eyebrow' }, `Concept card · ${card.clause}`), h('h2', {}, card.title), toggle),
    h('section', { class: 'panel' }, body), h('section', { class: 'panel' }, h('h3', {}, 'Check yourself'), checks),
    related.length ? h('p', { class: 'after' }, 'Practise it: ', ...related.map(id => h('a', { class: 'pill', href: hrefOf(id) }, titleOf(id)))) : null,
    h('p', { class: 'after' }, h('a', { href: '#/cards' }, '← All cards'), ALL_LABS.length ? '' : ''));
}
