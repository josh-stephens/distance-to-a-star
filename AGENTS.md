# Cosmic Distance Explorer — Agent Notes

**Read [CLAUDE.md](CLAUDE.md) — it is the single source of truth** for architecture, critical rendering patterns, the housekeeping checklist, and deployment. This file exists so agent tools that look for AGENTS.md find the pointer; it intentionally duplicates nothing (duplicated docs drift).

Hard constraints (details in CLAUDE.md):

- ES5 only in `js/` — `var`, no arrow functions, no template literals, no `let`/`const`
- No `innerHTML` anywhere — `createElement`/`textContent` only (a hook enforces this)
- No external runtime dependencies, no build step — files load as plain `<script>` tags
- Data in `js/data.js` (pure `var` declarations), all logic in `js/app.js`
- Tests: `node tests/validate-data.js` after any data change; `node tests/era-labels.test.js` after touching `getHistoricalEvent`
- Deploy: `./deploy.sh [bill|skippy|all]` — the pre-push git hook deploys to BOTH hosts on any push to `main`
