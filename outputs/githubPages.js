/**
 * GitHub Pages HTML output generator for threat intelligence feeds
 * Generates static HTML content for hosting on GitHub Pages
 */

import fs from 'fs/promises';
import path from 'path';
import { detectSeverity, classifyThreatType } from '../utils/formatter.js';

const OUTPUT_FILE = 'docs/index.html';

/**
 * Generate HTML template with CSS styling
 * @param {Array} entries - Array of threat intelligence entries
 * @returns {string} Complete HTML document
 */
function generateHTMLTemplate(entries) {
  const lastUpdated = new Date().toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Threat Intelligence Feed</title>
    <meta name="description" content="Latest cybersecurity threat intelligence from trusted sources">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #2d3748;
            background-color: #f7fafc;
            font-size: 16px;
        }

        .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 24px 20px;
        }

        .header {
            text-align: center;
            margin-bottom: 48px;
            padding-bottom: 24px;
            border-bottom: 1px solid #e2e8f0;
        }

        .header h1 {
            font-size: 2.25rem;
            font-weight: 700;
            color: #1a202c;
            margin-bottom: 8px;
            letter-spacing: -0.025em;
        }

        .header p {
            color: #718096;
            font-size: 1.125rem;
            margin-bottom: 16px;
            font-weight: 400;
        }

        .last-updated {
            font-size: 0.875rem;
            color: #a0aec0;
            font-style: italic;
        }

        .refresh-btn {
            position: fixed;
            top: 24px;
            right: 24px;
            background: #4299e1;
            color: white;
            border: none;
            padding: 12px 20px;
            border-radius: 8px;
            font-weight: 500;
            cursor: pointer;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            transition: all 0.2s ease;
            z-index: 1000;
            display: flex;
            align-items: center;
            gap: 8px;
            text-decoration: none;
            font-size: 0.875rem;
        }

        .refresh-btn:hover {
            background: #3182ce;
            transform: translateY(-1px);
            box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
        }

        .feed-entries {
            display: flex;
            flex-direction: column;
            gap: 32px;
        }

        .entry {
            background: white;
            border-radius: 12px;
            padding: 32px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            border: 1px solid #e2e8f0;
            border-left: 4px solid;
            transition: all 0.2s ease;
        }

        .entry:hover {
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            transform: translateY(-2px);
        }

        .entry.critical { border-left-color: #e53e3e; }
        .entry.high { border-left-color: #dd6b20; }
        .entry.medium { border-left-color: #d69e2e; }
        .entry.info { border-left-color: #3182ce; }

        .entry-title {
            font-size: 1.5rem;
            font-weight: 600;
            color: #1a202c;
            margin-bottom: 16px;
            line-height: 1.4;
        }

        .entry-title a {
            color: inherit;
            text-decoration: none;
        }

        .entry-title a:hover {
            color: #4299e1;
            text-decoration: underline;
        }

        .entry-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
            margin-bottom: 20px;
            font-size: 0.875rem;
            color: #718096;
        }

        .entry-meta span {
            display: flex;
            align-items: center;
            gap: 4px;
        }

        .entry-meta .source {
            font-weight: 600;
            color: #4a5568;
        }

        .entry-meta .priority {
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
        }

        .entry-meta .priority.critical {
            background: #fed7d7;
            color: #c53030;
        }

        .entry-meta .priority.high {
            background: #feebc8;
            color: #c05621;
        }

        .entry-meta .priority.medium {
            background: #faf089;
            color: #b7791f;
        }

        .entry-meta .priority.info {
            background: #bee3f8;
            color: #2a69ac;
        }

        .entry-description {
            color: #4a5568;
            line-height: 1.7;
            margin-bottom: 24px;
            font-size: 1rem;
        }

        .entry-actions {
            display: flex;
            align-items: center;
            justify-content: flex-start;
        }

        .read-more {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            color: #4299e1;
            text-decoration: none;
            font-weight: 500;
            font-size: 0.875rem;
            transition: color 0.2s ease;
        }

        .read-more:hover {
            color: #3182ce;
        }

        .footer {
            text-align: center;
            margin-top: 64px;
            padding: 32px 0;
            border-top: 1px solid #e2e8f0;
            color: #718096;
            font-size: 0.875rem;
        }

        .footer p {
            margin-bottom: 8px;
        }

        @media (max-width: 768px) {
            .container {
                padding: 16px 12px;
            }

            .header h1 {
                font-size: 1.875rem;
            }

            .header p {
                font-size: 1rem;
            }

            .entry {
                padding: 24px 20px;
            }

            .entry-title {
                font-size: 1.25rem;
            }

            .entry-meta {
                flex-direction: column;
                gap: 8px;
            }

            .refresh-btn {
                top: 16px;
                right: 16px;
                padding: 10px 16px;
                font-size: 0.8rem;
            }

            .feed-entries {
                gap: 24px;
            }
        }

        @media (max-width: 480px) {
            .container {
                padding: 12px 8px;
            }

            .entry {
                padding: 20px 16px;
            }

            .entry-title {
                font-size: 1.125rem;
            }
        }
    </style>
</head>
<body>
    <a href="javascript:location.reload()" class="refresh-btn">
        Refresh Feed
    </a>

    <div class="container">
        <div class="header">
            <h1>Threat Intelligence Feed</h1>
            <p>Latest cybersecurity threats and advisories from trusted sources</p>
            <div class="last-updated">Last updated: ${lastUpdated}</div>
        </div>

        <div class="feed-entries">
            ${entries.map(entry => generateEntryCard(entry)).join('')}
        </div>

        <div class="footer">
            <p>This feed is automatically updated with the latest threat intelligence.</p>
            <p>For urgent threats, immediate action may be recommended.</p>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Generate individual entry card for the news feed
 * @param {Object} entry - Threat intelligence entry
 * @returns {string} HTML for entry card
 */
function generateEntryCard(entry) {
  const severityClass = entry.severity?.level?.toLowerCase() || 'info';
  
  // Format publish date more naturally
  const publishDate = new Date(entry.publishedDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  // Use full description, only truncate if extremely long
  const description = entry.description || 'No description available for this threat intelligence item.';
  const displayDescription = description.length > 800 
    ? description.substring(0, 800) + '...' 
    : description;

  // Clean source name
  const sourceName = entry.feedName || 'Unknown Source';
  
  // Threat type for display
  const threatType = entry.threatType?.category || 'General';

  return `
    <article class="entry ${severityClass}">
        <h2 class="entry-title">
            <a href="${entry.url}" target="_blank" rel="noopener noreferrer">${entry.title}</a>
        </h2>

        <div class="entry-meta">
            <span class="source">${sourceName}</span>
            <span>${publishDate}</span>
            <span>${threatType}</span>
            <span class="priority ${severityClass}">${entry.severity?.level || 'Info'}</span>
        </div>

        <div class="entry-description">
            ${displayDescription}
        </div>

        <div class="entry-actions">
            <a href="${entry.url}" target="_blank" rel="noopener noreferrer" class="read-more">
                Read Advisory →
            </a>
        </div>
    </article>`;
}

/**
 * Process entries and prepare for HTML output
 * @param {Array} feedEntries - Raw feed entries
 * @returns {Array} Processed entries with metadata
 */
function processEntriesForHTML(feedEntries) {
  return feedEntries.map(entry => {
    const severity = detectSeverity(entry.title, entry.description || '');
    const threatType = classifyThreatType(entry.title, entry.description || '');
    
    return {
      ...entry,
      severity,
      threatType
    };
  });
}

/**
 * Generate and save HTML output for GitHub Pages
 * @param {Array} feedEntries - Array of threat intelligence entries
 */
export async function generateGitHubPagesOutput(feedEntries) {
  try {
    console.log('Generating GitHub Pages HTML output...');
    
    if (!Array.isArray(feedEntries) || feedEntries.length === 0) {
      console.log('No entries to generate HTML output');
      return;
    }

    // Process entries with severity and threat type classification
    const processedEntries = processEntriesForHTML(feedEntries);
    
    // Sort by publication date only (newest first) - chronological news stream
    const sortedEntries = processedEntries.sort((a, b) => {
      const dateA = new Date(a.publishedDate || 0);
      const dateB = new Date(b.publishedDate || 0);
      return dateB - dateA; // Most recent first
    });

    // Generate HTML content
    const htmlContent = generateHTMLTemplate(sortedEntries);
    
    // Ensure docs directory exists
    const docsDir = path.dirname(OUTPUT_FILE);
    await fs.mkdir(docsDir, { recursive: true });
    
    // Write HTML file
    await fs.writeFile(OUTPUT_FILE, htmlContent, 'utf8');
    
    console.log(`GitHub Pages HTML generated: ${OUTPUT_FILE}`);
    console.log(`Generated ${sortedEntries.length} threat intelligence entries`);
    
    // Log simplified statistics
    const stats = {
      critical: sortedEntries.filter(e => e.severity?.level === 'CRITICAL').length,
      high: sortedEntries.filter(e => e.severity?.level === 'HIGH').length,
      medium: sortedEntries.filter(e => e.severity?.level === 'MEDIUM').length,
      info: sortedEntries.filter(e => e.severity?.level === 'INFO').length
    };
    
    console.log(`Critical: ${stats.critical}, High: ${stats.high}, Medium: ${stats.medium}, Info: ${stats.info}`);
    
  } catch (error) {
    console.error('Failed to generate GitHub Pages output:', error.message);
    throw error;
  }
}
