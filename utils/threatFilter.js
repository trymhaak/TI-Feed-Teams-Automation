import { formatUtils } from './formatter.js';

/**
 * Advanced filtering and classification system for threat intelligence feeds
 */
export class ThreatFilter {
  constructor(config = {}) {
    this.config = {
      globalFilters: config.globalFilters || {},
      mutedTypes: config.mutedTypes || [],
      priorityBoosts: config.priorityBoosts || {},
      ...config
    };

    // Baseline relevant keywords used when no requiredKeywords are defined
    this.relevantKeywords = [
      'security','vulnerability','threat','malware','exploit','patch','update','advisory','alert',
      'breach','attack','cve-','cybersecurity','cyber','risk','incident','ransomware','phishing','apt'
    ];
  }

  /**
   * Apply filters to a feed entry
   * @param {Object} entry - The feed entry to filter
   * @param {Object} feedConfig - Feed-specific configuration
   * @returns {Object} Filtered and classified entry or null if filtered out
   */
  async filterEntry(entry, feedConfig = {}) {
    try {
      // Combine feed filters with global filters
      const filters = {
        ...this.config.globalFilters,
        ...feedConfig.filters
      };

      // Skip if entry doesn't meet age requirements
      if (!this.checkAge(entry, filters.maxAge)) {
        return null;
      }

      // Determine relevance: must have at least one relevant keyword overall (requiredKeywords or baseline)
      const hasRequired = this.hasRequiredKeywords(entry, filters.requiredKeywords);
      const hasBaselineRelevant = this.hasRequiredKeywords(entry, this.relevantKeywords);
      const isRelevant = hasRequired || hasBaselineRelevant;

      // If irrelevant, drop early
      if (!isRelevant) {
        console.warn(`🔍 Filtered (irrelevant): ${entry.source || 'unknown'} :: ${entry.title || ''}`);
        return null;
      }

      // If blocked keywords present but item is also relevant, do NOT drop solely due to blocked keywords
      // Only drop blocked if not relevant (handled above)
      if (!isRelevant && this.hasBlockedKeywords(entry, filters.blockedKeywords)) {
        console.warn(`🔍 Filtered (blocked keywords): ${entry.source || 'unknown'} :: ${entry.title || ''}`);
        return null;
      }

      // Classify the entry
      const classification = await this.classifyEntry(entry, filters);

      // Skip if threat type is muted
      if (this.config.mutedTypes.includes(classification.threatType)) {
        return null;
      }

      // Skip if severity below minimum
      if (!this.meetsSeverityRequirement(classification.severity, filters.minimumSeverity)) {
        console.warn(`🔍 Filtered (below min severity ${filters.minimumSeverity}): ${entry.source || 'unknown'} :: ${entry.title || ''}`);
        return null;
      }

      // Add classification data to entry
      const enhancedEntry = {
        ...entry,
        classification,
        filtered: true,
        filterTimestamp: new Date().toISOString()
      };

      return enhancedEntry;
    } catch (error) {
      console.error('Error filtering entry:', error);
      return entry; // Return original entry on filter error
    }
  }

  /**
   * Check if entry meets age requirements
   * @param {Object} entry - Feed entry
   * @param {number} maxAge - Maximum age in days
   * @returns {boolean}
   */
  checkAge(entry, maxAge) {
    if (!maxAge) return true;

    const entryDate = new Date(entry.publishedDate || entry.pubDate);
    const now = new Date();
    const daysDiff = (now - entryDate) / (1000 * 60 * 60 * 24);

    return daysDiff <= maxAge;
  }

  /**
   * Check for blocked keywords
   * @param {Object} entry - Feed entry
   * @param {Array} blockedKeywords - Keywords to block
   * @returns {boolean}
   */
  hasBlockedKeywords(entry, blockedKeywords = []) {
    if (!blockedKeywords.length) return false;

    const text = `${entry.title} ${entry.description || ''}`.toLowerCase();
    return blockedKeywords.some(keyword => 
      text.includes(keyword.toLowerCase())
    );
  }

  /**
   * Check for required keywords
   * @param {Object} entry - Feed entry
   * @param {Array} requiredKeywords - Keywords required
   * @returns {boolean}
   */
  hasRequiredKeywords(entry, requiredKeywords = []) {
    if (!requiredKeywords.length) return true;

    const text = `${entry.title} ${entry.description || ''}`.toLowerCase();
    return requiredKeywords.some(keyword => 
      text.includes(keyword.toLowerCase())
    );
  }

  /**
   * Classify threat entry
   * @param {Object} entry - Feed entry
   * @param {Object} filters - Filter configuration
   * @returns {Object} Classification result
   */
  async classifyEntry(entry, filters = {}) {
    const text = `${entry.title} ${entry.description || ''}`.toLowerCase();
    
    // Determine threat type
    const threatType = this.classifyThreatType(text);
    
    // Determine severity
    let severity = this.classifySeverity(text);
    
    // Apply priority boosts
    if (filters.priorityKeywords) {
      const hasPriorityKeyword = filters.priorityKeywords.some(keyword =>
        text.includes(keyword.toLowerCase())
      );
      if (hasPriorityKeyword) {
        severity = this.boostSeverity(severity);
      }
    }

    // Extract indicators (IoCs)
    const indicators = this.extractIndicators(text);

    // Calculate confidence score
    const confidence = this.calculateConfidence(text, threatType, severity);

    return {
      threatType,
      severity,
      indicators,
      confidence,
      classificationTimestamp: new Date().toISOString()
    };
  }

  /**
   * Classify threat type based on content
   * @param {string} text - Entry text
   * @returns {string} Threat type
   */
  classifyThreatType(text) {
    const patterns = {
      vulnerability: ['vulnerability', 'cve-', 'security update', 'patch', 'exploit'],
      malware: ['malware', 'trojan', 'ransomware', 'virus', 'backdoor'],
      apt: ['apt', 'advanced persistent', 'nation-state', 'targeted attack'],
      data_breach: ['data breach', 'data leak', 'breach', 'stolen data'],
      phishing: ['phishing', 'spear phishing', 'email attack', 'social engineering'],
      ddos: ['ddos', 'denial of service', 'botnet'],
      insider_threat: ['insider threat', 'rogue employee', 'internal threat'],
      supply_chain: ['supply chain', 'third party', 'vendor compromise']
    };

    for (const [type, keywords] of Object.entries(patterns)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return type;
      }
    }

    return 'general';
  }

  /**
   * Classify severity based on content
   * @param {string} text - Entry text
   * @returns {string} Severity level
   */
  classifySeverity(text) {
    const criticalKeywords = ['critical', 'emergency', 'zero-day', 'rce', 'remote code execution'];
    const highKeywords = ['high', 'severe', 'exploit', 'active attack', 'widespread'];
    const mediumKeywords = ['medium', 'moderate', 'vulnerability', 'patch available'];
    const lowKeywords = ['low', 'minor', 'informational'];

    if (criticalKeywords.some(keyword => text.includes(keyword))) {
      return 'critical';
    }
    if (highKeywords.some(keyword => text.includes(keyword))) {
      return 'high';
    }
    if (mediumKeywords.some(keyword => text.includes(keyword))) {
      return 'medium';
    }
    if (lowKeywords.some(keyword => text.includes(keyword))) {
      return 'low';
    }

    return 'info';
  }

  /**
   * Boost severity level
   * @param {string} currentSeverity - Current severity
   * @returns {string} Boosted severity
   */
  boostSeverity(currentSeverity) {
    const severityLevels = ['info', 'low', 'medium', 'high', 'critical'];
    const currentIndex = severityLevels.indexOf(currentSeverity);
    const boostedIndex = Math.min(currentIndex + 1, severityLevels.length - 1);
    return severityLevels[boostedIndex];
  }

  /**
   * Check if severity meets minimum requirement
   * @param {string} severity - Entry severity
   * @param {string} minimumSeverity - Minimum required severity
   * @returns {boolean}
   */
  meetsSeverityRequirement(severity, minimumSeverity) {
    if (!minimumSeverity) return true;

    const severityLevels = ['info', 'low', 'medium', 'high', 'critical'];
    const severityIndex = severityLevels.indexOf(severity);
    const minimumIndex = severityLevels.indexOf(minimumSeverity);

    return severityIndex >= minimumIndex;
  }

  /**
   * Extract indicators of compromise
   * @param {string} text - Entry text
   * @returns {Object} Extracted indicators
   */
  extractIndicators(text) {
    const indicators = {
      ips: [],
      domains: [],
      hashes: [],
      cves: [],
      urls: []
    };

    // IP addresses
    const ipPattern = /\b(?:[0-9]{1,3}\.){3}[0-9]{1,3}\b/g;
    indicators.ips = [...new Set((text.match(ipPattern) || []))];

    // Domain names
    const domainPattern = /\b[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}\b/g;
    indicators.domains = [...new Set((text.match(domainPattern) || [])
      .filter(domain => !domain.includes('example.com')))];

    // CVE IDs
    const cvePattern = /CVE-\d{4}-\d{4,}/gi;
    indicators.cves = [...new Set((text.match(cvePattern) || []))];

    // File hashes (MD5, SHA1, SHA256)
    const hashPattern = /\b[a-fA-F0-9]{32,64}\b/g;
    indicators.hashes = [...new Set((text.match(hashPattern) || []))];

    // URLs
    const urlPattern = /https?:\/\/[^\s<>"]+/g;
    indicators.urls = [...new Set((text.match(urlPattern) || []))];

    return indicators;
  }

  /**
   * Calculate confidence score for classification
   * @param {string} text - Entry text
   * @param {string} threatType - Classified threat type
   * @param {string} severity - Classified severity
   * @returns {number} Confidence score (0-100)
   */
  calculateConfidence(text, threatType, severity) {
    let confidence = 50; // Base confidence

    // Boost confidence based on specific indicators
    if (threatType !== 'general') confidence += 20;
    if (severity === 'critical' || severity === 'high') confidence += 15;
    
    // Look for authoritative sources
    const authoritativeSources = ['cve', 'nist', 'mitre', 'cisa', 'microsoft', 'advisory'];
    if (authoritativeSources.some(source => text.includes(source))) {
      confidence += 15;
    }

    // Look for technical details
    const technicalIndicators = ['exploit', 'proof of concept', 'technical details', 'patch'];
    if (technicalIndicators.some(indicator => text.includes(indicator))) {
      confidence += 10;
    }

    return Math.min(confidence, 100);
  }

  /**
   * Get filtering statistics
   * @param {Array} originalEntries - Original entries before filtering
   * @param {Array} filteredEntries - Entries after filtering
   * @returns {Object} Filter statistics
   */
  getFilterStats(originalEntries, filteredEntries) {
    const stats = {
      total: originalEntries.length,
      passed: filteredEntries.length,
      filtered: originalEntries.length - filteredEntries.length,
      filterRate: ((originalEntries.length - filteredEntries.length) / originalEntries.length * 100).toFixed(1)
    };

    // Breakdown by threat type
    const threatTypeBreakdown = {};
    filteredEntries.forEach(entry => {
      const type = entry.classification?.threatType || 'unknown';
      threatTypeBreakdown[type] = (threatTypeBreakdown[type] || 0) + 1;
    });

    // Breakdown by severity
    const severityBreakdown = {};
    filteredEntries.forEach(entry => {
      const severity = entry.classification?.severity || 'unknown';
      severityBreakdown[severity] = (severityBreakdown[severity] || 0) + 1;
    });

    return {
      ...stats,
      threatTypes: threatTypeBreakdown,
      severities: severityBreakdown,
      timestamp: new Date().toISOString()
    };
  }
}

export default ThreatFilter;
