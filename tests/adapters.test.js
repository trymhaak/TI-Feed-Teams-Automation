import { describe, it, expect } from '@jest/globals';
import { normalizeEntryByFeed } from '../parsers/adapters/index.js';

describe('Adapter registry', () => {
  it('uses identity for unknown feed', () => {
    const entry = { title: 'X', description: 'Y' };
    const out = normalizeEntryByFeed(entry, { name: 'Unknown' });
    expect(out).toEqual(entry);
  });

  it('applies MSRC adapter', () => {
    const entry = { title: '  Title  ', description: 'desc' };
    const out = normalizeEntryByFeed(entry, { name: 'Microsoft-MSRC' });
    expect(out.title).toBe('Title');
    expect(out._adapter).toBe('MSRC');
  });

  it('applies CISA adapter', () => {
    const entry = { title: 'A', description: 'desc' };
    const out = normalizeEntryByFeed(entry, { name: 'CISA-Alerts' });
    expect(out._adapter).toBe('CISA');
  });
});


