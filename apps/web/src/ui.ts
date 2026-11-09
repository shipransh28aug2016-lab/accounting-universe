import { h } from './dom';
let live: HTMLElement | null = null;
/** Polite screen-reader announcement. */
export function announce(text: string) {
  if (!live) { live = h('div', { class: 'sr-only', 'aria-live': 'polite', role: 'status' }); document.body.appendChild(live); }
  live.textContent = ''; setTimeout(() => { if (live) live.textContent = text; }, 30);
}

/** Loading state shown while IndexedDB or a file is being read. */
export function loading(text = 'Loading…'): HTMLElement { return h('div', { class: 'loading', role: 'status' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), text); }
