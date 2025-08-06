import fetch from 'node-fetch';

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

  // Create payload with enhanced content
  const cleanDescription = description.replace(/<[^>]*>/g, '').substring(0, 300); // Remove HTML and limit length
  const formattedDate = publishedDate ? new Date(publishedDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
  
  let message = `🚨 <strong>New Threat Intelligence Alert</strong><br><br><strong>Source:</strong> ${source}<br><br><strong>Title:</strong> ${title}<br><br><strong>Published:</strong> ${formattedDate}`;
  
  if (cleanDescription && cleanDescription.length > 10) {
    message += `<br><br><strong>Summary:</strong> ${cleanDescription}${cleanDescription.length >= 300 ? '...' : ''}`;
  }
  
  message += `<br><br><a href="${link}">🔗 Read Full Article</a>`;
  
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
