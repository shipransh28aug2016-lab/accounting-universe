import { LEVELS, clauseById, mistakeTally, nextSkill, SKILLS, summariseClauses } from '../../../../packages/curriculum/src';
import { h, mount } from '../dom';
import { attempts, exportAll, resetAll, seen, setProfile, storageMode } from '../store';
import { state } from '../state';
import { labsOfClause } from '../labs';
import { parseExport } from '../../../../packages/curriculum/src';
import { announce } from '../ui';

export function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: name }); document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function progressPage(): HTMLElement {
  const root = h('div', { class: 'progress' });
  async function draw() {
    const [a, s] = [await attempts(), await seen()];
    const cls = state.profile.cls;
    const sum = summariseClauses(labsOfClause, a, s, cls);
    const started = sum.filter(x => x.level > 0);
    const weak = sum.filter(x => x.weak);
    const tally = mistakeTally(a).slice(0, 5);
    const next = nextSkill(a, cls, state.profile.route);
    const nextTitle = SKILLS.find(x => x.skill === next)?.title ?? next;
    const name = h('input', { type: 'text', id: 'pname', value: state.profile.name, maxlength: 40, autocomplete: 'off', placeholder: 'Your name or roll no. (shown to your teacher only if you send them the file)' });
    const msg = h('p', { 'aria-live': 'polite', class: 'hint' });
    const fileIn = h('input', { type: 'file', accept: 'application/json,.json', 'aria-label': 'Import a progress file', hidden: true, onchange: async (e: Event) => {
      const f = (e.target as HTMLInputElement).files?.[0]; if (!f) return;
      try { const p = parseExport(JSON.parse(await f.text())); msg.textContent = p.ok ? `This file has ${p.value.attempts.length} attempts. Importing replaces nothing — to merge on a new device, use it on a fresh install.` : `Cannot import: ${p.reason}.`; } catch { msg.textContent = 'Cannot import: the file is not valid JSON.'; }
    } });
    mount(root,
      h('header', { class: 'labhead' }, h('p', { class: 'eyebrow' }, 'My progress'), h('h2', {}, `Class ${cls}`), h('p', { class: 'lead' }, `${a.length} practice attempts · ${started.length} of ${sum.length} topics started. Saved on this device only (${storageMode === 'indexeddb' ? 'IndexedDB' : 'memory — will be lost on close'}).`)),
      h('section', { class: 'panel' }, h('h3', {}, 'Next best step'), h('p', {}, `Practise: ${nextTitle}`), h('a', { class: 'button primary', href: `#/practice/${next}` }, 'Go →')),
      weak.length ? h('section', { class: 'panel' }, h('h3', {}, 'Needs attention'), h('ul', {}, ...weak.map(w => h('li', {}, `${clauseById(w.clause)?.title ?? w.clause} — ${Math.round((w.accuracy ?? 0) * 100)}% on recent attempts`)))) : null,
      tally.length ? h('section', { class: 'panel' }, h('h3', {}, 'Mistakes you repeat most'), h('ol', {}, ...tally.map(t => h('li', {}, `${t.mistake} (×${t.count})`)))) : null,
      h('section', { class: 'panel' }, h('h3', {}, 'The five levels, topic by topic'), h('p', { class: 'hint' }, 'Understand → Observe → Guided practice → Error correction → Independent mastery. Each level needs the one before it.'),
        h('div', { class: 'tablewrap' }, h('table', { class: 'data' }, h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Topic'), h('th', { scope: 'col' }, 'Level'), h('th', { scope: 'col', class: 'num' }, 'Recent accuracy'))),
          h('tbody', {}, ...sum.map(r => h('tr', {}, h('th', { scope: 'row' }, clauseById(r.clause)?.title ?? r.clause), h('td', {}, h('span', { class: `lvl l${r.level}` }, `${r.level} · ${LEVELS[r.level]}`)), h('td', { class: 'num' }, r.accuracy === null ? '—' : `${Math.round(r.accuracy * 100)}%`))))))),
      h('section', { class: 'panel' }, h('h3', {}, 'You and your data'),
        h('div', { class: 'field' }, h('label', { for: 'pname' }, 'Name'), name),
        h('div', { class: 'actions' },
          h('button', { type: 'button', onclick: () => { state.profile = { ...state.profile, name: name.value.trim() }; void setProfile(state.profile); announce('Name saved'); msg.textContent = 'Saved.'; } }, 'Save name'),
          h('button', { type: 'button', class: 'primary', onclick: async () => { download(`accounting-universe-${(state.profile.name || 'progress').replace(/[^\w-]+/g, '_')}.json`, JSON.stringify(await exportAll(), null, 2), 'application/json'); msg.textContent = 'Downloaded. Give this file to your teacher if they ask for it.'; } }, '⬇ Export my progress'),
          h('button', { type: 'button', onclick: () => fileIn.click() }, '⬆ Check a progress file'), fileIn,
          h('button', { type: 'button', class: 'danger', onclick: async () => { if (confirm('Delete ALL your progress on this device? This cannot be undone.')) { await resetAll(); announce('Progress deleted'); void draw(); } } }, 'Delete my progress')), msg));
  }
  void draw();
  return root;
}
