import { h } from './dom';
let live: HTMLElement | null = null;
/** Polite screen-reader announcement. */
export function announce(text: string) {
  if (!live) { live = h('div', { class: 'sr-only', 'aria-live': 'polite', role: 'status' }); document.body.appendChild(live); }
  live.textContent = ''; setTimeout(() => { if (live) live.textContent = text; }, 30);
}
