/**
 * Output Manager for coordinating multiple output channels
 * Handles Teams webhook and GitHub Pages HTML generation
 */

import { postToTeams } from '../post-to-teams.js';
import { generateGitHubPagesOutput } from './githubPages.js';

/**
 * Configuration for output channels
 */
const OUTPUT_CONFIG = {
  teams: {
    enabled: process.env.TEAMS_WEBHOOK_URL ? true : false,
    name: 'Microsoft Teams'
  },
  githubPages: {
    enabled: process.env.ENABLE_GITHUB_PAGES === 'true' || false,
    name: 'GitHub Pages'
  }
};

/**
 * Accumulated entries for batch processing
 */
let accumulatedEntries = [];

/**
 * Add entry to accumulated entries for batch output generation
 * @param {Object} entry - Threat intelligence entry
 */
export function addEntry(entry) {
  if (!entry || typeof entry !== 'object') {
    console.warn('⚠️  Invalid entry provided to output manager');
    return;
  }
  
  accumulatedEntries.push({
    timestamp: new Date().toISOString(),
    ...entry
  });
}

/**
 * Send individual entry to Teams (immediate processing)
 * @param {Object} entry - Threat intelligence entry
 * @param {boolean} isDryRun - Whether this is a dry run
 */
export async function sendToTeams(entry, isDryRun = false) {
  if (!OUTPUT_CONFIG.teams.enabled && !isDryRun) {
    console.log('⏸️  Teams output disabled (no webhook URL configured)');
    return null;
  }
  
  try {
    if (isDryRun) {
      console.log('🔍 DRY-RUN: Would send to Teams:', entry.title);
      return { success: true, mode: 'dry-run' };
    }
    
    console.log(`📨 Sending to ${OUTPUT_CONFIG.teams.name}: ${entry.title}`);
    
    // FIXED: Pass individual parameters instead of entire entry object
    const result = await postToTeams(
      entry.feedName || 'Unknown Source',
      entry.title || 'No Title',
      entry.url || '#',
      entry.description || '',
      entry.publishedDate || '',
      {
        category: entry.category,
        region: entry.region,
        priority: entry.priority,
        parser: entry.parser
      }
    );
    
    console.log('✅ Successfully sent to Teams');
    return result;
    
  } catch (error) {
    console.error(`❌ Failed to send to ${OUTPUT_CONFIG.teams.name}:`, error.message);
    throw error;
  }
}

/**
 * Generate HTML output from accumulated entries (batch processing)
 * @param {boolean} isDryRun - Whether this is a dry run
 */
export async function generateHTMLOutput(isDryRun = false) {
  if (!OUTPUT_CONFIG.githubPages.enabled && !isDryRun) {
    console.log('⏸️  GitHub Pages output disabled');
    return null;
  }
  
  if (accumulatedEntries.length === 0) {
    console.log('📝 No entries accumulated for HTML output');
    return null;
  }
  
  try {
    if (isDryRun && !OUTPUT_CONFIG.githubPages.enabled) {
      console.log(`🔍 DRY-RUN: Would generate HTML with ${accumulatedEntries.length} entries`);
      return { success: true, mode: 'dry-run', entryCount: accumulatedEntries.length };
    }
    
    console.log(`🌐 Generating ${OUTPUT_CONFIG.githubPages.name} output with ${accumulatedEntries.length} entries`);
    await generateGitHubPagesOutput(accumulatedEntries);
    
    if (isDryRun) {
      console.log('✅ Successfully generated HTML output (dry-run mode)');
    } else {
      console.log('✅ Successfully generated HTML output');
    }
    
    return { success: true, entryCount: accumulatedEntries.length, mode: isDryRun ? 'dry-run' : 'live' };
    
  } catch (error) {
    console.error(`❌ Failed to generate ${OUTPUT_CONFIG.githubPages.name} output:`, error.message);
    throw error;
  }
}

/**
 * Process entry through all enabled output channels
 * @param {Object} entry - Threat intelligence entry
 * @param {boolean} isDryRun - Whether this is a dry run
 */
export async function processEntry(entry, isDryRun = false) {
  const results = {
    teams: null,
    htmlAccumulated: false
  };
  
  try {
    // Add to accumulated entries for HTML generation
    addEntry(entry);
    results.htmlAccumulated = true;
    
    // Send to Teams immediately (if enabled)
    if (OUTPUT_CONFIG.teams.enabled || isDryRun) {
      results.teams = await sendToTeams(entry, isDryRun);
    }
    
    return results;
    
  } catch (error) {
    console.error('❌ Error processing entry through output channels:', error.message);
    throw error;
  }
}

/**
 * Finalize all outputs (call at end of processing)
 * @param {boolean} isDryRun - Whether this is a dry run
 */
export async function finalizeOutputs(isDryRun = false) {
  const results = {
    html: null,
    summary: {
      totalEntries: accumulatedEntries.length,
      enabledOutputs: Object.entries(OUTPUT_CONFIG)
        .filter(([key, config]) => config.enabled || isDryRun)
        .map(([key, config]) => config.name)
    }
  };
  
  try {
    // Generate HTML output from accumulated entries
    if (OUTPUT_CONFIG.githubPages.enabled || isDryRun) {
      results.html = await generateHTMLOutput(isDryRun);
    }
    
    // Clear accumulated entries after processing
    if (!isDryRun) {
      accumulatedEntries = [];
    }
    
    console.log(`📊 Output Summary: ${results.summary.totalEntries} entries processed`);
    console.log(`🔗 Enabled outputs: ${results.summary.enabledOutputs.join(', ')}`);
    
    return results;
    
  } catch (error) {
    console.error('❌ Error finalizing outputs:', error.message);
    throw error;
  }
}

/**
 * Get current configuration and status
 */
export function getOutputStatus() {
  return {
    config: OUTPUT_CONFIG,
    accumulatedEntries: accumulatedEntries.length,
    enabledChannels: Object.entries(OUTPUT_CONFIG)
      .filter(([key, config]) => config.enabled)
      .length
  };
}

/**
 * Reset accumulated entries (useful for testing)
 */
export function resetAccumulatedEntries() {
  const count = accumulatedEntries.length;
  accumulatedEntries = [];
  console.log(`🔄 Reset ${count} accumulated entries`);
  return count;
}

/**
 * Configure output channels
 * @param {Object} config - Configuration object
 */
export function configureOutputs(config = {}) {
  if (config.teams !== undefined) {
    OUTPUT_CONFIG.teams.enabled = config.teams;
  }
  if (config.githubPages !== undefined) {
    OUTPUT_CONFIG.githubPages.enabled = config.githubPages;
  }
  
  console.log('🔧 Output configuration updated:', OUTPUT_CONFIG);
}

// Export default object for easy importing
export default {
  addEntry,
  sendToTeams,
  generateHTMLOutput,
  processEntry,
  finalizeOutputs,
  getOutputStatus,
  resetAccumulatedEntries,
  configureOutputs
};
