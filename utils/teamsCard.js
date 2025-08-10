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
            { type: 'TextBlock', text: `**Threat Intelligence Alert — ${severity.level}**`, wrap: true, weight: 'Bolder', color: severityToColor(severity.level) },
            {
              type: 'FactSet',
              facts: [
                { title: 'Type', value: threatType.category },
                { title: 'Source', value: source },
                { title: 'Published', value: published }
              ]
            },
            { type: 'TextBlock', text: `**${title}**`, wrap: true },
            { type: 'TextBlock', text: summary || 'No summary available', wrap: true, maxLines: 6 }
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


