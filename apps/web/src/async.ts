import { Machine } from '../../../packages/engine/src';
import { ASYNC_RESOURCE } from '../../../packages/curriculum/src';
import { h, mount } from './dom';
import { loading } from './ui';
import { onDispose, track, unregister } from './machine-dom';

/**
 * Load something asynchronously into `root` through the `async-resource` machine:
 * spinner → content, or an error with a Retry button (a spinner can never hang forever), and results that arrive after the
 * student has left the page are dropped. `reload()` refreshes in place without flashing a spinner.
 */
export function loadInto<T>(root: HTMLElement, loader: () => Promise<T>, view: (data: T) => void, what = 'this page'): { reload: () => void; machine: Machine<string, string> } {
  const m = new Machine(ASYNC_RESOURCE) as unknown as Machine<string, string>;
  track(root, m); onDispose(() => { m.send('DISPOSE'); unregister(m); });
  let ticket = 0;
  const run = (first: boolean) => {
    const my = ++ticket;
    if (first) mount(root, loading('Loading…'));
    loader().then(data => {
      if (my !== ticket || !m.send('RESOLVE').ok) return;          // stale or the page was left
      view(data);
    }, (err: unknown) => {
      if (my !== ticket || !m.send('REJECT').ok) return;
      mount(root, h('div', { class: 'panel', role: 'alert' }, h('h3', {}, `Could not load ${what}`), h('p', {}, err instanceof Error ? err.message : 'Something went wrong while reading your saved data.'), h('p', { class: 'hint' }, 'Your data on this device has not been changed.'),
        h('button', { type: 'button', class: 'primary', onclick: () => { if (m.send('RETRY').ok) run(true); } }, 'Try again')));
    });
  };
  m.send('LOAD'); run(true);
  return { reload: () => { if (m.send('RELOAD').ok) run(false); }, machine: m };
}
