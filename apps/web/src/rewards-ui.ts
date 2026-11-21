import { BADGES, DAILY_GOAL_XP, LEVELS, clauseById, computeRewards, rewardDelta, summariseClauses, type Attempt, type ClassLevel, type RewardInput, type Rewards, type Seen } from '../../../packages/curriculum/src';
import { h, mount, reducedMotion, svg } from './dom';
import { icon } from './icons';
import { labsOfClause } from './labs';
import { attempts, seen } from './store';
import { announce } from './ui';

const tz = () => -new Date().getTimezoneOffset();
export async function currentRewards(): Promise<{ r: Rewards; a: Attempt[]; s: Seen[] }> {
  const [a, s] = await Promise.all([attempts(), seen()]);
  const mastered = summariseClauses(labsOfClause, a, s).filter(c => c.level === 5).length;
  return { r: computeRewards({ attempts: a, seen: s, now: Date.now(), tzOffsetMin: tz(), masteredClauses: mastered }), a, s };
}

// ── header HUD: level, XP bar, streak. Always visible, links to the quest board ──
const hud = h('a', { class: 'hud', href: '#/progress', title: 'Your level and streak' });
export const hudElement = () => hud;
export async function drawHud() {
  const { r } = await currentRewards(), L = r.level;
  hud.setAttribute('data-level', String(L.level)); hud.setAttribute('data-xp', String(r.xp)); hud.setAttribute('data-streak', String(r.streak));
  hud.setAttribute('title', `Lv ${L.level}, ${r.xp} XP, ${r.streak} day streak, ${L.title}`);
  mount(hud, h('span', { class: 'hud-lv' }, `Lv ${L.level}`), h('span', { class: 'hud-bar', 'aria-hidden': 'true' }, h('i', { style: `width:${Math.floor((100 * L.into) / L.span)}%` })), h('span', { class: 'hud-xp' }, `${r.xp} XP`), h('span', { class: 'hud-streak' + (r.streak ? ' on' : '') }, icon('flame', 14), String(r.streak)));
}

// ── celebration: toast + confetti, triggered by every recorded attempt ──
function confetti(n: number) {
  if (reducedMotion()) return;
  const layer = h('div', { class: 'confetti', 'aria-hidden': 'true' });
  const colors = ['#f2c14e', '#1b8a8f', '#e4572e', '#14633a', '#7a4fd1'];
  for (let i = 0; i < n; i++) layer.appendChild(h('i', { style: `left:${(i * 37) % 100}%;background:${colors[i % colors.length]};animation-delay:${(i % 8) * 60}ms;--dx:${((i * 53) % 120) - 60}px` }));
  document.body.appendChild(layer); setTimeout(() => layer.remove(), 1800);
}
let toastBox: HTMLElement | null = null;
function toast(lines: (Node | string)[], cls: string) {
  if (!toastBox) { toastBox = h('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' }); document.body.appendChild(toastBox); }
  const t = h('div', { class: 'toast ' + cls }, ...lines); toastBox.appendChild(t); setTimeout(() => t.remove(), 4200);
}
export function initRewards() {
  void drawHud();
  window.addEventListener('au:attempt', e => {
    const { before, a } = (e as CustomEvent<{ before: { attempts: Attempt[]; seen: Seen[] }; a: Attempt }>).detail;
    const input: RewardInput = { ...before, now: a.t, tzOffsetMin: tz() }, d = rewardDelta(input, a);
    if (d.xp > 0) toast([h('b', {}, `+${d.xp} XP`), d.comeback ? ' · Comeback bonus! You fixed it.' : a.marks === a.outOf ? ' · Perfect.' : ' · Keep going.'], 'xp');
    if (d.goalJustMet) { toast([`Daily goal reached (${DAILY_GOAL_XP} XP)`], 'goal'); confetti(24); }
    if (d.levelUp) { toast([h('b', {}, `Level ${d.levelUp.level}`), ` · ${d.levelUp.title}`], 'level'); confetti(40); announce(`Level up! You are now level ${d.levelUp.level}`); }
    for (const b of d.newBadges) { toast([`${b.icon} Badge: `, h('b', {}, b.title)], 'badge'); confetti(30); }
    void drawHud();
  });
}

// ── quest board (Progress page): level ring, streak, 14-day heat strip, badge shelf, mastery map ──
function ring(pct: number, label: string, sub: string): SVGElement {
  const R = 44, C = 2 * Math.PI * R;
  return svg('svg', { viewBox: '0 0 110 110', class: 'ring', role: 'img', 'aria-label': `${label}, ${pct}% to next level` },
    svg('circle', { cx: 55, cy: 55, r: R, class: 'ring-bg' }), svg('circle', { cx: 55, cy: 55, r: R, class: 'ring-fg', 'stroke-dasharray': `${(C * pct) / 100} ${C}`, transform: 'rotate(-90 55 55)' }),
    svg('text', { x: 55, y: 55, class: 'ring-n', 'text-anchor': 'middle' }, label), svg('text', { x: 55, y: 72, class: 'ring-s', 'text-anchor': 'middle' }, sub));
}
const shade = (xp: number) => (xp === 0 ? 0 : xp < 15 ? 1 : xp < DAILY_GOAL_XP ? 2 : xp < 2 * DAILY_GOAL_XP ? 3 : 4);

export function questBoard(r: Rewards, a: readonly Attempt[], s: readonly Seen[], cls: ClassLevel): HTMLElement {
  const L = r.level, pct = Math.floor((100 * L.into) / L.span), left = L.span - L.into;
  const goalPct = Math.min(100, Math.floor((100 * r.today) / DAILY_GOAL_XP));
  const sum = summariseClauses(labsOfClause, [...a], [...s], cls);
  return h('section', { class: 'panel quest', 'data-quest': '', 'aria-labelledby': 'quest-h' },
    h('h3', { id: 'quest-h' }, 'Quest board'),
    h('div', { class: 'quest-top' },
      h('div', { class: 'quest-lv' }, ring(pct, `Lv ${L.level}`, L.title), h('p', { class: 'note' }, `${left} XP to level ${L.level + 1}`)),
      h('div', { class: 'quest-stats' },
        h('p', { class: 'stat' }, h('b', {}, icon('flame', 16), ` ${r.streak}`), ` day streak · best ${r.bestStreak}`),
        h('p', { class: 'stat' }, h('b', {}, `${r.xp} XP`), ' total'),
        h('div', { class: 'goal' }, h('span', {}, r.goalMet ? 'Daily goal done' : `Daily goal: ${r.today} / ${DAILY_GOAL_XP} XP`), h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': goalPct }, h('i', { style: `width:${goalPct}%` }))),
        h('p', { class: 'hint' }, 'XP rewards correct answers, fewer hints, harder modes and fixing a mistake. Time on the page earns nothing.'))),
    h('h4', {}, 'Last 14 days'), h('div', { class: 'heat', role: 'img', 'aria-label': `XP per day, last 14 days: ${r.days.map(d => d.xp).join(', ')}` }, ...r.days.map(d => h('span', { class: `heat-c h${shade(d.xp)}`, title: `${d.day}: ${d.xp} XP` }))),
    h('h4', {}, `Badges · ${r.badges.length} of ${BADGES.length}`), h('ul', { class: 'badges' }, ...BADGES.map(b => { const on = r.badges.includes(b.id); return h('li', { class: 'badge' + (on ? ' on' : ''), 'data-badge': b.id, 'data-earned': String(on), title: b.how }, h('span', { class: 'bi', 'aria-hidden': 'true' }, on ? b.icon : icon('lock', 20)), h('b', {}, b.title), h('small', {}, on ? 'Earned' : b.how)); })),
    h('h4', {}, `Mastery map · Class ${cls}`), h('div', { class: 'mmap', role: 'list' }, ...sum.map(c => h('a', { role: 'listitem', class: `mcell l${c.level}${c.weak ? ' weak' : ''}`, href: `#/rescue`, 'data-level': String(c.level), title: `${clauseById(c.clause)?.title ?? c.clause}: ${LEVELS[c.level]}${c.weak ? ' (needs attention)' : ''}` }, String(c.level)))),
    h('p', { class: 'hint' }, 'Each tile is one syllabus topic, from 0 (not started) to 5 (independent mastery). Hover a tile for its name; red-edged tiles need attention.'));
}
