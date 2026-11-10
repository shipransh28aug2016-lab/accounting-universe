import { SKILLS, checkAnswer, makeQuestion, nextSkill, type Question } from '../../../../packages/curriculum/src';
import { Money } from '../../../../packages/engine/src';
import { Machine } from '../../../../packages/engine/src';
import { PRACTICE_QUESTION, type QuestionCtx, type QuestionEvent, type QuestionState } from '../../../../packages/curriculum/src';
import { register, track, unregister, onDispose } from '../machine-dom';
import { h, mount } from '../dom';
import { attempts, recordAttempt } from '../store';
import { announce } from '../ui';
import { state } from '../state';
import { ALL_LABS } from '../labs';

type Mode = 'BEGINNER' | 'PRACTICE' | 'BOARD';
const MODES: { id: Mode; label: string; blurb: string }[] = [
  { id: 'BEGINNER', label: 'Beginner', blurb: 'Hints and the worked steps are available, one at a time. Retry as often as you like.' },
  { id: 'PRACTICE', label: 'Practice', blurb: 'Hints available (each one is recorded). One check, then see the full working.' },
  { id: 'BOARD', label: 'Board', blurb: 'Exam conditions: no hints, one check, marks shown like a marking scheme.' },
];

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
    const inputs: HTMLInputElement[] = [];
    const feedback = h('div', { class: 'feedback', 'aria-live': 'polite' });
    const hintBox = h('div', { class: 'hintbox' });
    const workBox = h('div', { class: 'workbox' });
    const lab = ALL_LABS.find(l => l.skills.includes(skill));
    // one machine per question: decides what is possible right now (see `practice-question` in docs/STATE_MACHINES.md)
    if (current) unregister(current);
    const qm = new Machine(PRACTICE_QUESTION, { mode, hintsLeft: q.hints.length, stepsLeft: q.working.length });
    current = qm; register(qm);

    const showWorking = (n: number) => mount(workBox, n > 0 ? h('ol', { class: 'walk' }, ...q.working.slice(0, n).map(w => h('li', {}, w))) : null);

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
      showWorking(q.working.length);
      mount(feedback,
        h('p', { class: 'note ' + (finished ? 'good' : 'warn'), role: 'status' }, `${finished ? '✓ Correct.' : 'Not this time.'} You scored ${marks} / ${q.marks}${mode === 'BOARD' ? ' marks' : ''}.`),
        ...rows.filter(r => !r.ok).map(r => h('div', { class: 'note bad' }, h('p', {}, h('b', {}, r.p.label), ': you wrote “', r.v || '(blank)', '”; the answer is ', h('b', {}, r.p.kind === 'MONEY' ? Money.parse(r.p.answer).format() : r.p.answer), '.'), r.d ? h('p', {}, h('b', {}, r.d.mistake), ' ', r.d.fix) : null)));
      announce(finished ? 'Correct' : 'Incorrect, see the working below');
    };

    const hintBtn = h('button', { type: 'button', onclick: () => {
      const r = qm.send('HINT'); if (!r.ok) { mount(hintBox, h('p', { class: 'hint' }, r.reason!)); return; }
      hintsShown++; qm.ctx.hintsLeft--; refresh();
      mount(hintBox, h('ol', { class: 'hintlist' }, ...q.hints.slice(0, hintsShown).map(t => h('li', {}, t))));
    } }, '💡 Next hint');
    const stepBtn = h('button', { type: 'button', onclick: () => {
      const r = qm.send('STEP_SHOW'); if (!r.ok) { mount(workBox, h('p', { class: 'hint' }, r.reason!)); return; }
      stepsShown++; qm.ctx.stepsLeft--; refresh(); showWorking(stepsShown);
    } }, '👣 Show next step');
    const nextBtn = h('button', { type: 'button', class: 'primary', hidden: true, onclick: () => { seed = Math.floor(Math.random() * 1_000_000); draw(); } }, 'Next question →');

    const submitBtn = h('button', { type: 'submit', class: 'primary' }, mode === 'BOARD' ? 'Submit answer' : 'Check');
    /** Buttons follow the machine: after SUBMITTED only "Next" remains; unavailable help says why. */
    const refresh = () => {
      const done = qm.is('SUBMITTED');
      submitBtn.disabled = done; hintBtn.disabled = !qm.can('HINT'); stepBtn.disabled = !qm.can('STEP_SHOW'); nextBtn.hidden = !done;
      hintBtn.title = qm.why('HINT') ?? ''; stepBtn.title = qm.why('STEP_SHOW') ?? '';
    };
    const partsUi = q.parts.map((p, i) => {
      const inp = h('input', { type: 'text', id: `ans-${i}`, inputmode: p.kind === 'FRACTION' ? 'text' : 'decimal', autocomplete: 'off', placeholder: p.kind === 'FRACTION' ? 'e.g. 3/10' : p.kind === 'TEXT' ? 'type your answer' : 'amount in ₹' });
      inputs.push(inp);
      return h('div', { class: 'field' }, h('label', { for: `ans-${i}` }, `${p.label} `, h('span', { class: 'marks' }, `[${p.marks} mark${p.marks > 1 ? 's' : ''}]`)), inp, p.unit ? h('small', {}, p.unit) : null);
    });

    qm.subscribe(() => refresh());
    mount(root,
      h('header', { class: 'labhead' }, h('p', { class: 'eyebrow' }, `Class ${state.profile.cls}`), h('h2', {}, 'Practice'), h('p', { class: 'lead' }, 'Every question is made fresh and marked by the accounting engine. Wrong answers are explained, not just crossed out.')),
      h('div', { class: 'practice-top' },
        h('label', {}, 'Topic ', (() => { const s = h('select', { id: 'skillsel', onchange: (e: Event) => { skill = (e.target as HTMLSelectElement).value; seed = Math.floor(Math.random() * 1_000_000); draw(); } }, ...SKILLS.filter(x => x.clause.startsWith(state.profile.cls + '.')).map(x => h('option', { value: x.skill }, x.title))); s.value = skill; return s; })()),
        h('div', { class: 'modes', role: 'radiogroup', 'aria-label': 'Mode' }, ...MODES.map(m => h('button', { type: 'button', role: 'radio', 'aria-checked': String(m.id === mode), class: m.id === mode ? 'on' : '', onclick: () => { mode = m.id; draw(); } }, m.label))),
        h('button', { type: 'button', onclick: () => { void recommend(); } }, '🎯 Pick what I should practise next')),
      h('p', { class: 'hint' }, MODES.find(m => m.id === mode)!.blurb),
      qArticle = h('article', { class: 'question' },
        h('p', { class: 'eyebrow' }, `${q.clause} · ${q.marks} marks`), h('p', { class: 'stem' }, q.stem),
        h('form', { onsubmit: (e: Event) => { e.preventDefault(); check(); } }, ...partsUi,
          h('div', { class: 'actions' }, submitBtn,
            mode !== 'BOARD' ? hintBtn : null, mode === 'BEGINNER' ? stepBtn : null, nextBtn)),
        hintBox, workBox, feedback,
        lab ? h('p', { class: 'after' }, 'Stuck? Review the ', h('a', { href: `#/lab/${lab.id}` }, lab.title), '.') : null));
    track(qArticle, qm); refresh();
  }
  onDispose(() => { if (current) unregister(current); });
  draw();
  return root;
}
