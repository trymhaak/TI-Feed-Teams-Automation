/**
 * Tests for fetch-and-post.js module
 * Tests RSS feed processing, content filtering, and configuration management
 */

import fs from 'fs/promises';
import { FILTER_TEST_CASES, isRelevantThreatIntel, logSection, logTest } from './test-utils.js';

export async function testContentFiltering() {
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
    return passed === total;
}

export async function testFeedConfiguration() {
    logSection('FEED CONFIGURATION TEST');
    
    try {
        const feedsData = JSON.parse(await fs.readFile('./data/feeds.json', 'utf8'));
        
        let validFeeds = 0;
        let totalFeeds = feedsData.length;
        console.log(`\n📊 Validating ${totalFeeds} configured feeds:\n`);
        
        for (const feed of feedsData) {
            const hasRequiredFields = feed.name && feed.url && feed.category && 
                                    feed.region && feed.priority !== undefined && 
                                    feed.enabled !== undefined;
            
            logTest(feed.name, hasRequiredFields, 
                   `${feed.category}/${feed.region}, Priority: ${feed.priority}, ${feed.enabled ? 'ENABLED' : 'DISABLED'}`);
            
            if (hasRequiredFields && feed.enabled) validFeeds++;
        }
        
        console.log(`\n✅ Configuration Summary: ${validFeeds} active feeds ready for processing`);
        logTest('Feed Configuration', validFeeds > 0, `${validFeeds}/${totalFeeds} feeds properly configured`);
        
        return validFeeds > 0;
        
    } catch (error) {
        logTest('Feed Configuration', false, `Error reading data/feeds.json: ${error.message}`);
        return false;
    }
}

export async function testStateManagement() {
    logSection('STATE MANAGEMENT TEST');
    
    try {
        const stateData = JSON.parse(await fs.readFile('./data/state.json', 'utf8'));
        const feedsData = JSON.parse(await fs.readFile('./data/feeds.json', 'utf8'));
        
        const enabledFeeds = feedsData.filter(feed => feed.enabled);
        const isEnhanced = stateData && typeof stateData === 'object' && stateData.seen;

        if (isEnhanced) {
            const seenCount = Object.keys(stateData.seen || {}).length;
            console.log(`📊 State tracking (enhanced seen-map): ${seenCount} entries tracked`);
            console.log(`📊 Active feeds: ${enabledFeeds.length} enabled feeds\n`);
            const valid = typeof stateData.version === 'string';
            logTest('State Management', valid, valid ? 'Enhanced state present' : 'Enhanced state missing version');
            return valid;
        } else {
            const stateFeeds = Object.keys(stateData || {});
            console.log(`📊 State tracking: ${stateFeeds.length} feeds in state`);
            console.log(`📊 Active feeds: ${enabledFeeds.length} enabled feeds\n`);
            let validState = true;
            for (const feed of enabledFeeds) {
                const val = stateData[feed.name];
                const hasState = val !== undefined;
                const preview = val ? String(val).substring(0, 50) : '';
                logTest(`State for ${feed.name}`, hasState, hasState ? `URL: ${preview}...` : 'Missing');
                if (!hasState) validState = false;
            }
            logTest('State Management', validState, 'All active feeds have state tracking');
            return validState;
        }
        
    } catch (error) {
        logTest('State Management', false, `Error reading state files: ${error.message}`);
        return false;
    }
}

// Jest-compatible tests
if (typeof describe !== 'undefined') {
    describe('Fetch-and-Post Module', () => {
        test('should filter content correctly', async () => {
            const result = await testContentFiltering();
            expect(result).toBe(true);
        });
        
        test('should validate feed configuration', async () => {
            const result = await testFeedConfiguration();
            expect(result).toBe(true);
        });
        
        test('should manage state correctly', async () => {
            const result = await testStateManagement();
            expect(result).toBe(true);
        });
    });
}
