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
  const criticalKeywords = ['zero-day', 'rce', 'remote code execution', 
                           'exploit in the wild', 'actively exploited', 'emergency',
                           'ransomware', 'lockbit', 'cryptodestroy'];
  
  // High severity - patch/update required
  const highKeywords = ['high severity', 'security update', 'patch tuesday', 
                       'vulnerability', 'cve-', 'apt29',
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
export function formatMessage(options) {
  const {
    source,
    title,
    link = '#',
    description = '',
    publishedDate = '',
    feedMetadata = {}
  } = options || {};

  // Validate required parameters BEFORE applying defaults
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

export default {
  formatMessage,
  formatSimpleMessage,
  detectSeverity,
  classifyThreatType,
  cleanDescription,
  formatDate
};
