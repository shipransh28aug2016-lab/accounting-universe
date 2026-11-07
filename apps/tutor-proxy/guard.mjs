/**
 * Output guard: the AI tutor must NEVER introduce numbers of its own. Any figure of 3+ digits in its reply must already
 * appear in the engine facts or in the student's question; otherwise the reply is refused. This is what enforces
 * "AI must never override the accounting engine" in code rather than only in a prompt.
 */
const NUM = /\d[\d,]*(?:\.\d+)?/g;
const norm = s => s.replace(/,/g, '').replace(/\.0+$/, '');
export function numbersIn(text) { return (String(text).match(NUM) ?? []).map(norm); }
export function checkReply(reply, facts, question) {
  const allowed = new Set([...facts.flatMap(numbersIn), ...numbersIn(question)]);
  const rogue = numbersIn(reply).filter(n => n.replace('.', '').length >= 3 && !allowed.has(n));
  return { ok: rogue.length === 0, rogue };
}
