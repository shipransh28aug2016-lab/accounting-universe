import { Machine, Money } from '../../../../packages/engine/src';
import {
  CRISIS_KINDS,
  CRISIS_LIVES,
  KIND_LABEL,
  SPEED_BONUS_SECONDS,
  SPEED_BONUS_XP,
  SUSPENSE,
  TB_CRISIS,
  crisisBadges,
  makeCrisis,
  stepXp,
  totalsAfter,
  type Bilingual,
  type Crisis,
  type CrisisEvent,
  type CrisisKind,
  type CrisisState,
  type CrisisStep,
} from '../../../../packages/curriculum/src';
import { t, type Key } from '../../../../packages/curriculum/src/i18n';
import { mountBalanceScale, type BalanceHandle } from '../experience/balanceScale';
import { h, mount } from '../dom';
import { icon } from '../icons';
import { onDispose, track, unregister } from '../machine-dom';
import { state } from '../state';
import { recordAttempt, recordSeen } from '../store';
import { announce } from '../ui';

/** XP, streak of solved crises and badges live on this device only (same rule as all progress data). */
interface Saved {
  xp: number;
  row: number;
  badges: string[];
}
const KEY = 'au-crisis';
const load = (): Saved => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (v && typeof v.xp === 'number' && typeof v.row === 'number' && Array.isArray(v.badges)) return v;
  } catch {
    /* blocked or corrupt */
  }
  return { xp: 0, row: 0, badges: [] };
};
const save = (s: Saved) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* storage may be blocked */
  }
};
/** Does what the student typed equal the expected amount? (exact Money comparison; anything unparseable is simply wrong) */
function sameMoney(typed: string, want: string): boolean {
  try {
    return Money.parse(typed.replace(/[₹,\s]/g, '')).equals(Money.parse(want));
  } catch {
    return false;
  }
}
const STEPS: readonly CrisisStep[] = ['DIAGNOSE', 'LOCATE', 'CLASSIFY', 'RECTIFY', 'WHAT_IF'];

export function crisisPage(seedArg?: string): HTMLElement {
  const root = h('div', { class: 'crisis' });
  const hi = state.lang === 'hi',
    L = hi ? ('hi' as const) : ('en' as const);
  const T = (k: Key, vars?: Record<string, string | number>) => t(L, k, vars);
  const B = (b: Bilingual) => (hi ? b.hi : b.en);
  const fmt = (s: string) => Money.parse(s).format();
  let seed = seedArg && /^\d{1,9}$/.test(seedArg) ? Number(seedArg) : 1 + Math.floor(Math.random() * 999_999);
  void recordSeen({ lab: 'xi-crisis', tab: 'try', t: Date.now() });

  let c: Crisis, m: Machine<CrisisState, CrisisEvent, { lives: number }> | undefined, untrack: (() => void) | undefined;
  let xp = 0,
    streak = 0,
    livesLost = 0,
    started = 0,
    seconds = 0,
    timer = 0,
    speedBonus = false;
  let firstTry: Record<CrisisStep, boolean>, right: Record<CrisisStep, boolean>, mistakes: string[], opened: string | null, feedback: HTMLElement | null, pop: number | null;
  let scale: BalanceHandle | null = null;
  const scaleWrap = h('div', { class: 'balance-3d-wrap crisis-scale', 'aria-hidden': 'true' }),
    scaleText = h('p', { class: 'status crisis-scale-text', role: 'status' });
  const body = h('div', {});
  const stopTimer = () => {
    if (timer) {
      window.clearInterval(timer);
      timer = 0;
    }
  };
  onDispose(() => {
    stopTimer();
    scale?.dispose();
    if (m) unregister(m);
    untrack?.();
  });

  const accName = (id: string) =>
    id === SUSPENSE
      ? T('crisis.suspense')
      : (() => {
          const a = c.accounts.find(x => x.id === id)!;
          return hi ? a.nameHi : a.name;
        })();
  const sideWord = (s: 'DR' | 'CR') => T(s === 'DR' ? 'crisis.side.dr' : 'crisis.side.cr');

  function start(newSeed: number) {
    seed = newSeed;
    c = makeCrisis(seed);
    stopTimer();
    if (m) unregister(m);
    untrack?.();
    m = new Machine(TB_CRISIS, { lives: CRISIS_LIVES });
    untrack = track(root, m);
    xp = 0;
    streak = 0;
    livesLost = 0;
    seconds = 0;
    speedBonus = false;
    mistakes = [];
    opened = null;
    feedback = null;
    pop = null;
    started = Date.now();
    firstTry = { DIAGNOSE: true, LOCATE: true, CLASSIFY: true, RECTIFY: true, WHAT_IF: true };
    right = { DIAGNOSE: false, LOCATE: false, CLASSIFY: false, RECTIFY: false, WHAT_IF: false };
    timer = window.setInterval(() => {
      seconds = Math.floor((Date.now() - started) / 1000);
      const el = root.querySelector('[data-hud="time"]');
      if (el) el.textContent = clock();
    }, 1000);
    root.setAttribute('data-seed', String(seed));
    draw();
  }
  const clock = () => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  /** A step answered correctly: XP (with streak), pop-up, next state. */
  function win(step: CrisisStep, event: CrisisEvent, note: HTMLElement) {
    const gained = stepXp(step, firstTry[step], streak);
    xp += gained;
    pop = gained;
    right[step] = true;
    streak = firstTry[step] ? streak + 1 : 0;
    feedback = note;
    m!.send(event);
    announce(`+${gained} XP`);
    draw();
  }
  /** A wrong answer: streak is lost; in LOCATE and RECTIFY a life is lost too. */
  function lose(step: CrisisStep, note: HTMLElement, mistake: string) {
    firstTry[step] = false;
    streak = 0;
    pop = null;
    mistakes.push(mistake);
    if (step === 'LOCATE' || step === 'RECTIFY') {
      m!.ctx.lives--;
      livesLost++;
      feedback = note;
      const r = m!.send(m!.ctx.lives > 0 ? 'WRONG' : 'OUT');
      if (!r.ok) feedback = h('p', { class: 'note warn', role: 'alert' }, r.reason!);
    } else {
      feedback = note;
      m!.send('WRONG');
    }
    announce(note.textContent ?? '');
    draw();
  }
  function finish(cleared: boolean) {
    stopTimer();
    const saved = load();
    if (cleared && seconds <= SPEED_BONUS_SECONDS) {
      speedBonus = true;
      xp += SPEED_BONUS_XP;
    }
    saved.xp += xp;
    saved.row = cleared ? saved.row + 1 : 0;
    for (const b of crisisBadges({ cleared, livesLost, clearedInARow: saved.row })) if (!saved.badges.includes(b.id)) saved.badges.push(b.id);
    save(saved);
    const correct = STEPS.filter(s => right[s] && firstTry[s]).length;
    void recordAttempt({
      t: Date.now(),
      skill: 'tb-crisis',
      clause: 'XI.2.errors',
      seed,
      mode: 'PRACTICE',
      marks: correct,
      outOf: STEPS.length,
      hintsUsed: 0,
      mistakes,
      correctParts: correct,
      parts: STEPS.length,
    });
  }

  // ───────── fixed parts: journal, trial balance, scale ─────────
  const journal = () =>
    h(
      'section',
      { class: 'panel' },
      h('h3', {}, T('crisis.journal')),
      h(
        'ol',
        { class: 'crisis-journal', ...(hi ? { lang: 'hi' } : {}) },
        ...c.journal.map(j =>
          h(
            'li',
            {},
            `${j.day} ${hi ? 'अप्रैल' : 'April'}: ${hi ? j.hi : j.en} ${fmt(j.amount)} — `,
            h('b', {}, `${accName(j.dr)} ${hi ? 'नाम' : 'Dr.'}`),
            ' / ',
            h('b', {}, `${accName(j.cr)} ${hi ? 'जमा' : 'Cr.'}`),
          ),
        ),
      ),
    );
  function trialBalance() {
    const st = m!.state,
      fixed = st === 'WHAT_IF' || st === 'CLEARED',
      withSuspense = st !== 'DIAGNOSE';
    const after = fixed ? totalsAfter(c, c.answer.entry) : null;
    const rows = c.accounts
      .filter(a => a.shown)
      .map(a => {
        let side = a.shown!.side,
          amount = Money.parse(a.shown!.amount);
        if (fixed && a.id === c.answer.account) {
          const e = c.answer.entry,
            signed = (side === 'DR' ? amount : amount.neg()).add(e.dr === a.id ? Money.parse(e.amount) : Money.parse(e.amount).neg());
          side = signed.isNegative() ? 'CR' : 'DR';
          amount = signed.abs();
        }
        return h(
          'tr',
          { 'data-account': a.id, class: fixed && a.id === c.answer.account ? 'flag' : '' },
          h('th', { scope: 'row' }, accName(a.id)),
          h('td', { class: 'num' }, side === 'DR' ? amount.format() : ''),
          h('td', { class: 'num' }, side === 'CR' ? amount.format() : ''),
        );
      });
    const dr = after ? after.dr : withSuspense && c.answer.shortSide === 'DR' ? Money.parse(c.totals.dr).add(Money.parse(c.answer.difference)) : Money.parse(c.totals.dr);
    const cr = after ? after.cr : withSuspense && c.answer.shortSide === 'CR' ? Money.parse(c.totals.cr).add(Money.parse(c.answer.difference)) : Money.parse(c.totals.cr);
    const suspenseRow =
      withSuspense && !fixed
        ? h(
            'tr',
            { class: 'flag', 'data-account': SUSPENSE },
            h('th', { scope: 'row' }, T('crisis.suspense')),
            h('td', { class: 'num' }, c.answer.shortSide === 'DR' ? fmt(c.answer.difference) : ''),
            h('td', { class: 'num' }, c.answer.shortSide === 'CR' ? fmt(c.answer.difference) : ''),
          )
        : null;
    return h(
      'section',
      { class: 'panel' },
      h('h3', {}, T('crisis.tb')),
      h(
        'div',
        { class: 'tablewrap' },
        h(
          'table',
          { class: 'data crisis-tb' },
          h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, T('crisis.account')), h('th', { scope: 'col' }, T('crisis.dr')), h('th', { scope: 'col' }, T('crisis.cr')))),
          h('tbody', {}, ...rows, suspenseRow),
          h(
            'tfoot',
            {},
            h('tr', {}, h('th', { scope: 'row' }, T('crisis.total')), h('td', { class: 'num', 'data-total': 'dr' }, dr.format()), h('td', { class: 'num', 'data-total': 'cr' }, cr.format())),
          ),
        ),
      ),
    );
  }
  function updateScale() {
    // the scale shows the REAL state of the books: it levels only when the rectifying entry is posted (a suspense balance is a parked problem, not a fix)
    const fixed = m!.state === 'WHAT_IF' || m!.state === 'CLEARED';
    const dr = Number(c.totals.dr),
      cr = Number(c.totals.cr),
      big = Math.max(dr, cr);
    const st = {
      assets: fixed ? big : dr,
      rhs: fixed ? big : cr,
      balanced: fixed,
      assetsLabel: `${T('crisis.scaleDr')} ${fmt(fixed ? totalsAfter(c, c.answer.entry).dr.toString() : c.totals.dr)}`,
      rhsLabel: `${T('crisis.scaleCr')} ${fmt(fixed ? totalsAfter(c, c.answer.entry).cr.toString() : c.totals.cr)}`,
    };
    scaleText.textContent = fixed ? T('crisis.scaleOn') : T('crisis.scaleOff', { amount: fmt(c.answer.difference) });
    scaleText.setAttribute('data-balanced', String(fixed));
    if (scale) scale.set(st);
    else
      queueMicrotask(() => {
        if (scale || !document.body.contains(scaleWrap)) return;
        scale = mountBalanceScale(scaleWrap, st);
        if (!scale) scaleWrap.style.display = 'none';
      });
  }

  // ───────── the five steps ─────────
  const note = (cls: string, text: string) => h('p', { class: 'note ' + cls, role: cls === 'good' ? 'status' : 'alert', ...(hi ? { lang: 'hi' } : {}) }, text);
  function stepPanel(): HTMLElement {
    const st = m!.state;
    if (st === 'DIAGNOSE') {
      const amt = h('input', { type: 'text', id: 'c-diff', inputmode: 'decimal', autocomplete: 'off' }),
        side = h('select', { id: 'c-side' }, h('option', { value: '' }, T('crisis.choose')), h('option', { value: 'DR' }, T('crisis.side.dr')), h('option', { value: 'CR' }, T('crisis.side.cr')));
      return h(
        'form',
        {
          class: 'panel crisis-step',
          onsubmit: (e: Event) => {
            e.preventDefault();
            const ok = sameMoney(amt.value, c.answer.difference) && side.value === c.answer.shortSide;
            if (ok) win('DIAGNOSE', 'RIGHT', note('good', T('crisis.s1.right')));
            else lose('DIAGNOSE', note('warn', T('crisis.s1.wrong')), 'Could not find the trial-balance difference or the short side');
          },
        },
        h('h3', {}, T('crisis.s1.title')),
        h('div', { class: 'field' }, h('label', { for: 'c-diff' }, T('crisis.s1.diff')), amt),
        h('div', { class: 'field' }, h('label', { for: 'c-side' }, T('crisis.s1.side')), side),
        h('div', { class: 'actions' }, h('button', { type: 'submit', class: 'primary' }, T('crisis.check'))),
      );
    }
    if (st === 'LOCATE') {
      const a = opened ? c.accounts.find(x => x.id === opened)! : null;
      return h(
        'section',
        { class: 'panel crisis-step' },
        h('h3', {}, T('crisis.s2.title')),
        h('p', { class: 'hint' }, T('crisis.s2.help')),
        h(
          'div',
          { class: 'actions crisis-accounts' },
          ...c.accounts.map(x =>
            h(
              'button',
              {
                type: 'button',
                'data-open': x.id,
                'aria-pressed': String(opened === x.id),
                class: opened === x.id ? 'primary' : '',
                onclick: () => {
                  opened = x.id;
                  feedback = null;
                  pop = null;
                  draw();
                },
              },
              accName(x.id),
            ),
          ),
        ),
        a
          ? h(
              'div',
              { class: 'crisis-ledger' },
              h('h4', {}, T('crisis.posted', { account: accName(a.id) })),
              h(
                'div',
                { class: 'tablewrap' },
                h(
                  'table',
                  { class: 'data' },
                  h('thead', {}, h('tr', {}, ...[T('crisis.date'), T('crisis.particulars'), T('crisis.side'), T('crisis.amount')].map(x => h('th', { scope: 'col' }, x)))),
                  h(
                    'tbody',
                    {},
                    ...a.posted.map(p =>
                      h(
                        'tr',
                        {},
                        h('td', {}, `${p.day} ${hi ? 'अप्रैल' : 'April'}`),
                        h('td', {}, hi ? p.hi : p.en),
                        h('td', {}, p.side === 'DR' ? (hi ? 'नाम' : 'Dr.') : hi ? 'जमा' : 'Cr.'),
                        h('td', { class: 'num' }, fmt(p.amount)),
                      ),
                    ),
                  ),
                ),
              ),
              h(
                'div',
                { class: 'actions' },
                h(
                  'button',
                  {
                    type: 'button',
                    class: 'primary',
                    'data-accuse': a.id,
                    onclick: () => {
                      if (a.id === c.answer.account) win('LOCATE', 'RIGHT', note('good', T('crisis.s2.right', { account: accName(a.id) })));
                      else lose('LOCATE', note('bad', T('crisis.s2.wrong', { account: accName(a.id) })), `Accused ${a.name} instead of the account with the wrong posting`);
                    },
                  },
                  T('crisis.s2.accuse'),
                ),
              ),
            )
          : null,
      );
    }
    if (st === 'CLASSIFY') {
      return h(
        'section',
        { class: 'panel crisis-step' },
        h('h3', {}, T('crisis.s3.title')),
        h(
          'div',
          { class: 'actions crisis-kinds' },
          ...CRISIS_KINDS.map((k: CrisisKind) =>
            h(
              'button',
              {
                type: 'button',
                'data-kind': k,
                onclick: () => {
                  if (k === c.answer.kind) win('CLASSIFY', 'RIGHT', note('good', B(c.cause)));
                  else lose('CLASSIFY', note('warn', T('crisis.s3.wrong')), `Called the error "${KIND_LABEL[k].en}"`);
                },
              },
              B(KIND_LABEL[k]),
            ),
          ),
        ),
      );
    }
    if (st === 'RECTIFY') {
      const options = () => [h('option', { value: '' }, T('crisis.choose')), ...[...c.accounts.map(a => a.id), SUSPENSE].map(id => h('option', { value: id }, accName(id)))];
      const dr = h('select', { id: 'c-dr' }, ...options()),
        cr = h('select', { id: 'c-cr' }, ...options()),
        amt = h('input', { type: 'text', id: 'c-amt', inputmode: 'decimal', autocomplete: 'off' });
      return h(
        'form',
        {
          class: 'panel crisis-step',
          onsubmit: (e: Event) => {
            e.preventDefault();
            const want = c.answer.entry;
            const amountOk = sameMoney(amt.value, want.amount);
            if (!dr.value || !cr.value || !amt.value.trim()) {
              feedback = note('warn', `${T('crisis.s4.drAcc')} · ${T('crisis.s4.crAcc')} · ${T('crisis.s4.amount')}`);
              pop = null;
              draw();
              return;
            }
            if (dr.value === want.dr && cr.value === want.cr && amountOk) {
              win('RECTIFY', 'RIGHT', note('good', T('crisis.s4.right')));
              return;
            }
            const usesSuspense = dr.value === SUSPENSE || cr.value === SUSPENSE,
              usesAccount = dr.value === c.answer.account || cr.value === c.answer.account;
            const why = !usesSuspense
              ? T('crisis.s4.noSuspense')
              : !usesAccount
                ? T('crisis.s4.wrongAccount', { account: accName(c.answer.account) })
                : dr.value === want.cr && cr.value === want.dr
                  ? T('crisis.s4.swapped', { side: hi ? (c.answer.shortSide === 'DR' ? 'नाम' : 'जमा') : c.answer.shortSide === 'DR' ? 'debit' : 'credit' })
                  : T('crisis.s4.amountWrong');
            lose(
              'RECTIFY',
              note('bad', why),
              !usesSuspense
                ? 'Rectified a one-sided error without the Suspense Account'
                : !usesAccount
                  ? 'Rectifying entry used the wrong account'
                  : amountOk
                    ? 'Rectifying entry had debit and credit swapped'
                    : 'Rectifying entry had the wrong amount',
            );
          },
        },
        h('h3', {}, T('crisis.s4.title')),
        h('p', { class: 'hint', ...(hi ? { lang: 'hi' } : {}) }, B(c.cause)),
        h('div', { class: 'field' }, h('label', { for: 'c-dr' }, T('crisis.s4.drAcc')), dr),
        h('div', { class: 'field' }, h('label', { for: 'c-cr' }, T('crisis.s4.crAcc')), cr),
        h('div', { class: 'field' }, h('label', { for: 'c-amt' }, T('crisis.s4.amount')), amt),
        h('div', { class: 'actions' }, h('button', { type: 'submit', class: 'primary' }, T('crisis.s4.post'))),
      );
    }
    if (st === 'WHAT_IF') {
      return h(
        'section',
        { class: 'panel crisis-step' },
        h('h3', {}, T('crisis.s5.title')),
        h('p', { class: 'stem', ...(hi ? { lang: 'hi' } : {}) }, B(c.whatIf.question)),
        h(
          'div',
          { class: 'actions crisis-whatif' },
          ...c.whatIf.options.map((o, i) =>
            h(
              'button',
              {
                type: 'button',
                'data-option': String(i),
                onclick: () => {
                  const ok = i === c.whatIf.answer;
                  if (ok) {
                    const gained = stepXp('WHAT_IF', true, streak);
                    xp += gained;
                    pop = gained;
                    right.WHAT_IF = true;
                  } else {
                    firstTry.WHAT_IF = false;
                    pop = null;
                    mistakes.push('What-if: thought an error that keeps debits and credits equal would upset the trial balance');
                  }
                  feedback = h('div', {}, note(ok ? 'good' : 'warn', T(ok ? 'crisis.s5.right' : 'crisis.s5.wrong')), note('', B(c.whatIf.why)));
                  m!.send('ANSWER');
                  finish(true);
                  announce(T(ok ? 'crisis.s5.right' : 'crisis.s5.wrong'));
                  draw();
                },
              },
              B(o),
            ),
          ),
        ),
      );
    }
    // CLEARED or FAILED: summary + full solution
    const saved = load(),
      cleared = st === 'CLEARED',
      e = c.answer.entry;
    const badges = crisisBadges({ cleared, livesLost, clearedInARow: saved.row });
    return h(
      'section',
      { class: 'panel crisis-step crisis-end', 'data-end': cleared ? 'cleared' : 'failed' },
      h('h3', {}, T(cleared ? 'crisis.cleared' : 'crisis.failed')),
      cleared ? null : h('p', {}, T('crisis.failedLead')),
      h(
        'p',
        { class: 'crisis-earned' },
        h('b', { 'data-earned': String(xp) }, T('crisis.earned', { xp })),
        speedBonus ? ` · ${T('crisis.speed', { xp: SPEED_BONUS_XP })}` : '',
        ' · ',
        h('span', { 'data-total-xp': String(saved.xp) }, T('crisis.totalXp', { xp: saved.xp })),
      ),
      badges.length
        ? h('p', { class: 'crisis-badges' }, ...badges.map(b => h('span', { class: 'chip badge', 'data-badge': b.id }, icon('medal', 15), ` ${T('crisis.badge')}: ${hi ? b.hi : b.en}`)))
        : null,
      h(
        'div',
        {
          class: 'solution',
          'data-sol-difference': c.answer.difference,
          'data-sol-side': c.answer.shortSide,
          'data-sol-account': c.answer.account,
          'data-sol-kind': c.answer.kind,
          'data-sol-dr': e.dr,
          'data-sol-cr': e.cr,
          'data-sol-amount': e.amount,
          'data-sol-whatif': String(c.whatIf.answer),
          ...(hi ? { lang: 'hi' } : {}),
        },
        h('h4', {}, T('crisis.solution')),
        h(
          'ol',
          {},
          h('li', {}, T('crisis.sol.diff', { amount: fmt(c.answer.difference), side: sideWord(c.answer.shortSide) })),
          h('li', {}, B(c.cause)),
          h('li', {}, B(KIND_LABEL[c.answer.kind])),
          h('li', {}, T('crisis.sol.entry', { dr: accName(e.dr), cr: accName(e.cr), amount: fmt(e.amount) })),
          h('li', {}, `${B(c.whatIf.question)} — ${B(c.whatIf.options[c.whatIf.answer]!)}. ${B(c.whatIf.why)}`),
        ),
      ),
      h(
        'div',
        { class: 'actions' },
        h(
          'button',
          {
            type: 'button',
            class: 'primary',
            'data-again': 'new',
            onclick: () => {
              m!.send('AGAIN');
              start(1 + Math.floor(Math.random() * 999_999));
            },
          },
          T('crisis.again'),
        ),
        cleared
          ? null
          : h(
              'button',
              {
                type: 'button',
                'data-again': 'same',
                onclick: () => {
                  m!.send('AGAIN');
                  start(seed);
                },
              },
              T('crisis.retry'),
            ),
      ),
    );
  }

  let failedDone = false;
  function draw() {
    const st = m!.state;
    if (st === 'FAILED' && !failedDone) {
      failedDone = true;
      finish(false);
    } else if (st !== 'FAILED') failedDone = false;
    const idx = STEPS.indexOf(st as CrisisStep),
      saved = load();
    const hud = h(
      'div',
      { class: 'crisis-hud', role: 'group', 'aria-label': 'Status' },
      h(
        'span',
        { class: 'chip', 'data-hud': 'lives', 'data-lives': String(m!.ctx.lives), 'aria-label': `${T('crisis.lives')}: ${m!.ctx.lives}` },
        `${T('crisis.lives')} `,
        ...Array.from({ length: CRISIS_LIVES }, (_, i) => icon(i < Math.max(0, m!.ctx.lives) ? 'heart' : 'heart-outline', 15)),
      ),
      h('span', { class: 'chip', 'data-hud': 'xp', 'data-xp': String(xp) }, `${T('crisis.xp')} ${xp}`, pop ? h('b', { class: 'xp-pop', 'data-pop': String(pop) }, ` +${pop}`) : null),
      h('span', { class: 'chip', 'data-hud': 'streak', 'data-streak': String(streak) }, `${T('crisis.streak')} ${streak}`, ...(streak >= 2 ? [' ', icon('flame', 15), ' ×1.5'] : [])),
      h('span', { class: 'chip' }, `${T('crisis.time')} `, h('span', { 'data-hud': 'time' }, clock())),
      idx >= 0 ? h('span', { class: 'chip', 'data-hud': 'step' }, T('crisis.step', { n: idx + 1 })) : null,
      h('span', { class: 'chip', 'data-hud': 'total' }, T('crisis.totalXp', { xp: saved.xp })),
    );
    mount(body, hud, feedback, stepPanel(), h('div', { class: 'crisis-grid' }, trialBalance(), journal()));
    updateScale();
    const focus = body.querySelector<HTMLElement>('.crisis-step input, .crisis-step select, .crisis-step button');
    if (feedback && focus && st !== 'CLEARED' && st !== 'FAILED') focus.focus({ preventScroll: true });
  }

  root.append(
    h('header', { class: 'labhead' }, h('p', { class: 'eyebrow' }, T('crisis.eyebrow')), h('h2', {}, T('crisis.title')), h('p', { class: 'lead', ...(hi ? { lang: 'hi' } : {}) }, T('crisis.lead'))),
    scaleWrap,
    scaleText,
    body,
  );
  start(seed);
  return root;
}
