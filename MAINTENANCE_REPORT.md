# Maintenance Report

Date: ${DATE}

Scope: End-to-end production readiness audit covering pipeline logic, Teams output, GitHub Pages UI, state & metrics, and workflows.

## What was checked
- New-only posting, canonical IDs, intra-run dedupe, backfill guard
- Strict chronological ordering for Teams and Pages
- Timeouts and 429 backoff resilience
- Teams card clarity (Flow-safe HTML, soft-limit trimming)
- GitHub Pages generator and publishing (docs/index.html + docs/feed.json)
- State atomic writes, backups, locking, recovery
- Metrics and state reporting visibility
- Workflows (reusable + staging + production) and artifacts

## Gaps found and fixes
- Pages logo missing → Restored brand logo support in enhanced generator
- Pages sometimes missing entries → Decoupled from Teams cap; always include all filtered
- feed.json not published → Workflow now commits docs/feed.json
- Ordering not guaranteed → Added strict newest-first, title tie-break
- No run summary → Write compact metrics to data/metrics.json
- No quick state overview → Added scripts/state-doctor.js (writes data/state-report.json)
- CVEs not auto-linked → Teams card links CVEs to NVD
- Legacy UI duplication → Removed docs/app.js and docs/styles.css; consolidated to enhanced template
- Proof artifacts → Workflow now uploads run-metrics artifact

## Verification runs
- Staging proof run: ordering enforced, backfill off (no new items), metrics artifact uploaded.
  - Artifact: run-metrics (contains data/metrics.json and data/state-report.json)

## Operator notes
- Backfill remains off by default. Use the one-time "Seed Pages" workflow or set ALLOW_BACKFILL=true explicitly when needed.
- Metrics/state JSONs live under data/.

## Next recommended improvements
- Optional: header chip “Last updated •” and date localization
- Extend tests to snapshot Teams cards across severities


