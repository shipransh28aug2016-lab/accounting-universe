# Changelog

## Unreleased

### Added
- `docs/` Phase 0 discovery set (syllabus matrix, app audit, architecture, repository research, roadmap).
- `packages/engine` v0.1: exact `Money`, closed chart of accounts, validated + frozen journal, ledger with
  reversal, audit trail, trial balance, accounting equation, T-account rows. 63 tests.
- `e2e/legacy-smoke.cjs`, `e2e/legacy-simulator-regression.cjs`.

### Fixed (legacy `index.html`)
- **F-1** Simulator ledger accounts were untyped and accounts outside a 9-entry dictionary were mis-signed
  (Debtors −7,000; Purchases −4,000); Simulator balance sheet empty; "balanced" was 0 = 0; shared state bus
  ran on zeros. Types now come from `AcctEngine.classify`; pre-fix sessions are rebuilt from the journal;
  the M1 mirror no longer leaves stale balances.

### Earlier (merged to main)
- Removed injected Cloudflare scripts; M1 goods-sold logic (Stock ↓ by cost, P&L ↑ by margin);
  depreciation lines no longer typed as assets; Final Accounts boss-fight double-count, wrong-line reduction and
  reset persistence; stale home-grid module labels.
