import fs from 'fs/promises';
import Parser from 'rss-parser';
import { postToTeams } from './post-to-teams.js';

const RSS_PARSER = new Parser();
const FEEDS_FILE = 'feeds.json';
const STATE_FILE = 'state.json';

// Limit for testing - set to 1 to avoid spam during testing
const MAX_ITEMS_PER_FEED = process.env.NODE_ENV === 'production' ? 10 : 1;

/**
 * Load and parse the feeds configuration file
 * @returns {Promise<Array>} Array of feed objects
 */
async function loadFeeds() {
  try {
    const data = await fs.readFile(FEEDS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`❌ Error loading feeds from ${FEEDS_FILE}:`, error.message);
    return [];
  }
}

/**
 * Load the current state tracking file
 * @returns {Promise<Object>} State object with last processed URLs per feed
 */
async function loadState() {
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
  try {
    await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
    console.log(`✅ State updated and saved to ${STATE_FILE}`);
  } catch (error) {
    console.error(`❌ Error saving state to ${STATE_FILE}:`, error.message);
  }
}

/**
 * Process a single RSS feed
 * @param {Object} feed - Feed configuration object
 * @param {Object} state - Current state object
 * @returns {Promise<string|null>} URL of the latest processed item, or null if failed
 */
async function processFeed(feed, state) {
  const { name, url } = feed;
  console.log(`🔍 Processing feed: ${name}`);

  try {
    const parsedFeed = await RSS_PARSER.parseURL(url);
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
    const sortedItems = items.sort((a, b) => {
      const dateA = new Date(a.pubDate || a.isoDate || 0);
      const dateB = new Date(b.pubDate || b.isoDate || 0);
      return dateB - dateA;
    });

    // Find new items that are newer than the last processed item
    const itemsToProcess = [];
    
    if (!lastProcessedUrl) {
      // First run for this feed - post the most recent item to demonstrate the new feed is working
      console.log(`ℹ️  First run for ${name}, posting most recent item to demonstrate new feed`);
      const mostRecentItem = sortedItems[0]; // Already sorted newest first
      if (mostRecentItem) {
        itemsToProcess.push(mostRecentItem);
      }
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
      console.log(`ℹ️  No new items found for ${name}`);
      return lastProcessedUrl; // Keep existing state
    }

    console.log(`📰 Found ${itemsToProcess.length} new item(s) for ${name}`);

    // Limit items to avoid overwhelming Teams
    if (itemsToProcess.length > MAX_ITEMS_PER_FEED) {
      console.log(`ℹ️  Limiting to ${MAX_ITEMS_PER_FEED} item(s) per feed`);
      itemsToProcess.splice(MAX_ITEMS_PER_FEED); // Keep only the first N items (newest)
    }

    // Post items from oldest to newest (reverse the array since it's sorted newest first)
    const itemsToPost = itemsToProcess.reverse();
    let latestProcessedUrl = lastProcessedUrl;

    for (const item of itemsToPost) {
      const itemUrl = item.link || item.guid;
      const title = item.title || 'No Title';
      const description = item.contentSnippet || item.content || item.summary || item.description || '';
      const publishedDate = item.pubDate || item.isoDate || new Date().toISOString();
      
      console.log(`📤 Posting new item from ${name}: ${title}`);
      
      const success = await postToTeams(name, title, itemUrl, description, publishedDate);
      
      if (success) {
        newItemsFound = true;
        latestProcessedUrl = itemUrl; // Update to this item's URL
        // Small delay between posts to avoid rate limiting and Logic App throttling
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
      } else {
        console.error(`❌ Failed to post item from ${name}: ${title}`);
        // Continue processing other items even if one fails
      }
    }

    if (newItemsFound) {
      console.log(`✅ Successfully posted ${itemsToPost.length} new item(s) from ${name}`);
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
 * Main function to process all feeds
 */
async function main() {
  console.log('🚀 Starting Threat Feed Bot...');
  console.log(`📅 Run time: ${new Date().toISOString()}`);

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
    if (latestUrl) {
      updatedState[feed.name] = latestUrl;
    }
    
    // Delay between feeds to be respectful and avoid throttling
    await new Promise(resolve => setTimeout(resolve, 5000)); // 5 second delay
  }

  // Save updated state
  await saveState(updatedState);

  console.log('✅ Threat Feed Bot completed successfully');
}

// Run the main function and handle any unhandled errors
main().catch(error => {
  console.error('❌ Fatal error in Threat Feed Bot:', error.message);
  console.error(error.stack);
  process.exit(1);
});
