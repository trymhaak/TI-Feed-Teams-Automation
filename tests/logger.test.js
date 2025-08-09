import { describe, it, expect } from '@jest/globals';
import { logger } from '../utils/logger.js';

describe('Logger redaction', () => {
  it('should redact webhook URL in logs', () => {
    const original = console.log;
    let captured = '';
    console.log = (...args) => { captured += args.join(' '); };
    try {
      process.env.TEAMS_WEBHOOK_URL = 'https://example.com/webhook/secret';
      logger.info('Posting to', process.env.TEAMS_WEBHOOK_URL);
      expect(captured).not.toContain('https://example.com/webhook/secret');
      expect(captured).toContain('[REDACTED_URL]');
    } finally {
      console.log = original;
      delete process.env.TEAMS_WEBHOOK_URL;
    }
  });
});


