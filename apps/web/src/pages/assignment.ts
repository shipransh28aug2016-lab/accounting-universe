import { assignmentProgress, makeQuestion, SKILLS, type Assignment } from '../../../../packages/curriculum/src';
import { h, mount } from '../dom';
import { assignmentsAll, attempts } from '../store';
import { loadInto } from '../async';

export function assignmentPage(id: string): HTMLElement {
  const root = h('div', {});
  loadInto(root, async () => ({ a: (await assignmentsAll()).find(x => x.id === id) as unknown as Assignment | undefined, tries: await attempts() }), ({ a, tries }) => {
    if (!a) { mount(root, h('div', { class: 'panel' }, h('h2', {}, 'Assignment not found'), h('p', {}, 'It is not on this device. Import the file from your teacher on My Progress.'), h('a', { href: '#/progress' }, 'Go to My Progress'))); return; }
    const p = assignmentProgress(a, tries);
    mount(root, h('header', { class: 'labhead' }, h('p', { class: 'eyebrow' }, a.mode === 'BOARD' ? 'Test (Board mode)' : 'Assignment'), h('h2', {}, a.title), h('p', { class: 'lead' }, `${p.done} of ${a.items.length} questions attempted${p.outOf ? ` · ${p.marks}/${p.outOf} marks so far` : ''}. Everyone in your class gets exactly these questions.`)),
      h('ol', { class: 'queue' }, ...p.items.map((it, k) => h('li', {}, h('div', {}, h('b', {}, `Q${k + 1}. ${SKILLS.find(s => s.skill === it.item.skill)?.title ?? it.item.skill}`), ' ', h('span', { class: 'marks' }, makeQuestion(it.item.skill, it.item.seed).marks + ' marks')), h('div', {}, it.attempted ? h('span', { class: 'lvl l5' }, `Done ${it.marks}/${it.outOf}`) : h('span', { class: 'lvl' }, 'Not done'), ' ', h('a', { class: 'button small', href: `#/practice/${it.item.skill}/${it.item.seed}/${a.mode.toLowerCase()}` }, it.attempted ? 'Try again' : 'Start'))))),
      h('p', { class: 'after' }, h('a', { href: '#/progress' }, '← My Progress')));
  }, 'this assignment');
  return root;
}
