export function showHelp() {
  console.log(`
🤖 Threat Feed Bot - Enhanced

USAGE:
  node fetch-and-post-enhanced.js [--dry-run] [--validate] [--help]

OPTIONS:
  --dry-run     Run without posting or updating state
  --validate    Validate configuration and environment
  --help, -h    Show this help message

ENVIRONMENT:
  TEAMS_WEBHOOK_URL    Teams incoming webhook URL
  ENABLE_GITHUB_PAGES  'true' to enable HTML output generation
  PER_RUN_POST_CAP     Cap posts per run (default 30)
  POST_DELAY_MS        Delay between posts (default 1000)
`);
}

export default { showHelp };


