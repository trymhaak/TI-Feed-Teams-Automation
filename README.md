# TI Feed → Teams Automation

Real‑time threat intelligence collection from trusted RSS sources with automated posting to Microsoft Teams and a public GitHub Pages dashboard. Built for reliability, ESM‑only Node 20+, strong filtering/classification, and CI/CD best practices.

### Live Dashboard
- GitHub Pages: `https://trymhaak.github.io/TI-Feed-Teams-Automation/`
- Feed JSON: `https://trymhaak.github.io/TI-Feed-Teams-Automation/feed.json`

## What it does
- Fetches and normalizes multiple TI RSS feeds
- Applies relevance filtering, severity detection, and threat categorization
- Posts Adaptive Cards to Microsoft Teams (webhook) with exponential backoff and Retry‑After support
- Publishes a GitHub Pages dashboard that is always populated with the latest relevant items

## Key guarantees
- New‑only posting to Teams with per‑run cap (default 30)
- Non‑empty GitHub Pages feed: we never overwrite a previous non‑empty `docs/feed.json` with an empty one. If a run collects 0 new items, the dashboard is built from the previous feed and/or `data/state.json` (last N seen items).
- Secrets safety: webhook URLs are redacted from logs

## Architecture (high level)
- `fetch-and-post-enhanced.js`: main orchestration (ESM)
- `outputs/outputManager.js`: coordinates Teams + GitHub Pages. Pages generation merges current items with the previous feed, falls back to state.
- `outputs/githubPages-enhanced.js`: writes `docs/feed.json` and supports the dashboard
- `services/feedProcessor.js`: per‑feed processing and filtering
- `utils/`: configuration, logging, time helpers, formatter, state manager, threat filter
- `docs/`: static dashboard (`index.html`) that fetches `feed.json`

## Repository layout
```
TI-Feed-Teams-Automation/
├── data/                    # feeds.json, state.json
├── docs/                    # GitHub Pages (index.html, feed.json)
├── outputs/                 # output manager + pages generators
├── parsers/                 # default + future per-source adapters
├── services/                # feed processor
├── utils/                   # config, state, formatter, logger, time, etc.
├── tests/                   # Jest unit + integration tests
└── .github/workflows/       # CI, staging, production, seed, pages smoke
```

## Workflows
- `production.yml` (schedule + manual): Node 20, 10m timeout, cancel-in-progress, `ENABLE_GITHUB_PAGES=true`, posts to Teams and publishes Pages
- `staging.yml`: manual/scheduled using environment‑scoped secrets
- `ci.yml`: unit/integration tests and smoke checks on PRs
- `seed-pages.yml`: one‑time seed of Pages without Teams posting
- `ci-pages-smoke.yml` (“Pages Smoke (Live)”): checks live `feed.json` lastUpdated freshness and UI init marker after production completes

## Configuration
### Feeds
Edit `data/feeds.json` to add/remove sources. Minimal example:
```json
[
  {"name":"NSM-NCSC","url":"https://nsm.no/.../rss/","enabled":true},
  {"name":"CISA-Alerts","url":"https://www.cisa.gov/news.xml","enabled":true}
]
```

### Environment variables (via `.env` locally or GitHub Secrets)
- `TEAMS_WEBHOOK_URL` (required in prod)
- `ENABLE_GITHUB_PAGES` (true/false)
- `PER_RUN_POST_CAP` (default 30)
- `POST_DELAY_MS` (default 1000)
- `TEAMS_MAX_RETRIES` (default 5)
- `FETCH_TIMEOUT_MS`, `POST_TIMEOUT_MS` (timeouts for HTTP)
- `TEAMS_CARD_BUDGET_BYTES` (default ~24KB soft budget)
- `ALLOW_BACKFILL` (default false)
- `MAX_BACKFILL_DAYS` (default 14)

### State
- `data/state.json` stores a `seen` map for canonical IDs and timestamps.
- Backfill is off by default; you can run the seed workflow to populate Pages without posting to Teams.

## Run locally
```bash
npm install
export TEAMS_WEBHOOK_URL="https://outlook.office.com/webhook/..."
npm start                   # runs enhanced pipeline
npm run dry-run             # no Teams posting, no state update
ENABLE_GITHUB_PAGES=true npm run dry-run:html  # builds docs/feed.json locally
```

## GitHub Pages dashboard
- `docs/index.html` loads `docs/feed.json`.
- `docs/feed.json` structure:
```json
{
  "lastUpdated": "2025-01-01T00:00:00.000Z",
  "entries": [
    {"title":"...","link":"...","source":"...","description":"...","publishedDate":"..."}
  ]
}
```
- Non‑empty guarantee: `outputManager` merges current items with previous feed and, if needed, rebuilds from `state.seen`. If still empty, the previous non‑empty feed is kept.

## Posting to Teams
- Adaptive Card v1.4+ payloads with severity headers, meta line, summary (soft size trimming), and link action.
- Exponential backoff with `Retry-After` support; `TEAMS_MAX_RETRIES` and request timeouts respected.

## Testing and quality gates
```bash
npm test                 # unit + integration
```
- CI smoke validates live `feed.json` freshness and that the dashboard initializes (“TI-Dashboard: UI initialized …”).

## Troubleshooting
- Live feed shows 0 items: verify Production run logs and that Pages is enabled; with the non‑empty safeguard, a subsequent run will republish previous items.
- Teams errors: check webhook URL (secret), rate‑limit logs (429), and backoff events.

## Security
- Webhook URL kept in GitHub Secrets and redacted in logs
- Only public RSS content and derived metadata are stored in the repo

## Contributing
- Use feature branches and add tests for new behavior
- Keep Teams posting behavior stable; Pages logic may evolve independently

## License
MIT
