import { h, svg } from './dom';
import type { Block } from './spec';
import type { Illustration } from '../../../packages/engine/src';

const rs = (n: number) => n; // geometry passthrough, kept for readability

function journalTable(e: Illustration, idx?: number): HTMLElement {
  const dr = e.lines.filter(l => l.side === 'DR'), cr = e.lines.filter(l => l.side === 'CR');
  return h('table', { class: 'journal' },
    h('caption', {}, idx !== undefined ? `Entry ${idx + 1}` : 'Journal entry'),
    h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, 'Particulars'), h('th', { scope: 'col', class: 'num' }, 'Debit (₹)'), h('th', { scope: 'col', class: 'num' }, 'Credit (₹)'))),
    h('tbody', {},
      ...dr.map(l => h('tr', {}, h('td', {}, `${l.account}`, h('span', { class: 'tag' }, 'Dr.')), h('td', { class: 'num' }, l.amount.format()), h('td', {}))),
      ...cr.map(l => h('tr', {}, h('td', { class: 'indent' }, `To ${l.account}`), h('td', {}), h('td', { class: 'num' }, l.amount.format()))),
      h('tr', { class: 'narr' }, h('td', { colspan: 3 }, `(${e.narration})`)),
    ),
  );
}

function bars(b: Extract<Block, { kind: 'bars' }>): HTMLElement {
  const max = Math.max(1, ...b.items.map(i => Math.abs(i.value)));
  const W = 560, rowH = 30, L = 170, R = 150, H = b.items.length * rowH + 8;
  const g = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `${b.title}: ${b.items.map(i => `${i.label} ${i.text}`).join('; ')}`, class: 'chart' });
  b.items.forEach((i, k) => {
    const y = k * rowH + 4, w = Math.max(2, (Math.abs(i.value) / max) * (W - L - R));
    g.appendChild(svg('text', { x: L - 8, y: y + 16, 'text-anchor': 'end', class: 'lbl' }, i.label));
    g.appendChild(svg('rect', { x: L, y, width: rs(w), height: 20, rx: 3, class: `bar ${i.tone ?? 'a'}${i.value < 0 ? ' neg' : ''}` }));
    g.appendChild(svg('text', { x: L + w + 8, y: y + 16, class: 'val' }, i.text));
  });
  return h('figure', { class: 'figure' }, h('figcaption', {}, b.title), g as unknown as Node);
}

function ratioChart(b: Extract<Block, { kind: 'ratio' }>): HTMLElement {
  const W = 560, L = 90, rowH = 38, H = b.rows.length * rowH + 4;
  const g = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `${b.title}: ${b.rows.map(r => `${r.label}: ${r.segments.map(s => `${s.name} ${s.text}`).join(', ')}`).join('; ')}`, class: 'chart' });
  b.rows.forEach((r, k) => {
    const y = k * rowH + 4; let x = L;
    g.appendChild(svg('text', { x: L - 8, y: y + 20, 'text-anchor': 'end', class: 'lbl' }, r.label));
    r.segments.forEach((s, i) => {
      const w = Math.max(0, s.value) * (W - L - 8);
      g.appendChild(svg('rect', { x, y, width: rs(w), height: 26, class: `seg s${i % 5}` }));
      if (w > 34) g.appendChild(svg('text', { x: x + w / 2, y: y + 18, 'text-anchor': 'middle', class: 'seglbl' }, s.name));
      x += w;
    });
  });
  const legend = b.rows[0]?.segments ?? [];
  return h('figure', { class: 'figure' }, h('figcaption', {}, b.title), g as unknown as Node,
    h('ul', { class: 'legend' }, ...legend.map((s, i) => h('li', {}, h('span', { class: `swatch s${i % 5}` }), s.name))),
    h('table', { class: 'mini' }, h('thead', {}, h('tr', {}, h('th', {}, ''), ...legend.map(s => h('th', { scope: 'col' }, s.name)))),
      h('tbody', {}, ...b.rows.map(r => h('tr', {}, h('th', { scope: 'row' }, r.label), ...r.segments.map(s => h('td', {}, s.text)))))));
}

function equation(b: Extract<Block, { kind: 'equation' }>): HTMLElement {
  const total = (xs: { value: number }[]) => xs.reduce((a, x) => a + Math.max(0, x.value), 0);
  if (total(b.assets) === 0 && total(b.rhs) === 0) return h('p', { class: 'eqempty' }, 'Nothing posted yet — assets and capital are both ₹0.');
  const max = Math.max(1, total(b.assets), total(b.rhs));
  const col = (title: string, xs: { label: string; value: number; text: string }[]) => {
    const t = total(xs);
    return h('div', { class: 'eqcol' }, h('h4', {}, title),
      // the tank shows the COMPOSITION of this side: one coloured segment per item, sized by its share
      h('div', { class: 'tank', role: 'img', 'aria-label': `${title}: ${xs.map(x => `${x.label} ${x.text}`).join(', ')}`, style: 'height:180px' },
        ...xs.filter(x => x.value > 0).map((x, i) => h('div', { class: `tankseg s${i % 5}`, style: `height:${Math.round((x.value / Math.max(1, t)) * (t / max) * 1000) / 10}%` }))),
      h('ul', { class: 'eqlist' }, ...xs.map((x, i) => h('li', {}, h('span', {}, h('span', { class: `swatch s${i % 5}`, 'aria-hidden': 'true' }), x.label), h('b', {}, x.text)))));
  };
  return h('figure', { class: 'figure equation', role: 'group', 'aria-label': b.balanced ? 'Assets equal capital plus liabilities' : 'Assets do not equal capital plus liabilities' },
    col('Assets', b.assets), h('div', { class: 'eqsign' + (b.balanced ? ' ok' : ' bad'), 'aria-hidden': 'true' }, b.balanced ? '=' : '≠'), col('Capital + Liabilities', b.rhs));
}

function streams(b: Extract<Block, { kind: 'streams' }>): HTMLElement {
  const max = Math.max(1, ...b.items.map(i => Math.abs(i.value)));
  return h('figure', { class: 'figure streams' }, ...b.items.map(i =>
    h('div', { class: 'stream' }, h('div', { class: 'streamname' }, i.label),
      h('div', { class: 'streambar' }, h('div', { class: 'streamfill ' + (i.value < 0 ? 'out' : 'in'), style: `width:${Math.max(3, Math.round((Math.abs(i.value) / max) * 100))}%` })),
      h('div', { class: 'streamval ' + (i.value < 0 ? 'out' : 'in') }, i.text, h('span', { class: 'dir' }, i.value < 0 ? ' used' : ' generated')))),
    h('div', { class: 'streamnet' }, b.net));
}

function lifecycle(b: Extract<Block, { kind: 'lifecycle' }>): HTMLElement {
  return h('ol', { class: 'lifecycle' }, ...b.stages.map((s, i) =>
    h('li', { class: s.state }, h('span', { class: 'dot', 'aria-hidden': 'true' }, i + 1), h('div', {}, h('b', {}, s.name), h('span', {}, s.detail)))));
}

export function renderBlock(b: Block): HTMLElement {
  switch (b.kind) {
    case 'heading': return h('h3', { class: 'blockhead' }, b.text);
    case 'note': return h('p', { class: 'note ' + (b.tone ?? 'info'), role: b.tone === 'bad' ? 'alert' : undefined }, b.text);
    case 'steps': return h('section', { class: 'steps' }, h('h4', {}, b.title), h('ol', {}, ...b.steps.map(s => h('li', {}, s))));
    case 'journal': return h('div', { class: 'journals' }, ...b.entries.map((e, i) => journalTable(e, b.entries.length > 1 ? i : undefined)));
    case 'table': {
      const num = new Set(b.numeric ?? []);
      return h('div', { class: 'tablewrap' }, h('table', { class: 'data' },
        b.caption ? h('caption', {}, b.caption) : null,
        h('thead', {}, h('tr', {}, ...b.head.map((c, i) => h('th', { scope: 'col', class: num.has(i) ? 'num' : '' }, c)))),
        h('tbody', {}, ...b.rows.map(r => h('tr', {}, ...r.map((c, i) => h(i === 0 ? 'th' : 'td', { ...(i === 0 ? { scope: 'row' } : {}), class: num.has(i) ? 'num' : '' }, c))))),
        b.foot ? h('tfoot', {}, h('tr', {}, ...b.foot.map((c, i) => h('td', { class: num.has(i) ? 'num' : '' }, c)))) : null));
    }
    case 'bars': return bars(b);
    case 'ratio': return ratioChart(b);
    case 'equation': return equation(b);
    case 'streams': return streams(b);
    case 'lifecycle': return lifecycle(b);
  }
}
export function renderBlocks(blocks: Block[]): HTMLElement { return h('div', { class: 'blocks' }, ...blocks.map(renderBlock)); }
export { journalTable };
