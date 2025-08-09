import { DefaultParser } from '../parsers/defaultParser.js';
import { normalizeEntryByFeed } from '../parsers/adapters/index.js';

/**
 * Basic feed processor used by the enhanced pipeline.
 * For now, uses DefaultParser for all feeds and returns normalized entries.
 */
export class FeedProcessor {
  constructor(config = {}) {
    this.config = config;
    this.parser = new DefaultParser();
  }

  async processFeed(feed) {
    const parsed = await this.parser.parseURL(feed.url);
    const items = parsed.items || [];
    const normalized = items.map(e => normalizeEntryByFeed(e, feed));
    return {
      entries: normalized,
      newEntries: normalized
    };
  }
}

export default FeedProcessor;


