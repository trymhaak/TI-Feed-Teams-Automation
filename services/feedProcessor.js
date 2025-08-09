import { DefaultParser } from '../parsers/defaultParser.js';

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
    return {
      entries: parsed.items || [],
      newEntries: parsed.items || []
    };
  }
}

export default FeedProcessor;


