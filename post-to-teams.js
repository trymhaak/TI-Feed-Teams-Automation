import fetch from 'node-fetch';

/**
 * Detect threat severity based on content
 * @param {string} title - The title of the threat intel item
 * @param {string} description - The description/summary of the item
 * @returns {Object} - Severity object with level, emoji, and color
 */
function detectSeverity(title, description) {
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
function classifyThreatType(title, description) {
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
 * Posts a threat intelligence item to Microsoft Teams using webhook
 * @param {string} source - The name of the RSS feed source
 * @param {string} title - The title of the threat intel item
 * @param {string} link - The URL to the full article
 * @param {string} description - The description/summary of the item
 * @param {string} publishedDate - The published date from RSS
 * @returns {Promise<boolean>} - Returns true if successful, false otherwise
 */
export async function postToTeams(source, title, link, description = '', publishedDate = '') {
  const webhookUrl = process.env.TEAMS_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.error('TEAMS_WEBHOOK_URL environment variable is not set');
    return false;
  }

  // Detect severity and threat type
  const severity = detectSeverity(title, description);
  const threatType = classifyThreatType(title, description);
  
  // Create enhanced payload with threat intelligence analysis
  const cleanDescription = description.replace(/<[^>]*>/g, '').substring(0, 400); // Increased length
  const formattedDate = publishedDate ? new Date(publishedDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  
  // Build enhanced message with severity and classification
  let message = `${severity.emoji} <strong>Threat Intelligence Alert - ${severity.level}</strong><br><br>`;
  
  // Add threat type classification
  message += `${threatType.emoji} <strong>Type:</strong> ${threatType.category}<br><br>`;
  
  // Add source and priority info
  message += `<strong>Source:</strong> ${source}<br><br>`;
  message += `<strong>Priority:</strong> ${severity.level} (P${severity.priority})<br><br>`;
  
  // Add title with severity styling
  message += `<strong>Title:</strong> ${title}<br><br>`;
  
  // Add publication date
  message += `<strong>Published:</strong> ${formattedDate}<br><br>`;
  
  // Add enhanced summary with threat context
  if (cleanDescription && cleanDescription.length > 10) {
    message += `<strong>Summary:</strong> ${cleanDescription}${cleanDescription.length >= 400 ? '...' : ''}<br><br>`;
  }
  
  // Add action items based on severity
  if (severity.priority <= 2) {
    message += `<strong>⚡ Action Required:</strong> Review and assess impact immediately<br><br>`;
  } else if (severity.priority === 3) {
    message += `<strong>📝 Recommended Action:</strong> Review when convenient<br><br>`;
  }
  
  // Add read more link
  message += `<a href="${link}">🔗 Read Full Threat Report</a>`;
  
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
              "wrap": true
            }
          ]
        }
      }
    ]
  };

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log(`✅ Successfully posted to Teams: ${title}`);
      return true;
    } else {
      console.error(`❌ Failed to post to Teams. Status: ${response.status}, Status Text: ${response.statusText}`);
      const responseText = await response.text();
      console.error(`Response: ${responseText}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error posting to Teams: ${error.message}`);
    return false;
  }
}

// Export functions for testing
export { detectSeverity, classifyThreatType };
