/**
 * Test Data and Utilities for Threat Feed Bot Tests
 */

// Test scenarios with realistic threat intelligence data
export const TEST_SCENARIOS = [
    {
        name: "Critical Zero-Day Vulnerability",
        source: "Microsoft-MSRC",
        title: "Critical Zero-Day RCE Vulnerability in Exchange Server - CVE-2025-0001",
        link: "https://msrc.microsoft.com/vulnerability/CVE-2025-0001",
        description: "A critical remote code execution vulnerability has been discovered allowing unauthenticated attackers to execute arbitrary code. Actively exploited in the wild."
    },
    {
        name: "APT Campaign",
        source: "NSM-NCSC",
        title: "APT29 Launches Advanced Phishing Campaign Targeting Government Officials",
        link: "https://nsm.no/threat-reports/apt29-2025",
        description: "Sophisticated spear-phishing campaign using compromised legitimate domains to steal government credentials and access sensitive systems."
    },
    {
        name: "Ransomware Campaign", 
        source: "NIST-Cybersecurity",
        title: "Security Advisory: New LockBit Ransomware Variant Detected",
        link: "https://nist.gov/cybersecurity/lockbit-variant-2025",
        description: "New variant of LockBit ransomware with enhanced encryption capabilities spreading through vulnerable RDP connections."
    },
    {
        name: "Data Breach",
        source: "CISA-Alerts",
        title: "Major Healthcare Data Breach Exposes 10 Million Patient Records",
        link: "https://cisa.gov/alerts/healthcare-breach-2025",
        description: "SQL injection attack compromised healthcare provider database containing patient records, medical histories, and insurance information."
    }
];

export const FILTER_TEST_CASES = [
    { title: "Critical Security Vulnerability CVE-2025-1234", expected: true },
    { title: "Weather Forecast for Next Week", expected: false },
    { title: "New Malware Campaign Targeting Banks", expected: true },
    { title: "Celebrity News and Gossip", expected: false },
    { title: "Ransomware Attack on Hospital Network", expected: true },
    { title: "Sports Game Results", expected: false }
];

// Content filtering function (duplicated from fetch-and-post.js for testing)
export const isRelevantThreatIntel = (title, description = '') => {
    const content = (title + ' ' + description).toLowerCase();
    const securityKeywords = [
        'vulnerability', 'exploit', 'malware', 'ransomware', 'phishing',
        'breach', 'attack', 'threat', 'security', 'cyber', 'hack',
        'patch', 'cve', 'advisory', 'alert', 'compromise', 'apt',
        'zero-day', 'backdoor', 'trojan', 'virus', 'worm', 'rootkit'
    ];
    return securityKeywords.some(keyword => content.includes(keyword));
};

// Test utility functions
export const logSection = (title) => {
    console.log('\n' + '='.repeat(60));
    console.log(`🧪 ${title}`);
    console.log('='.repeat(60));
};

export const logTest = (name, status, details = '') => {
    const icon = status ? '✅' : '❌';
    console.log(`${icon} ${name}${details ? ': ' + details : ''}`);
};
