/**
 * Cost controls as an explicit little state machine.
 *   per client:  OPEN  --(rph requests in the last hour)-->  THROTTLED  --(oldest request ages out)-->  OPEN
 *   globally:    OPEN  --(dailyCap requests today)------->  CAPPED      --(UTC midnight)------------->  OPEN
 * Pure apart from the injected clock, so the day boundary and the hourly window are testable.
 */
const HOUR = 3_600_000, dayKey = t => new Date(t).toISOString().slice(0, 10);
export function createLimiter({ rph = 20, dailyCap = 500, now = Date.now } = {}) {
  const hits = new Map(); let day = dayKey(now()), today = 0, calls = 0;
  const sweep = t => { for (const [ip, list] of hits) { const keep = list.filter(x => t - x < HOUR); if (keep.length) hits.set(ip, keep); else hits.delete(ip); } };
  return {
    /** Decide and (if allowed) record one request. */
    check(ip) {
      const t = now();
      if (dayKey(t) !== day) { day = dayKey(t); today = 0; }
      if (++calls % 200 === 0) sweep(t);                                  // idle clients must not accumulate forever
      const list = (hits.get(ip) ?? []).filter(x => t - x < HOUR);
      if (list.length >= rph) { hits.set(ip, list); return { ok: false, status: 429, reason: 'IP_THROTTLED', error: 'Too many questions this hour. Try again later.' }; }
      if (today >= dailyCap) return { ok: false, status: 429, reason: 'DAILY_CAP', error: 'The tutor has reached its daily limit. Everything else in the app still works.' };
      list.push(t); hits.set(ip, list); today++;
      return { ok: true };
    },
    stats: () => ({ clients: hits.size, today, day }),
  };
}
