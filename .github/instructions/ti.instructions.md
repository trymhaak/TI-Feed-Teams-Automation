---
applyTo: '**/*.js'
---

# PROJECT: Threat Feed Bot

## DESCRIPTION:
This project implements an automated threat intelligence feed collector. It polls open-source RSS feeds and posts newly published items to a Microsoft Teams channel using a webhook. The bot runs on a fixed schedule using GitHub Actions and avoids duplicate postings via simple file-based state tracking.

## INTENDED OUTCOME:
- Automatically notify a SOC team when new threat intel is published by selected sources
- Run every 30 minutes without manual intervention
- Operate without relying on external databases or cloud infrastructure

## PROJECT STRUCTURE:

1. **feeds.json**
   - JSON array containing RSS feed metadata
   - Format: [{ "name": "CISA", "url": "https://..." }]
   - Feeds must have unique "name" fields

2. **state.json**
   - JSON object storing last processed item per feed
   - Format: { "CISA": "https://..." }

3. **fetch-and-post.js**
   - Main program logic
   - Responsibilities:
     • Load and parse each RSS feed using rss-parser
     • Compare entries against state.json
     • Send unseen entries to Teams using postToTeams()
     • Update state.json on success
   - Must skip already processed entries
   - Must not fail entirely if one feed breaks

4. **post-to-teams.js**
   - Contains function: postToTeams(source, title, link)
   - Sends adaptive card message to Microsoft Teams using webhook
   - Uses webhook URL from environment variable TEAMS_WEBHOOK_URL
   - Formats message as Markdown or JSON payload (MessageCard format)

5. **.github/workflows/rss-to-teams.yml**
   - GitHub Actions configuration
   - Runs every 30 minutes via cron trigger
   - Node.js setup + npm install + script execution
   - Commits and pushes updated state.json after successful run

## TECHNICAL GUIDELINES:
- Node.js 18+
- ECMAScript Modules ("type": "module" in package.json)
- Use async/await for all asynchronous operations
- Use node-fetch for HTTP requests
- Code must fail gracefully: no unhandled exceptions
- Log failures to console without stopping entire loop
- No frontend or CLI required
- No database integration
- No caching or deduplication beyond state.json

## NON-GOALS (OUT OF SCOPE FOR MVP):
- Integration with Slack, Notion, or email
- GPT-based summarization or tagging
- Feed enrichment (e.g., IOC extraction, MITRE mapping)
- Visual dashboard or web UI
- JSON or GraphQL feed parsing

## COMPLETION CRITERIA:
- A new post from any feed is successfully sent to Teams
- Duplicate entries are avoided
- GitHub Actions executes cleanly and updates state.json
- Failures are contained and logged
Provide project context and coding guidelines that AI should follow when generating code, answering questions, or reviewing changes.