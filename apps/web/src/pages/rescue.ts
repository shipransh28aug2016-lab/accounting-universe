import { CLAUSES, LEVELS, clauseById, rescueOrder, rescuePlan, summariseClauses } from '../../../../packages/curriculum/src';
import { h, mount } from '../dom';
import { attempts, seen } from '../store';
import { state } from '../state';
import { hrefOf, labsOfClause } from '../labs';
import { loading } from '../ui';

export function rescuePage(clause?: string): HTMLElement {
  const root = h('div', { class: 'rescue' }, loading('Loading your plan…'));
  void (async () => {
    const [a, s] = [await attempts(), await seen()];
    const cls = state.profile.cls;
    if (clause && clauseById(clause)) {
      const plan = rescuePlan({ clause, labs: labsOfClause(clause), attempts: a, seen: s, hrefForLab: hrefOf });
      mount(root, h('header', { class: 'labhead' }, h('p', { class: 'eyebrow' }, 'Rescue plan'), h('h2', {}, clauseById(clause)!.title), h('p', { class: 'lead' }, `You are at level ${plan.currentLevel}: ${plan.levelName}. One small step at a time.`)),
        h('ol', { class: 'rescue-steps' }, ...plan.steps.map(st => h('li', { class: st.done ? 'done' : st === plan.next ? 'now' : '' }, h('b', {}, `Level ${st.level} · ${st.name}`, st.done ? ' ✓' : st === plan.next ? ' ← you are here' : ''), h('p', {}, st.instruction), st === plan.next ? h('a', { class: 'button primary', href: st.href }, 'Start this step →') : null))),
        plan.next ? null : h('p', { class: 'note good' }, 'Every step is complete for this topic. Well done!'), h('p', { class: 'after' }, h('a', { href: '#/rescue' }, '← All topics')));
      return;
    }
    const sum = summariseClauses(labsOfClause, a, s, cls);
    const order = rescueOrder(sum).slice(0, 12);
    mount(root, h('header', { class: 'labhead' }, h('p', { class: 'eyebrow' }, 'Rescue plan'), h('h2', {}, 'Where to start'), h('p', { class: 'lead' }, 'Struggling topics come first, then topics you have not started. Each topic has five levels: Understand → Observe → Guided practice → Error correction → Independent mastery.')),
      order.length === 0 ? h('p', { class: 'empty' }, 'Every topic is at the top level. Nothing to rescue!') : h('div', { class: 'cards' }, ...order.map(id => { const r = sum.find(x => x.clause === id)!; return h('a', { class: 'card', href: `#/rescue/${id}` }, h('h3', {}, clauseById(id)?.title ?? id), h('p', {}, r.weak ? `Needs help — ${Math.round((r.accuracy ?? 0) * 100)}% on recent attempts` : r.level === 0 ? 'Not started' : `Level ${r.level}: ${LEVELS[r.level]}`), h('span', { class: `lvl l${r.level}` }, `Level ${r.level}`)); })));
    void CLAUSES;
  })();
  return root;
}
