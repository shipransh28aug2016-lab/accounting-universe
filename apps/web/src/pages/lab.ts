import { clauseById } from '../../../../packages/curriculum/src';
import { h, mount } from '../dom';
import { renderBlocks } from '../render';
import { InputError, type Field, type Lab } from '../spec';
import { recordSeen } from '../store';

type Tab = 'learn' | 'example' | 'try';
const TABS: { id: Tab; label: string }[] = [{ id: 'learn', label: '1 · Learn' }, { id: 'example', label: '2 · Worked example' }, { id: 'try', label: '3 · Try it' }];

/** Run a lab; turns an InputError into a message the student can act on, and anything else into an honest failure notice. */
export function runLab(lab: Lab, values: Record<string, string>): { node: HTMLElement; error?: { message: string; field?: string } } {
  try { return { node: renderBlocks(lab.compute(values)) }; }
  catch (e) {
    if (e instanceof InputError) return { node: h('p', { class: 'note bad', role: 'alert' }, e.message), error: { message: e.message, ...(e.field ? { field: e.field } : {}) } };
    // Engine refusals (e.g. a rule of the syllabus) are also explained rather than crashing the page.
    const msg = e instanceof Error ? e.message : String(e);
    return { node: h('p', { class: 'note bad', role: 'alert' }, `The engine could not work this out: ${msg}`), error: { message: msg } };
  }
}

function fieldInput(f: Field, value: string, onInput: () => void): HTMLElement {
  const id = `f-${f.id}`;
  const common = { id, name: f.id, 'aria-describedby': f.help ? `${id}-help` : undefined };
  let control: HTMLElement;
  if (f.type === 'textarea') control = h('textarea', { ...common, rows: 4, oninput: onInput }, value);
  else if (f.type === 'select') control = h('select', { ...common, onchange: onInput }, ...(f.options ?? []).map(o => h('option', { value: o.value, ...(o.value === value ? { selected: true } : {}) }, o.label)));
  else control = h('input', { ...common, type: 'text', value, inputmode: f.type === 'money' ? 'decimal' : f.type === 'int' || f.type === 'percent' ? 'numeric' : 'text', autocomplete: 'off', oninput: onInput });
  return h('div', { class: 'field' }, h('label', { for: id }, f.label), control, f.help ? h('small', { id: `${id}-help` }, f.help) : null);
}

export function labPage(lab: Lab, startTab: Tab = 'learn'): HTMLElement {
  const panel = h('div', { class: 'tabpanel', id: 'labpanel', role: 'tabpanel', tabindex: 0 });
  const values: Record<string, string> = { ...lab.example };
  const tabBtns = new Map<Tab, HTMLElement>();
  let current: Tab = startTab;

  const clauseNotes = lab.clauses.map(id => clauseById(id)).filter(Boolean).map(c => h('li', {}, h('span', { class: 'cid' }, c!.id), ' ', c!.title, c!.limit ? h('em', { class: 'limit' }, ` — Syllabus limit: ${c!.limit}`) : null));

  function learn() {
    return h('div', { class: 'prose' },
      h('h3', {}, 'The idea'), ...lab.concept.map(p => h('p', {}, p)),
      h('h3', {}, 'Where you see it in real life'), h('p', {}, lab.realWorld),
      h('h3', {}, 'Syllabus clauses covered'), h('ul', { class: 'clauses' }, ...clauseNotes),
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'primary', onclick: () => select('example') }, 'See a worked example →')));
  }
  function example() {
    const res = runLab(lab, lab.example);
    return h('div', {},
      h('h3', {}, 'The question'),
      h('table', { class: 'data inputs' }, h('tbody', {}, ...lab.fields.map(f => h('tr', {}, h('th', { scope: 'row' }, f.label), h('td', {}, lab.example[f.id] ?? ''))))),
      h('h3', {}, 'Step by step'), h('ol', { class: 'walk' }, ...lab.walkthrough.map(s => h('li', {}, s))),
      h('h3', {}, 'The result'), res.node,
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'primary', onclick: () => select('try') }, 'Now try your own numbers →')));
  }
  function tryIt() {
    const out = h('div', { class: 'result', 'aria-live': 'polite' });
    const run = () => {
      for (const el of Array.from(form.querySelectorAll('[aria-invalid]'))) el.removeAttribute('aria-invalid');
      const r = runLab(lab, values);
      mount(out, r.node);
      if (r.error?.field) { const el = form.querySelector(`#f-${r.error.field}`); el?.setAttribute('aria-invalid', 'true'); }
    };
    const fields: HTMLElement[] = [];
    let group: string | undefined;
    for (const f of lab.fields) {
      if (f.group && f.group !== group) { group = f.group; fields.push(h('h4', { class: 'fgroup' }, f.group)); }
      fields.push(fieldInput(f, values[f.id] ?? '', () => { const el = form.querySelector(`#f-${f.id}`) as HTMLInputElement; values[f.id] = el.value; }));
    }
    const form = h('form', { class: 'labform', onsubmit: (e: Event) => { e.preventDefault(); run(); } },
      h('div', { class: 'fieldgrid' }, ...fields),
      h('div', { class: 'actions' }, h('button', { type: 'submit', class: 'primary' }, 'Work it out'),
        h('button', { type: 'button', onclick: () => { for (const f of lab.fields) values[f.id] = lab.example[f.id] ?? ''; mount(panel, tryIt()); } }, 'Reset to example'),
        h('button', { type: 'button', onclick: () => { for (const f of lab.fields) values[f.id] = ''; mount(panel, tryIt()); } }, 'Clear all')));
    const wrap = h('div', {}, h('p', { class: 'hint' }, 'Change any number and press “Work it out”. Money can be typed as 125000 or 1,25,000. Nothing you type leaves your device.'), form, out);
    queueMicrotask(run);
    return wrap;
  }
  function select(t: Tab) {
    current = t;
    for (const [id, b] of tabBtns) { b.setAttribute('aria-selected', String(id === t)); b.tabIndex = id === t ? 0 : -1; }
    mount(panel, t === 'learn' ? learn() : t === 'example' ? example() : tryIt());
    panel.setAttribute('aria-labelledby', `tab-${t}`);
    void recordSeen({ lab: lab.id, tab: t, t: Date.now() });
  }
  const tablist = h('div', { class: 'tabs', role: 'tablist', 'aria-label': `${lab.title} sections` },
    ...TABS.map((t, i) => {
      const b = h('button', { type: 'button', role: 'tab', id: `tab-${t.id}`, 'aria-controls': 'labpanel', 'aria-selected': 'false', onclick: () => select(t.id),
        onkeydown: ((e: KeyboardEvent) => { if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const n = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length]!; select(n.id); tabBtns.get(n.id)!.focus(); } }) as EventListener }, t.label);
      tabBtns.set(t.id, b); return b;
    }));
  const root = h('article', { class: 'labpage' },
    h('header', { class: 'labhead' }, h('p', { class: 'eyebrow' }, `Class ${lab.cls}`), h('h2', {}, lab.title), h('p', { class: 'lead' }, lab.summary)),
    tablist, panel,
    lab.skills.length ? h('p', { class: 'after' }, 'Ready to test yourself? ', h('a', { href: `#/practice/${lab.skills[0]}` }, 'Practise this topic →')) : null);
  select(current);
  void current;
  return root;
}
