/**
 * The single source of truth for navigation. Pure (no DOM): the router renders from it, the header highlights from it,
 * tests and docs read it. Adding a page = one row here + one factory in main.ts.
 */
export type RouteId = 'home' | 'class' | 'labs' | 'lab' | 'ledger' | 'practice' | 'cards' | 'trainer' | 'cas' | 'project' | 'rescue' | 'assignment' | 'tutor' | 'progress' | 'teacher' | 'notfound';
export type NavKey = 'HOME' | 'CLASS XI' | 'CLASS XII' | 'VISUAL LABS' | 'PRACTICE' | 'AI TUTOR' | 'MY PROGRESS' | 'TEACHER DASHBOARD';
export const NAV: readonly { key: NavKey; hash: string }[] = [
  { key: 'HOME', hash: '#/' }, { key: 'CLASS XI', hash: '#/class/XI' }, { key: 'CLASS XII', hash: '#/class/XII' }, { key: 'VISUAL LABS', hash: '#/labs' },
  { key: 'PRACTICE', hash: '#/practice' }, { key: 'AI TUTOR', hash: '#/tutor' }, { key: 'MY PROGRESS', hash: '#/progress' }, { key: 'TEACHER DASHBOARD', hash: '#/teacher' },
];
/** first path segment → route + the nav item it lives under. `valid` checks the remaining segments structurally. */
const ROUTES: readonly { head: string; id: RouteId; nav: NavKey; valid?: (rest: string[]) => boolean }[] = [
  { head: 'class', id: 'class', nav: 'CLASS XI', valid: r => r[0] === 'XI' || r[0] === 'XII' },
  { head: 'labs', id: 'labs', nav: 'VISUAL LABS' }, { head: 'lab', id: 'lab', nav: 'VISUAL LABS', valid: r => !!r[0] }, { head: 'ledger', id: 'ledger', nav: 'VISUAL LABS' },
  { head: 'trainer', id: 'trainer', nav: 'VISUAL LABS' }, { head: 'cas', id: 'cas', nav: 'VISUAL LABS' }, { head: 'cards', id: 'cards', nav: 'VISUAL LABS' }, { head: 'project', id: 'project', nav: 'VISUAL LABS' },
  { head: 'practice', id: 'practice', nav: 'PRACTICE' }, { head: 'assignment', id: 'assignment', nav: 'PRACTICE', valid: r => !!r[0] }, { head: 'rescue', id: 'rescue', nav: 'PRACTICE' },
  { head: 'tutor', id: 'tutor', nav: 'AI TUTOR' }, { head: 'progress', id: 'progress', nav: 'MY PROGRESS' }, { head: 'teacher', id: 'teacher', nav: 'TEACHER DASHBOARD' },
];
export interface Resolved { id: RouteId; nav: NavKey | null; rest: string[] }
export function resolve(path: readonly string[]): Resolved {
  if (path.length === 0) return { id: 'home', nav: 'HOME', rest: [] };
  const r = ROUTES.find(x => x.head === path[0]);
  if (!r) return { id: 'notfound', nav: null, rest: [...path] };
  const rest = path.slice(1);
  // the header highlight follows the first segment (and the class for /class/XI vs /class/XII), even when the page itself is "not found"
  const nav: NavKey = r.id === 'class' ? (rest[0] === 'XII' ? 'CLASS XII' : 'CLASS XI') : r.nav;
  const okClass = r.id !== 'class' || r.valid!(rest);
  return { id: r.valid && !r.valid(rest) ? 'notfound' : r.id, nav: r.id === 'class' && !okClass ? null : nav, rest };
}
export const hashFor = (...segments: string[]) => '#/' + segments.map(encodeURIComponent).join('/');
