import fetch from 'node-fetch';
import { formatMessage } from './utils/formatter.js';

// Re-export formatter functions for backward compatibility and testing
export { detectSeverity, classifyThreatType } from './utils/formatter.js';

/**
 * Posts a threat intelligence item to Microsoft Teams using webhook
 * Supports both positional args and an entry object
 * @param {string|Object} sourceOrEntry - Source string or entry object
 * @param {string} [title]
 * @param {string} [link]
 * @param {string} [description]
 * @param {string} [publishedDate]
 * @param {Object} [feedMetadata]
 * @returns {Promise<{success: boolean, status?: number, statusText?: string, error?: string}>>
 */
export async function postToTeams(
  sourceOrEntry,
  title,
  link,
  description = '',
  publishedDate = '',
  feedMetadata = {}
) {
  const webhookUrl = process.env.TEAMS_WEBHOOK_URL;

  if (!webhookUrl) {
    const msg = 'TEAMS_WEBHOOK_URL environment variable is not set';
    console.error(msg);
    return { success: false, error: msg };
  }

  // Normalize input to a single options object expected by formatter
  let options;
  if (typeof sourceOrEntry === 'object' && sourceOrEntry !== null) {
    const entry = sourceOrEntry;
    options = {
      source: entry.source || entry.feedName || 'Unknown Source',
      title: entry.title || 'No Title',
      link: entry.link || entry.url || '#',
      description: entry.description || '',
      publishedDate: entry.publishedDate || '',
      feedMetadata: entry.feedMetadata || {
        category: entry.category,
        region: entry.region,
        priority: entry.priority,
        parser: entry.parser
      }
    };
  } else {
    options = {
      source: sourceOrEntry,
      title,
      link,
      description,
      publishedDate,
      feedMetadata
    };
  }

  try {
    // Use the formatter to create the Teams payload
    const { payload, metadata } = formatMessage(options);

    console.log(
      `📝 Formatted message: ${metadata.severity.level} ${metadata.threatType.category} (${metadata.messageLength} chars)`
    );

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log(`✅ Successfully posted to Teams: ${options.title}`);
      return { success: true, status: response.status, statusText: response.statusText };
    } else {
      const responseText = await response.text();
      console.error(
        `❌ Failed to post to Teams. Status: ${response.status}, Status Text: ${response.statusText}`
      );
      console.error(`Response: ${responseText}`);
      return { success: false, status: response.status, statusText: response.statusText, error: responseText };
    }
  } catch (error) {
    console.error(`❌ Error posting to Teams: ${error.message}`);
    return { success: false, error: error.message };
  }
}
