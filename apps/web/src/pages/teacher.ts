import { SKILLS, classReport, clauseById, heatmap, makeAssignment, remedial, reportToCsv, type ClassReport } from '../../../../packages/curriculum/src';
import { h, mount } from '../dom';
import { labsOfClause, hrefOf, titleOf } from '../labs';
import { download } from './progress';

function builder(): HTMLElement {
  const title = h('input', { type: 'text', id: 'atitle', placeholder: 'e.g. Unit 2 chapter test', maxlength: 60 });
  const mode = h('select', { id: 'amode' }, h('option', { value: 'PRACTICE' }, 'Assignment (practice mode)'), h('option', { value: 'BOARD' }, 'Chapter test (board mode: no hints)'), h('option', { value: 'BEGINNER' }, 'Guided (beginner mode)'));
  const per = h('input', { type: 'text', id: 'aper', inputmode: 'numeric', value: '2', 'aria-label': 'Questions per topic' });
  const boxes = SKILLS.map(s => ({ s, el: h('input', { type: 'checkbox', value: s.skill }) }));
  const msg = h('p', { class: 'formerr', role: 'alert' });
  return h('section', { class: 'panel' }, h('h3', {}, 'Create an assignment or chapter test'), h('p', { class: 'hint' }, 'You get a file to share (email, WhatsApp, a class drive). Every student who imports it gets the same questions. Their results come back to you in their progress files.'),
    h('div', { class: 'formgrid' }, h('label', {}, 'Title', title), h('label', {}, 'Type', mode)), h('label', { class: 'stack' }, 'Questions per topic', per),
    h('fieldset', { class: 'topicpick' }, h('legend', {}, 'Topics'), ...boxes.map(b => h('label', { class: 'radio' }, b.el, ' ', `${b.s.title} `, h('span', { class: 'cid' }, b.s.clause)))),
    h('div', { class: 'actions' }, h('button', { type: 'button', class: 'primary', onclick: () => {
      try {
        const n = Number(per.value); const a = makeAssignment({ title: title.value, mode: mode.value as 'PRACTICE' | 'BOARD' | 'BEGINNER', skills: boxes.filter(b => (b.el as HTMLInputElement).checked).map(b => b.s.skill), perSkill: n, seed: Math.floor(Math.random() * 1_000_000_000), createdAt: Date.now() });
        download(`${a.title.replace(/[^\w-]+/g, '_')}.assignment.json`, JSON.stringify(a, null, 2), 'application/json'); msg.textContent = '';
      } catch (e) { msg.textContent = e instanceof RangeError ? e.message : 'Could not create the assignment.'; }
    } }, '⬇ Download assignment file')), msg);
}

export function teacherPage(): HTMLElement {
  const out = h('div', { class: 'teacherout', 'aria-live': 'polite' });
  const files: { file: string; data: unknown }[] = [];
  let last: ClassReport | null = null;
  const draw = () => {
    if (files.length === 0) { mount(out, h('p', { class: 'empty' }, 'No files loaded yet.')); return; }
    const r = classReport(files, labsOfClause); last = r;
    mount(out,
      r.skipped.length ? h('div', { class: 'note warn' }, h('b', {}, 'Skipped files:'), h('ul', {}, ...r.skipped.map(s => h('li', {}, s)))) : null,
      h('section', { class: 'panel' }, h('h3', {}, `Students (${r.students.length})`), h('div', { class: 'tablewrap' }, h('table', { class: 'data' }, h('thead', {}, h('tr', {}, ['Student', 'Attempts', 'Accuracy', 'Weak topics'].map((t, i) => h('th', { scope: 'col', class: i === 1 || i === 2 ? 'num' : '' }, t)))),
        h('tbody', {}, ...r.students.map(s => h('tr', {}, h('th', { scope: 'row' }, s.name), h('td', { class: 'num' }, String(s.attempts)), h('td', { class: 'num' }, s.accuracy === null ? '—' : `${Math.round(s.accuracy * 100)}%`), h('td', {}, s.weakClauses.length ? s.weakClauses.map(c => clauseById(c)?.title ?? c).join('; ') : '—')))))),
        h('p', { class: 'hint' }, 'Only the files you loaded appear here. Nothing is uploaded or stored.')),
      h('section', { class: 'panel' }, h('h3', {}, 'Topics across the class'), r.clauses.length === 0 ? h('p', { class: 'empty' }, 'No practice recorded yet.') : h('div', { class: 'tablewrap' }, h('table', { class: 'data' }, h('thead', {}, h('tr', {}, ['Topic', 'Students', 'Accuracy', 'Struggling', 'Most common mistake'].map((t, i) => h('th', { scope: 'col', class: i >= 1 && i <= 3 ? 'num' : '' }, t)))),
        h('tbody', {}, ...r.clauses.map(c => h('tr', { class: c.strugglingStudents > 0 ? 'flag' : '' }, h('th', { scope: 'row' }, clauseById(c.clause)?.title ?? c.clause), h('td', { class: 'num' }, String(c.students)), h('td', { class: 'num' }, c.accuracy === null ? '—' : `${Math.round(c.accuracy * 100)}%`), h('td', { class: 'num' }, String(c.strugglingStudents)), h('td', {}, c.topMistake ?? '—')))))),
        h('div', { class: 'actions' }, h('button', { type: 'button', onclick: () => last && download('class-report.csv', reportToCsv(last), 'text/csv') }, '⬇ Download CSV'))),
      (() => { const hm = heatmap(files); if (hm.students.length === 0 || hm.clauses.length === 0) return null;
        const cls = (x: number | null) => (x === null ? 'hm-none' : x >= 0.8 ? 'hm-good' : x >= 0.6 ? 'hm-ok' : 'hm-bad');
        return h('section', { class: 'panel' }, h('h3', {}, 'Heat-map: who is stuck where'), h('p', { class: 'hint' }, 'Each cell is a student’s accuracy on a topic. Red below 60%, amber 60–79%, green 80%+; a dash means not attempted.'),
          h('div', { class: 'tablewrap' }, h('table', { class: 'data heatmap' }, h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Student'), ...hm.clauses.map(c => h('th', { scope: 'col', title: clauseById(c)?.title ?? c }, c.replace(/^X(I|II)\./, ''))))),
            h('tbody', {}, ...hm.students.map((nm, i) => h('tr', {}, h('th', { scope: 'row' }, nm), ...hm.cells[i]!.map(x => h('td', { class: cls(x) }, x === null ? '—' : `${Math.round(x * 100)}%`))))))));
      })(),
      (() => { const rem = remedial(r, labsOfClause); return h('section', { class: 'panel' }, h('h3', {}, 'Suggested remedial work'), rem.length === 0 ? h('p', { class: 'empty' }, 'No topic stands out as a problem yet.') : h('ol', {}, ...rem.slice(0, 8).map(x => h('li', {}, h('b', {}, clauseById(x.clause)?.title ?? x.clause), ' — ', x.reason, '. ', x.labs.length ? h('span', {}, 'Send them to: ', ...x.labs.map(id => h('a', { class: 'pill', href: hrefOf(id) }, titleOf(id)))) : 'No lab exists for this topic yet.')))); })(),
      r.mistakes.length ? h('section', { class: 'panel' }, h('h3', {}, 'Most common mistakes'), h('ol', {}, ...r.mistakes.slice(0, 8).map(m => h('li', {}, `${m.mistake} (×${m.count})`)))) : null);
  };
  const input = h('input', { type: 'file', multiple: true, accept: 'application/json,.json', id: 'tfiles', onchange: async (e: Event) => {
    for (const f of Array.from((e.target as HTMLInputElement).files ?? [])) {
      try { files.push({ file: f.name, data: JSON.parse(await f.text()) }); } catch { files.push({ file: f.name, data: null }); }
    }
    draw();
  } });
  draw();
  return h('div', { class: 'teacher' },
    h('header', { class: 'labhead' }, h('p', { class: 'eyebrow' }, 'Teacher dashboard'), h('h2', {}, 'See where the class is stuck'), h('p', { class: 'lead' }, 'There are no accounts and no server. Each student exports a progress file from “My Progress” and gives it to you; you load the files here. Everything is calculated in your browser and nothing is uploaded, so one student’s data is never visible to another.')),
    builder(),
    h('section', { class: 'panel' }, h('label', { for: 'tfiles' }, 'Load students’ progress files (.json)'), input,
      h('div', { class: 'actions' }, h('button', { type: 'button', onclick: () => { files.length = 0; (input as HTMLInputElement).value = ''; draw(); } }, 'Clear loaded files'))), out);
}
