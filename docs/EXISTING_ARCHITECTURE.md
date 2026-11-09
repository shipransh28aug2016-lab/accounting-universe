# Existing Architecture (Phase 0)

## Runtime shape

```
index.html
 ├─ <style>   ~43 KB   theme tokens (CSS vars), tanks, chips, panels, cards
 ├─ <body>    19 <section class="screen" id="m*">  + top nav rail + home grid (built from MODS[])
 └─ <script>  ~234 KB  one global scope, ~30 "MODULE n" regions concatenated in order
```

There is no module system: later regions rely on earlier globals (`$`, `$$`, `fmt`, `sfx`, `go`,
`awardXP`, `makeDraggable`, `toast`). Several regions **monkey-patch earlier ones** at load time:

* `simRender` is wrapped twice (Drawings-sign patch, then the state-bus persist/broadcast wrapper).
* `window.simPost` is replaced by an `AcctEngine`-validating wrapper (the original keeps the buggy typing, audit F-1).
* `window.go` is wrapped to remember the last screen in `sessionStorage`.
* `window.ACC_TYPE` is replaced by a `Proxy` that falls back to `AcctEngine.classify`.

Load order therefore *is* the architecture; reordering regions changes behaviour.

## Data flow

```
user action ─► module handler ─► module-local state ─► innerHTML render
                                   │
   m6 Journal Builder ─► simPost ─► SIM.journal / SIM.ledger ─► simRender ─► bus "state"
                                                                   ├─► m1 mirror (overwrites Cash/Creditors)
                                                                   └─► m8 slider sync
```

Only the m6→m7 path goes through `AcctEngine.validate`. m1, m2, m4, m5, m10–m15, m18 each keep
private arrays/objects and private correctness rules.

## "Accounting engine" today

`AcctEngine` (in `index.html`, ~line 4690) offers `classify(name)` (dictionary + regex fallback),
`naturalSide`, `effect`, `eqDelta`, `validate`, `explain`. It is a good *vocabulary* but: floats,
no identities, no ledger/TB/statement generation, tolerance-based balancing, regex fallback that can
misclassify (already patched for depreciation lines). Reporting code (Trading/P&L/BS) lives separately
in m12 and works from hard-coded rows, not from a ledger.

## Navigation

Top rail buttons (`data-go`) + home grid cards generated from `MODS`. Four screens (m4, m5, m8, m16)
are reachable only from the home grid. Keyboard shortcuts: digits, `h`, `-`, `=`, `[`. No URLs/hash routing.

## Persistence

`sessionStorage["au:sim:v1"]` (journal, ledger, counter) and `["au:screen"]`. Nothing durable.

## Build / test / deploy

None. Opened directly or served statically. `.html` backups are the only "version control" inside the folder.

## What the new architecture must keep from this

Content banks (scenes, quizzes, cases) → extract to typed JSON data; offline single-bundle delivery;
the existing look until a design system replaces it. See `IMPLEMENTATION_ROADMAP.md` for the migration
approach (strangler pattern, legacy stays shippable).
