import { SKILLS, checkAnswer, makeQuestion, nextSkill, type Question } from '../../../../packages/curriculum/src';
import { Money } from '../../../../packages/engine/src';
import { Machine } from '../../../../packages/engine/src';
import { PRACTICE_QUESTION, type QuestionCtx, type QuestionEvent, type QuestionState } from '../../../../packages/curriculum/src';
import { register, track, unregister, onDispose } from '../machine-dom';
import { icon } from '../icons';
import { h, mount } from '../dom';
import { tr } from '../i18n';
import type { Key } from '../../../../packages/curriculum/src/i18n';
import { attempts, recordAttempt } from '../store';
import { announce } from '../ui';
import { state } from '../state';
import { ALL_LABS } from '../labs';
import { t } from '../../../../packages/curriculum/src/i18n';

type Mode = 'BEGINNER' | 'PRACTICE' | 'BOARD';
const MODES: readonly Mode[] = ['BEGINNER', 'PRACTICE', 'BOARD'];

export function practicePage(skillArg?: string, seedArg?: string, modeArg?: string): HTMLElement {
  const root = h('div', { class: 'practice' });
  let mode: Mode = modeArg && /^(beginner|practice|board)$/i.test(modeArg) ? (modeArg.toUpperCase() as Mode) : 'PRACTICE';
  const skillsHere = SKILLS.filter(s => s.clause.startsWith(state.profile.cls + '.') && !(state.profile.cls === 'XII' && state.profile.route === 'OPTION_II_COMPUTERISED' && /^XII\.[34]\./.test(s.clause)));
  let skill = skillArg && SKILLS.some(s => s.skill === skillArg) ? skillArg : skillsHere[0]?.skill ?? SKILLS[0]!.skill;
  let seed = seedArg && /^\d{1,9}$/.test(seedArg) ? Number(seedArg) : Math.floor(Math.random() * 1_000_000);

  async function recommend() {
    const a = await attempts();
    skill = nextSkill(a, state.profile.cls, state.profile.route);
    seed = Math.floor(Math.random() * 1_000_000);
    draw();
  }

  let current: Machine<QuestionState, QuestionEvent, QuestionCtx> | undefined;
  function draw() {
    let qArticle!: HTMLElement;
    const q: Question = makeQuestion(skill, seed);
    let hintsShown = 0, stepsShown = 0;
    const inputs: (HTMLInputElement | HTMLSelectElement)[] = [];
    // Hindi (draft) when chosen and available; otherwise English, and say so
    const hi = state.lang === 'hi' && q.hi ? q.hi : null, T = (en: string, k?: number, arr?: readonly string[]) => (hi && arr && k !== undefined && arr[k] ? arr[k]! : en);
    const L = state.lang;                                              // language of the page chrome (buttons, feedback lines)
    const fb = state.lang === 'hi' && !hi;                              // a question that has no Hindi version yet: its own text stays English and is marked so
    const qc = (x: string): string | HTMLElement => (fb ? h('span', { lang: 'en' }, x) : x);
    const qlang = fb ? { lang: 'en' } : {};
    const stem = hi ? hi.stem : q.stem, hints = hi ? hi.hints : q.hints, working = hi ? hi.working : q.working;
    const optLabel = (k: number, o: string) => { const i = q.parts[k]!.options?.indexOf(o) ?? -1; return hi?.options?.[k]?.[i] ?? o; };
    const feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
    const hintBox = h('div', { class: 'hintbox' });
    const workBox = h('div', { class: 'workbox' });
    const lab = ALL_LABS.find(l => l.skills.includes(skill));
    // one machine per question: decides what is possible right now (see `practice-question` in docs/STATE_MACHINES.md)
    if (current) unregister(current);
    const qm = new Machine(PRACTICE_QUESTION, { mode, hintsLeft: hints.length, stepsLeft: working.length });
    current = qm; register(qm);

    const showWorking = (n: number) => mount(workBox, n > 0 ? h('ol', { class: 'walk', ...(hi ? { lang: 'hi' } : qlang) }, ...working.slice(0, n).map(w => h('li', {}, w))) : null);

    const check = () => {
      if (qm.is('SUBMITTED')) { mount(feedback, h('p', { class: 'note warn', role: 'status' }, qm.why('SUBMIT_FINAL')!)); return; }     // an answer can never be recorded twice
      let marks = 0, correctParts = 0; const mistakes: string[] = [];
      const rows = q.parts.map((p, i) => {
        const v = inputs[i]!.value;
        const ok = checkAnswer(p, v);
        if (ok) { marks += p.marks; correctParts++; }
        else {
          const d = q.distractors.find(x => x.part === i && checkAnswer({ ...p, answer: x.value }, v));
          if (d) mistakes.push(d.mistake);
          return { ok, p, v, d };
        }
        return { ok, p, v, d: undefined };
      });
      const finished = correctParts === q.parts.length;
      // Beginner mode lets a wrong answer be retried; every other mode (and any correct answer) is final.
      const sent = qm.send(finished || mode !== 'BEGINNER' ? 'SUBMIT_FINAL' : 'SUBMIT_PARTIAL');
      if (!sent.ok) { mount(feedback, h('p', { class: 'note warn', role: 'status' }, sent.reason!)); return; }
      if (mode === 'BEGINNER' && !finished) {
        mount(feedback, h('p', { class: 'note warn', role: 'alert' }, `${correctParts} of ${q.parts.length} parts correct. Not quite — use a hint or look at the next step, then try again.`),
          ...rows.filter(r => r.d).map(r => h('p', { class: 'note bad' }, h('b', {}, r.d!.mistake), ' ', r.d!.fix)));
        rows.forEach((r, i) => inputs[i]!.setAttribute('aria-invalid', String(!r.ok)));
        void recordAttempt({ t: Date.now(), skill, clause: q.clause, seed, mode, marks, outOf: q.marks, hintsUsed: hintsShown + stepsShown, mistakes, correctParts, parts: q.parts.length });
        announce('Not yet correct. Try again.');
        return;
      }
      for (const i of inputs) i.disabled = true;
      void recordAttempt({ t: Date.now(), skill, clause: q.clause, seed, mode, marks, outOf: q.marks, hintsUsed: hintsShown + stepsShown, mistakes, correctParts, parts: q.parts.length });
      showWorking(working.length);
      mount(feedback,
        h('p', { class: 'note ' + (finished ? 'good' : 'warn'), role: 'status' }, `${t(L, finished ? 'practice.correct' : 'practice.notThisTime')} ${t(L, 'practice.scored', { marks, outOf: q.marks })}`),
        ...rows.filter(r => !r.ok).map(r => h('div', { class: 'note bad' }, h('p', {}, h('b', {}, qc(T(r.p.label, q.parts.indexOf(r.p), hi?.parts))), t(L, 'practice.youWrote'), (r.p.kind === 'CHOICE' ? optLabel(q.parts.indexOf(r.p), r.v) : r.v) || t(L, 'practice.blank'), t(L, 'practice.answerIs'), h('b', {}, r.p.kind === 'MONEY' ? Money.parse(r.p.answer).format() : r.p.kind === 'CHOICE' ? optLabel(q.parts.indexOf(r.p), r.p.answer) : r.p.answer), t(L, 'practice.end')), r.d ? h('p', {}, h('b', {}, r.d.mistake), ' ', r.d.fix) : null)));
      announce(finished ? 'Correct' : 'Incorrect, see the working below');
    };

    const hintBtn = h('button', { type: 'button', onclick: () => {
      const r = qm.send('HINT'); if (!r.ok) { mount(hintBox, h('p', { class: 'hint' }, r.reason!)); return; }
      hintsShown++; qm.ctx.hintsLeft--; refresh();
      mount(hintBox, h('ol', { class: 'hintlist', ...(hi ? { lang: 'hi' } : qlang) }, ...hints.slice(0, hintsShown).map(t => h('li', {}, t))));
    } }, icon('lightbulb', 16), tr('prac.hint'));
    const stepBtn = h('button', { type: 'button', onclick: () => {
      const r = qm.send('STEP_SHOW'); if (!r.ok) { mount(workBox, h('p', { class: 'hint' }, r.reason!)); return; }
      stepsShown++; qm.ctx.stepsLeft--; refresh(); showWorking(stepsShown);
    } }, icon('steps', 16), tr('prac.step'));
    const nextBtn = h('button', { type: 'button', class: 'primary', hidden: true, onclick: () => { seed = Math.floor(Math.random() * 1_000_000); draw(); } }, tr('prac.next'));

    const submitBtn = h('button', { type: 'submit', class: 'primary' }, tr(mode === 'BOARD' ? 'prac.submit' : 'prac.check'));
    /** Buttons follow the machine: after SUBMITTED only "Next" remains; unavailable help says why. */
    const refresh = () => {
      const done = qm.is('SUBMITTED');
      submitBtn.disabled = done; hintBtn.disabled = !qm.can('HINT'); stepBtn.disabled = !qm.can('STEP_SHOW'); nextBtn.hidden = !done;
      hintBtn.title = qm.why('HINT') ?? ''; stepBtn.title = qm.why('STEP_SHOW') ?? '';
    };
    const partsUi = q.parts.map((p, i) => {
      const label = T(p.label, i, hi?.parts);
      const inp: HTMLInputElement | HTMLSelectElement = p.kind === 'CHOICE'
        ? h('select', { id: `ans-${i}` }, h('option', { value: '' }, t(L, 'practice.choose')), ...(p.options ?? []).map(o => h('option', { value: o, ...qlang }, optLabel(i, o))))
        : h('input', { type: 'text', id: `ans-${i}`, inputmode: p.kind === 'FRACTION' ? 'text' : 'decimal', autocomplete: 'off', placeholder: p.kind === 'FRACTION' ? 'e.g. 3/10' : p.kind === 'TEXT' ? 'type your answer' : t(L, 'practice.amount') });
      inputs.push(inp);
      return h('div', { class: 'field' }, h('label', { for: `ans-${i}` }, qc(label), ' ', h('span', { class: 'marks' }, state.lang === 'hi' ? `[${p.marks} अंक]` : `[${p.marks} mark${p.marks > 1 ? 's' : ''}]`)), inp, p.unit ? h('small', {}, p.unit) : null);
    });
    qm.subscribe(() => refresh());
    mount(root,
      h('header', { class: 'labhead' }, h('p', { class: 'eyebrow' }, tr('ui.class', { cls: state.profile.cls })), h('h2', {}, tr('prac.h2')), h('p', { class: 'lead' }, tr('prac.lead'))),
      h('div', { class: 'practice-top' },
        h('label', {}, tr('prac.topic'), (() => { const s = h('select', { id: 'skillsel', onchange: (e: Event) => { skill = (e.target as HTMLSelectElement).value; seed = Math.floor(Math.random() * 1_000_000); draw(); } }, ...SKILLS.filter(x => x.clause.startsWith(state.profile.cls + '.')).map(x => h('option', { value: x.skill, lang: 'en' }, x.title))); s.value = skill; return s; })()),
        h('div', { class: 'modes', role: 'radiogroup', 'aria-label': tr('prac.mode') }, ...MODES.map(m => h('button', { type: 'button', role: 'radio', 'aria-checked': String(m === mode), class: m === mode ? 'on' : '', onclick: () => { mode = m; draw(); } }, tr(`prac.m.${m}` as Key)))),
        h('button', { type: 'button', onclick: () => { void recommend(); } }, icon('target', 16), tr('prac.recommend'))),
      h('p', { class: 'hint' }, tr(`prac.b.${mode}` as Key)),
      qArticle = h('article', { class: 'question' },
        h('p', { class: 'eyebrow' }, h('span', { lang: 'en' }, q.clause), ` · ${tr('ui.marks', { n: q.marks })} · ${t(L, `typology.${q.typology}`)}`), hi ? null : state.lang === 'hi' ? h('p', { class: 'note warn', lang: 'hi' }, t('hi', 'practice.noHindi')) : null, h('p', { class: 'stem', ...(hi ? { lang: 'hi' } : qlang) }, stem),
        h('form', { onsubmit: (e: Event) => { e.preventDefault(); check(); } }, ...partsUi,
          h('div', { class: 'actions' }, submitBtn,
            mode !== 'BOARD' ? hintBtn : null, mode === 'BEGINNER' ? stepBtn : null, nextBtn)),
        hintBox, workBox, feedback,
        lab ? h('p', { class: 'after' }, tr('prac.stuck'), h('a', { href: `#/lab/${lab.id}`, lang: 'en' }, lab.title), '.') : null));
    track(qArticle, qm); refresh();
  }
  onDispose(() => { if (current) unregister(current); });
  draw();
  return root;
}
