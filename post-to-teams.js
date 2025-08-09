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
    const { payload, metadata } = formatMessage({
      source,
      title,
      link,
      description,
      publishedDate,
      feedMetadata
    });
    console.log(`📝 Formatted message: ${metadata.severity.level} ${metadata.threatType.category} (${metadata.messageLength} chars)`);

    // Rate limit/backoff with Retry-After support
    const maxRetries = Number(process.env.TEAMS_MAX_RETRIES || 5);
    let attempt = 0;
    let delayMs = 1000;

    const postTimeoutMs = Number(process.env.POST_TIMEOUT_MS || 5000);
    while (attempt <= maxRetries) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), postTimeoutMs);
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timer);

      if (response.ok) {
        console.log(`✅ Successfully posted to Teams: ${title}`);
        return true;
      }

      // Handle 429 with Retry-After header
      if (response.status === 429 && attempt < maxRetries) {
        const retryAfter = response.headers.get('Retry-After');
        const retryMs = retryAfter ? Number(retryAfter) * 1000 : delayMs;
        console.warn(`⚠️  429 Too Many Requests. Retrying in ${Math.round(retryMs)}ms (attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(r => setTimeout(r, retryMs));
        attempt++;
        delayMs = Math.min(delayMs * 2, 30000);
        continue;
      }

      // Other failures
      const responseText = await response.text();
      console.error(`❌ Failed to post to Teams. Status: ${response.status} ${response.statusText}. Response: ${responseText}`);
      return false;
    }

    console.error(`❌ Exhausted retries posting to Teams: ${title}`);
    return false;
  } catch (error) {
    // Redact webhook URL if it appears in error messages
    const redacted = (error && error.message || '').replaceAll(webhookUrl || '', '[REDACTED_URL]');
    console.error(`❌ Error posting to Teams: ${redacted}`);
    return false;
  }
}
