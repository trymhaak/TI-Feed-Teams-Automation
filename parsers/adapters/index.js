/**
 * Adapter registry for per-source normalization.
 * Default behavior: return entry unchanged.
 * Example adapters annotate entries with `_adapter` for traceability.
 */

function identityAdapter(entry) {
  return entry;
}

function msrcAdapter(entry) {
  // Example: ensure basic normalization and tag
  return {
    ...entry,
    title: (entry.title || '').trim(),
    description: entry.description || '',
    _adapter: 'MSRC'
  };
}

function cisaAdapter(entry) {
  return {
    ...entry,
    title: (entry.title || '').trim(),
    description: entry.description || '',
    _adapter: 'CISA'
  };
}

// Map by feed name; could also map by host in future
const feedNameToAdapter = {
  'Microsoft-MSRC': msrcAdapter,
  'CISA-Alerts': cisaAdapter
};

export function normalizeEntryByFeed(entry, feed) {
  if (!feed || !feed.name) return identityAdapter(entry);
  const adapter = feedNameToAdapter[feed.name] || identityAdapter;
  return adapter(entry);
}

export default { normalizeEntryByFeed };


