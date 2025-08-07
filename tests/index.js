#!/usr/bin/env node

/**
 * Main Test Runner for Threat Feed Bot
 * Orchestrates all test modules and provides unified reporting
 */

import { testPostToTeams, testTeamsIntegration } from './post-to-teams.test.js';
import { testContentFiltering, testFeedConfiguration, testStateManagement } from './fetch-and-post.test.js';
import { logSection } from './test-utils.js';

async function runAllTests() {
    console.log('🚀 THREAT FEED BOT - COMPREHENSIVE TEST SUITE');
    console.log('='.repeat(60));
    console.log(`📅 Test Run: ${new Date().toISOString()}\n`);
    
    const testMode = process.argv.includes('--live-teams') ? 'LIVE' : 'SIMULATION';
    console.log(`🎯 Test Mode: ${testMode} (use --live-teams to send actual Teams messages)\n`);
    
    const results = [];
    
    try {
        // Run all test modules
        results.push(await testPostToTeams());
        results.push(await testContentFiltering());
        results.push(await testFeedConfiguration());
        results.push(await testStateManagement());
        results.push(await testTeamsIntegration(testMode === 'LIVE'));
        
        const passed = results.filter(r => r).length;
        const total = results.length;
        
        logSection('TEST SUITE COMPLETE');
        
        if (passed === total) {
            console.log('🎉 All tests completed successfully!');
            console.log('📋 System Status: OPERATIONAL');
            console.log('🛡️  Ready for production threat intelligence processing');
            process.exit(0);
        } else {
            console.log(`❌ ${total - passed} test(s) failed out of ${total}`);
            console.log('📋 System Status: NEEDS ATTENTION');
            process.exit(1);
        }
        
    } catch (error) {
        console.error('\n❌ Test suite failed:', error);
        process.exit(1);
    }
}

// CLI interface
if (import.meta.url === `file://${process.argv[1]}`) {
    runAllTests();
}

export { runAllTests };
