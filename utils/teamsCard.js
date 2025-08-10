import { cleanDescription, detectSeverity, classifyThreatType, formatDate } from './formatter.js';

function severityToColor(level) {
  const map = { CRITICAL: 'attention', HIGH: 'warning', MEDIUM: 'accent', INFO: 'default' };
  return map[level] || 'default';
}

export function buildAdaptiveCard({ source, title, link, description, publishedDate }) {
  const severity = detectSeverity(title, description);
  const threatType = classifyThreatType(title, description);
  const summary = cleanDescription(description, 280);
  const published = formatDate(publishedDate);
  const html = [
    `<strong>Threat Intelligence Alert — ${severity.level}</strong>`,
    `<br/><br/><strong>Type:</strong> ${threatType.category}  |  <strong>Source:</strong> ${source}  |  <strong>Published:</strong> ${published}`,
    `<br/><br/><strong>${title}</strong>`,
    summary ? `<br/><br/>${summary}` : '',
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


