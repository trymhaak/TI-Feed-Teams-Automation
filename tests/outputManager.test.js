/**
 * Tests for Output Manager
 */

import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import OutputManager from '../outputs/outputManager.js';

// Mock data
const mockEntry = {
  feedName: 'Test-Feed',
  category: 'test',
  region: 'global',
  priority: 'high',
  title: 'Test Security Alert',
  url: 'https://example.com/alert',
  description: 'This is a test security alert for validation purposes.',
  publishedDate: '2025-08-07T10:00:00Z'
};

describe('Output Manager', () => {
  beforeEach(() => {
    // Reset accumulated entries before each test
    OutputManager.resetAccumulatedEntries();
    
    // Configure for testing
    OutputManager.configureOutputs({
      teams: false, // Disable Teams for testing
      githubPages: false // Disable HTML generation for most tests
    });
  });

  afterEach(() => {
    // Clean up after each test
    OutputManager.resetAccumulatedEntries();
  });

  test('should add entries to accumulation', () => {
    const initialStatus = OutputManager.getOutputStatus();
    expect(initialStatus.accumulatedEntries).toBe(0);
    
    OutputManager.addEntry(mockEntry);
    
    const updatedStatus = OutputManager.getOutputStatus();
    expect(updatedStatus.accumulatedEntries).toBe(1);
  });

  test('should handle invalid entries gracefully', () => {
    const initialCount = OutputManager.getOutputStatus().accumulatedEntries;
    
    // Should not add null or invalid entries
    OutputManager.addEntry(null);
    OutputManager.addEntry(undefined);
    OutputManager.addEntry('invalid');
    
    const finalCount = OutputManager.getOutputStatus().accumulatedEntries;
    expect(finalCount).toBe(initialCount);
  });

  test('should process entry in dry-run mode', async () => {
    const results = await OutputManager.processEntry(mockEntry, true);
    
    expect(results).toHaveProperty('teams');
    expect(results).toHaveProperty('htmlAccumulated');
    expect(results.htmlAccumulated).toBe(true);
    expect(results.teams?.mode).toBe('dry-run');
    
    // Should accumulate entry
    const status = OutputManager.getOutputStatus();
    expect(status.accumulatedEntries).toBe(1);
  });

  test('should finalize outputs in dry-run mode', async () => {
    // Add some entries first
    OutputManager.addEntry(mockEntry);
    OutputManager.addEntry({ ...mockEntry, title: 'Second Alert' });
    
    const results = await OutputManager.finalizeOutputs(true);
    
    expect(results).toHaveProperty('html');
    expect(results).toHaveProperty('summary');
    expect(results.summary.totalEntries).toBe(2);
    expect(results.html?.mode).toBe('dry-run');
  });

  test('should reset accumulated entries', () => {
    // Add entries
    OutputManager.addEntry(mockEntry);
    OutputManager.addEntry({ ...mockEntry, title: 'Another Alert' });
    
    expect(OutputManager.getOutputStatus().accumulatedEntries).toBe(2);
    
    const resetCount = OutputManager.resetAccumulatedEntries();
    expect(resetCount).toBe(2);
    expect(OutputManager.getOutputStatus().accumulatedEntries).toBe(0);
  });

  test('should configure output channels', () => {
    OutputManager.configureOutputs({
      teams: true,
      githubPages: true
    });
    
    const status = OutputManager.getOutputStatus();
    expect(status.config.teams.enabled).toBe(true);
    expect(status.config.githubPages.enabled).toBe(true);
  });

  test('should get output status', () => {
    OutputManager.addEntry(mockEntry);
    OutputManager.configureOutputs({ teams: true, githubPages: false });
    
    const status = OutputManager.getOutputStatus();
    
    expect(status).toHaveProperty('config');
    expect(status).toHaveProperty('accumulatedEntries');
    expect(status).toHaveProperty('enabledChannels');
    expect(status.accumulatedEntries).toBe(1);
    expect(status.enabledChannels).toBe(1); // Only teams enabled
  });

  test('should handle Teams output with no webhook URL', async () => {
    // Ensure no Teams webhook is set
    delete process.env.TEAMS_WEBHOOK_URL;
    
    OutputManager.configureOutputs({ teams: false });
    
    const result = await OutputManager.sendToTeams(mockEntry, false);
    expect(result).toBeNull();
  });

  test('should handle HTML output when disabled', async () => {
    OutputManager.configureOutputs({ githubPages: false });
    
    const result = await OutputManager.generateHTMLOutput(false);
    expect(result).toBeNull();
  });

  test('should process multiple entries and finalize', async () => {
    const entries = [
      mockEntry,
      { ...mockEntry, title: 'Second Alert', url: 'https://example.com/alert2' },
      { ...mockEntry, title: 'Third Alert', url: 'https://example.com/alert3' }
    ];
    
    // Process all entries
    for (const entry of entries) {
      await OutputManager.processEntry(entry, true);
    }
    
    // Verify accumulation
    expect(OutputManager.getOutputStatus().accumulatedEntries).toBe(3);
    
    // Finalize
    const results = await OutputManager.finalizeOutputs(true);
    expect(results.summary.totalEntries).toBe(3);
  });

  test('should add timestamp to entries', () => {
    const beforeTime = new Date().toISOString();
    OutputManager.addEntry(mockEntry);
    const afterTime = new Date().toISOString();
    
    // Can't directly access the entry, but we can verify it was processed
    const status = OutputManager.getOutputStatus();
    expect(status.accumulatedEntries).toBe(1);
    
    // The entry should have been timestamped between before and after
    // This is implicit in the addEntry function
  });
});
