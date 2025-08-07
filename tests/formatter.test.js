import { describe, test, expect } from '@jest/globals';
import { 
  formatMessage, 
  formatSimpleMessage,
  detectSeverity, 
  classifyThreatType,
  cleanDescription,
  formatDate 
} from '../utils/formatter.js';

describe('Formatter - Severity Detection', () => {
  test('should detect critical severity', () => {
    const severity = detectSeverity('Critical Zero-Day Vulnerability', 'actively exploited in the wild');
    
    expect(severity.level).toBe('CRITICAL');
    expect(severity.emoji).toBe('🚨');
    expect(severity.priority).toBe(1);
    expect(severity.color).toBe('#FF0000');
  });

  test('should detect high severity', () => {
    const severity = detectSeverity('CVE-2024-1234 Vulnerability Advisory', 'security update required');
    
    expect(severity.level).toBe('HIGH');
    expect(severity.emoji).toBe('⚠️');
    expect(severity.priority).toBe(2);
  });

  test('should detect medium severity', () => {
    const severity = detectSeverity('Security Advisory', 'moderate recommendation');
    
    expect(severity.level).toBe('MEDIUM');
    expect(severity.emoji).toBe('📋');
    expect(severity.priority).toBe(3);
  });

  test('should default to info severity', () => {
    const severity = detectSeverity('General Information', 'general security information');
    
    expect(severity.level).toBe('INFO');
    expect(severity.emoji).toBe('ℹ️');
    expect(severity.priority).toBe(4);
  });
});

describe('Formatter - Threat Type Classification', () => {
  test('should classify malware threats', () => {
    const threatType = classifyThreatType('Ransomware Attack', 'trojan backdoor detected');
    
    expect(threatType.category).toBe('Malware');
    expect(threatType.emoji).toBe('🦠');
  });

  test('should classify vulnerability threats', () => {
    const threatType = classifyThreatType('CVE-2024-1234', 'buffer overflow vulnerability found');
    
    expect(threatType.category).toBe('Vulnerability');
    expect(threatType.emoji).toBe('🔓');
  });

  test('should classify phishing threats', () => {
    const threatType = classifyThreatType('Phishing Campaign', 'social engineering scam detected');
    
    expect(threatType.category).toBe('Phishing');
    expect(threatType.emoji).toBe('🎣');
  });

  test('should classify APT threats', () => {
    const threatType = classifyThreatType('APT29 Activity', 'advanced persistent threat detected');
    
    expect(threatType.category).toBe('APT');
    expect(threatType.emoji).toBe('🎯');
  });

  test('should classify data breach threats', () => {
    const threatType = classifyThreatType('Data Leak Alert', 'exposed database with credentials');
    
    expect(threatType.category).toBe('Data Breach');
    expect(threatType.emoji).toBe('💾');
  });

  test('should default to general category', () => {
    const threatType = classifyThreatType('General Alert', 'general security information');
    
    expect(threatType.category).toBe('General');
    expect(threatType.emoji).toBe('📄');
  });
});

describe('Formatter - Text Processing', () => {
  test('should clean HTML from description', () => {
    const dirty = '<p>This is a <strong>test</strong> description with <a href="#">links</a>.</p>';
    const clean = cleanDescription(dirty);
    
    expect(clean).toBe('This is a test description with links.');
    expect(clean).not.toContain('<');
    expect(clean).not.toContain('>');
  });

  test('should truncate long descriptions', () => {
    const longText = 'a'.repeat(500);
    const clean = cleanDescription(longText, 100);
    
    expect(clean.length).toBeLessThanOrEqual(104); // 100 + '...'
    expect(clean.endsWith('...')).toBe(true);
  });

  test('should handle empty descriptions', () => {
    expect(cleanDescription('')).toBe('');
    expect(cleanDescription(null)).toBe('');
    expect(cleanDescription(undefined)).toBe('');
  });

  test('should format dates correctly', () => {
    const isoDate = '2024-01-15T10:30:00Z';
    const formatted = formatDate(isoDate);
    
    expect(formatted).toBe('2024-01-15');
  });

  test('should handle invalid dates', () => {
    const formatted = formatDate('invalid-date');
    
    expect(formatted).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  test('should handle empty dates', () => {
    const formatted = formatDate('');
    
    expect(formatted).toMatch(/\d{4}-\d{2}-\d{2}/);
  });
});

describe('Formatter - Message Formatting', () => {
  test('should format complete message', () => {
    const options = {
      source: 'Test Source',
      title: 'CVE-2024-1234 Security Update',
      link: 'https://example.com/alert',
      description: 'A security vulnerability has been discovered; apply security update promptly',
      publishedDate: '2024-01-15T10:30:00Z',
      feedMetadata: {
        category: 'vendor',
        region: 'global',
        priority: 'high',
        parser: 'customParser'
      }
    };

    const result = formatMessage(options);

    expect(result.payload).toBeDefined();
    expect(result.metadata).toBeDefined();
    expect(result.metadata.severity.level).toBe('HIGH');
    expect(result.metadata.threatType.category).toBe('Vulnerability');
    expect(result.metadata.formattedDate).toBe('2024-01-15');
    expect(result.payload.attachments).toHaveLength(1);
  });

  test('should throw error for missing required fields', () => {
    expect(() => {
      formatMessage({});
    }).toThrow('Source and title are required');

    expect(() => {
      formatMessage({ source: 'Test' });
    }).toThrow('Source and title are required');
  });

  test('should format simple text message', () => {
    const options = {
      source: 'Test Source',
      title: 'Test Alert',
      link: 'https://example.com',
      description: 'Test description',
      publishedDate: '2024-01-15T10:30:00Z'
    };

    const message = formatSimpleMessage(options);

    expect(message).toContain('Test Source');
    expect(message).toContain('Test Alert');
    expect(message).toContain('https://example.com');
    expect(message).toContain('2024-01-15');
  });

  test('should handle minimal input gracefully', () => {
    const options = {
      source: 'Minimal Source',
      title: 'Minimal Title',
      link: 'https://example.com'
    };

    const result = formatMessage(options);

    expect(result.payload).toBeDefined();
    expect(result.metadata.severity.level).toBe('INFO');
    expect(result.metadata.threatType.category).toBe('General');
  });
});
