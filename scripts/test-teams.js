#!/usr/bin/env node

/**
 * Teams Integration Test Script
 * Tests the spam prevention measures with a controlled Teams webhook call
 */

import { postToTeams } from './post-to-teams.js';
import fs from 'fs/promises';

async function testTeamsIntegration() {
  console.log('🧪 CONTROLLED TEAMS INTEGRATION TEST');
  console.log('=' .repeat(50));
  console.log(`📅 Test Time: ${new Date().toISOString()}`);
  
  // Check if Teams webhook is configured
  const webhookUrl = process.env.TEAMS_WEBHOOK_URL;
  
  if (!webhookUrl) {
    console.log('❌ TEAMS_WEBHOOK_URL not configured');
    console.log('ℹ️  To test with actual Teams webhook, set TEAMS_WEBHOOK_URL environment variable');
    console.log('ℹ️  This test will simulate the Teams posting behavior without actually posting');
    
    // Simulate Teams posting behavior
    console.log('\n🔍 SIMULATION MODE:');
    const testMessage = {
      source: 'TEST-FEED',
      title: 'Test Threat Intelligence Alert',
      link: 'https://example.com/test-alert',
      description: 'This is a test message to verify spam prevention measures',
      publishedDate: new Date().toISOString(),
      feedMetadata: {
        category: 'test',
        region: 'global',
        priority: 'high'
      }
    };
    
    console.log('📧 Would send Teams message:');
    console.log(`   Source: ${testMessage.source}`);
    console.log(`   Title: ${testMessage.title}`);
    console.log(`   Priority: ${testMessage.feedMetadata.priority}`);
    console.log('✅ Simulation completed - no actual Teams message sent');
    
  } else {
    console.log('✅ TEAMS_WEBHOOK_URL configured');
    console.log('🚨 WARNING: This will send an ACTUAL test message to Teams');
    console.log('ℹ️  Press Ctrl+C within 5 seconds to cancel...');
    
    // 5 second delay to allow cancellation
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    console.log('\n📤 Sending test message to Teams...');
    
    try {
      const success = await postToTeams(
        'THREAT-FEED-TEST',
        'TEST: Spam Prevention Verification',
        'https://github.com/trymhaak/TI-Feed-Teams-Automation',
        'This is a controlled test message to verify the Teams spam prevention fixes are working correctly. This should be the ONLY message if limits are working.',
        new Date().toISOString(),
        {
          category: 'test',
          region: 'global', 
          priority: 'high'
        }
      );
      
      if (success) {
        console.log('✅ Test message sent successfully');
        console.log('🔍 Check Teams to verify only ONE message was received');
      } else {
        console.log('❌ Test message failed to send');
      }
      
    } catch (error) {
      console.error('❌ Error sending test message:', error.message);
    }
  }
  
  console.log('\n📊 NEXT STEPS:');
  console.log('1. If Teams webhook is configured, check Teams channel for test message');
  console.log('2. Verify only ONE test message was sent (spam prevention working)');
  console.log('3. Monitor next scheduled workflow run (every 4 hours)');
  console.log('4. Verify production runs send maximum 1 message per feed');
}

// Run the test
testTeamsIntegration().catch(error => {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
});
