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
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            text-align: center;
            margin-bottom: 40px;
            background: rgba(255, 255, 255, 0.95);
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            backdrop-filter: blur(10px);
        }

        .header h1 {
            font-size: 2.5rem;
            color: #2c3e50;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
        }

        .header p {
            color: #7f8c8d;
            font-size: 1.1rem;
        }

        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 40px;
        }

        .stat-card {
            background: rgba(255, 255, 255, 0.9);
            padding: 20px;
            border-radius: 10px;
            text-align: center;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
        }

        .stat-card h3 {
            font-size: 2rem;
            margin-bottom: 5px;
        }

        .stat-card.critical h3 { color: #e74c3c; }
        .stat-card.high h3 { color: #f39c12; }
        .stat-card.medium h3 { color: #f1c40f; }
        .stat-card.info h3 { color: #3498db; }

        .threat-grid {
            display: grid;
            gap: 25px;
        }

        .threat-card {
            background: rgba(255, 255, 255, 0.95);
            border-radius: 15px;
            padding: 25px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            border-left: 5px solid;
            transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .threat-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15);
        }

        .threat-card.critical { border-left-color: #e74c3c; }
        .threat-card.high { border-left-color: #f39c12; }
        .threat-card.medium { border-left-color: #f1c40f; }
        .threat-card.info { border-left-color: #3498db; }

        .threat-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 15px;
            flex-wrap: wrap;
            gap: 10px;
        }

        .threat-title {
            flex: 1;
            min-width: 0;
        }

        .threat-title h2 {
            font-size: 1.4rem;
            color: #2c3e50;
            margin-bottom: 5px;
            line-height: 1.3;
        }

        .threat-title a {
            color: inherit;
            text-decoration: none;
        }

        .threat-title a:hover {
            color: #3498db;
            text-decoration: underline;
        }

        .severity-badge {
            padding: 8px 16px;
            border-radius: 20px;
            font-weight: bold;
            font-size: 0.9rem;
            white-space: nowrap;
            display: flex;
            align-items: center;
            gap: 5px;
        }

        .severity-badge.critical {
            background: #ffe6e6;
            color: #c0392b;
            border: 1px solid #e74c3c;
        }

        .severity-badge.high {
            background: #fff3e0;
            color: #d68910;
            border: 1px solid #f39c12;
        }

        .severity-badge.medium {
            background: #fffbdd;
            color: #b7950b;
            border: 1px solid #f1c40f;
        }

        .severity-badge.info {
            background: #e8f4fd;
            color: #2980b9;
            border: 1px solid #3498db;
        }

        .threat-meta {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-bottom: 15px;
            font-size: 0.9rem;
        }

        .meta-item {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .meta-label {
            font-weight: 600;
            color: #7f8c8d;
        }

        .meta-value {
            color: #2c3e50;
        }

        .threat-type {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            padding: 4px 10px;
            background: #ecf0f1;
            border-radius: 15px;
            font-size: 0.85rem;
            color: #2c3e50;
        }

        .description {
            color: #5d6d7e;
            line-height: 1.6;
            margin-bottom: 20px;
        }

        .action-buttons {
            display: flex;
            gap: 10px;
            flex-wrap: wrap;
        }

        .action-btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 10px 20px;
            background: #3498db;
            color: white;
            text-decoration: none;
            border-radius: 25px;
            font-weight: 500;
            transition: background-color 0.3s ease;
        }

        .action-btn:hover {
            background: #2980b9;
        }

        .action-btn.primary {
            background: #e74c3c;
        }

        .action-btn.primary:hover {
            background: #c0392b;
        }

        .footer {
            text-align: center;
            margin-top: 50px;
            padding: 20px;
            background: rgba(255, 255, 255, 0.9);
            border-radius: 10px;
            color: #7f8c8d;
        }

        .timestamp {
            font-size: 0.9rem;
            color: #95a5a6;
            margin-top: 10px;
        }

        @media (max-width: 768px) {
            .header h1 {
                font-size: 2rem;
                flex-direction: column;
                gap: 5px;
            }

            .threat-header {
                flex-direction: column;
                align-items: stretch;
            }

            .threat-meta {
                grid-template-columns: 1fr;
            }

            .stats {
                grid-template-columns: repeat(2, 1fr);
            }
        }

        @media (max-width: 480px) {
            .container {
                padding: 10px;
            }

            .stats {
                grid-template-columns: 1fr;
            }

            .action-buttons {
                flex-direction: column;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🛡️ Threat Intelligence Feed</h1>
            <p>Real-time cybersecurity alerts and advisories from trusted sources</p>
            <div class="timestamp">Last updated: ${lastUpdated}</div>
        </div>

        ${generateStatsSection(entries)}

        <div class="threat-grid">
            ${entries.map(entry => generateThreatCard(entry)).join('')}
        </div>

        <div class="footer">
            <p>🔄 This feed is automatically updated with the latest threat intelligence</p>
            <p>🚨 For urgent threats marked as CRITICAL, immediate action is recommended</p>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Generate statistics section
 * @param {Array} entries - Array of threat intelligence entries
 * @returns {string} HTML for stats section
 */
function generateStatsSection(entries) {
  const stats = {
    critical: entries.filter(e => e.severity?.level === 'CRITICAL').length,
    high: entries.filter(e => e.severity?.level === 'HIGH').length,
    medium: entries.filter(e => e.severity?.level === 'MEDIUM').length,
    info: entries.filter(e => e.severity?.level === 'INFO').length
  };

  const total = entries.length;

  return `
    <div class="stats">
        <div class="stat-card critical">
            <h3>${stats.critical}</h3>
            <p>Critical Threats</p>
        </div>
        <div class="stat-card high">
            <h3>${stats.high}</h3>
            <p>High Priority</p>
        </div>
        <div class="stat-card medium">
            <h3>${stats.medium}</h3>
            <p>Medium Priority</p>
        </div>
        <div class="stat-card info">
            <h3>${stats.info}</h3>
            <p>Informational</p>
        </div>
        <div class="stat-card">
            <h3>${total}</h3>
            <p>Total Alerts</p>
        </div>
    </div>`;
}

/**
 * Generate individual threat card
 * @param {Object} entry - Threat intelligence entry
 * @returns {string} HTML for threat card
 */
function generateThreatCard(entry) {
  const severityClass = entry.severity?.level?.toLowerCase() || 'info';
  const actionRequired = ['CRITICAL', 'HIGH'].includes(entry.severity?.level);
  
  // Format publish date
  const publishDate = new Date(entry.publishedDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  // Prepare description with fallback
  const description = entry.description || 'No detailed description available for this threat intelligence item.';
  const truncatedDescription = description.length > 300 
    ? description.substring(0, 300) + '...' 
    : description;

  return `
    <div class="threat-card ${severityClass}">
        <div class="threat-header">
            <div class="threat-title">
                <h2><a href="${entry.url}" target="_blank" rel="noopener noreferrer">${entry.title}</a></h2>
            </div>
            <div class="severity-badge ${severityClass}">
                ${entry.severity?.emoji || 'ℹ️'} ${entry.severity?.level || 'INFO'}
            </div>
        </div>

        <div class="threat-meta">
            <div class="meta-item">
                <span class="meta-label">📡 Feed:</span>
                <span class="meta-value">${entry.feedName}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">🌍 Region:</span>
                <span class="meta-value">${entry.region}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">📂 Category:</span>
                <span class="meta-value">${entry.category}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">⚡ Priority:</span>
                <span class="meta-value">P${entry.severity?.priority || 4}</span>
            </div>
            <div class="meta-item">
                <span class="meta-label">📅 Published:</span>
                <span class="meta-value">${publishDate}</span>
            </div>
            ${entry.threatType ? `
            <div class="meta-item">
                <span class="meta-label">🏷️ Type:</span>
                <span class="threat-type">${entry.threatType.emoji} ${entry.threatType.category}</span>
            </div>
            ` : ''}
        </div>

        <div class="description">
            ${truncatedDescription}
        </div>

        <div class="action-buttons">
            <a href="${entry.url}" target="_blank" rel="noopener noreferrer" 
               class="action-btn ${actionRequired ? 'primary' : ''}">
                🔗 View Advisory
            </a>
            ${actionRequired ? `
            <span class="action-btn primary" style="cursor: default;">
                ⚡ Action Required
            </span>
            ` : ''}
        </div>
    </div>`;
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
    console.log('🌐 Generating GitHub Pages HTML output...');
    
    if (!Array.isArray(feedEntries) || feedEntries.length === 0) {
      console.log('⚠️  No entries to generate HTML output');
      return;
    }

    // Process entries with severity and threat type classification
    const processedEntries = processEntriesForHTML(feedEntries);
    
    // Sort by severity (critical first) and then by date
    const sortedEntries = processedEntries.sort((a, b) => {
      // First sort by severity priority (lower number = higher priority)
      const severityDiff = (a.severity?.priority || 5) - (b.severity?.priority || 5);
      if (severityDiff !== 0) return severityDiff;
      
      // Then sort by date (newest first)
      const dateA = new Date(a.publishedDate || 0);
      const dateB = new Date(b.publishedDate || 0);
      return dateB - dateA;
    });

    // Generate HTML content
    const htmlContent = generateHTMLTemplate(sortedEntries);
    
    // Ensure docs directory exists
    const docsDir = path.dirname(OUTPUT_FILE);
    await fs.mkdir(docsDir, { recursive: true });
    
    // Write HTML file
    await fs.writeFile(OUTPUT_FILE, htmlContent, 'utf8');
    
    console.log(`✅ GitHub Pages HTML generated: ${OUTPUT_FILE}`);
    console.log(`📊 Generated ${sortedEntries.length} threat intelligence entries`);
    
    // Log statistics
    const stats = {
      critical: sortedEntries.filter(e => e.severity?.level === 'CRITICAL').length,
      high: sortedEntries.filter(e => e.severity?.level === 'HIGH').length,
      medium: sortedEntries.filter(e => e.severity?.level === 'MEDIUM').length,
      info: sortedEntries.filter(e => e.severity?.level === 'INFO').length
    };
    
    console.log(`🚨 Critical: ${stats.critical}, ⚠️  High: ${stats.high}, 📊 Medium: ${stats.medium}, ℹ️  Info: ${stats.info}`);
    
  } catch (error) {
    console.error('❌ Failed to generate GitHub Pages output:', error.message);
    throw error;
  }
}

/**
 * Output manager interface for compatibility
 */
export const GitHubPagesOutput = {
  name: 'GitHubPages',
  generateOutput: generateGitHubPagesOutput
};

export default GitHubPagesOutput;
