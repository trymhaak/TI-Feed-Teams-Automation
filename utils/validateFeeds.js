import fs from 'fs/promises';
import path from 'path';

/**
 * Validate feed configuration structure and content
 */
export class FeedValidator {
  constructor() {
    this.requiredFields = ['name', 'url', 'enabled'];
    this.optionalFields = ['category', 'region', 'priority', 'description', 'parser'];
    this.validPriorities = ['high', 'medium', 'low'];
    this.validCategories = ['national', 'vendor', 'government', 'commercial', 'community'];
    this.availableParsers = new Set(['defaultParser']);
  }

  /**
   * Add a parser to the list of available parsers
   * @param {string} parserName - Name of the parser
   */
  addAvailableParser(parserName) {
    this.availableParsers.add(parserName);
  }

  /**
   * Validate a single feed configuration
   * @param {Object} feed - Feed configuration object
   * @param {number} index - Index of the feed in the array (for error reporting)
   * @returns {Object} - Validation result with isValid and errors
   */
  validateFeed(feed, index = 0) {
    const errors = [];
    const feedIdentifier = feed?.name || `feed[${index}]`;

    // Check if feed is an object
    if (!feed || typeof feed !== 'object') {
      return {
        isValid: false,
        errors: [`${feedIdentifier}: Feed must be an object`],
        feed: null
      };
    }

    // Validate required fields
    for (const field of this.requiredFields) {
      if (!feed[field]) {
        errors.push(`${feedIdentifier}: Missing required field '${field}'`);
      } else if (typeof feed[field] !== 'string' && field !== 'enabled') {
        errors.push(`${feedIdentifier}: Field '${field}' must be a string`);
      }
    }

    // Validate enabled field specifically
    if (feed.enabled !== undefined && typeof feed.enabled !== 'boolean') {
      errors.push(`${feedIdentifier}: Field 'enabled' must be a boolean`);
    }

    // Validate URL format
    if (feed.url) {
      try {
        const url = new URL(feed.url);
        if (!['http:', 'https:'].includes(url.protocol)) {
          errors.push(`${feedIdentifier}: URL must use HTTP or HTTPS protocol`);
        }
      } catch (error) {
        errors.push(`${feedIdentifier}: Invalid URL format - ${error.message}`);
      }
    }

    // Validate priority if specified
    if (feed.priority && !this.validPriorities.includes(feed.priority)) {
      errors.push(`${feedIdentifier}: Priority must be one of: ${this.validPriorities.join(', ')}`);
    }

    // Validate category if specified
    if (feed.category && !this.validCategories.includes(feed.category)) {
      errors.push(`${feedIdentifier}: Category must be one of: ${this.validCategories.join(', ')}`);
    }

    // Validate parser if specified
    if (feed.parser && !this.availableParsers.has(feed.parser)) {
      errors.push(`${feedIdentifier}: Unknown parser '${feed.parser}'. Available parsers: ${Array.from(this.availableParsers).join(', ')}`);
    }

    // Validate name uniqueness (this will be checked at the array level)
    if (feed.name && typeof feed.name === 'string') {
      if (feed.name.trim().length === 0) {
        errors.push(`${feedIdentifier}: Name cannot be empty`);
      }
      if (feed.name.length > 100) {
        errors.push(`${feedIdentifier}: Name cannot exceed 100 characters`);
      }
    }

    // Check for unknown fields
    const allKnownFields = [...this.requiredFields, ...this.optionalFields];
    const unknownFields = Object.keys(feed).filter(field => !allKnownFields.includes(field));
    if (unknownFields.length > 0) {
      errors.push(`${feedIdentifier}: Unknown fields detected: ${unknownFields.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      feed: errors.length === 0 ? this.normalizeFeed(feed) : null
    };
  }

  /**
   * Normalize feed configuration by adding defaults
   * @param {Object} feed - Valid feed configuration
   * @returns {Object} - Normalized feed configuration
   */
  normalizeFeed(feed) {
    return {
      ...feed,
      priority: feed.priority || 'medium',
      category: feed.category || 'unknown',
      region: feed.region || 'global',
      description: feed.description || `Threat intelligence feed: ${feed.name}`,
      parser: feed.parser || 'defaultParser',
      enabled: feed.enabled !== false // Default to true unless explicitly false
    };
  }

  /**
   * Validate an array of feed configurations
   * @param {Array} feeds - Array of feed configurations
   * @returns {Object} - Validation result with valid feeds and errors
   */
  validateFeeds(feeds) {
    if (!Array.isArray(feeds)) {
      return {
        validFeeds: [],
        errors: ['Feeds configuration must be an array'],
        totalFeeds: 0,
        validCount: 0
      };
    }

    const validFeeds = [];
    const allErrors = [];
    const feedNames = new Set();

    feeds.forEach((feed, index) => {
      const result = this.validateFeed(feed, index);
      
      if (result.isValid && result.feed) {
        // Check for duplicate names
        if (feedNames.has(result.feed.name)) {
          allErrors.push(`Duplicate feed name '${result.feed.name}' found at index ${index}`);
        } else {
          feedNames.add(result.feed.name);
          validFeeds.push(result.feed);
        }
      }
      
      allErrors.push(...result.errors);
    });

    return {
      validFeeds,
      errors: allErrors,
      totalFeeds: feeds.length,
      validCount: validFeeds.length
    };
  }

  /**
   * Load and validate feeds from a JSON file
   * @param {string} filePath - Path to the feeds.json file
   * @returns {Promise<Object>} - Validation result
   */
  async loadAndValidateFeeds(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const feeds = JSON.parse(content);
      return this.validateFeeds(feeds);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {
          validFeeds: [],
          errors: [`Feeds file not found: ${filePath}`],
          totalFeeds: 0,
          validCount: 0
        };
      } else if (error instanceof SyntaxError) {
        return {
          validFeeds: [],
          errors: [`Invalid JSON in feeds file: ${error.message}`],
          totalFeeds: 0,
          validCount: 0
        };
      } else {
        return {
          validFeeds: [],
          errors: [`Error reading feeds file: ${error.message}`],
          totalFeeds: 0,
          validCount: 0
        };
      }
    }
  }
}

/**
 * Scan for available parsers in the parsers directory
 * @param {string} parsersDir - Path to the parsers directory
 * @returns {Promise<Array>} - Array of available parser names
 */
export async function scanAvailableParsers(parsersDir) {
  try {
    const files = await fs.readdir(parsersDir);
    const parserFiles = files.filter(file => 
      file.endsWith('.js') && 
      file !== 'index.js' && 
      !file.startsWith('.')
    );
    
    return parserFiles.map(file => path.basename(file, '.js'));
  } catch (error) {
    console.warn(`Warning: Could not scan parsers directory: ${error.message}`);
    return ['defaultParser']; // Return default parser as fallback
  }
}

export default FeedValidator;
