import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ThreatFilter } from '../utils/threatFilter.js';

describe('ThreatFilter', () => {
  let threatFilter;
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      globalFilters: {
        requiredKeywords: ['security'],
        blockedKeywords: ['spam'],
        minimumSeverity: 'medium'
      },
      mutedTypes: ['general'],
      priorityBoosts: {
        criticalKeywords: ['zero-day', 'rce']
      }
    };
    threatFilter = new ThreatFilter(mockConfig);
  });

  describe('filterEntry', () => {
    it('should filter out entries with blocked keywords if not otherwise relevant', async () => {
      const entry = {
        title: 'Spam alert notification',
        description: 'This is spam content',
        publishedDate: new Date().toISOString()
      };

      const result = await threatFilter.filterEntry(entry);
      expect(result).toBeNull();
    });

    it('should filter out entries without any relevant keywords', async () => {
      const entry = {
        title: 'General notification',
        description: 'No security keywords here',
        publishedDate: new Date().toISOString()
      };

      const result = await threatFilter.filterEntry(entry);
      expect(result).toBeNull();
    });

    it('should pass valid entries with classification', async () => {
      const entry = {
        title: 'Security vulnerability alert',
        description: 'Critical security issue found',
        publishedDate: new Date().toISOString()
      };

      const result = await threatFilter.filterEntry(entry);
      expect(result).not.toBeNull();
      expect(result.classification).toBeDefined();
      expect(result.classification.threatType).toBe('vulnerability');
      expect(result.classification.severity).toBe('critical');
    });

    it('should allow relevant entries even if blocked keywords appear', async () => {
      const entry = {
        title: 'Ransomware webinar advisory',
        description: 'Important ransomware advisory that mentions a webinar',
        publishedDate: new Date().toISOString()
      };

      const result = await threatFilter.filterEntry(entry, { filters: { blockedKeywords: ['webinar'] } });
      expect(result).not.toBeNull();
      expect(result.classification).toBeDefined();
    });

    it('should filter by age when maxAge is specified', async () => {
      const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
      const entry = {
        title: 'Security alert',
        description: 'Old security alert',
        publishedDate: oldDate.toISOString()
      };

      const feedConfig = { filters: { maxAge: 7 } };
      const result = await threatFilter.filterEntry(entry, feedConfig);
      expect(result).toBeNull();
    });

    it('should filter out muted threat types', async () => {
      const entry = {
        title: 'General information',
        description: 'Some general security info',
        publishedDate: new Date().toISOString()
      };

      const result = await threatFilter.filterEntry(entry);
      expect(result).toBeNull(); // 'general' is muted in config
    });
  });

  describe('classifyThreatType', () => {
    it('should classify vulnerability threats', () => {
      const result = threatFilter.classifyThreatType('CVE-2023-1234 vulnerability found');
      expect(result).toBe('vulnerability');
    });

    it('should classify malware threats', () => {
      const result = threatFilter.classifyThreatType('New ransomware variant detected');
      expect(result).toBe('malware');
    });

    it('should classify APT threats', () => {
      const result = threatFilter.classifyThreatType('APT29 targeted attack campaign');
      expect(result).toBe('apt');
    });

    it('should default to general for unrecognized patterns', () => {
      const result = threatFilter.classifyThreatType('Some random text');
      expect(result).toBe('general');
    });
  });

  describe('classifySeverity', () => {
    it('should classify critical severity', () => {
      const result = threatFilter.classifySeverity('Critical zero-day exploit');
      expect(result).toBe('critical');
    });

    it('should classify high severity', () => {
      const result = threatFilter.classifySeverity('High severity vulnerability');
      expect(result).toBe('high');
    });

    it('should boost severity for priority keywords', () => {
      const severityBefore = threatFilter.classifySeverity('Medium severity issue');
      const severityAfter = threatFilter.boostSeverity(severityBefore);
      expect(severityAfter).toBe('high');
    });

    it('should not boost critical severity beyond critical', () => {
      const severityAfter = threatFilter.boostSeverity('critical');
      expect(severityAfter).toBe('critical');
    });
  });

  describe('extractIndicators', () => {
    it('should extract IP addresses', () => {
      const text = 'Malicious IP 192.168.1.1 detected';
      const indicators = threatFilter.extractIndicators(text);
      expect(indicators.ips).toContain('192.168.1.1');
    });

    it('should extract CVE IDs', () => {
      const text = 'CVE-2023-1234 and CVE-2023-5678 found';
      const indicators = threatFilter.extractIndicators(text);
      expect(indicators.cves).toContain('CVE-2023-1234');
      expect(indicators.cves).toContain('CVE-2023-5678');
    });

    it('should extract domain names', () => {
      const text = 'Malicious domain evil.com detected';
      const indicators = threatFilter.extractIndicators(text);
      expect(indicators.domains).toContain('evil.com');
    });

    it('should extract file hashes', () => {
      const text = 'Hash: a1b2c3d4e5f6789012345678901234567890abcdef';
      const indicators = threatFilter.extractIndicators(text);
      expect(indicators.hashes.length).toBeGreaterThan(0);
    });

    it('should extract URLs', () => {
      const text = 'Malicious URL https://evil.com/malware detected';
      const indicators = threatFilter.extractIndicators(text);
      expect(indicators.urls).toContain('https://evil.com/malware');
    });
  });

  describe('meetsSeverityRequirement', () => {
    it('should pass when severity meets minimum', () => {
      expect(threatFilter.meetsSeverityRequirement('high', 'medium')).toBe(true);
      expect(threatFilter.meetsSeverityRequirement('critical', 'high')).toBe(true);
      expect(threatFilter.meetsSeverityRequirement('medium', 'medium')).toBe(true);
    });

    it('should fail when severity below minimum', () => {
      expect(threatFilter.meetsSeverityRequirement('low', 'high')).toBe(false);
      expect(threatFilter.meetsSeverityRequirement('medium', 'critical')).toBe(false);
    });

    it('should pass when no minimum specified', () => {
      expect(threatFilter.meetsSeverityRequirement('info', null)).toBe(true);
      expect(threatFilter.meetsSeverityRequirement('low', undefined)).toBe(true);
    });
  });

  describe('calculateConfidence', () => {
    it('should return higher confidence for specific threat types', () => {
      const confidence1 = threatFilter.calculateConfidence('text', 'vulnerability', 'high');
      const confidence2 = threatFilter.calculateConfidence('text', 'general', 'low');
      expect(confidence1).toBeGreaterThan(confidence2);
    });

    it('should boost confidence for critical/high severity', () => {
      const confidence1 = threatFilter.calculateConfidence('text', 'vulnerability', 'critical');
      const confidence2 = threatFilter.calculateConfidence('text', 'vulnerability', 'low');
      expect(confidence1).toBeGreaterThan(confidence2);
    });

    it('should not exceed 100% confidence', () => {
      const confidence = threatFilter.calculateConfidence(
        'cve nist mitre cisa microsoft advisory exploit technical details patch',
        'vulnerability',
        'critical'
      );
      expect(confidence).toBeLessThanOrEqual(100);
    });
  });

  describe('getFilterStats', () => {
    it('should calculate correct filter statistics', () => {
      const original = [
        { title: 'Entry 1' },
        { title: 'Entry 2' },
        { title: 'Entry 3' },
        { title: 'Entry 4' }
      ];

      const filtered = [
        { title: 'Entry 1', classification: { threatType: 'vulnerability', severity: 'high' } },
        { title: 'Entry 3', classification: { threatType: 'malware', severity: 'critical' } }
      ];

      const stats = threatFilter.getFilterStats(original, filtered);
      
      expect(stats.total).toBe(4);
      expect(stats.passed).toBe(2);
      expect(stats.filtered).toBe(2);
      expect(stats.filterRate).toBe('50.0');
      expect(stats.threatTypes.vulnerability).toBe(1);
      expect(stats.threatTypes.malware).toBe(1);
      expect(stats.severities.high).toBe(1);
      expect(stats.severities.critical).toBe(1);
    });
  });

  describe('error handling', () => {
    it('should handle malformed entries gracefully', async () => {
      const entry = null;
      const result = await threatFilter.filterEntry(entry);
      expect(result).toBeNull();
    });

    it('should return original entry on classification error', async () => {
      const entry = {
        title: 'Test',
        description: 'Test',
        publishedDate: 'invalid-date'
      };

      // Mock classification method to throw error
      jest.spyOn(threatFilter, 'classifyEntry').mockImplementation(() => {
        throw new Error('Classification error');
      });

      const result = await threatFilter.filterEntry(entry);
      expect(result).toEqual(entry);
    });
  });
});
