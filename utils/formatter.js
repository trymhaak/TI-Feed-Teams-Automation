/**
 * Message formatter utility for Teams webhook integration
 * Handles consistent formatting of threat intelligence messages
 */

/**
 * Detect threat severity based on content
 * @param {string} title - The title of the threat intel item
 * @param {string} description - The description/summary of the item
 * @returns {Object} - Severity object with level, emoji, and color
 */
export function detectSeverity(title, description) {
  const content = (title + ' ' + description).toLowerCase();
  
  // Critical threats - immediate action required
  const criticalKeywords = ['critical', 'zero-day', 'rce', 'remote code execution', 
                           'exploit in the wild', 'actively exploited', 'emergency',
                           'ransomware', 'lockbit', 'cryptodestroy'];
  
  // High severity - patch/update required
  const highKeywords = ['high severity', 'security update', 'patch tuesday', 
                       'vulnerability', 'cve-', 'security advisory', 'apt29',
                       'advanced persistent threat', 'apt', 'phishing campaign',
                       'data breach', 'exposed', 'leaked', 'compromised'];
  
  // Medium severity - informational but important
  const mediumKeywords = ['moderate', 'advisory', 'recommendation', 'guidance',
                         'medium priority', 'security alert'];
  
  if (criticalKeywords.some(keyword => content.includes(keyword))) {
    return { 
      level: 'CRITICAL', 
      emoji: '🚨', 
      color: '#FF0000',
      priority: 1 
    };
  }
  
  if (highKeywords.some(keyword => content.includes(keyword))) {
    return { 
      level: 'HIGH', 
      emoji: '⚠️', 
      color: '#FF8C00',
      priority: 2 
    };
  }
  
  if (mediumKeywords.some(keyword => content.includes(keyword))) {
    return { 
      level: 'MEDIUM', 
      emoji: '📋', 
      color: '#32CD32',
      priority: 3 
    };
  }
  
  // Default severity
  return { 
    level: 'INFO', 
    emoji: 'ℹ️', 
    color: '#1E90FF',
    priority: 4 
  };
}

/**
 * Classify threat type based on content
 * @param {string} title - The title of the threat intel item
 * @param {string} description - The description/summary of the item
 * @returns {Object} - Threat type object
 */
export function classifyThreatType(title, description) {
  const content = (title + ' ' + description).toLowerCase();
  
  const threatTypes = {
    malware: {
      keywords: ['ransomware', 'trojan', 'backdoor', 'malware', 'virus', 'worm'],
      emoji: '🦠',
      category: 'Malware'
    },
    vulnerability: {
      keywords: ['vulnerability', 'cve-', 'patch', 'security update', 'buffer overflow'],
      emoji: '🔓',
      category: 'Vulnerability'
    },
    phishing: {
      keywords: ['phishing', 'scam', 'social engineering', 'fraudulent'],
      emoji: '🎣',
      category: 'Phishing'
    },
    apt: {
      keywords: ['apt', 'advanced persistent threat', 'nation state', 'targeted attack'],
      emoji: '🎯',
      category: 'APT'
    },
    data_breach: {
      keywords: ['data breach', 'data leak', 'exposed database', 'credential theft'],
      emoji: '💾',
      category: 'Data Breach'
    }
  };
  
  for (const [key, type] of Object.entries(threatTypes)) {
    if (type.keywords.some(keyword => content.includes(keyword))) {
      return type;
    }
  }
  
  return { emoji: '📄', category: 'General' };
}

/**
 * Clean and truncate description text
 * @param {string} description - Raw description text
 * @param {number} maxLength - Maximum length for description
 * @returns {string} - Cleaned and truncated description
 */
export function cleanDescription(description, maxLength = 400) {
  if (!description || typeof description !== 'string') {
    return '';
  }
  
  // Remove HTML tags and normalize whitespace
  const cleaned = description
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  if (cleaned.length <= maxLength) {
    return cleaned;
  }
  
  // Truncate at word boundary
  const truncated = cleaned.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  
  if (lastSpace > maxLength * 0.8) {
    return truncated.substring(0, lastSpace) + '...';
  }
  
  return truncated + '...';
}

/**
 * Format date for display
 * @param {string} publishedDate - ISO date string or other date format
 * @returns {string} - Formatted date string
 */
export function formatDate(publishedDate) {
  if (!publishedDate) {
    return new Date().toISOString().split('T')[0];
  }
  
  try {
    return new Date(publishedDate).toISOString().split('T')[0];
  } catch (error) {
    console.warn(`Invalid date format: ${publishedDate}`);
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Format threat intelligence message for Teams
 * @param {Object} options - Message formatting options
 * @returns {Object} - Formatted Teams webhook payload
 */
export function formatMessage({
  source = 'Unknown Source',
  title = 'No Title',
  link = '#',
  description = '',
  publishedDate = '',
  feedMetadata = {}
}) {
  // Validate required parameters
  if (!source || !title) {
    throw new Error('Source and title are required for message formatting');
  }
  
  // Detect severity and threat type
  const severity = detectSeverity(title, description);
  const threatType = classifyThreatType(title, description);
  
  // Clean and format content
  const cleanDesc = cleanDescription(description);
  const formattedDate = formatDate(publishedDate);
  
  // Build enhanced message with severity and classification
  let message = `${severity.emoji} <strong>Threat Intelligence Alert - ${severity.level}</strong><br><br>`;
  
  // Add threat type classification
  message += `${threatType.emoji} <strong>Type:</strong> ${threatType.category}<br><br>`;
  
  // Add source and priority info
  message += `<strong>Source:</strong> ${source}`;
  
  // Add feed metadata if available
  if (feedMetadata.region) {
    message += ` (${feedMetadata.region})`;
  }
  if (feedMetadata.category) {
    message += ` [${feedMetadata.category}]`;
  }
  message += `<br><br>`;
  
  message += `<strong>Priority:</strong> ${severity.level} (P${severity.priority})<br><br>`;
  
  // Add title with severity styling
  message += `<strong>Title:</strong> ${title}<br><br>`;
  
  // Add publication date
  message += `<strong>Published:</strong> ${formattedDate}<br><br>`;
  
  // Add enhanced summary with threat context
  if (cleanDesc && cleanDesc.length > 10) {
    message += `<strong>Summary:</strong> ${cleanDesc}<br><br>`;
  }
  
  // Add action items based on severity
  if (severity.priority <= 2) {
    message += `<strong>⚡ Action Required:</strong> Review and assess impact immediately<br><br>`;
  } else if (severity.priority === 3) {
    message += `<strong>📝 Recommended Action:</strong> Review when convenient<br><br>`;
  }
  
  // Add parser info if available
  if (feedMetadata.parser && feedMetadata.parser !== 'defaultParser') {
    message += `<strong>Parser:</strong> ${feedMetadata.parser}<br><br>`;
  }
  
  // Add read more link
  message += `<a href="${link}">🔗 Read Full Threat Report</a>`;
  
  // Create Teams webhook payload
  const payload = {
    "type": "ThreatIntelAlert",
    "attachments": [
      {
        "contentType": "text/html",
        "content": {
          "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
          "type": "AdaptiveCard",
          "version": "1.2",
          "body": [
            {
              "type": "TextBlock",
              "text": message,
              "wrap": true,
              "color": severity.color
            }
          ]
        }
      }
    ]
  };
  
  return {
    payload,
    metadata: {
      severity,
      threatType,
      formattedDate,
      messageLength: message.length
    }
  };
}

/**
 * Create a simple text message for fallback scenarios
 * @param {Object} options - Message options
 * @returns {string} - Simple text message
 */
export function formatSimpleMessage({
  source,
  title,
  link,
  description,
  publishedDate
}) {
  const severity = detectSeverity(title, description);
  const threatType = classifyThreatType(title, description);
  const formattedDate = formatDate(publishedDate);
  
  return `${severity.emoji} ${severity.level} Threat Alert
${threatType.emoji} Type: ${threatType.category}
Source: ${source}
Published: ${formattedDate}

${title}

${cleanDescription(description, 200)}

Read more: ${link}`;
}

/**
 * Helper functions for enhanced Teams adaptive cards
 */

/**
 * Get severity color for Teams cards
 */
export function getSeverityColor(severity) {
  const colors = {
    critical: 'attention',
    high: 'warning', 
    medium: 'good',
    low: 'accent',
    info: 'default'
  };
  return colors[severity] || 'default';
}

/**
 * Get severity emoji
 */
export function getSeverityEmoji(severity) {
  const emojis = {
    critical: '🚨',
    high: '⚠️',
    medium: '📋',
    low: 'ℹ️',
    info: 'ℹ️'
  };
  return emojis[severity] || 'ℹ️';
}

/**
 * Get threat type emoji
 */
export function getThreatTypeEmoji(threatType) {
  const emojis = {
    vulnerability: '🔓',
    malware: '🦠',
    apt: '🎯',
    data_breach: '💾',
    phishing: '🎣',
    ddos: '⚡',
    insider_threat: '👤',
    supply_chain: '🔗',
    general: '📄'
  };
  return emojis[threatType] || '📄';
}

/**
 * Get severity icon URL for Teams cards
 */
export function getSeverityIcon(severity) {
  // Using standard iconify icons that work in Teams
  const icons = {
    critical: 'https://img.icons8.com/color/48/000000/error.png',
    high: 'https://img.icons8.com/color/48/000000/warning-shield.png',
    medium: 'https://img.icons8.com/color/48/000000/security-checked.png',
    low: 'https://img.icons8.com/color/48/000000/info.png',
    info: 'https://img.icons8.com/color/48/000000/info.png'
  };
  return icons[severity] || icons.info;
}

/**
 * Classify threat severity (simplified for consistency)
 */
export function classifyThreatSeverity(title, description) {
  const content = `${title} ${description || ''}`.toLowerCase();
  
  if (['critical', 'zero-day', 'rce', 'remote code execution', 'emergency'].some(k => content.includes(k))) {
    return 'critical';
  }
  if (['high', 'exploit', 'vulnerability', 'cve-', 'security update'].some(k => content.includes(k))) {
    return 'high';
  }
  if (['medium', 'advisory', 'patch'].some(k => content.includes(k))) {
    return 'medium';
  }
  if (['low', 'informational'].some(k => content.includes(k))) {
    return 'low';
  }
  return 'info';
}

/**
 * Generate enhanced Teams adaptive card for a feed entry
 * @param {Object} entry - Feed entry object
 * @param {string} feedName - Name of the feed
 * @returns {Object} Teams adaptive card
 */
export function formatTeamsMessage(entry, feedName) {
  const severity = entry.classification?.severity || classifyThreatSeverity(entry.title, entry.description);
  const threatType = entry.classification?.threatType || classifyThreatType(entry.title, entry.description).category.toLowerCase().replace(' ', '_');
  const indicators = entry.classification?.indicators || {};
  
  const severityColor = getSeverityColor(severity);
  const severityEmoji = getSeverityEmoji(severity);
  const threatEmoji = getThreatTypeEmoji(threatType);
  const severityIcon = getSeverityIcon(severity);

  // Build facts array
  const facts = [
    {
      title: "Published",
      value: formatDate(entry.publishedDate)
    },
    {
      title: "Source",
      value: feedName
    },
    {
      title: "Threat Type",
      value: threatType.replace('_', ' ').toUpperCase()
    },
    {
      title: "Severity",
      value: severity.toUpperCase()
    }
  ];

  // Add confidence if available
  if (entry.classification?.confidence) {
    facts.push({
      title: "Confidence",
      value: `${entry.classification.confidence}%`
    });
  }

  // Add CVE if available
  if (indicators.cves && indicators.cves.length > 0) {
    facts.push({
      title: "CVE IDs",
      value: indicators.cves.slice(0, 3).join(', ')
    });
  }

  // Build actions array
  const actions = [
    {
      type: "Action.OpenUrl",
      title: "📖 Read Article",
      url: entry.link
    }
  ];

  // Add quick action buttons based on threat type and severity
  if (severity === 'critical' || severity === 'high') {
    actions.push({
      type: "Action.Submit",
      title: "🚨 Alert Team",
      data: {
        action: "alert_team",
        entryId: entry.id || entry.link,
        severity: severity,
        threatType: threatType
      }
    });
  }

  // Add search actions for indicators
  if (indicators.cves && indicators.cves.length > 0) {
    actions.push({
      type: "Action.OpenUrl",
      title: "🔍 Search CVE",
      url: `https://nvd.nist.gov/vuln/search/results?form_type=Basic&results_type=overview&query=${indicators.cves[0]}`
    });
  }

  if (indicators.ips && indicators.ips.length > 0) {
    actions.push({
      type: "Action.OpenUrl", 
      title: "🌐 Check IP",
      url: `https://www.virustotal.com/gui/ip-address/${indicators.ips[0]}`
    });
  }

  if (indicators.domains && indicators.domains.length > 0) {
    actions.push({
      type: "Action.OpenUrl",
      title: "🔗 Check Domain", 
      url: `https://www.virustotal.com/gui/domain/${indicators.domains[0]}`
    });
  }

  // Add bookmark action
  actions.push({
    type: "Action.Submit",
    title: "🔖 Bookmark",
    data: {
      action: "bookmark",
      entryId: entry.id || entry.link,
      title: entry.title
    }
  });

  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        content: {
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            {
              type: "Container",
              style: "emphasis",
              items: [
                {
                  type: "ColumnSet",
                  columns: [
                    {
                      type: "Column",
                      width: "auto",
                      items: [
                        {
                          type: "Image",
                          url: severityIcon,
                          size: "Small",
                          style: "Default"
                        }
                      ]
                    },
                    {
                      type: "Column",
                      width: "auto", 
                      items: [
                        {
                          type: "TextBlock",
                          text: `${threatEmoji} ${severityEmoji}`,
                          size: "Large",
                          spacing: "None"
                        }
                      ]
                    },
                    {
                      type: "Column",
                      width: "stretch",
                      items: [
                        {
                          type: "TextBlock",
                          text: entry.title,
                          weight: "Bolder",
                          wrap: true,
                          size: "Medium"
                        },
                        {
                          type: "TextBlock",
                          text: `**${severity.toUpperCase()}** | ${threatType.replace('_', ' ')} | ${feedName}`,
                          color: severityColor,
                          weight: "Bolder",
                          size: "Small"
                        }
                      ]
                    }
                  ]
                }
              ]
            },
            {
              type: "TextBlock",
              text: entry.description || "No description available",
              wrap: true,
              spacing: "Medium",
              maxLines: 3
            },
            {
              type: "FactSet",
              facts: facts,
              spacing: "Medium"
            }
          ],
          actions: actions.slice(0, 6) // Limit to 6 actions per Teams constraints
        }
      }
    ]
  };
}

export default {
  formatMessage,
  formatSimpleMessage,
  formatTeamsMessage,
  detectSeverity,
  classifyThreatType,
  classifyThreatSeverity,
  cleanDescription,
  formatDate,
  getSeverityColor,
  getSeverityEmoji,
  getThreatTypeEmoji,
  getSeverityIcon
};
