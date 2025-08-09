# Project Summary

## Purpose
Continuous threat intelligence ingestion from ~5 RSS sources, normalized, filtered, and posted per-item to Microsoft Teams, with optional static HTML dashboard.

## Current Architecture (Enhanced Pipeline)
- Orchestrator: `fetch-and-post-enhanced.js`
- Parsing: `parsers/defaultParser.js` (with `FETCH_TIMEOUT_MS`)
- Filtering/Classification: `utils/threatFilter.js` (relevance-first)
- Formatting: `utils/formatter.js`
- Outputs: `outputs/outputManager.js` → `post-to-teams.js` (backoff + `POST_TIMEOUT_MS`) and `outputs/githubPages*.js`
- State: `utils/stateManager.js` (locking, backup/recovery, legacy migration)
- Health: `utils/healthMonitor.js`
- Config + Help + Logger: `utils/config.js`, `utils/help.js`, `utils/logger.js` (URL redaction)

## Key Decisions
- Enhanced pipeline is authoritative. Base kept for legacy CLI.
- State uses `seen` map; one-time migration from legacy map supported.
- Teams posting: exponential backoff, Retry-After, per-run cap.
- HTML output: enhanced generator behind a compat wrapper.
- Node 20 LTS; ESM.

## Workflows
- Reusable run: .github/workflows/run-feed-reusable.yml
- CI: .github/workflows/ci.yml (PR/push to non-main)
- Staging: .github/workflows/staging.yml (manual/scheduled; staging secret)
- Production: .github/workflows/production.yml (*/5 schedule, cancel-in-progress)

## Environment
- Local: .env.example (no secrets). .env should be ignored.
- Production: GitHub Actions secrets only.

## Recent Changes (What & Why)
- Set enhanced pipeline as default (package.json): align with long-term design.
- Added adapters and thin modules: utils/validator.js, utils/feedProcessor.js, utils/config.js, utils/help.js, utils/logger.js → wire enhanced code safely.
- Output wrappers: compat class in outputs/githubPages.js; lightweight class in outputs/outputManager.js → easier orchestration.
- State migration: auto-upgrade legacy map → prevent misses/duplicates.
- Posting backoff + timeouts + redaction → reliability & security.
- Filtering refined (relevance-first, detailed logs) → reduce false negatives.
- Tests added/updated: filter behavior, URL redaction, Retry-After backoff.
- Actions split into CI/staging/prod using reusable workflow.
- .env.example created.

## Repo Audit (Initial Pass)
- Keep: core code under utils/, services/, outputs/, parsers/, scripts/, tests/, docs/.
- Move: test-teams.js → scripts/test-teams.js (utility script).
- Move: outputs/# Code Citations.md → docs/Code-Citations.md (documentation).
- Archive: disable-workflow.md → archive/disable-workflow.md (historical).
- Remove: stray root file with accidental command name (gh run list ...).
- Consider archiving: large flow CSV (kept for now), add note in docs.
- Add .gitignore entries for logs/ and .env to avoid accidental commits.

## Next
- Complete repo moves/archives per above (tests must remain green).
- Update README.md with workflows, schedules, envs, backoff/timeouts, state migration.
- Periodically review feed list and add per-source parser maps.
