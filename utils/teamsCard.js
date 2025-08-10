import { cleanDescription, detectSeverity, classifyThreatType, formatDate } from './formatter.js';

function severityToColor(level) {
  const map = { CRITICAL: 'attention', HIGH: 'warning', MEDIUM: 'accent', INFO: 'default' };
  return map[level] || 'default';
}

export function buildAdaptiveCard({ source, title, link, description, publishedDate }) {
  const severity = detectSeverity(title, description);
  const threatType = classifyThreatType(title, description);
  const summary = cleanDescription(description, 480);
  const published = formatDate(publishedDate);
  const cves = Array.from(new Set((`${title} ${description||''}`.match(/CVE-\d{4}-\d{4,7}/gi) || []).slice(0,3)));
  const recommended =
    severity.level === 'CRITICAL' ? 'Immediately assess exposure, prioritize patching/mitigation, and monitor for exploitation.' :
    severity.level === 'HIGH' ? 'Prioritize patching in normal change window and monitor for related activity.' :
    'Review and triage as appropriate.';
  const html = [
    `<strong>Threat Intelligence Alert — ${severity.level}</strong>`,
    `<br/><br/><strong>Type:</strong> ${threatType.category}  |  <strong>Source:</strong> ${source}  |  <strong>Published:</strong> ${published}`,
    `<br/><br/><strong>${title}</strong>`,
    summary ? `<br/><br/>${summary}` : '',
    (cves.length ? `<br/><br/><strong>Indicators:</strong> CVE(s): ${cves.join(', ')}` : ''),
    `<br/><br/><strong>Recommended:</strong> ${recommended}`,
    `<br/><br/><a href="${link}">Read Advisory →</a>`
  ].join('');

  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            { type: 'TextBlock', text: html, wrap: true, color: severityToColor(severity.level) }
          ],
          actions: [
            { type: 'Action.OpenUrl', title: 'Read Advisory →', url: link }
          ]
        }
      }
    ]
  };
}

export default { buildAdaptiveCard };


