/**
 * Every state machine in the app, declared as DATA (see packages/engine/src/machine.ts).
 * Pure: no DOM, no storage. The web app interprets these specs; tests verify them; `docs/STATE_MACHINES.md` is generated from them.
 * The strings in `reason` / `blocked` are exactly what a user sees when an action is unavailable — keep them kind and specific.
 */
import { Machine, type MachineSpec } from '../../engine/src';

type Role = 'ACCOUNTANT' | 'CHECKER' | 'VIEWER';
const ONLY = (what: string) => `Only a Checker can ${what}. Switch role.`;

// ───────────────────────── Journal → Ledger → Trial Balance: the animated story ─────────────────────────
export type PlayerState = 'IDLE' | 'PLAYING' | 'PAUSED' | 'FINISHED' | 'DISPOSED';
export type PlayerEvent = 'PLAY' | 'PAUSE' | 'STEP' | 'TICK' | 'DONE' | 'SPEED' | 'RESET' | 'REPLAY' | 'DISPOSE';
const FINISHED_MSG = 'The story is finished — press Replay or Reset.';
export const LEDGER_PLAYER: MachineSpec<PlayerState, PlayerEvent> = {
  id: 'ledger-player', doc: 'Play / pause / step / reset / speed for the Ravi story on the Journal → Ledger page. DISPOSE stops the timer when the student leaves the page.', initial: 'IDLE',
  states: {
    IDLE: { doc: 'Nothing posted from the story yet.', on: { PLAY: 'PLAYING', STEP: 'PAUSED', SPEED: 'IDLE', RESET: 'IDLE', DISPOSE: 'DISPOSED' }, blocked: { PAUSE: 'Nothing is playing yet.' } },
    PLAYING: { doc: 'A timer posts one transaction per tick.', on: { PAUSE: 'PAUSED', STEP: 'PAUSED', TICK: 'PLAYING', SPEED: 'PLAYING', DONE: 'FINISHED', RESET: 'IDLE', DISPOSE: 'DISPOSED' } },
    PAUSED: { doc: 'Stopped part-way; Step moves one transaction at a time.', on: { PLAY: 'PLAYING', STEP: 'PAUSED', SPEED: 'PAUSED', DONE: 'FINISHED', RESET: 'IDLE', DISPOSE: 'DISPOSED' }, blocked: { PAUSE: 'Already paused.' } },
    FINISHED: { doc: 'All transactions of the story are posted.', on: { REPLAY: 'PLAYING', SPEED: 'FINISHED', RESET: 'IDLE', DISPOSE: 'DISPOSED' }, blocked: { PLAY: FINISHED_MSG, STEP: FINISHED_MSG, PAUSE: FINISHED_MSG } },
    DISPOSED: { doc: 'The student left the page; the timer is cleared.', final: true },
  },
};

// ───────────────────────── Practice: one question ─────────────────────────
export type QuestionState = 'ANSWERING' | 'RETRYING' | 'SUBMITTED';
export type QuestionEvent = 'HINT' | 'STEP_SHOW' | 'SUBMIT_PARTIAL' | 'SUBMIT_FINAL' | 'NEXT';
export interface QuestionCtx { mode: 'BEGINNER' | 'PRACTICE' | 'BOARD'; hintsLeft: number; stepsLeft: number }
const hintOk = (c: QuestionCtx) => c.mode !== 'BOARD' && c.hintsLeft > 0;
const hintWhy = (c: QuestionCtx) => (c.mode === 'BOARD' ? 'Hints are off in Board mode (exam conditions).' : 'No more hints for this question.');
const stepOk = (c: QuestionCtx) => c.mode === 'BEGINNER' && c.stepsLeft > 0;
const stepWhy = (c: QuestionCtx) => (c.mode !== 'BEGINNER' ? 'Step-by-step help is only in Beginner mode.' : 'You have seen every step.');
const ALREADY = 'Already checked — read the working below, then go to the next question.';
const open = { HINT: { to: 'ANSWERING', guard: hintOk, reason: hintWhy }, STEP_SHOW: { to: 'ANSWERING', guard: stepOk, reason: stepWhy }, SUBMIT_PARTIAL: 'RETRYING', SUBMIT_FINAL: 'SUBMITTED' } as const;
export const PRACTICE_QUESTION: MachineSpec<QuestionState, QuestionEvent, QuestionCtx> = {
  id: 'practice-question', doc: 'One generated question. Beginner mode lets a wrong answer be retried; every other mode ends at the first check. After SUBMITTED nothing but NEXT is possible, so an answer can never be recorded twice.', initial: 'ANSWERING',
  states: {
    ANSWERING: { doc: 'Waiting for the first answer. Hints (and, in Beginner mode, steps) can be revealed.', on: open },
    RETRYING: { doc: 'Beginner mode only: the last answer was wrong, try again.', on: { ...open, HINT: { to: 'RETRYING', guard: hintOk, reason: hintWhy }, STEP_SHOW: { to: 'RETRYING', guard: stepOk, reason: stepWhy } } },
    SUBMITTED: { doc: 'Final answer recorded; the full working is shown.', on: { NEXT: 'ANSWERING' }, blocked: { SUBMIT_PARTIAL: ALREADY, SUBMIT_FINAL: ALREADY, HINT: 'The full working is already shown.', STEP_SHOW: 'The full working is already shown.' } },
  },
};

// ───────────────────────── Debit & Credit Trainer ─────────────────────────
export type TrainerState = 'ASKING' | 'ANSWERED' | 'COMPLETE';
export type TrainerEvent = 'ANSWER' | 'NEXT' | 'FINISH' | 'AGAIN';
export const TRAINER_ROUND: MachineSpec<TrainerState, TrainerEvent, { hasBoth: boolean }> = {
  id: 'trainer-round', doc: 'A round of the Debit & Credit Trainer.', initial: 'ASKING',
  states: {
    ASKING: { doc: 'A transaction is shown; waiting for a debit and a credit account.', on: { ANSWER: { to: 'ANSWERED', guard: c => c.hasBoth, reason: 'Choose an account for both the debit and the credit side.' } } },
    ANSWERED: { doc: 'Checked; the rule behind each side is shown.', on: { NEXT: 'ASKING', FINISH: 'COMPLETE' }, blocked: { ANSWER: 'Already answered — go to the next question.' } },
    COMPLETE: { doc: 'All questions done; the score is shown.', on: { AGAIN: 'ASKING' } },
  },
};

// ───────────────────────── Concept card: one self-check question ─────────────────────────
export type CheckState = 'UNANSWERED' | 'ANSWERED';
export const CARD_CHECK: MachineSpec<CheckState, 'ANSWER', { hasChoice: boolean }> = {
  id: 'card-check', doc: 'A single self-check question on a concept card.', initial: 'UNANSWERED',
  states: {
    UNANSWERED: { doc: 'Waiting for a choice.', on: { ANSWER: { to: 'ANSWERED', guard: c => c.hasChoice, reason: 'Choose an answer first.' } } },
    ANSWERED: { doc: 'Locked, explanation shown.', final: true, blocked: { ANSWER: 'Already answered.' } },
  },
};

// ───────────────────────── Anything loaded asynchronously (IndexedDB, files) ─────────────────────────
export type AsyncState = 'IDLE' | 'LOADING' | 'READY' | 'FAILED' | 'DISPOSED';
export type AsyncEvent = 'LOAD' | 'RESOLVE' | 'REJECT' | 'RETRY' | 'RELOAD' | 'DISPOSE';
export const ASYNC_RESOURCE: MachineSpec<AsyncState, AsyncEvent> = {
  id: 'async-resource', doc: 'Used by every page that reads stored data. FAILED always offers Retry (a spinner can never hang forever); DISPOSED ignores results that arrive after the student left.', initial: 'IDLE',
  states: {
    IDLE: { doc: 'Not started.', on: { LOAD: 'LOADING', DISPOSE: 'DISPOSED' } },
    LOADING: { doc: 'Spinner shown.', on: { RESOLVE: 'READY', REJECT: 'FAILED', DISPOSE: 'DISPOSED' } },
    READY: { doc: 'Content shown.', on: { RELOAD: 'LOADING', DISPOSE: 'DISPOSED' } },
    FAILED: { doc: 'Error message with a Retry button.', on: { RETRY: 'LOADING', DISPOSE: 'DISPOSED' } },
    DISPOSED: { doc: 'Page left; late results are dropped.', final: true },
  },
};

// ───────────────────────── Where progress is stored ─────────────────────────
export type StorageState = 'CONNECTING' | 'INDEXEDDB' | 'MEMORY' | 'DEGRADED';
export type StorageEvent = 'OPENED' | 'UNAVAILABLE' | 'WRITE_FAILED';
export const STORAGE: MachineSpec<StorageState, StorageEvent> = {
  id: 'storage', doc: 'Progress is saved in IndexedDB on the device. If that is unavailable the app keeps working from memory and tells the student plainly that progress will be lost when the tab closes.', initial: 'CONNECTING',
  states: {
    CONNECTING: { doc: 'Opening IndexedDB.', on: { OPENED: 'INDEXEDDB', UNAVAILABLE: 'MEMORY' } },
    INDEXEDDB: { doc: 'Normal: saved on this device.', on: { WRITE_FAILED: 'DEGRADED' } },
    MEMORY: { doc: 'IndexedDB unavailable (private mode / blocked): progress lasts until the tab closes. A banner says so.', final: true },
    DEGRADED: { doc: 'IndexedDB opened but a write failed; some progress is only in memory. A banner says so.', final: true },
  },
};

// ───────────────────────── App shell ─────────────────────────
export const APP_BOOT: MachineSpec<'BOOTING' | 'READY' | 'FAILED', 'BOOTED' | 'CRASHED'> = {
  id: 'app-boot', doc: 'Start-up of the web app. Automation should wait for READY (`<html data-app="ready">`) instead of sleeping.', initial: 'BOOTING',
  states: { BOOTING: { doc: 'Opening storage, loading the saved profile.', on: { BOOTED: 'READY', CRASHED: 'FAILED' } }, READY: { doc: 'First page rendered.', final: true }, FAILED: { doc: 'Start-up crashed; a message is shown.', final: true } },
};
export const NETWORK: MachineSpec<'ONLINE' | 'OFFLINE', 'WENT_OFFLINE' | 'WENT_ONLINE'> = {
  id: 'network', doc: 'Browser connectivity. Everything in the app works offline; the header only tells the student.', initial: 'ONLINE',
  states: { ONLINE: { doc: 'Connected.', on: { WENT_OFFLINE: 'OFFLINE' } }, OFFLINE: { doc: 'No network; cached app keeps working.', on: { WENT_ONLINE: 'ONLINE' } } },
};

// ───────────────────────── Computerised Accounting Simulator ─────────────────────────
export type VoucherState = 'DRAFT' | 'PENDING' | 'POSTED' | 'SENT_BACK';
export type VoucherEvent = 'SAVE' | 'VERIFY' | 'SEND_BACK';
export interface VoucherCtx { role: Role; yearClosed: boolean }
export const CAS_VOUCHER: MachineSpec<VoucherState, VoucherEvent, VoucherCtx> = {
  id: 'cas-voucher', doc: 'Maker–checker: an Accountant enters a voucher, a different role (Checker) verifies and posts it. Posted vouchers are never edited or deleted.', initial: 'DRAFT',
  states: {
    DRAFT: { doc: 'Being typed in the form.', on: { SAVE: { to: 'PENDING', guard: c => c.role === 'ACCOUNTANT' && !c.yearClosed, reason: c => (c.role !== 'ACCOUNTANT' ? 'Your role cannot enter vouchers. Switch to Accountant.' : 'The year is closed. Start the next year before entering vouchers.') } } },
    PENDING: { doc: 'Waiting in the verification queue; not in the books yet.', on: { VERIFY: { to: 'POSTED', guard: c => c.role === 'CHECKER', reason: ONLY('verify and post') }, SEND_BACK: { to: 'SENT_BACK', guard: c => c.role === 'CHECKER', reason: 'Only a Checker can reject.' } } },
    POSTED: { doc: 'In the ledger (journal, ledger, trial balance, audit trail).', final: true },
    SENT_BACK: { doc: 'Rejected by the checker; removed from the queue.', final: true },
  },
};
export type YearState = 'OPEN' | 'CLOSED';
export type YearEvent = 'CLOSE' | 'START_NEXT_YEAR' | 'RESTORE_OPEN' | 'RESTORE_CLOSED';
export interface YearCtx { role: Role; pending: number }
export const CAS_YEAR: MachineSpec<YearState, YearEvent, YearCtx> = {
  id: 'cas-year', doc: 'The accounting year: open for vouchers, then closed by a Checker (closing entries), then the next year opens with an opening entry. RESTORE_* is used when loading a saved or backed-up book.', initial: 'OPEN',
  states: {
    OPEN: { doc: 'Vouchers can be entered and posted.', on: { CLOSE: { to: 'CLOSED', guard: c => c.role === 'CHECKER' && c.pending === 0, reason: c => (c.role !== 'CHECKER' ? 'Only a Checker can close the year.' : 'Verify or reject all pending vouchers first.') }, RESTORE_OPEN: 'OPEN', RESTORE_CLOSED: 'CLOSED' }, blocked: { START_NEXT_YEAR: 'Close the year first.' } },
    CLOSED: { doc: 'Closing entries posted; no more vouchers this year.', on: { START_NEXT_YEAR: { to: 'OPEN', guard: c => c.role === 'CHECKER', reason: 'Only a Checker can start the next year.' }, RESTORE_OPEN: 'OPEN', RESTORE_CLOSED: 'CLOSED' }, blocked: { CLOSE: 'This year is already closed.' } },
  },
};

// ───────────────────────── AI tutor request ─────────────────────────
export type AskState = 'IDLE' | 'ASKING' | 'ANSWERED' | 'WITHHELD' | 'FAILED';
export type AskEvent = 'ASK' | 'RESOLVE' | 'WITHHOLD' | 'REJECT';
const ask = { to: 'ASKING', guard: (c: { hasQuestion: boolean }) => c.hasQuestion, reason: 'Type your question first.' } as const;
export const AI_ASK: MachineSpec<AskState, AskEvent, { hasQuestion: boolean }> = {
  id: 'ai-ask', doc: 'One question to the optional AI tutor. WITHHELD = the server refused to show a reply that contained a figure the engine did not supply. The core app never depends on this.', initial: 'IDLE',
  states: {
    IDLE: { doc: 'No question asked yet.', on: { ASK: ask } },
    ASKING: { doc: 'Waiting for the server (20 s timeout).', on: { RESOLVE: 'ANSWERED', WITHHOLD: 'WITHHELD', REJECT: 'FAILED' }, blocked: { ASK: 'Still thinking — one question at a time.' } },
    ANSWERED: { doc: 'Reply shown.', on: { ASK: ask } },
    WITHHELD: { doc: 'Reply withheld by the output guard; the student is told why.', on: { ASK: ask } },
    FAILED: { doc: 'Server unreachable or refused; the offline helper is still there.', on: { ASK: ask } },
  },
};

// ───────────────────────── A lab: run result ─────────────────────────
export type RunState = 'IDLE' | 'OK' | 'ERROR';
export const LAB_RUN: MachineSpec<RunState, 'RUN_OK' | 'RUN_ERROR' | 'RESET'> = {
  id: 'lab-run', doc: 'The result area of a lab: nothing yet, a result, or an input/engine error explained in words.', initial: 'IDLE',
  states: { IDLE: { doc: 'Not run yet.', on: { RUN_OK: 'OK', RUN_ERROR: 'ERROR' } }, OK: { doc: 'Result shown.', on: { RUN_OK: 'OK', RUN_ERROR: 'ERROR', RESET: 'IDLE' } }, ERROR: { doc: 'A message explains what to fix; the field is marked.', on: { RUN_OK: 'OK', RUN_ERROR: 'ERROR', RESET: 'IDLE' } } },
};

// ───────────────────────── Share issue lifecycle (domain) ─────────────────────────
export type ShareState = 'APPLICATION' | 'ALLOTMENT' | 'CALLS' | 'PAID' | 'ARREARS' | 'FORFEITED' | 'REISSUED';
export type ShareEvent = 'ALLOT' | 'CALL' | 'PAY_IN_FULL' | 'DEFAULT' | 'PAY_ARREARS' | 'FORFEIT' | 'REISSUE';
export const SHARE_LIFECYCLE: MachineSpec<ShareState, ShareEvent> = {
  id: 'share-lifecycle', doc: 'What can happen to an issue of shares: application → allotment → calls → paid, or unpaid → forfeited → re-issued. Syllabus limit: no interest on calls in arrears or advance.', initial: 'APPLICATION',
  states: {
    APPLICATION: { doc: 'Application money received.', on: { ALLOT: 'ALLOTMENT' } },
    ALLOTMENT: { doc: 'Shares allotted (pro-rata if over-subscribed); excess money adjusted or refunded.', on: { CALL: 'CALLS' } },
    CALLS: { doc: 'Call money demanded on the allotted shares.', on: { PAY_IN_FULL: 'PAID', DEFAULT: 'ARREARS' }, blocked: { FORFEIT: 'Shares can only be forfeited after a call was not paid.' } },
    PAID: { doc: 'Every instalment received.', final: true },
    ARREARS: { doc: 'Some shareholders did not pay a call (calls in arrears).', on: { PAY_ARREARS: 'PAID', FORFEIT: 'FORFEITED' }, blocked: { REISSUE: 'Shares can only be re-issued after they have been forfeited.' } },
    FORFEITED: { doc: 'Shares cancelled; amount received is kept in Share Forfeited A/c.', on: { REISSUE: 'REISSUED' } },
    REISSUED: { doc: 'Forfeited shares issued again; any gain goes to Capital Reserve.', final: true },
  },
};
export interface ShareFacts { readonly arrears: boolean; readonly forfeited: boolean; readonly reissued: boolean }
export type StageState = 'done' | 'skip' | 'issue';
/** Runs the share story through the machine (so an impossible story such as "re-issue without forfeiture" is refused) and returns the six lifecycle stages the lab draws. */
export function shareStages(f: ShareFacts): { name: string; state: StageState }[] {
  const m = new Machine(SHARE_LIFECYCLE), run = (e: ShareEvent) => { const r = m.send(e); if (!r.ok) throw new RangeError(r.reason); };
  run('ALLOT'); run('CALL');
  if (f.arrears) { run('DEFAULT'); if (f.forfeited) run('FORFEIT'); if (f.reissued) run('REISSUE'); }
  else { if (f.forfeited || f.reissued) throw new RangeError('Shares can only be forfeited after a call was not paid.'); run('PAY_IN_FULL'); }
  return [
    { name: 'Application', state: 'done' }, { name: 'Allotment', state: 'done' }, { name: 'Call', state: 'done' },
    { name: 'Payment status', state: f.arrears ? 'issue' : 'done' }, { name: 'Forfeiture', state: f.forfeited ? 'issue' : 'skip' }, { name: 'Re-issue', state: f.reissued ? 'done' : 'skip' },
  ];
}

/** Registry used by tests and by the generated documentation. */
export const MACHINES = [
  { spec: LEDGER_PLAYER, where: 'apps/web/src/pages/ledger.ts', kind: 'UI' }, { spec: PRACTICE_QUESTION, where: 'apps/web/src/pages/practice.ts', kind: 'UI' }, { spec: TRAINER_ROUND, where: 'apps/web/src/pages/trainer.ts', kind: 'UI' },
  { spec: CARD_CHECK, where: 'apps/web/src/pages/cards.ts', kind: 'UI' }, { spec: ASYNC_RESOURCE, where: 'apps/web/src/async.ts (progress, rescue, assignment pages)', kind: 'UI' }, { spec: STORAGE, where: 'apps/web/src/store.ts', kind: 'UI' },
  { spec: APP_BOOT, where: 'apps/web/src/main.ts', kind: 'UI' }, { spec: NETWORK, where: 'apps/web/src/main.ts', kind: 'UI' }, { spec: CAS_VOUCHER, where: 'apps/web/src/pages/cas.ts', kind: 'UI' }, { spec: CAS_YEAR, where: 'apps/web/src/pages/cas.ts', kind: 'UI' },
  { spec: AI_ASK, where: 'apps/web/src/pages/tutor.ts', kind: 'UI' }, { spec: LAB_RUN, where: 'apps/web/src/pages/lab.ts', kind: 'UI' }, { spec: SHARE_LIFECYCLE, where: 'packages/curriculum/src/machines.ts → apps/web/src/labs/company.ts', kind: 'domain' },
] as const;
