import type { Profile } from './store';
/** App-wide, in-memory view of the saved profile. Persisted through store.setProfile. */
export const state: { profile: Profile } = { profile: { cls: 'XI', route: 'OPTION_I_ANALYSIS', name: '' } };
