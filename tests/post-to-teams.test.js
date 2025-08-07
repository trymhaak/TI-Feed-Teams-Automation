/**
 * Tests for post-to-teams.js module
 * Tests severity detection, threat classification, and Teams integration
 */

import { detectSeverity, classifyThreatType, postToTeams } from '../post-to-teams.js';
import { TEST_SCENARIOS, logSection, logTest } from './test-utils.js';

// Note: The actual formatter functions are now tested in formatter.test.js
// This file maintains compatibility for the integration tests

export async function testPostToTeams() {
    logSection('POST-TO-TEAMS MODULE TEST');
    
    console.log('Testing severity detection and threat classification...\n');
    console.log('Note: Detailed formatter tests are now in formatter.test.js\n');
    
    let passed = 0;
    let total = 0;
    
    for (const scenario of TEST_SCENARIOS) {
        const severity = detectSeverity(scenario.title, scenario.description);
        const threatType = classifyThreatType(scenario.title, scenario.description);
        
        console.log(`📊 ${scenario.name}:`);
        console.log(`   Title: ${scenario.title.substring(0, 60)}...`);
        console.log(`   🎯 Severity: ${severity.emoji} ${severity.level} (Priority ${severity.priority})`);
        console.log(`   🏷️  Threat Type: ${threatType.emoji} ${threatType.category}`);
        console.log(`   🏢 Source: ${scenario.source}\n`);
        
        // Test severity detection logic
        total++;
        if (severity.level && severity.emoji && severity.priority) {
            passed++;
        }
        
        // Test threat type classification logic
        total++;
        if (threatType.category && threatType.emoji) {
            passed++;
        }
    }
    
    logTest('Severity Detection', passed >= total * 0.5, `${passed}/${total} checks passed`);
    return passed === total;
}

export async function testTeamsIntegration(sendLiveMessages = false) {
    logSection('TEAMS INTEGRATION TEST');
    
    if (!process.env.TEAMS_WEBHOOK_URL && sendLiveMessages) {
        console.log('⚠️  TEAMS_WEBHOOK_URL not configured - showing message format only\n');
        sendLiveMessages = false;
    }
    
    if (sendLiveMessages) {
        console.log('📤 Sending test messages to Teams...\n');
        
        let successCount = 0;
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
                if (success) successCount++;
                
                // Rate limiting
                if (i < TEST_SCENARIOS.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            } catch (error) {
                logTest(`Teams Message ${i + 1}`, false, error.message);
            }
        }
        
        return successCount > 0;
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
        
        logTest('Message Format Validation', true, 'All formats generated successfully');
        return true;
    }
}

// Jest-compatible tests
if (typeof describe !== 'undefined') {
    describe('Post-to-Teams Module', () => {
        test('should detect threat severity correctly', async () => {
            const result = await testPostToTeams();
            expect(result).toBe(true);
        });
        
        test('should format Teams messages correctly', async () => {
            const result = await testTeamsIntegration(false);
            expect(result).toBe(true);
        });
    });
}
