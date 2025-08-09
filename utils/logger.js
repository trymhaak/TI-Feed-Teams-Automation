const LEVELS = ['error', 'warn', 'info', 'debug'];

function getLevel() {
  const lvl = (process.env.LOG_LEVEL || 'info').toLowerCase();
  const idx = LEVELS.indexOf(lvl);
  return idx === -1 ? LEVELS.indexOf('info') : idx;
}

function ts() {
  return new Date().toISOString();
}

export const logger = {
  error: (...args) => {
    if (getLevel() >= 0) console.error(`[${ts()}] ERROR`, ...sanitize(args));
  },
  warn: (...args) => {
    if (getLevel() >= 1) console.warn(`[${ts()}] WARN `, ...sanitize(args));
  },
  info: (...args) => {
    if (getLevel() >= 2) console.log(`[${ts()}] INFO `, ...sanitize(args));
  },
  debug: (...args) => {
    if (getLevel() >= 3) console.log(`[${ts()}] DEBUG`, ...sanitize(args));
  }
};

export default logger;

function sanitize(args) {
  const webhook = process.env.TEAMS_WEBHOOK_URL || '';
  if (!webhook) return args;
  const redacted = '[REDACTED_URL]';
  return args.map(a => typeof a === 'string' ? a.replaceAll(webhook, redacted) : a);
}


