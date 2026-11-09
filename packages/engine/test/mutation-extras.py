"""Mutation check for src/extras.ts: each mutant must make at least one test fail. Run: python3 test/mutation-extras.py"""
import subprocess, shutil, sys, os
F = os.path.join(os.path.dirname(__file__), '..', 'src', 'extras.ts'); ORIG = open(F).read()
M = [
 ("EMI rounded down", "divRound(o.principal.paise * nu * A, d * (A - B), R)", "divRound(o.principal.paise * nu * A, d * (A - B), 'DOWN')"),
 ("deposit forgets the bank column", "case 'DEPOSIT': cashCr = t.amount; bankDr = t.amount; cash = cash.sub(t.amount); bank = bank.add(t.amount);", "case 'DEPOSIT': cashCr = t.amount; bankDr = t.amount; cash = cash.sub(t.amount);"),
 ("discount provision on gross debtors", "after.sub(newPdd).mulRatio(i.discountPercent", "after.mulRatio(i.discountPercent"),
 ("liability sign flipped in revaluation", "item.before.sub(item.after)", "item.after.sub(item.before)"),
 ("GST payable reversed", "gstPayable: outputGst.sub(inputGst)", "gstPayable: inputGst.sub(outputGst)"),
 ("inventory change reversed", "const changes = v(i.openingInventory).sub(v(i.closingInventory));", "const changes = v(i.closingInventory).sub(v(i.openingInventory));"),
 ("Act loan interest 12%", "6n * BigInt(l.months), 1200n", "12n * BigInt(l.months), 1200n"),
 ("fixed-capital current account ignores drawings", "current: g(p.openingCurrent).add(credits).sub(debits)", "current: g(p.openingCurrent).add(credits)"),
 ("opening capital = A + L", "const capital = A.sub(Li);", "const capital = A.add(Li);"),
 ("cash may go negative silently", "if (cash.isNegative()) throw new ExtrasError", "if (false) throw new ExtrasError"),
]
killed = 0
try:
    for name, a, b in M:
        assert a in ORIG, f"pattern missing: {name}"
        open(F, 'w').write(ORIG.replace(a, b, 1))
        r = subprocess.run(['npx', 'vitest', 'run', 'test/extras.test.ts'], capture_output=True, text=True, cwd=os.path.join(os.path.dirname(__file__), '..'))
        dead = r.returncode != 0; killed += dead; print(('KILLED   ' if dead else 'SURVIVED ') + name)
finally:
    open(F, 'w').write(ORIG)
print(f"{killed}/{len(M)} mutants killed"); sys.exit(0 if killed == len(M) else 1)
