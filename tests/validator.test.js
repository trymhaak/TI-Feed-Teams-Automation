import { describe, test, expect, beforeEach } from '@jest/globals';
import { FeedValidator, scanAvailableParsers } from '../../utils/validateFeeds.js';

describe('FeedValidator', () => {
  let validator;

  beforeEach(() => {
    validator = new FeedValidator();
  });

  test('should validate a complete valid feed', () => {
    const feed = {
      name: 'Test Feed',
      url: 'https://example.com/feed.xml',
      enabled: true,
      category: 'vendor',
      region: 'global',
      priority: 'high',
      description: 'A test feed'
    };

    const result = validator.validateFeed(feed);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.feed).toMatchObject(feed);
  });

  test('should reject feed missing required fields', () => {
    const feed = {
      // Missing name, url, enabled
      category: 'vendor'
    };

    const result = validator.validateFeed(feed);

    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors.some(error => error.includes('Missing required field'))).toBe(true);
    expect(result.feed).toBeNull();
  });

  test('should reject invalid URL', () => {
    const feed = {
      name: 'Test Feed',
      url: 'invalid-url',
      enabled: true
    };

    const result = validator.validateFeed(feed);

    expect(result.isValid).toBe(false);
    expect(result.errors.some(error => error.includes('Invalid URL format'))).toBe(true);
  });

  test('should reject invalid priority', () => {
    const feed = {
      name: 'Test Feed',
      url: 'https://example.com/feed.xml',
      enabled: true,
      priority: 'invalid-priority'
    };

    const result = validator.validateFeed(feed);

    expect(result.isValid).toBe(false);
    expect(result.errors.some(error => error.includes('Priority must be one of'))).toBe(true);
  });

  test('should reject unknown parser', () => {
    const feed = {
      name: 'Test Feed',
      url: 'https://example.com/feed.xml',
      enabled: true,
      parser: 'unknownParser'
    };

    const result = validator.validateFeed(feed);

    expect(result.isValid).toBe(false);
    expect(result.errors.some(error => error.includes('Unknown parser'))).toBe(true);
  });

  test('should accept known parser', () => {
    validator.addAvailableParser('customParser');
    
    const feed = {
      name: 'Test Feed',
      url: 'https://example.com/feed.xml',
      enabled: true,
      parser: 'customParser'
    };

    const result = validator.validateFeed(feed);

    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  test('should normalize feed with defaults', () => {
    const feed = {
      name: 'Minimal Feed',
      url: 'https://example.com/feed.xml',
      enabled: true
    };

    const result = validator.validateFeed(feed);

    expect(result.isValid).toBe(true);
    expect(result.feed.priority).toBe('medium');
    expect(result.feed.category).toBe('unknown');
    expect(result.feed.region).toBe('global');
    expect(result.feed.parser).toBe('defaultParser');
    expect(result.feed.description).toContain('Minimal Feed');
  });

  test('should validate array of feeds', () => {
    const feeds = [
      {
        name: 'Feed 1',
        url: 'https://example.com/feed1.xml',
        enabled: true
      },
      {
        name: 'Feed 2',
        url: 'https://example.com/feed2.xml',
        enabled: false
      },
      {
        // Invalid feed missing required fields
        name: 'Feed 3'
      }
    ];

    const result = validator.validateFeeds(feeds);

    expect(result.totalFeeds).toBe(3);
    expect(result.validCount).toBe(2);
    expect(result.validFeeds).toHaveLength(2);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('should detect duplicate feed names', () => {
    const feeds = [
      {
        name: 'Duplicate Feed',
        url: 'https://example.com/feed1.xml',
        enabled: true
      },
      {
        name: 'Duplicate Feed',
        url: 'https://example.com/feed2.xml',
        enabled: true
      }
    ];

    const result = validator.validateFeeds(feeds);

    expect(result.validCount).toBe(1);
    expect(result.errors.some(error => error.includes('Duplicate feed name'))).toBe(true);
  });

  test('should handle non-array input', () => {
    const result = validator.validateFeeds('not-an-array');

    expect(result.validFeeds).toHaveLength(0);
    expect(result.errors).toContain('Feeds configuration must be an array');
    expect(result.totalFeeds).toBe(0);
    expect(result.validCount).toBe(0);
  });
});

describe('scanAvailableParsers', () => {
  test('should return default parser as fallback', async () => {
    // Test with non-existent directory
    const parsers = await scanAvailableParsers('/non/existent/directory');
    
    expect(parsers).toContain('defaultParser');
  });
});
