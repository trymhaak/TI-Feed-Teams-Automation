import { buildAdaptiveCard } from '../utils/teamsCard.js';

function sample(sev, title, desc) {
  return buildAdaptiveCard({
    source: 'Test-Feed',
    title: title || `${sev} alert`,
    link: 'https://example.com/advisory',
    description: desc || `${sev} vulnerability CVE-2025-0001`,
    publishedDate: new Date().toISOString()
  });
}

export async function testTeamsCardSnapshots() {
  const severities = ['CRITICAL','HIGH','MEDIUM','INFO'];
  let ok = true;
  severities.forEach(s => {
    const card = sample(s, `${s} Threat`, `${s.toLowerCase()} vulnerability CVE-2025-0001`);
    const body = card.attachments?.[0]?.content?.body;
    if (!card || card.attachments?.[0]?.content?.version !== '1.4') ok = false;
    if (!Array.isArray(body) || body.length < 4) ok = false; // header, title, badges, summary
  });
  console.log(`✅ Teams AdaptiveCard snapshots: ${ok ? 'OK' : 'FAIL'}`);
  return ok;
}


