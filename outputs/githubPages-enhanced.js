import fs from 'fs/promises';
import path from 'path';

/**
 * GitHub Pages static HTML output module
 * Generates modern cybersecurity news feed with search, filters, and live status
 */
export class GitHubPagesOutput {
  constructor(config = {}) {
    this.outputPath = config.outputPath || './docs/index.html';
    this.config = {
      title: 'Threat Intelligence Feed',
      description: 'Real-time cybersecurity threat intelligence and advisories',
      maxEntries: 200,
      enableSearch: true,
      enableFilters: true,
      enableLiveStatus: true,
      ...config
    };
  }

  /**
   * Generate and save the HTML feed
   * @param {Array} entries - Array of threat feed entries
   * @param {Object} metadata - Additional metadata
   */
  async generateFeed(entries, metadata = {}) {
    try {
      // Sort entries by publishedDate (newest first)
      const sortedEntries = entries
        .filter(entry => entry && entry.title)
        .sort((a, b) => new Date(b.publishedDate || 0) - new Date(a.publishedDate || 0))
        .slice(0, this.config.maxEntries);

      const html = this.generateHTML(sortedEntries, metadata);
      
      // Ensure output directory exists
      const outputDir = path.dirname(this.outputPath);
      await fs.mkdir(outputDir, { recursive: true });
      
      // Write HTML file
      await fs.writeFile(this.outputPath, html, 'utf-8');

      // Also emit feed.json for client-side rendering
      const feedJson = sortedEntries.map(e => ({
        title: e.title || '',
        link: e.link || '#',
        source: e.source || '',
        published: e.publishedDate || '',
        category: (e.classification?.threatType) || this.classifyThreatType(e.title, e.description),
        severity: (e.classification?.severity) || this.classifySeverity(e.title, e.description),
        threatType: (e.classification?.threatType) || this.classifyThreatType(e.title, e.description),
        summary: this.cleanDescription(e.description || '', 300)
      }));
      const feedPath = path.join(path.dirname(this.outputPath), 'feed.json');
      await fs.writeFile(feedPath, JSON.stringify(feedJson, null, 2), 'utf-8');
      
      console.log(`✅ GitHub Pages feed generated: ${this.outputPath} (${sortedEntries.length} entries)`);
      return { success: true, entriesCount: sortedEntries.length, outputPath: this.outputPath };
    } catch (error) {
      console.error('❌ Error generating GitHub Pages feed:', error);
      throw error;
    }
  }

  /**
   * Generate complete HTML document
   * @param {Array} entries - Sorted feed entries
   * @param {Object} metadata - Feed metadata
   * @returns {string} Complete HTML document
   */
  generateHTML(entries, metadata) {
    const feedStats = this.calculateStats(entries);
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.config.title}</title>
    <meta name="description" content="${this.config.description}">
    
    <!-- Modern CSS Framework and Icons -->
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    
    <style>
        :root {
            --primary-blue: #1e40af;
            --accent-orange: #f59e0b;
            --success-green: #10b981;
            --warning-yellow: #f59e0b;
            --danger-red: #ef4444;
            --gray-50: #f9fafb;
            --gray-800: #1f2937;
            --gray-900: #111827;
        }
        
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(135deg, var(--gray-50) 0%, #e5e7eb 100%);
        }
        
        .header-gradient {
            background: linear-gradient(135deg, var(--primary-blue) 0%, #1e3a8a 100%);
        }
        
        .card-hover {
            transition: all 0.2s ease-in-out;
        }
        
        .card-hover:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        }
        
        .severity-critical { border-left: 4px solid var(--danger-red); }
        .severity-high { border-left: 4px solid var(--warning-yellow); }
        .severity-medium { border-left: 4px solid var(--accent-orange); }
        .severity-low { border-left: 4px solid var(--success-green); }
        .severity-info { border-left: 4px solid var(--primary-blue); }
        
        .badge {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
        
        .badge-critical { background: #fef2f2; color: var(--danger-red); }
        .badge-high { background: #fffbeb; color: #d97706; }
        .badge-medium { background: #fff7ed; color: var(--accent-orange); }
        .badge-low { background: #f0fdf4; color: var(--success-green); }
        .badge-info { background: #eff6ff; color: var(--primary-blue); }
        
        .search-container {
            position: relative;
        }
        
        .search-icon {
            position: absolute;
            left: 1rem;
            top: 50%;
            transform: translateY(-50%);
            color: #9ca3af;
        }
        
        .status-indicator {
            position: relative;
            display: inline-block;
        }
        
        .status-indicator::before {
            content: '';
            position: absolute;
            top: 0;
            right: 0;
            width: 8px;
            height: 8px;
            background: var(--success-green);
            border-radius: 50%;
            animation: pulse 2s infinite;
        }
        
        @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
        }
        
        .filter-active {
            background: var(--primary-blue);
            color: white;
        }
        
        .hidden {
            display: none !important;
        }
        
        @media (max-width: 768px) {
            .header-stats {
                grid-template-columns: repeat(2, 1fr);
                gap: 1rem;
            }
            
            .filters-container {
                flex-direction: column;
                align-items: stretch;
            }
            
            .filter-buttons {
                justify-content: center;
                margin-top: 1rem;
            }
        }
    </style>
</head>
<body class="bg-gray-50">
    <!-- Header -->
    <header class="header-gradient text-white shadow-lg">
        <div class="container mx-auto px-6 py-8">
            <div class="flex items-center justify-between mb-6">
                <div class="flex items-center space-x-4">
                    <div class="status-indicator">
                        <i class="fas fa-shield-alt text-3xl"></i>
                    </div>
                    <div>
                        <h1 class="text-3xl font-bold">${this.config.title}</h1>
                        <p class="text-blue-100 mt-1">${this.config.description}</p>
                    </div>
                </div>
                ${this.config.enableLiveStatus ? `
                <div class="text-right">
                    <div class="text-sm text-blue-100">Last Updated</div>
                    <div class="text-lg font-semibold" id="lastUpdated">${new Date().toLocaleString()}</div>
                    <div class="text-xs text-blue-200 mt-1">
                        <i class="fas fa-wifi text-green-400"></i> Live Feed Active
                    </div>
                </div>` : ''}
            </div>
            
            <!-- Statistics Dashboard -->
            <div class="grid grid-cols-4 gap-4 header-stats">
                <div class="text-center">
                    <div class="text-2xl font-bold" id="totalCount">${entries.length}</div>
                    <div class="text-blue-100 text-sm">Total Alerts</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-red-300" id="criticalCount">${feedStats.critical}</div>
                    <div class="text-blue-100 text-sm">Critical</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-yellow-300" id="highCount">${feedStats.high}</div>
                    <div class="text-blue-100 text-sm">High Priority</div>
                </div>
                <div class="text-center">
                    <div class="text-2xl font-bold text-green-300" id="recentCount">${feedStats.recent24h}</div>
                    <div class="text-blue-100 text-sm">Last 24h</div>
                </div>
            </div>
        </div>
    </header>

    <!-- Search and Filters -->
    ${this.config.enableSearch || this.config.enableFilters ? `
    <div class="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div class="container mx-auto px-6 py-4">
            <div class="filters-container flex items-center justify-between">
                ${this.config.enableSearch ? `
                <div class="search-container flex-1 max-w-md">
                    <i class="fas fa-search search-icon"></i>
                    <input 
                        type="text" 
                        id="searchInput" 
                        placeholder="Search threats, CVEs, sources..." 
                        class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                </div>` : ''}
                
                ${this.config.enableFilters ? `
                <div class="filter-buttons flex space-x-2 ml-4">
                    <button class="filter-btn filter-active px-4 py-2 rounded-lg text-sm font-medium transition-colors" data-filter="all">
                        All
                    </button>
                    <button class="filter-btn px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors" data-filter="critical">
                        Critical
                    </button>
                    <button class="filter-btn px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors" data-filter="high">
                        High
                    </button>
                    <button class="filter-btn px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors" data-filter="vulnerability">
                        Vulnerabilities
                    </button>
                    <button class="filter-btn px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors" data-filter="malware">
                        Malware
                    </button>
                </div>` : ''}
            </div>
        </div>
    </div>` : ''}

    <!-- Main Content -->
    <main class="container mx-auto px-6 py-8">
        <div class="space-y-6" id="feedContainer">
            ${entries.map(entry => this.generateEntryHTML(entry)).join('')}
        </div>
        
        <!-- Load More / Pagination -->
        <div class="text-center mt-12">
            <button class="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors" onclick="loadMoreEntries()">
                <i class="fas fa-sync-alt mr-2"></i> Refresh Feed
            </button>
        </div>
    </main>

    <!-- Footer -->
    <footer class="bg-gray-800 text-white mt-16">
        <div class="container mx-auto px-6 py-8">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div>
                    <h3 class="font-bold text-lg mb-4">About This Feed</h3>
                    <p class="text-gray-300 text-sm">
                        Automated threat intelligence aggregation from multiple trusted sources. 
                        Updated continuously to provide the latest cybersecurity alerts and advisories.
                    </p>
                </div>
                <div>
                    <h3 class="font-bold text-lg mb-4">Data Sources</h3>
                    <ul class="text-gray-300 text-sm space-y-1">
                        <li>• CISA Cybersecurity Advisories</li>
                        <li>• Microsoft Security Response Center</li>
                        <li>• NIST Cybersecurity Insights</li>
                        <li>• Norwegian NCSC Alerts</li>
                        <li>• CIS Security Advisories</li>
                    </ul>
                </div>
                <div>
                    <h3 class="font-bold text-lg mb-4">Feed Statistics</h3>
                    <div class="text-gray-300 text-sm space-y-1">
                        <div>Generated: ${new Date().toLocaleString()}</div>
                        <div>Total Entries: ${entries.length}</div>
                        <div>Critical Alerts: ${feedStats.critical}</div>
                        <div>Last 24 Hours: ${feedStats.recent24h}</div>
                    </div>
                </div>
            </div>
            <div class="border-t border-gray-700 mt-8 pt-8 text-center text-gray-400 text-sm">
                <p>Threat Intelligence Feed • Generated ${new Date().toLocaleString()}</p>
            </div>
        </div>
    </footer>

    <script>
        // Search functionality
        ${this.config.enableSearch ? this.generateSearchScript() : ''}
        
        // Filter functionality  
        ${this.config.enableFilters ? this.generateFilterScript() : ''}
        
        // Live status updates
        ${this.config.enableLiveStatus ? this.generateLiveStatusScript() : ''}
        
        // Utility functions
        function loadMoreEntries() {
            // In a real implementation, this would fetch more data
            location.reload();
        }
        
        // Initialize page
        document.addEventListener('DOMContentLoaded', function() {
            console.log('Threat Intelligence Feed loaded');
            
            // Add click tracking for entries
            document.querySelectorAll('.threat-entry').forEach(entry => {
                entry.addEventListener('click', function() {
                    const link = this.dataset.link;
                    if (link && link !== '#') {
                        window.open(link, '_blank');
                    }
                });
            });
        });
    </script>
</body>
</html>`;
  }

  /**
   * Generate HTML for a single entry
   * @param {Object} entry - Feed entry
   * @returns {string} HTML string
   */
  generateEntryHTML(entry) {
    const severity = entry.classification?.severity || this.classifySeverity(entry.title, entry.description);
    const threatType = entry.classification?.threatType || this.classifyThreatType(entry.title, entry.description);
    const publishedDate = new Date(entry.publishedDate || Date.now());
    const relativeTime = this.getRelativeTime(publishedDate);
    const indicators = entry.classification?.indicators || {};
    
    const severityClass = `severity-${severity}`;
    const badgeClass = `badge badge-${severity}`;
    
    return `
    <article class="threat-entry card-hover bg-white rounded-lg shadow-md p-6 ${severityClass} cursor-pointer" 
             data-severity="${severity}" 
             data-threat-type="${threatType}"
             data-link="${entry.link}"
             data-search-text="${entry.title.toLowerCase()} ${(entry.description || '').toLowerCase()} ${entry.source?.toLowerCase() || ''}">
        
        <div class="flex items-start justify-between mb-4">
            <div class="flex items-center space-x-3">
                <div class="flex-shrink-0">
                    ${this.getThreatIcon(threatType)}
                </div>
                <div class="flex-1">
                    <h2 class="text-lg font-semibold text-gray-900 leading-tight mb-2 hover:text-blue-600">
                        ${entry.title}
                    </h2>
                    <div class="flex items-center space-x-3 text-sm text-gray-600">
                        <span class="${badgeClass}">${severity}</span>
                        <span class="flex items-center">
                            <i class="fas fa-calendar-alt mr-1"></i>
                            ${relativeTime}
                        </span>
                        <span class="flex items-center">
                            <i class="fas fa-rss mr-1"></i>
                            ${entry.source || 'Unknown Source'}
                        </span>
                    </div>
                </div>
            </div>
            <div class="flex-shrink-0">
                <button class="text-gray-400 hover:text-blue-600 p-2" title="External Link">
                    <i class="fas fa-external-link-alt"></i>
                </button>
            </div>
        </div>
        
        ${entry.description ? `
        <div class="text-gray-700 text-sm leading-relaxed mb-4 line-clamp-3">
            ${this.cleanDescription(entry.description, 300)}
        </div>` : ''}
        
        ${this.generateIndicatorsHTML(indicators)}
        
        <div class="flex items-center justify-between pt-4 border-t border-gray-100">
            <div class="flex items-center space-x-4 text-xs text-gray-500">
                ${entry.classification?.confidence ? `
                <span class="flex items-center">
                    <i class="fas fa-chart-line mr-1"></i>
                    ${entry.classification.confidence}% confidence
                </span>` : ''}
                <span class="flex items-center">
                    <i class="fas fa-clock mr-1"></i>
                    ${publishedDate.toLocaleDateString()}
                </span>
            </div>
            <div class="flex space-x-2">
                ${severity === 'critical' || severity === 'high' ? `
                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    <i class="fas fa-exclamation-triangle mr-1"></i>
                    Action Required
                </span>` : ''}
            </div>
        </div>
    </article>`;
  }

  /**
   * Generate indicators HTML section
   * @param {Object} indicators - Extracted indicators
   * @returns {string} HTML string
   */
  generateIndicatorsHTML(indicators) {
    if (!indicators || Object.keys(indicators).every(key => !indicators[key]?.length)) {
      return '';
    }

    let html = '<div class="indicators mb-4 p-3 bg-gray-50 rounded-lg"><div class="text-sm font-medium text-gray-700 mb-2">Indicators of Compromise:</div><div class="flex flex-wrap gap-2">';
    
    if (indicators.cves?.length) {
      html += indicators.cves.slice(0, 3).map(cve => 
        `<span class="inline-flex items-center px-2 py-1 rounded text-xs font-mono bg-red-100 text-red-800">${cve}</span>`
      ).join('');
    }
    
    if (indicators.ips?.length) {
      html += indicators.ips.slice(0, 2).map(ip => 
        `<span class="inline-flex items-center px-2 py-1 rounded text-xs font-mono bg-yellow-100 text-yellow-800">${ip}</span>`
      ).join('');
    }
    
    if (indicators.domains?.length) {
      html += indicators.domains.slice(0, 2).map(domain => 
        `<span class="inline-flex items-center px-2 py-1 rounded text-xs font-mono bg-blue-100 text-blue-800">${domain}</span>`
      ).join('');
    }
    
    html += '</div></div>';
    return html;
  }

  /**
   * Calculate feed statistics
   * @param {Array} entries - Feed entries
   * @returns {Object} Statistics object
   */
  calculateStats(entries) {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    return {
      total: entries.length,
      critical: entries.filter(e => (e.classification?.severity || this.classifySeverity(e.title, e.description)) === 'critical').length,
      high: entries.filter(e => (e.classification?.severity || this.classifySeverity(e.title, e.description)) === 'high').length,
      recent24h: entries.filter(e => new Date(e.publishedDate || 0) > yesterday).length
    };
  }

  // Helper methods
  classifySeverity(title, description) {
    const content = `${title} ${description || ''}`.toLowerCase();
    if (['critical', 'zero-day', 'rce', 'emergency'].some(k => content.includes(k))) return 'critical';
    if (['high', 'exploit', 'vulnerability', 'cve-'].some(k => content.includes(k))) return 'high';
    if (['medium', 'advisory', 'patch'].some(k => content.includes(k))) return 'medium';
    if (['low', 'informational'].some(k => content.includes(k))) return 'low';
    return 'info';
  }

  classifyThreatType(title, description) {
    const content = `${title} ${description || ''}`.toLowerCase();
    if (['vulnerability', 'cve-', 'patch'].some(k => content.includes(k))) return 'vulnerability';
    if (['malware', 'trojan', 'ransomware'].some(k => content.includes(k))) return 'malware';
    if (['phishing', 'scam'].some(k => content.includes(k))) return 'phishing';
    if (['apt', 'targeted attack'].some(k => content.includes(k))) return 'apt';
    if (['data breach', 'leak'].some(k => content.includes(k))) return 'data_breach';
    return 'general';
  }

  getThreatIcon(threatType) {
    const icons = {
      vulnerability: '<i class="fas fa-shield-alt text-orange-500 text-2xl"></i>',
      malware: '<i class="fas fa-virus text-red-500 text-2xl"></i>',
      phishing: '<i class="fas fa-fishing-rod text-blue-500 text-2xl"></i>',
      apt: '<i class="fas fa-crosshairs text-purple-500 text-2xl"></i>',
      data_breach: '<i class="fas fa-database text-gray-500 text-2xl"></i>',
      general: '<i class="fas fa-info-circle text-gray-500 text-2xl"></i>'
    };
    return icons[threatType] || icons.general;
  }

  cleanDescription(description, maxLength = 300) {
    if (!description) return '';
    const cleaned = description.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    return cleaned.length > maxLength ? cleaned.substring(0, maxLength) + '...' : cleaned;
  }

  getRelativeTime(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  generateSearchScript() {
    return `
    // Real-time search functionality
    const searchInput = document.getElementById('searchInput');
    const entries = document.querySelectorAll('.threat-entry');
    
    searchInput.addEventListener('input', function() {
        const query = this.value.toLowerCase().trim();
        let visibleCount = 0;
        
        entries.forEach(entry => {
            const searchText = entry.dataset.searchText;
            const isMatch = !query || searchText.includes(query);
            
            if (isMatch) {
                entry.classList.remove('hidden');
                visibleCount++;
            } else {
                entry.classList.add('hidden');
            }
        });
        
        // Update total count
        document.getElementById('totalCount').textContent = visibleCount;
    });
    `;
  }

  generateFilterScript() {
    return `
    // Filter functionality
    const filterButtons = document.querySelectorAll('.filter-btn');
    const entries = document.querySelectorAll('.threat-entry');
    
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            const filter = this.dataset.filter;
            
            // Update active button
            filterButtons.forEach(btn => {
                btn.classList.remove('filter-active');
                btn.classList.add('bg-gray-100', 'text-gray-700');
            });
            this.classList.add('filter-active');
            this.classList.remove('bg-gray-100', 'text-gray-700');
            
            // Filter entries
            let visibleCount = 0;
            entries.forEach(entry => {
                let shouldShow = filter === 'all';
                
                if (filter === 'critical' || filter === 'high') {
                    shouldShow = entry.dataset.severity === filter;
                } else if (filter === 'vulnerability' || filter === 'malware') {
                    shouldShow = entry.dataset.threatType === filter;
                }
                
                if (shouldShow) {
                    entry.classList.remove('hidden');
                    visibleCount++;
                } else {
                    entry.classList.add('hidden');
                }
            });
            
            // Update counts
            document.getElementById('totalCount').textContent = visibleCount;
        });
    });
    `;
  }

  generateLiveStatusScript() {
    return `
    // Live status updates
    function updateLiveStatus() {
        const lastUpdatedEl = document.getElementById('lastUpdated');
        if (lastUpdatedEl) {
            lastUpdatedEl.textContent = new Date().toLocaleString();
        }
    }
    
    // Update every 30 seconds
    setInterval(updateLiveStatus, 30000);
    `;
  }
}

export default GitHubPagesOutput;
