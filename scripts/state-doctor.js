#!/usr/bin/env node
import fs from 'fs/promises';

async function main() {
  try {
    const raw = await fs.readFile('./data/state.json', 'utf8');
    const state = JSON.parse(raw);
    const seen = state.seen || {};
    const bySource = {};
    for (const [id, meta] of Object.entries(seen)) {
      const src = meta.source || 'unknown';
      if (!bySource[src]) bySource[src] = { count: 0, last: null };
      bySource[src].count++;
      const ts = Date.parse(meta.timestamp || 0) || 0;
      if (!bySource[src].last || ts > bySource[src].last) bySource[src].last = ts;
    }
    const rows = Object.entries(bySource).map(([src, v]) => ({
      source: src,
      seenCount: v.count,
      lastSeenUtc: v.last ? new Date(v.last).toISOString() : null
    }));
    const report = {
      generatedAt: new Date().toISOString(),
      totalSeen: Object.keys(seen).length,
      lastRun: state.lastRun || null,
      feeds: rows.sort((a,b)=>a.source.localeCompare(b.source))
    };
    console.log(JSON.stringify(report, null, 2));
    await fs.writeFile('./data/state-report.json', JSON.stringify(report, null, 2), 'utf8');
  } catch (e) {
    console.error('state-doctor failed:', e.message);
    process.exit(1);
  }
}

main();


