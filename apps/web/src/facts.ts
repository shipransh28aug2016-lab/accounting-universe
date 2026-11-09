import type { Block } from './spec';
/** Flatten a lab's engine output into plain sentences. These are the ONLY facts the AI tutor receives — it explains them, it never recomputes. */
export function blocksToFacts(blocks: readonly Block[], maxLines = 60, maxLen = 300): string[] {
  const out: string[] = [];
  const add = (s: string) => { const t = s.replace(/\s+/g, ' ').trim(); if (t) out.push(t.slice(0, maxLen)); };
  for (const b of blocks) {
    switch (b.kind) {
      case 'heading': add(b.text); break;
      case 'note': add(b.text); break;
      case 'steps': add(b.title); b.steps.forEach(add); break;
      case 'table': if (b.caption) add(b.caption); for (const r of b.rows) add(r.map((c, i) => (b.head[i] && i > 0 ? `${b.head[i]}: ${c}` : c)).filter(Boolean).join(' | ')); if (b.foot) add(b.foot.filter(Boolean).join(' | ')); break;
      case 'journal': for (const e of b.entries) add(`${e.narration}: ` + e.lines.map(l => `${l.side === 'DR' ? 'Dr' : 'Cr'} ${l.account} ${l.amount.format()}`).join('; ')); break;
      case 'bars': add(b.title + ': ' + b.items.map(i => `${i.label} ${i.text}`).join('; ')); break;
      case 'ratio': add(b.title + ': ' + b.rows.map(r => `${r.label}: ${r.segments.map(s => `${s.name} ${s.text}`).join(', ')}`).join('; ')); break;
      case 'equation': add(`Assets: ${b.assets.map(a => `${a.label} ${a.text}`).join(', ')}. Capital and liabilities: ${b.rhs.map(a => `${a.label} ${a.text}`).join(', ')}. ${b.balanced ? 'Balanced.' : 'Not balanced.'}`); break;
      case 'streams': add(b.items.map(i => `${i.label} ${i.text}`).join('; ') + '. ' + b.net); break;
      case 'lifecycle': add(b.stages.map(s => `${s.name}: ${s.detail}`).join('; ')); break;
    }
  }
  return out.slice(0, maxLines);
}
