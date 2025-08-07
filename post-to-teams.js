import fetch from 'node-fetch';
import { formatMessage } from './utils/formatter.js';

// Re-export formatter functions for backward compatibility and testing
export { detectSeverity, classifyThreatType } from './utils/formatter.js';

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
 * @param {Object} feedMetadata - Additional feed metadata (category, region, etc.)
 * @returns {Promise<boolean>} - Returns true if successful, false otherwise
 */
export async function postToTeams(source, title, link, description = '', publishedDate = '', feedMetadata = {}) {
  const webhookUrl = process.env.TEAMS_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.error('TEAMS_WEBHOOK_URL environment variable is not set');
    return false;
  }

  try {
    // Use the new formatter to create the message
    const { payload, metadata } = formatMessage({
      source,
      title,
      link,
      description,
      publishedDate,
      feedMetadata
    });

    console.log(`📝 Formatted message: ${metadata.severity.level} ${metadata.threatType.category} (${metadata.messageLength} chars)`);

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
