#!/usr/bin/env node

/**
 * Simple Intelligence Features Demo
 * Showcases the key Tier 2 enhancements with clean output
 */

import { detectSeverity, classifyThreatType, postToTeams } from './post-to-teams.js';
import fs from 'fs';

console.log('🚀 TIER 2 INTELLIGENCE FEATURES DEMONSTRATION');
console.log('=' + '='.repeat(58));
console.log(`📅 Demo Time: ${new Date().toISOString()}\n`);

// Demo threat scenarios
const demoThreats = [
    {
        title: "Critical Zero-Day RCE Vulnerability in Microsoft Exchange Server - CVE-2024-12345",
        description: "A critical remote code execution vulnerability allowing unauthenticated attackers to execute arbitrary code. Actively exploited in the wild.",
        source: "Microsoft-MSRC",
        link: "https://example.com/cve-2024-12345"
    },
    {
        title: "APT29 Cozy Bear Targets Government Officials with Sophisticated Spear Phishing",
        description: "Advanced persistent threat group conducting targeted phishing campaign against government personnel using legitimate compromised domains.",
        source: "NSM-NCSC", 
        link: "https://example.com/apt29-campaign"
    },
    {
        title: "LockBit 3.0 Ransomware Campaign Spreads Through RDP Brute Force",
        description: "New variant of LockBit ransomware spreading rapidly through vulnerable RDP connections and lateral movement techniques.",
        source: "NIST-Cybersecurity",
        link: "https://example.com/lockbit-campaign"
    },
    {
        title: "Data Breach: 10 Million Healthcare Records Exposed Through SQL Injection",
        description: "Major healthcare provider suffered data breach exposing patient records, medical histories, and insurance information via SQL injection attack.",
        source: "Microsoft-MSRC",
        link: "https://example.com/healthcare-breach"
    },
    {
        title: "Security Advisory: Chrome Browser Update Available - Medium Priority",
        description: "Google releases security update addressing several medium-severity vulnerabilities in Chrome rendering engine.",
        source: "NIST-Cybersecurity",
        link: "https://example.com/chrome-update"
    }
];

console.log('🧠 INTELLIGENT THREAT ANALYSIS:\n');

for (let i = 0; i < demoThreats.length; i++) {
    const threat = demoThreats[i];
    
    // Analyze threat
    const severity = detectSeverity(threat.title, threat.description);
    const threatType = classifyThreatType(threat.title, threat.description);
    
    console.log(`📊 THREAT ${i + 1}:`);
    console.log(`   📝 Title: ${threat.title}`);
    console.log(`   🎯 Severity: ${severity.emoji} ${severity.level} (Priority ${severity.priority})`);
    console.log(`   🏷️  Type: ${threatType.emoji} ${threatType.category}`);
    console.log(`   🏢 Source: ${threat.source}\n`);
}

// Test content filtering
console.log('🔍 CONTENT FILTERING DEMONSTRATION:\n');

const filterTests = [
    { title: "Critical Security Vulnerability CVE-2024-1234", shouldPass: true },
    { title: "Weather Forecast for Next Week", shouldPass: false },
    { title: "New Malware Campaign Targeting Banks", shouldPass: true },
    { title: "Celebrity News and Gossip", shouldPass: false },
    { title: "Ransomware Attack on Hospital Network", shouldPass: true },
    { title: "Sports Game Results", shouldPass: false }
];

const isRelevantThreatIntel = (title, description = '') => {
    const content = (title + ' ' + description).toLowerCase();
    const securityKeywords = [
        'vulnerability', 'exploit', 'malware', 'ransomware', 'phishing',
        'breach', 'attack', 'threat', 'security', 'cyber', 'hack',
        'patch', 'cve', 'advisory', 'alert', 'compromise', 'apt',
        'zero-day', 'backdoor', 'trojan', 'virus', 'worm', 'rootkit'
    ];
    return securityKeywords.some(keyword => content.includes(keyword));
};

for (const test of filterTests) {
    const isRelevant = isRelevantThreatIntel(test.title);
    const status = isRelevant === test.shouldPass ? '✅ PASS' : '❌ FAIL';
    const relevance = isRelevant ? 'RELEVANT' : 'FILTERED OUT';
    
    console.log(`${status} "${test.title}" → ${relevance}`);
}

// Show feed metadata
console.log('\n📊 ENHANCED FEED CONFIGURATION:\n');

try {
    const feedsData = JSON.parse(fs.readFileSync('./feeds.json', 'utf8'));
    
    for (const feed of feedsData) {
        console.log(`🌐 ${feed.name}`);
        console.log(`   📂 Category: ${feed.category}/${feed.region}`);
        console.log(`   ⚡ Priority: ${feed.priority.toUpperCase()}`);
        console.log(`   🔄 Status: ${feed.enabled ? 'ENABLED' : 'DISABLED'}`);
        console.log(`   📄 Description: ${feed.description}\n`);
    }
} catch (error) {
    console.log(`❌ Could not read feeds.json: ${error.message}\n`);
}

// Show sample Teams message format
console.log('💬 ENHANCED TEAMS MESSAGE FORMAT:\n');

const sampleThreat = demoThreats[0]; // Critical threat
console.log('📧 Sample message that would be sent to Teams:');
console.log('─'.repeat(50));

// Mock the Teams message format
const severity = detectSeverity(sampleThreat.title, sampleThreat.description);
const threatType = classifyThreatType(sampleThreat.title, sampleThreat.description);

console.log(`🚨 **CRITICAL THREAT ALERT**`);
console.log(`\n**${severity.emoji} Severity:** ${severity.level}`);
console.log(`**${threatType.emoji} Type:** ${threatType.category}`);
console.log(`**🏢 Source:** ${sampleThreat.source}`);
console.log(`\n**📰 Title:** ${sampleThreat.title}`);
console.log(`\n**🔗 Link:** ${sampleThreat.link}`);
console.log(`\n**💡 Recommended Action:** Immediate attention required - patch or mitigate vulnerability`);
console.log('─'.repeat(50));

console.log('\n🎉 TIER 2 INTELLIGENCE FEATURES SUMMARY:');
console.log('  ✅ Automatic severity detection (CRITICAL → INFO)');
console.log('  ✅ Threat type classification (5 categories)');
console.log('  ✅ Smart content filtering (security relevance)');
console.log('  ✅ Enhanced feed metadata (category/region/priority)');
console.log('  ✅ Action recommendations for SOC teams');
console.log('  ✅ Priority-based processing and formatting');
console.log('\n🛡️  Your SOC team now receives intelligent, actionable threat intelligence!');

export {};
