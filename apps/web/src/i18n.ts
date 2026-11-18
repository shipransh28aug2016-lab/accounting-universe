import { h } from './dom';
import { HINDI_REVIEWED, t, type Key } from '../../../packages/curriculum/src/i18n';
import { state } from './state';

/** Look up a UI string in the language chosen in the header (English or Hindi). `{name}` placeholders come from `vars`. */
export const tr = (key: Key, vars?: Record<string, string | number>): string => t(state.lang, key, vars);

/**
 * Text that has no Hindi version yet (lab names, syllabus topics, explanations) inside a Hindi page.
 * It is marked lang="en" so a screen reader pronounces it correctly and the "no English left in the page chrome" test can tell it apart.
 */
export const en = (text: string): HTMLElement | string => (state.lang === 'hi' ? h('span', { lang: 'en' }, text) : text);

/** Pages whose own text is fully available in Hindi. Every other page is shown in English with a notice (see main.ts). */
export const HINDI_PAGES: ReadonlySet<string> = new Set(['home', 'class', 'labs', 'practice', 'crisis']);

/** The one "Hindi is a draft" notice for the whole app (decision D10: a qualified reviewer must sign the Hindi off before it goes). */
export function hindiBanner(): HTMLElement {
  return h(
    'div',
    { class: 'draft-banner', role: 'note', 'data-hindi-draft': HINDI_REVIEWED ? 'reviewed' : 'draft', hidden: true },
    h('b', { lang: 'hi' }, t('hi', 'draft.title')),
    h('span', { lang: 'en' }, t('en', 'draft.body')),
  );
}
