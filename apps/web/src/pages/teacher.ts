import { classReport, clauseById, reportToCsv, type ClassReport } from '../../../../packages/curriculum/src';
import { h, mount } from '../dom';
import { labsOfClause } from '../labs';
import { download } from './progress';

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
    h('section', { class: 'panel' }, h('label', { for: 'tfiles' }, 'Load students’ progress files (.json)'), input,
      h('div', { class: 'actions' }, h('button', { type: 'button', onclick: () => { files.length = 0; (input as HTMLInputElement).value = ''; draw(); } }, 'Clear loaded files'))), out);
}
