#!/usr/bin/env node

/**
 * Enhanced Threat Intelligence Feed Bot
 * Monitors RSS feeds for cybersecurity threats and posts to Teams with advanced filtering
 */

import { readFile } from 'fs/promises';
import { OutputManager, addEntry as addHtmlEntry, finalizeOutputs as finalizeHtmlOutputs } from './outputs/outputManager.js';
import { StateManager } from './utils/stateManager.js';
import { ThreatFilter } from './utils/threatFilter.js';
import { HealthMonitor } from './utils/healthMonitor.js';
import { validateFeeds } from './utils/validator.js';
import { config } from './utils/config.js';
import { logger } from './utils/logger.js';
import { showHelp } from './utils/help.js';
import { FeedProcessor } from './utils/feedProcessor.js';

class ThreatIntelBot {
  constructor() {
    this.config = config;
    this.isDryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === 'true';
    this.showHelp = process.argv.includes('--help') || process.argv.includes('-h');
    this.validateConfig = process.argv.includes('--validate');
    
    // Initialize components
    this.stateManager = new StateManager({
      stateFile: this.config.stateFile,
      backupDir: this.config.backupDir || './data/backups'
    });
    
    this.threatFilter = new ThreatFilter(this.config.threatFilter);
    this.healthMonitor = new HealthMonitor(this.config.healthMonitor);
    this.outputManager = new OutputManager(this.config.outputs);
    this.feedProcessor = new FeedProcessor(this.config.feedProcessor);
  }

  /**
   * Main entry point
   */
  async run() {
    try {
      if (this.showHelp) {
        showHelp();
        return;
      }

      if (this.validateConfig) {
        await this.validateConfiguration();
        return;
      }

      logger.info('🚀 Starting Threat Intelligence Bot', {
        mode: this.isDryRun ? 'DRY-RUN' : 'LIVE',
        timestamp: new Date().toISOString()
      });

      // Record run start
      await this.healthMonitor.recordRunStart({
        mode: this.isDryRun ? 'dry-run' : 'live',
        timestamp: new Date().toISOString()
      });

      // Load and validate feeds
      const feeds = await this.loadFeeds();
      logger.info(`📋 Loaded ${feeds.length} feed(s)`);

      // Load state
      const state = await this.stateManager.loadState();
      logger.info(`📊 Loaded state: ${Object.keys(state.seen || {}).length} entries tracked`);

      // Process all feeds
      const results = await this.processFeeds(feeds, state);

      // Filter and classify entries
      const filteredResults = await this.filterAndClassifyEntries(results);

      // Output results
      const outputResults = await this.outputEntries(filteredResults);

      // Update state
      await this.updateState(state, filteredResults);

      // Record successful run
      await this.healthMonitor.recordRunEnd({
        success: true,
        entriesProcessed: results.totalEntries,
        entriesPosted: outputResults.totalPosted,
        feedResults: results.feedResults,
        filterStats: filteredResults.stats
      });

      logger.info('✅ Bot run completed successfully', {
        processed: results.totalEntries,
        posted: outputResults.totalPosted,
        filtered: filteredResults.stats.filtered
      });

    } catch (error) {
      logger.error('❌ Bot run failed:', error);
      await this.healthMonitor.recordError(error);
      await this.healthMonitor.recordRunEnd({
        success: false,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Load and validate feeds configuration
   */
  async loadFeeds() {
    try {
      const feedsData = await readFile('./data/feeds.json', 'utf-8');
      const feeds = JSON.parse(feedsData);

      // Validate feeds
      const validation = validateFeeds(feeds);
      if (!validation.isValid) {
        throw new Error(`Invalid feeds configuration: ${validation.errors.join(', ')}`);
      }

      // Filter enabled feeds
      const enabledFeeds = feeds.filter(feed => feed.enabled !== false);
      logger.info(`🔄 ${enabledFeeds.length}/${feeds.length} feeds enabled`);

      return enabledFeeds;
    } catch (error) {
      logger.error('Failed to load feeds configuration:', error);
      throw error;
    }
  }

  /**
   * Process all feeds and collect entries
   */
  async processFeeds(feeds, state) {
    const results = {
      totalEntries: 0,
      feedResults: {},
      allEntries: []
    };

    logger.info('🔄 Processing feeds...');

    for (const feed of feeds) {
      try {
        logger.info(`📡 Processing feed: ${feed.name}`);
        
        const feedResult = await this.feedProcessor.processFeed(feed);
        results.feedResults[feed.name] = {
          success: true,
          entries: feedResult.entries.length,
          newEntries: feedResult.newEntries.length
        };

        // Filter out already seen entries
        const now = Date.now();
        const lastRunTs = state.lastRun ? Date.parse(state.lastRun) : 0;
        const maxAgeMs = this.config.maxBackfillDays * 24 * 60 * 60 * 1000;
        const thisRunIds = new Set();

        const newEntries = feedResult.entries.filter(entry => {
          const entryId = this.generateEntryId(entry);
          if (thisRunIds.has(entryId)) return false; // intra-run dedupe
          thisRunIds.add(entryId);
          if (state.seen[entryId]) return false; // already seen
          if (!this.config.allowBackfill) {
            const pubTs = entry.publishedDate ? Date.parse(entry.publishedDate) : now;
            if (lastRunTs && pubTs < lastRunTs) return false; // older than last run
            if (pubTs && now - pubTs > maxAgeMs) return false; // too old
          }
          return true;
        });

        logger.info(`📰 Feed "${feed.name}": ${feedResult.entries.length} total, ${newEntries.length} new`);

        // Add source information to entries
        const enrichedEntries = newEntries.map(entry => ({
          ...entry,
          source: feed.name,
          feedConfig: feed
        }));

        results.allEntries.push(...enrichedEntries);
        results.totalEntries += newEntries.length;

      } catch (error) {
        logger.error(`Failed to process feed "${feed.name}":`, error);
        results.feedResults[feed.name] = {
          success: false,
          error: error.message
        };
        await this.healthMonitor.recordError(error, { feed: feed.name });
      }
    }

    return results;
  }

  /**
   * Filter and classify entries using ThreatFilter
   */
  async filterAndClassifyEntries(results) {
    logger.info('🔍 Filtering and classifying entries...');

    const filteredEntries = [];
    
    for (const entry of results.allEntries) {
      try {
        const filteredEntry = await this.threatFilter.filterEntry(entry, entry.feedConfig);
        if (filteredEntry) {
          filteredEntries.push(filteredEntry);
        }
      } catch (error) {
        logger.error('Error filtering entry:', error);
        // Include unfiltered entry on error
        filteredEntries.push(entry);
      }
    }

    // Generate filter statistics
    const stats = this.threatFilter.getFilterStats(results.allEntries, filteredEntries);
    
    logger.info(`🎯 Filtering complete: ${filteredEntries.length}/${results.allEntries.length} entries passed (${stats.filterRate}% filtered)`);

    return {
      entries: filteredEntries,
      stats
    };
  }

  /**
   * Output entries to configured channels
   */
  async outputEntries(filteredResults) {
    logger.info('📤 Outputting entries...');

    if (this.isDryRun) {
      logger.info('🏃 DRY-RUN MODE: Entries would be posted:', {
        count: filteredResults.entries.length,
        entries: filteredResults.entries.map(e => ({
          title: e.title,
          source: e.source,
          severity: e.classification?.severity,
          threatType: e.classification?.threatType
        }))
      });

      return {
        totalPosted: 0,
        dryRunCount: filteredResults.entries.length
      };
    }

    let totalPosted = 0;

    // Always accumulate ALL entries for GitHub Pages output regardless of Teams posting
    try {
      for (const entry of filteredResults.entries) {
        addHtmlEntry(entry);
      }
    } catch {}

    let postedThisRun = 0;
    const postCap = Number(process.env.PER_RUN_POST_CAP || 30);
    for (const entry of filteredResults.entries) {
      if (postedThisRun >= postCap) {
        logger.warn(`Post cap reached (${postCap}). Skipping remaining entries this run.`);
        break;
      }
      try {
        await this.outputManager.sendEntry(entry);
        totalPosted++;
        postedThisRun++;
        logger.info(`📨 Posted: ${entry.title} (${entry.source})`);

        // Add delay between posts to avoid rate limiting
        if (totalPosted < filteredResults.entries.length) {
          await this.sleep(this.config.postDelay || 1000);
        }
      } catch (error) {
        logger.error(`Failed to post entry "${entry.title}":`, error);
        await this.healthMonitor.recordError(error, { entry: entry.title });
      }
    }

    // Finalize GitHub Pages output (writes docs/index.html and feed.json when enabled)
    try {
      await finalizeHtmlOutputs(false);
    } catch (e) {
      logger.warn('GitHub Pages finalize step skipped or failed:', e?.message || e);
    }

    return { totalPosted };
  }

  /**
   * Update state with processed entries
   */
  async updateState(state, filteredResults) {
    logger.info('💾 Updating state...');

    // Mark all processed entries as seen
    for (const entry of filteredResults.entries) {
      const entryId = this.generateEntryId(entry);
      state.seen[entryId] = {
        timestamp: new Date().toISOString(),
        source: entry.source,
        title: entry.title
      };
    }

    // Update metadata
    state.lastRun = new Date().toISOString();
    state.filterStats = filteredResults.stats;

    // Clean up old seen entries (keep last 1000)
    const seenEntries = Object.entries(state.seen);
    if (seenEntries.length > 1000) {
      const sortedEntries = seenEntries.sort((a, b) => 
        new Date(b[1].timestamp) - new Date(a[1].timestamp)
      );
      state.seen = Object.fromEntries(sortedEntries.slice(0, 1000));
    }

    await this.stateManager.saveState(state);
  }

  /**
   * Validate configuration
   */
  async validateConfiguration() {
    logger.info('🔍 Validating configuration...');

    try {
      // Validate feeds
      const feedsData = await readFile('./data/feeds.json', 'utf-8');
      const feeds = JSON.parse(feedsData);
      const validation = validateFeeds(feeds);

      if (validation.isValid) {
        logger.info('✅ Configuration is valid');
        console.log(`✅ Feeds configuration valid (${feeds.length} feeds)`);
        
        // Show feed summary
        feeds.forEach(feed => {
          const status = feed.enabled !== false ? '🟢 ENABLED' : '🔴 DISABLED';
          console.log(`   ${status} ${feed.name} - ${feed.url}`);
        });
        
      } else {
        logger.error('❌ Configuration validation failed:', validation.errors);
        console.log('❌ Configuration validation failed:');
        validation.errors.forEach(error => console.log(`   • ${error}`));
        process.exit(1);
      }

      // Validate environment
      if (!process.env.TEAMS_WEBHOOK_URL) {
        console.log('⚠️  Warning: TEAMS_WEBHOOK_URL not set');
      } else {
        console.log('✅ Teams webhook URL configured');
      }

      // Test state manager
      const testState = await this.stateManager.loadState();
      console.log(`✅ State file accessible (${Object.keys(testState.seen || {}).length} entries tracked)`);

    } catch (error) {
      logger.error('❌ Configuration validation failed:', error);
      console.log(`❌ Configuration validation failed: ${error.message}`);
      process.exit(1);
    }
  }

  /**
   * Generate unique ID for an entry
   */
  generateEntryId(entry) {
    // Prefer stable GUID
    if (entry.guid && typeof entry.guid === 'string') return entry.guid.trim();
    // Normalize URL if present
    if (entry.link) {
      try {
        const u = new URL(entry.link);
        u.hash = '';
        u.search = ''; // drop tracking params
        u.pathname = u.pathname.replace(/\/$/, '');
        return u.toString().toLowerCase();
      } catch {
        return entry.link;
      }
    }
    // Fallback: hash of title|published
    const content = `${entry.title || ''}|${entry.publishedDate || ''}`;
    return 'h:' + Buffer.from(content).toString('base64');
  }

  /**
   * Sleep for specified milliseconds
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Run the bot if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const bot = new ThreatIntelBot();
  
  bot.run().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}

export default ThreatIntelBot;
