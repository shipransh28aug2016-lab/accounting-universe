import type { Profile } from './store';
/** App-wide, in-memory view of the saved profile and UI language. Persisted through store.setProfile. */
export const state: { profile: Profile; lang: 'en' | 'hi' } = { profile: { cls: 'XI', route: 'OPTION_I_ANALYSIS', name: '' }, lang: 'en' };
