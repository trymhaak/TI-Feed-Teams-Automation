import Parser from 'rss-parser';

/**
 * Default RSS parser implementation
 * This is the standard parser used for most RSS feeds
 */
export class DefaultParser {
  constructor() {
    this.parser = new Parser();
    this.name = 'defaultParser';
  }

  /**
   * Parse an RSS feed from URL
   * @param {string} url - The RSS feed URL to parse
   * @returns {Promise<Object>} - Parsed feed object with items array
   */
  async parseURL(url) {
    try {
      const feed = await this.parser.parseURL(url);
      return {
        title: feed.title,
        description: feed.description,
        link: feed.link,
        items: this.normalizeItems(feed.items || [])
      };
    } catch (error) {
      throw new Error(`Failed to parse RSS feed: ${error.message}`);
    }
  }

  /**
   * Parse RSS content from string
   * @param {string} content - The RSS content as string
   * @returns {Promise<Object>} - Parsed feed object with items array
   */
  async parseString(content) {
    try {
      const feed = await this.parser.parseString(content);
      return {
        title: feed.title,
        description: feed.description,
        link: feed.link,
        items: this.normalizeItems(feed.items || [])
      };
    } catch (error) {
      throw new Error(`Failed to parse RSS content: ${error.message}`);
    }
  }

  /**
   * Normalize RSS items to a consistent format
   * @param {Array} items - Raw RSS items from parser
   * @returns {Array} - Normalized items with consistent field names
   */
  normalizeItems(items) {
    return items.map(item => ({
      title: item.title || 'No Title',
      link: item.link || item.guid,
      guid: item.guid || item.link,
      description: item.contentSnippet || item.content || item.summary || item.description || '',
      publishedDate: item.pubDate || item.isoDate || new Date().toISOString(),
      content: item.content || item.contentSnippet || item.summary || '',
      // Keep original item for any parser-specific fields
      _original: item
    }));
  }

  /**
   * Validate if this parser can handle the given feed
   * @param {Object} feed - Feed configuration object
   * @returns {boolean} - True if this parser can handle the feed
   */
  canHandle(feed) {
    // Default parser can handle any RSS feed
    return true;
  }

  /**
   * Get parser-specific configuration
   * @returns {Object} - Parser configuration object
   */
  getConfig() {
    return {
      name: this.name,
      supportedFormats: ['rss', 'atom', 'rdf'],
      description: 'Standard RSS/Atom parser for most threat intelligence feeds'
    };
  }
}

export default DefaultParser;
