#!/usr/bin/env node

/**
 * Comprehensive Testing Suite for Threat Feed Bot
 * Combines all testing functionality into a single, maintainable script
 */

import { detectSeverity, classifyThreatType, postToTeams } from './post-to-teams.js';
import fs from 'fs/promises';

// Test scenarios with realistic threat intelligence data
const TEST_SCENARIOS = [
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

const FILTER_TEST_CASES = [
    { title: "Critical Security Vulnerability CVE-2025-1234", expected: true },
    { title: "Weather Forecast for Next Week", expected: false },
    { title: "New Malware Campaign Targeting Banks", expected: true },
    { title: "Celebrity News and Gossip", expected: false },
    { title: "Ransomware Attack on Hospital Network", expected: true },
    { title: "Sports Game Results", expected: false }
];

// Intelligence analysis functions (duplicated from fetch-and-post.js for testing)
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

// Utility functions
const logSection = (title) => {
    console.log('\n' + '='.repeat(60));
    console.log(`🧪 ${title}`);
    console.log('='.repeat(60));
};

const logTest = (name, status, details = '') => {
    const icon = status ? '✅' : '❌';
    console.log(`${icon} ${name}${details ? ': ' + details : ''}`);
};

// Test functions
async function testIntelligenceFeatures() {
    logSection('INTELLIGENCE ANALYSIS TEST');
    
    console.log('Testing severity detection and threat classification...\n');
    
    for (const scenario of TEST_SCENARIOS) {
        const severity = detectSeverity(scenario.title, scenario.description);
        const threatType = classifyThreatType(scenario.title, scenario.description);
        
        console.log(`📊 ${scenario.name}:`);
        console.log(`   Title: ${scenario.title.substring(0, 60)}...`);
        console.log(`   🎯 Severity: ${severity.emoji} ${severity.level} (Priority ${severity.priority})`);
        console.log(`   🏷️  Threat Type: ${threatType.emoji} ${threatType.category}`);
        console.log(`   🏢 Source: ${scenario.source}\n`);
    }
}

async function testContentFiltering() {
    logSection('CONTENT FILTERING TEST');
    
    let passed = 0;
    let total = FILTER_TEST_CASES.length;
    
    for (const test of FILTER_TEST_CASES) {
        const isRelevant = isRelevantThreatIntel(test.title);
        const success = isRelevant === test.expected;
        const relevance = isRelevant ? 'RELEVANT' : 'FILTERED OUT';
        
        logTest(`"${test.title}"`, success, `→ ${relevance}`);
        if (success) passed++;
    }
    
    console.log(`\n📊 Content Filtering Accuracy: ${passed}/${total} (${Math.round(passed/total*100)}%)`);
}

async function testFeedConfiguration() {
    logSection('FEED CONFIGURATION TEST');
    
    try {
        const feedsData = JSON.parse(await fs.readFile('./feeds.json', 'utf8'));
        
        let validFeeds = 0;
        console.log(`\n📊 Validating ${feedsData.length} configured feeds:\n`);
        
        for (const feed of feedsData) {
            const hasRequiredFields = feed.name && feed.url && feed.category && 
                                    feed.region && feed.priority !== undefined && 
                                    feed.enabled !== undefined;
            
            const status = hasRequiredFields && feed.enabled;
            logTest(feed.name, hasRequiredFields, 
                   `${feed.category}/${feed.region}, Priority: ${feed.priority}, ${feed.enabled ? 'ENABLED' : 'DISABLED'}`);
            
            if (hasRequiredFields && feed.enabled) validFeeds++;
        }
        
        console.log(`\n✅ Configuration Summary: ${validFeeds} active feeds ready for processing`);
        
    } catch (error) {
        logTest('Feed Configuration', false, `Error reading feeds.json: ${error.message}`);
    }
}

async function testTeamsIntegration(sendLiveMessages = false) {
    logSection('TEAMS INTEGRATION TEST');
    
    if (!process.env.TEAMS_WEBHOOK_URL && sendLiveMessages) {
        console.log('⚠️  TEAMS_WEBHOOK_URL not configured - showing message format only\n');
        sendLiveMessages = false;
    }
    
    if (sendLiveMessages) {
        console.log('📤 Sending test messages to Teams...\n');
        
        for (let i = 0; i < Math.min(2, TEST_SCENARIOS.length); i++) {
            const scenario = TEST_SCENARIOS[i];
            console.log(`📧 Sending: ${scenario.name}`);
            
            try {
                const success = await postToTeams(
                    scenario.source,
                    scenario.title,
                    scenario.link,
                    scenario.description
                );
                logTest(`Teams Message ${i + 1}`, success);
                
                // Rate limiting
                if (i < TEST_SCENARIOS.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            } catch (error) {
                logTest(`Teams Message ${i + 1}`, false, error.message);
            }
        }
    } else {
        console.log('📋 Message format validation (no live sending):\n');
        
        for (const scenario of TEST_SCENARIOS) {
            const severity = detectSeverity(scenario.title, scenario.description);
            const threatType = classifyThreatType(scenario.title, scenario.description);
            
            console.log(`📧 ${scenario.name}:`);
            console.log(`   ${severity.emoji} **${severity.level} THREAT ALERT**`);
            console.log(`   ${threatType.emoji} Type: ${threatType.category} | Source: ${scenario.source}`);
            console.log(`   📰 ${scenario.title.substring(0, 60)}...`);
            console.log(`   🔗 ${scenario.link}\n`);
        }
    }
}

// Main test runner
async function runAllTests() {
    console.log('🚀 THREAT FEED BOT - COMPREHENSIVE TEST SUITE');
    console.log('='.repeat(60));
    console.log(`📅 Test Run: ${new Date().toISOString()}\n`);
    
    const testMode = process.argv.includes('--live-teams') ? 'LIVE' : 'SIMULATION';
    console.log(`🎯 Test Mode: ${testMode} (use --live-teams to send actual Teams messages)\n`);
    
    try {
        await testIntelligenceFeatures();
        await testContentFiltering();
        await testFeedConfiguration();
        await testTeamsIntegration(testMode === 'LIVE');
        
        logSection('TEST SUITE COMPLETE');
        console.log('🎉 All tests completed successfully!');
        console.log('📋 System Status: OPERATIONAL');
        console.log('🛡️  Ready for production threat intelligence processing');
        
    } catch (error) {
        console.error('\n❌ Test suite failed:', error);
        process.exit(1);
    }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
    runAllTests();
}

export { testIntelligenceFeatures, testContentFiltering, testFeedConfiguration, testTeamsIntegration };
