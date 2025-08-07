import { describe, test, expect, beforeEach } from '@jest/globals';
import { DefaultParser } from '../../parsers/defaultParser.js';

describe('DefaultParser', () => {
  let parser;

  beforeEach(() => {
    parser = new DefaultParser();
  });

  test('should create parser instance', () => {
    expect(parser).toBeInstanceOf(DefaultParser);
    expect(parser.name).toBe('defaultParser');
  });

  test('should normalize items correctly', () => {
    const rawItems = [
      {
        title: 'Test Alert',
        link: 'https://example.com/alert1',
        guid: 'guid1',
        contentSnippet: 'This is a test alert',
        pubDate: '2024-01-01T10:00:00Z'
      },
      {
        title: 'Another Alert',
        guid: 'guid2',
        content: 'Another test alert content',
        isoDate: '2024-01-02T10:00:00Z'
      }
    ];

    const normalized = parser.normalizeItems(rawItems);

    expect(normalized).toHaveLength(2);
    
    // First item
    expect(normalized[0].title).toBe('Test Alert');
    expect(normalized[0].link).toBe('https://example.com/alert1');
    expect(normalized[0].guid).toBe('guid1');
    expect(normalized[0].description).toBe('This is a test alert');
    expect(normalized[0].publishedDate).toBe('2024-01-01T10:00:00Z');
    
    // Second item
    expect(normalized[1].title).toBe('Another Alert');
    expect(normalized[1].link).toBe('guid2');
    expect(normalized[1].guid).toBe('guid2');
    expect(normalized[1].description).toBe('Another test alert content');
    expect(normalized[1].publishedDate).toBe('2024-01-02T10:00:00Z');
  });

  test('should handle items with missing fields', () => {
    const rawItems = [
      {
        // Missing title, link, content
        guid: 'incomplete-item'
      }
    ];

    const normalized = parser.normalizeItems(rawItems);

    expect(normalized).toHaveLength(1);
    expect(normalized[0].title).toBe('No Title');
    expect(normalized[0].link).toBe('incomplete-item');
    expect(normalized[0].description).toBe('');
    expect(normalized[0].publishedDate).toBeDefined();
  });

  test('should indicate it can handle any feed', () => {
    const feed = { url: 'https://example.com/feed.xml' };
    expect(parser.canHandle(feed)).toBe(true);
  });

  test('should return correct configuration', () => {
    const config = parser.getConfig();
    
    expect(config.name).toBe('defaultParser');
    expect(config.supportedFormats).toContain('rss');
    expect(config.supportedFormats).toContain('atom');
    expect(config.supportedFormats).toContain('rdf');
    expect(config.description).toContain('RSS/Atom parser');
  });
});
