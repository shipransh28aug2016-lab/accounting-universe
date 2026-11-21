/**
 * The single source of truth for navigation. Pure (no DOM): the router renders from it, the header highlights from it,
 * tests and docs read it. Adding a page = one row here + one factory in main.ts.
 */
export type RouteId = 'home' | 'class' | 'labs' | 'lab' | 'ledger' | 'practice' | 'cards' | 'trainer' | 'crisis' | 'cas' | 'project' | 'rescue' | 'assignment' | 'tutor' | 'progress' | 'teacher' | 'notes' | 'notfound';
export type NavKey = 'Home' | 'Class XI' | 'Class XII' | 'Visual labs' | 'Practice' | 'Help' | 'Notes' | 'My progress' | 'Teacher dashboard';
export const NAV: readonly { key: NavKey; hash: string }[] = [
  { key: 'Home', hash: '#/' }, { key: 'Class XI', hash: '#/class/XI' }, { key: 'Class XII', hash: '#/class/XII' }, { key: 'Visual labs', hash: '#/labs' },
  { key: 'Practice', hash: '#/practice' }, { key: 'Notes', hash: '#/notes' }, { key: 'Help', hash: '#/tutor' }, { key: 'My progress', hash: '#/progress' }, { key: 'Teacher dashboard', hash: '#/teacher' },
];
/** first path segment → route + the nav item it lives under. `valid` checks the remaining segments structurally. */
const ROUTES: readonly { head: string; id: RouteId; nav: NavKey; valid?: (rest: string[]) => boolean }[] = [
  { head: 'class', id: 'class', nav: 'Class XI', valid: r => r[0] === 'XI' || r[0] === 'XII' },
  { head: 'labs', id: 'labs', nav: 'Visual labs' }, { head: 'lab', id: 'lab', nav: 'Visual labs', valid: r => !!r[0] }, { head: 'ledger', id: 'ledger', nav: 'Visual labs' },
  { head: 'trainer', id: 'trainer', nav: 'Visual labs' }, { head: 'crisis', id: 'crisis', nav: 'Visual labs' }, { head: 'cas', id: 'cas', nav: 'Visual labs' }, { head: 'cards', id: 'cards', nav: 'Visual labs' }, { head: 'project', id: 'project', nav: 'Visual labs' },
  { head: 'practice', id: 'practice', nav: 'Practice' }, { head: 'assignment', id: 'assignment', nav: 'Practice', valid: r => !!r[0] }, { head: 'rescue', id: 'rescue', nav: 'Practice' },
  { head: 'tutor', id: 'tutor', nav: 'Help' }, { head: 'progress', id: 'progress', nav: 'My progress' }, { head: 'teacher', id: 'teacher', nav: 'Teacher dashboard' }, { head: 'notes', id: 'notes', nav: 'Notes' },
];
export interface Resolved { id: RouteId; nav: NavKey | null; rest: string[] }
export function resolve(path: readonly string[]): Resolved {
  if (path.length === 0) return { id: 'home', nav: 'Home', rest: [] };
  const r = ROUTES.find(x => x.head === path[0]);
  if (!r) return { id: 'notfound', nav: null, rest: [...path] };
  const rest = path.slice(1);
  // the header highlight follows the first segment (and the class for /class/XI vs /class/XII), even when the page itself is "not found"
  const nav: NavKey = r.id === 'class' ? (rest[0] === 'XII' ? 'Class XII' : 'Class XI') : r.nav;
  const okClass = r.id !== 'class' || r.valid!(rest);
  return { id: r.valid && !r.valid(rest) ? 'notfound' : r.id, nav: r.id === 'class' && !okClass ? null : nav, rest };
}
export const hashFor = (...segments: string[]) => '#/' + segments.map(encodeURIComponent).join('/');
