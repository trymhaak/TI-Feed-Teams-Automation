import { cleanDescription, detectSeverity, classifyThreatType, formatDate } from './formatter.js';
import { logger } from './logger.js';

function severityToColor(level) {
  const map = { CRITICAL: 'attention', HIGH: 'warning', MEDIUM: 'accent', INFO: 'default' };
  return map[level] || 'default';
}

function severityToEmoji(level) {
  return level === 'CRITICAL' ? '🚨' : level === 'HIGH' ? '⚠️' : 'ℹ️';
}

function toUtcPretty(iso) {
  try {
    const d = new Date(iso);
    const pad = n => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
  } catch { return String(iso || '') }
}

function byteLength(obj) {
  try { return Buffer.byteLength(JSON.stringify(obj), 'utf8'); } catch { return 0; }
}

function sentences(text) {
  const parts = String(text || '').split(/(?<=[.!?])\s+/);
  return parts.filter(Boolean);
}

export function buildAdaptiveCard({ source, title, link, description, publishedDate }) {
  const severity = detectSeverity(title, description);
  const threatType = classifyThreatType(title, description);
  let summary = cleanDescription(description, 50000); // start with full text; soft-limit later
  const published = formatDate(publishedDate);
  const cves = Array.from(new Set((`${title} ${description||''}`.match(/CVE-\d{4}-\d{4,7}/gi) || []).slice(0,3)));
  const cveLinks = cves.map(c => `[${c}](https://nvd.nist.gov/vuln/detail/${c})`);
  const recommended =
    severity.level === 'CRITICAL' ? 'Immediately assess exposure, prioritize patching/mitigation, and monitor for exploitation.' :
    severity.level === 'HIGH' ? 'Prioritize patching in normal change window and monitor for related activity.' :
    'Review and triage as appropriate.';
  const headerText = `${severityToEmoji(severity.level)} Threat Intelligence Alert — ${severity.level}`;
  const badgesLine = `Type: ${threatType.category}  |  Source: ${source}  |  Published: ${toUtcPretty(publishedDate)}`;

  // Build rich card first (not relied on by current Flow, but kept for future-proofing)
  const facts = [];
  if (cves.length) facts.push({ title: 'CVEs', value: cveLinks.join(', ') });
  facts.push({ title: 'Feed', value: source });

  const baseCard = {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            { type: 'TextBlock', text: `**${headerText}**`, wrap: true, weight: 'Bolder', color: severityToColor(severity.level) },
            { type: 'TextBlock', text: `**${title}**`, wrap: true, maxLines: 2, weight: 'Bolder' },
            { type: 'TextBlock', text: badgesLine, wrap: true, isSubtle: true, spacing: 'Small' },
            { type: 'TextBlock', text: '', wrap: true }, // summary placeholder index 3
            ...(facts.length ? [{ type: 'FactSet', facts }] : [])
          ],
          actions: [
            { type: 'Action.OpenUrl', title: 'Read Advisory →', url: link }
          ]
        }
      }
    ]
  };

  // Soft-limit logic
  const budget = Number(process.env.TEAMS_CARD_BUDGET_BYTES || 24000);
  const minFloor = 320; // minimum summary floor
  let trimmed = false;

  function setSummary(text) {
    baseCard.attachments[0].content.body[3].text = text;
  }

  setSummary(summary);
  let size = byteLength(baseCard);
  if (size > budget) {
    const sents = sentences(summary);
    let acc = '';
    for (let i = 0; i < sents.length; i++) {
      const next = acc ? acc + ' ' + sents[i] : sents[i];
      setSummary(next);
      size = byteLength(baseCard);
      if (size > budget && next.length > minFloor) {
        // finalize previous sentence with ellipsis
        setSummary((acc || sents[0]).trimEnd() + '…');
        trimmed = true;
        break;
      }
      acc = next;
    }
    if (!trimmed) {
      setSummary(acc);
      size = byteLength(baseCard);
    }
  }

  // Backward-compatible HTML in first block (Flow posts body[0].text)
  const html = [
    `<strong>${headerText}</strong>`,
    `<br/><br/><strong>${title}</strong>`,
    `<br/><span>${badgesLine}</span>`,
    summary ? `<br/><br/>${baseCard.attachments[0].content.body[3].text}` : '',
    (cves.length ? `<br/><br/><strong>CVEs:</strong> ${cves.map(c=>`<a href=\"https://nvd.nist.gov/vuln/detail/${c}\">${c}</a>`).join(', ')}` : ''),
    `<br/><br/><a href="${link}">Read Advisory →</a>`
  ].join('');
  baseCard.attachments[0].content.body[0].text = html;

  logger.debug(
    `teams_card bytes=${size} summary_chars=${(baseCard.attachments[0].content.body[3].text||'').length} trimmed=${trimmed}`
  );

  return baseCard;
}

export default { buildAdaptiveCard };


