/**
 * @fileoverview Tests for dry-run functionality
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';

describe('Dry-run Mode', () => {
  const testConfigDir = path.join(process.cwd(), 'tests', 'test-data');
  const testConfigFile = path.join(testConfigDir, 'test-feeds.json');
  const testFeeds = [
    {
      "name": "Test-Feed",
      "url": "https://feeds.feedburner.com/oreilly/radar",
      "category": "test",
      "region": "global",
      "priority": "medium",
      "enabled": true,
      "description": "Test feed for dry-run validation"
    }
  ];

  beforeEach(async () => {
    // Create test directory and config file
    await fs.mkdir(testConfigDir, { recursive: true });
    await fs.writeFile(testConfigFile, JSON.stringify(testFeeds, null, 2));
  });

  test('should run in dry-run mode with --dry-run flag', () => {
    const result = execSync(
      `node fetch-and-post.js --dry-run --config ${testConfigFile}`,
      { encoding: 'utf8', cwd: process.cwd() }
    );

    expect(result).toContain('DRY-RUN MODE');
    expect(result).toContain('No Teams posting');
    expect(result).toContain('dry-run completed successfully');
    expect(result).not.toContain('Posted to Teams');
  });

  test('should display help with --help flag', () => {
    const result = execSync(
      'node fetch-and-post.js --help',
      { encoding: 'utf8', cwd: process.cwd() }
    );

    expect(result).toContain('Threat Feed Bot - Advanced Threat Intelligence Collector');
    expect(result).toContain('--dry-run');
    expect(result).toContain('--config');
    expect(result).toContain('EXAMPLES');
  });

  test('should use custom config file with --config flag', () => {
    const result = execSync(
      `node fetch-and-post.js --dry-run --config ${testConfigFile}`,
      { encoding: 'utf8', cwd: process.cwd() }
    );

    expect(result).toContain(testConfigFile);
    expect(result).toContain('Test-Feed');
  });

  test('should create logs directory when LOG_TO_FILE=true', async () => {
    try {
      await fs.rmdir('logs', { recursive: true });
    } catch (error) {
      // Directory might not exist, that's okay
    }

    execSync(
      `LOG_TO_FILE=true node fetch-and-post.js --dry-run --config ${testConfigFile}`,
      { encoding: 'utf8', cwd: process.cwd() }
    );

    // Check if logs directory was created
    const logsExists = await fs.access('logs').then(() => true).catch(() => false);
    expect(logsExists).toBe(true);

    // Check if a dry-run file was created
    const logFiles = await fs.readdir('logs');
    const dryRunFiles = logFiles.filter(file => file.startsWith('dry-run-'));
    expect(dryRunFiles.length).toBeGreaterThan(0);
  });

  test('should process feeds without updating state in dry-run mode', () => {
    const result = execSync(
      `node fetch-and-post.js --dry-run --config ${testConfigFile}`,
      { encoding: 'utf8', cwd: process.cwd() }
    );

    expect(result).toContain('Skipping state save');
    expect(result).toContain('State file updates: SKIPPED');
  });

  test('npm run dry-run script should work', () => {
    const result = execSync(
      'npm run dry-run',
      { encoding: 'utf8', cwd: process.cwd() }
    );

    expect(result).toContain('DRY-RUN MODE');
    expect(result).toContain('dry-run completed successfully');
  });

  test('npm run dry-run:save script should create log files', async () => {
    try {
      await fs.rmdir('logs', { recursive: true });
    } catch (error) {
      // Directory might not exist, that's okay
    }

    execSync(
      'npm run dry-run:save',
      { encoding: 'utf8', cwd: process.cwd() }
    );

    // Check if logs directory and files were created
    const logsExists = await fs.access('logs').then(() => true).catch(() => false);
    expect(logsExists).toBe(true);

    const logFiles = await fs.readdir('logs');
    const dryRunFiles = logFiles.filter(file => file.startsWith('dry-run-'));
    expect(dryRunFiles.length).toBeGreaterThan(0);
  });
});
