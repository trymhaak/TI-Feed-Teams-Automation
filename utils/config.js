export const config = {
  feedsFile: process.env.FEEDS_FILE || './data/feeds.json',
  stateFile: process.env.STATE_FILE || './data/state.json',
  backupDir: process.env.STATE_BACKUP_DIR || './data/backups',
  enableGitHubPages: process.env.ENABLE_GITHUB_PAGES === 'true',
  dryRun: process.env.DRY_RUN === 'true',
  postDelay: Number(process.env.POST_DELAY_MS || 1000),
  perRunPostCap: Number(process.env.PER_RUN_POST_CAP || 30),
  teams: {
    webhookUrl: process.env.TEAMS_WEBHOOK_URL || '',
    maxRetries: Number(process.env.TEAMS_MAX_RETRIES || 5)
  },
  threatFilter: {},
  healthMonitor: {},
  outputs: {},
  feedProcessor: {}
};

export default { config };


