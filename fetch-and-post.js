// Deprecated entrypoint; the enhanced pipeline is authoritative.
// This stub remains only for CLI/automation compatibility.
console.warn('[DEPRECATED] Use fetch-and-post-enhanced.js. Redirecting...');

try {
  await import('./fetch-and-post-enhanced.js');
} catch (err) {
  console.error('Failed to start enhanced pipeline:', err?.message || err);
  process.exit(0);
}

// Deprecated entrypoint kept for compatibility. Use fetch-and-post-enhanced.js
console.warn('[DEPRECATED] fetch-and-post.js has been replaced by fetch-and-post-enhanced.js');
import('./fetch-and-post-enhanced.js').catch(err => {
  console.error('Failed to load enhanced pipeline:', err?.message || err);
  process.exit(0);
});

// Default configuration
const DEFAULT_FEEDS_FILE = 'data/feeds.json';
const DEFAULT_STATE_FILE = 'data/state.json';
const PARSERS_DIR = 'parsers';

// Parse CLI arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const configIndex = args.indexOf('--config');
const customConfigPath = configIndex !== -1 && args[configIndex + 1] ? args[configIndex + 1] : null;
const logToFile = process.env.LOG_TO_FILE === 'true';

// Set configuration paths
const FEEDS_FILE = customConfigPath || DEFAULT_FEEDS_FILE;
const STATE_FILE = isDryRun ? null : DEFAULT_STATE_FILE; // Don't use state file in dry-run mode

// Production limits with enhanced control
const MAX_ITEMS_PER_FEED = isDryRun ? 5 : (process.env.NODE_ENV === 'production' ? 10 : 1);

// Dry-run output storage
let dryRunOutputs = [];

/**
 * Log output for dry-run mode
 * @param {Object} output - Output data to log
 */
function logDryRunOutput(output) {
  if (!isDryRun) return;
  
  dryRunOutputs.push({
    timestamp: new Date().toISOString(),
    ...output
  });
  
  // Console output for immediate feedback
  console.log('📋 DRY-RUN OUTPUT:');
  console.log(JSON.stringify(output, null, 2));
  console.log('─'.repeat(80));
}

/**
 * Save dry-run outputs to file or display summary
 */
async function finalizeDryRunOutput() {
  if (!isDryRun || dryRunOutputs.length === 0) return;
  
  const summary = {
    runTimestamp: new Date().toISOString(),
    configFile: FEEDS_FILE,
    totalOutputs: dryRunOutputs.length,
    outputs: dryRunOutputs
  };
  
  if (logToFile) {
    try {
      // Ensure logs directory exists
      await fs.mkdir('logs', { recursive: true });
      const outputFile = `logs/dry-run-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      await fs.writeFile(outputFile, JSON.stringify(summary, null, 2));
      console.log(`📁 Dry-run output saved to: ${outputFile}`);
    } catch (error) {
      console.error(`❌ Failed to save dry-run output to file:`, error.message);
    }
  }
  
  console.log('\n🏁 DRY-RUN SUMMARY:');
  console.log(`   Total messages that would be posted: ${dryRunOutputs.length}`);
  console.log(`   Config file used: ${FEEDS_FILE}`);
  console.log(`   State file updates: SKIPPED (dry-run mode)`);
  console.log(`   Teams posting: SKIPPED (dry-run mode)`);
}

// Cache for loaded parsers
const parserCache = new Map();

/**
 * Dynamically load a parser module
 * @param {string} parserName - Name of the parser to load
 * @returns {Promise<Object>} - Parser instance
 */
async function loadParser(parserName) {
  if (parserCache.has(parserName)) {
    return parserCache.get(parserName);
  }

  try {
    let ParserClass;
    
    if (parserName === 'defaultParser') {
      ParserClass = DefaultParser;
    } else {
      // Dynamic import for custom parsers
      const parserModule = await import(`./parsers/${parserName}.js`);
      ParserClass = parserModule.default || parserModule[parserName];
    }

    if (!ParserClass) {
      throw new Error(`Parser class not found in ${parserName}.js`);
    }

    const parser = new ParserClass();
    parserCache.set(parserName, parser);
    console.log(`✅ Loaded parser: ${parserName}`);
    return parser;
  } catch (error) {
    console.error(`❌ Failed to load parser ${parserName}:`, error.message);
    console.log(`🔄 Falling back to default parser`);
    
    if (!parserCache.has('defaultParser')) {
      const defaultParser = new DefaultParser();
      parserCache.set('defaultParser', defaultParser);
    }
    return parserCache.get('defaultParser');
  }
}

/**
 * Check if content is relevant threat intelligence
 * @param {string} title - The title of the item
 * @param {string} description - The description of the item
 * @returns {boolean} - True if relevant, false if should be filtered out
 */
function isRelevantThreatIntel(title, description) {
  const content = (title + ' ' + description).toLowerCase();
  
  // Filter out irrelevant content
  const irrelevantKeywords = [
    'webinar', 'conference', 'marketing', 'advertisement', 'promo',
    'newsletter', 'subscribe', 'follow us', 'social media',
    'job opening', 'hiring', 'career', 'training course'
  ];
  
  // Must contain relevant security keywords
  const relevantKeywords = [
    'security', 'vulnerability', 'threat', 'malware', 'exploit',
    'patch', 'update', 'advisory', 'alert', 'breach', 'attack',
    'cve-', 'cybersecurity', 'cyber', 'risk', 'incident'
  ];
  
  // Filter out if contains irrelevant content
  if (irrelevantKeywords.some(keyword => content.includes(keyword))) {
    return false;
  }
  
  // Must contain at least one relevant keyword
  return relevantKeywords.some(keyword => content.includes(keyword));
}

/**
 * Validate RSS feed item structure (with normalized fields from parser)
 * @param {Object} item - RSS item to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function validateFeedItem(item) {
  return item && item.title && (item.link || item.guid) && item.publishedDate;
}

/**
 * Get feed priority delay based on feed configuration
 * @param {Object} feed - Feed configuration object
 * @returns {number} - Delay in milliseconds
 */
function getFeedDelay(feed) {
  const priorityDelays = {
    'high': 3000,    // 3 seconds for high priority feeds
    'medium': 5000,  // 5 seconds for medium priority feeds
    'low': 8000      // 8 seconds for low priority feeds
  };
  
  return priorityDelays[feed.priority] || 5000;
}

/**
 * Load and validate feeds configuration
 * @returns {Promise<Array>} Array of valid feed objects
 */
async function loadFeeds() {
  console.log(`📋 Loading and validating feeds from ${FEEDS_FILE}...`);
  
  const validator = new FeedValidator();
  
  // Scan for available parsers and add them to validator
  try {
    const availableParsers = await scanAvailableParsers(PARSERS_DIR);
    availableParsers.forEach(parser => validator.addAvailableParser(parser));
    console.log(`🔧 Available parsers: ${availableParsers.join(', ')}`);
  } catch (error) {
    console.warn(`⚠️  Could not scan parsers: ${error.message}`);
  }
  
  const result = await validator.loadAndValidateFeeds(FEEDS_FILE);
  
  if (result.errors.length > 0) {
    console.error(`❌ Feed validation errors:`);
    result.errors.forEach(error => console.error(`   ${error}`));
  }
  
  if (result.validCount === 0) {
    console.error(`❌ No valid feeds found. Total feeds: ${result.totalFeeds}`);
    return [];
  }
  
  console.log(`✅ Validated ${result.validCount}/${result.totalFeeds} feeds successfully`);
  return result.validFeeds;
}

/**
 * Load the current state tracking file
 * @returns {Promise<Object>} State object with last processed URLs per feed
 */
async function loadState() {
  if (isDryRun) {
    console.log(`ℹ️  DRY-RUN: Using empty state (will not check for duplicates)`);
    return {};
  }
  
  try {
    const data = await fs.readFile(STATE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.log(`ℹ️  No existing state file found, starting fresh`);
    return {};
  }
}

/**
 * Save the updated state to file
 * @param {Object} state - State object to save
 */
async function saveState(state) {
  if (isDryRun) {
    console.log(`ℹ️  DRY-RUN: Skipping state save to ${STATE_FILE}`);
    return;
  }
  
  try {
    await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
    console.log(`✅ State updated and saved to ${STATE_FILE}`);
  } catch (error) {
    console.error(`❌ Error saving state to ${STATE_FILE}:`, error.message);
  }
}

/**
 * Process a single RSS feed using the appropriate parser
 * @param {Object} feed - Feed configuration object
 * @param {Object} state - Current state object
 * @returns {Promise<string|null>} URL of the latest processed item, or null if failed
 */
async function processFeed(feed, state) {
  const { name, url, enabled, category, region, priority, parser: parserName } = feed;
  
  // Skip disabled feeds
  if (enabled === false) {
    console.log(`⏸️  Skipping disabled feed: ${name}`);
    return state[name] || null;
  }
  
  console.log(`🔍 Processing ${category}/${region} feed: ${name} (Priority: ${priority}, Parser: ${parserName})`);

  try {
    // Load the appropriate parser
    const parser = await loadParser(parserName);
    
    // Parse the feed using the selected parser
    const parsedFeed = await parser.parseURL(url);
    const items = parsedFeed.items || [];

    if (items.length === 0) {
      console.log(`⚠️  No items found in feed: ${name}`);
      return state[name] || null;
    }

    // Get the last processed item URL for this feed
    const lastProcessedUrl = state[name];
    let newItemsFound = false;
    let latestItemUrl = null;

    // Sort items by publication date (most recent first)
    const sortedItems = items
      .filter(item => validateFeedItem(item)) // Filter out malformed items
      .sort((a, b) => {
        const dateA = new Date(a.publishedDate || 0);
        const dateB = new Date(b.publishedDate || 0);
        return dateB - dateA;
      });

    console.log(`📊 Found ${sortedItems.length} valid items in ${name} (${items.length - sortedItems.length} filtered out)`);

    // Find new items that are newer than the last processed item
    const itemsToProcess = [];
    
    if (!lastProcessedUrl && !isDryRun) {
      // First run - only save the most recent item without posting to avoid spam
      console.log(`ℹ️  First run for ${name}, initializing state without posting`);
      const mostRecentItem = sortedItems[0]; // Already sorted newest first
      if (mostRecentItem) {
        const mostRecentUrl = mostRecentItem.link || mostRecentItem.guid;
        console.log(`ℹ️  Saved most recent item URL for ${name}: ${mostRecentUrl}`);
        return mostRecentUrl;
      }
      return null;
    } else if (isDryRun) {
      // In dry-run mode, process all recent items for preview
      itemsToProcess.push(...sortedItems.slice(0, MAX_ITEMS_PER_FEED));
      console.log(`ℹ️  DRY-RUN: Processing ${itemsToProcess.length} recent items from ${name}`);
    } else {
      // Find items that are newer than the last processed one
      for (const item of sortedItems) {
        const itemUrl = item.link || item.guid;
        
        if (!itemUrl) {
          console.log(`⚠️  Skipping item without URL in feed: ${name}`);
          continue;
        }

        // Stop when we reach the last processed item
        if (itemUrl === lastProcessedUrl) {
          break;
        }
        
        itemsToProcess.push(item);
      }
    }

    // Check if we have new items to process
    if (itemsToProcess.length === 0) {
      const message = isDryRun ? `No items to preview for ${name}` : `No new items found for ${name}`;
      console.log(`ℹ️  ${message}`);
      return lastProcessedUrl; // Keep existing state
    }

    // Filter for relevant threat intelligence content
    const relevantItems = itemsToProcess.filter(item => {
      const isRelevant = isRelevantThreatIntel(
        item.title || '',
        item.description || item.content || ''
      );
      
      if (!isRelevant) {
        console.log(`🔍 Filtered out non-threat-intel content: "${item.title}"`);
      }
      
      return isRelevant;
    });

    if (relevantItems.length === 0) {
      const message = isDryRun 
        ? `No relevant threat intelligence found in ${itemsToProcess.length} preview items from ${name}`
        : `No relevant threat intelligence found in ${itemsToProcess.length} new items from ${name}`;
      console.log(`ℹ️  ${message}`);
      // Still update state to avoid reprocessing filtered items (unless dry-run)
      if (!isDryRun) {
        const mostRecentItem = itemsToProcess[0];
        return mostRecentItem?.link || mostRecentItem?.guid || lastProcessedUrl;
      }
      return lastProcessedUrl;
    }

    const actionVerb = isDryRun ? 'preview' : 'threat intel';
    console.log(`🎯 Found ${relevantItems.length} relevant ${actionVerb} items from ${name} (${itemsToProcess.length - relevantItems.length} filtered as non-relevant)`);

    // Limit items to avoid overwhelming Teams
    let finalItems = relevantItems;
    if (finalItems.length > MAX_ITEMS_PER_FEED) {
      console.log(`ℹ️  Limiting to ${MAX_ITEMS_PER_FEED} item(s) per feed`);
      finalItems = finalItems.slice(0, MAX_ITEMS_PER_FEED); // Keep only the first N items (newest)
    }

    // Post items from oldest to newest (reverse the array since it's sorted newest first)
    const itemsToPost = finalItems.reverse();
    let latestProcessedUrl = lastProcessedUrl;
    const feedDelay = getFeedDelay(feed);

    for (const item of itemsToPost) {
      const itemUrl = item.link || item.guid;
      const title = item.title || 'No Title';
      const description = item.description || item.content || '';
      const publishedDate = item.publishedDate || new Date().toISOString();
      
      // Create feed metadata for the post
      const feedMetadata = {
        category,
        region,
        priority,
        parser: parserName
      };
      
      if (isDryRun) {
        // Generate formatted message for preview
        const formattedMessage = formatMessage({
          feedName: name,
          title,
          url: itemUrl,
          description,
          publishedDate,
          feedMetadata
        });
        
        // Create entry for output manager
        const entryData = {
          feedName: name,
          category,
          region,
          priority,
          title,
          url: itemUrl,
          description,
          publishedDate
        };
        
        // Process through output manager for dry-run
        await OutputManager.processEntry(entryData, true);
        
        logDryRunOutput({
          feedName: name,
          category,
          region,
          priority,
          title,
          url: itemUrl,
          description: description.substring(0, 200) + (description.length > 200 ? '...' : ''),
          publishedDate,
          formattedMessage
        });
        
        console.log(`🔍 DRY-RUN: Would post from ${name} (${category}): ${title}`);
        latestProcessedUrl = itemUrl;
      } else {
        console.log(`📤 Posting threat intel from ${name} (${category}): ${title}`);
        
        // Create entry for output manager
        const entryData = {
          feedName: name,
          category,
          region,
          priority,
          title,
          url: itemUrl,
          description,
          publishedDate
        };
        
        try {
          // Process through output manager (sends to Teams and accumulates for HTML)
          const results = await OutputManager.processEntry(entryData, false);
          
          if (results.teams?.success) {
            newItemsFound = true;
            latestProcessedUrl = itemUrl; // Update to this item's URL
            // Use priority-based delay between posts
            console.log(`⏳ Applying ${feedDelay}ms delay for ${priority} priority feed`);
            await new Promise(resolve => setTimeout(resolve, feedDelay));
          } else {
            console.error(`❌ Failed to post item from ${name}: ${title}`);
          }
        } catch (error) {
          console.error(`❌ Failed to process item from ${name}: ${title}`, error.message);
          // Continue processing other items even if one fails
        }
      }
    }

    if (isDryRun) {
      console.log(`✅ DRY-RUN: Previewed ${itemsToPost.length} potential messages from ${name}`);
      return latestProcessedUrl;
    } else if (newItemsFound) {
      console.log(`✅ Successfully posted ${itemsToPost.length} threat intelligence items from ${name}`);
      return latestProcessedUrl;
    } else {
      console.log(`❌ No items were successfully posted from ${name}`);
      return lastProcessedUrl; // Keep existing state if posting failed
    }

  } catch (error) {
    console.error(`❌ Error processing feed ${name} (${url}):`, error.message);
    // Return existing state to avoid losing progress
    return state[name] || null;
  }
}

/**
 * Display help information
 */
function displayHelp() {
  console.log(`
🤖 Threat Feed Bot - Advanced Threat Intelligence Collector

USAGE:
  node fetch-and-post.js [OPTIONS]

OPTIONS:
  --dry-run              Run in preview mode (no Teams posting, no state updates)
  --config <path>        Use custom feed configuration file (default: data/feeds.json)
  
ENVIRONMENT VARIABLES:
  TEAMS_WEBHOOK_URL      Microsoft Teams webhook URL (required for live posting)
  ENABLE_GITHUB_PAGES    Set to 'true' to generate HTML output for GitHub Pages
  LOG_TO_FILE           Set to 'true' to save dry-run output to logs/output.json
  NODE_ENV              Set to 'production' for production limits

EXAMPLES:
  node fetch-and-post.js                           # Normal operation
  node fetch-and-post.js --dry-run                 # Preview mode
  node fetch-and-post.js --config feeds-test.json  # Custom config
  LOG_TO_FILE=true node fetch-and-post.js --dry-run # Save preview to file
  ENABLE_GITHUB_PAGES=true node fetch-and-post.js  # Generate HTML output

OUTPUT CHANNELS:
  - Microsoft Teams: Immediate posting of threat intelligence alerts
  - GitHub Pages: Static HTML feed generated at docs/index.html

DRY-RUN MODE:
  - Processes all feeds and validates configuration
  - Generates formatted Teams message previews
  - Shows threat classification and severity detection
  - Skips actual Teams posting and state file updates
  - Optionally saves output to logs/dry-run-<timestamp>.json
`);
}

/**
 * Main function to process all feeds
 */
async function main() {
  // Handle help flag
  if (args.includes('--help') || args.includes('-h')) {
    displayHelp();
    process.exit(0);
  }
  
  const mode = isDryRun ? 'DRY-RUN' : 'LIVE';
  console.log(`🚀 Starting Threat Feed Bot in ${mode} mode...`);
  console.log(`📅 Run time: ${new Date().toISOString()}`);
  
  // Configure output channels
  OutputManager.configureOutputs({
    teams: !!process.env.TEAMS_WEBHOOK_URL || isDryRun,
    githubPages: process.env.ENABLE_GITHUB_PAGES === 'true' || isDryRun
  });
  
  if (isDryRun) {
    console.log('🔍 DRY-RUN MODE: No Teams posting, no state updates');
    console.log(`📋 Config file: ${FEEDS_FILE}`);
    if (logToFile) {
      console.log('📁 Output will be saved to logs/ directory');
    }
  }

  // Load feeds and current state
  const feeds = await loadFeeds();
  const state = await loadState();

  if (feeds.length === 0) {
    console.error('❌ No feeds configured or unable to load feeds');
    process.exit(1);
  }

  console.log(`📡 Processing ${feeds.length} feed(s)...`);

  // Process each feed
  let updatedState = { ...state };
  
  for (const feed of feeds) {
    const latestUrl = await processFeed(feed, state);
    if (latestUrl && !isDryRun) {
      updatedState[feed.name] = latestUrl;
    }
    
    // Delay between feeds to be respectful and avoid throttling
    if (!isDryRun) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
    } else {
      // Shorter delay in dry-run mode
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
    }
  }

  // Save updated state
  await saveState(updatedState);
  
  // Finalize all outputs (Teams and HTML)
  await OutputManager.finalizeOutputs(isDryRun);
  
  // Finalize dry-run output
  await finalizeDryRunOutput();

  const completionMessage = isDryRun 
    ? '✅ Threat Feed Bot dry-run completed successfully'
    : '✅ Threat Feed Bot completed successfully';
  console.log(completionMessage);
}

// Run the main function and handle any unhandled errors
main().catch(error => {
  console.error('❌ Fatal error in Threat Feed Bot:', error.message);
  console.error(error.stack);
  process.exit(1);
});
