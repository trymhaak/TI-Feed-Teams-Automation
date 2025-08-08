#!/usr/bin/env node

/**
 * CLI Configuration Validation Tool
 * Validates feeds.json, configuration files, and environment setup
 */

import fs from 'fs/promises';
import path from 'path';
import { validateFeeds } from '../utils/validator.js';
import { StateManager } from '../utils/stateManager.js';
import { HealthMonitor } from '../utils/healthMonitor.js';
import { ThreatFilter } from '../utils/threatFilter.js';

class ConfigValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.checks = 0;
    this.passed = 0;
  }

  /**
   * Main validation entry point
   */
  async validate() {
    console.log('🔍 Starting configuration validation...\n');

    try {
      await this.validateProject();
      await this.validateFeeds();
      await this.validateEnvironment();
      await this.validateDependencies();
      await this.validateFilesystem();
      await this.validateModules();
      
      this.printSummary();
      
      // Exit with appropriate code
      process.exit(this.errors.length > 0 ? 1 : 0);
      
    } catch (error) {
      console.error('❌ Validation failed:', error.message);
      process.exit(1);
    }
  }

  /**
   * Validate project structure
   */
  async validateProject() {
    console.log('📁 Validating project structure...');
    
    const requiredDirs = [
      'data',
      'outputs',
      'parsers', 
      'utils',
      'tests'
    ];

    const requiredFiles = [
      'package.json',
      'fetch-and-post.js',
      'data/feeds.json',
      'utils/formatter.js',
      'utils/validator.js',
      'outputs/outputManager.js'
    ];

    // Check directories
    for (const dir of requiredDirs) {
      await this.checkPath(dir, 'directory');
    }

    // Check files
    for (const file of requiredFiles) {
      await this.checkPath(file, 'file');
    }

    console.log('✅ Project structure validation complete\n');
  }

  /**
   * Validate feeds configuration
   */
  async validateFeeds() {
    console.log('📋 Validating feeds configuration...');

    try {
      const feedsPath = './data/feeds.json';
      const feedsContent = await fs.readFile(feedsPath, 'utf-8');
      const feeds = JSON.parse(feedsContent);

      this.check('feeds.json exists and is valid JSON');

      // Use existing validator
      const validation = validateFeeds(feeds);
      
      if (validation.isValid) {
        this.pass('feeds.json structure is valid');
        console.log(`   📊 Found ${feeds.length} feed(s) configured`);
        
        // Validate individual feeds
        for (const feed of feeds) {
          await this.validateIndividualFeed(feed);
        }
      } else {
        this.fail('feeds.json validation failed', validation.errors);
      }

    } catch (error) {
      this.fail('Failed to load or parse feeds.json', error.message);
    }

    console.log('✅ Feeds validation complete\n');
  }

  /**
   * Validate individual feed configuration
   */
  async validateIndividualFeed(feed) {
    const feedName = feed.name || 'unnamed';
    
    // Check required fields
    if (!feed.url) {
      this.fail(`Feed "${feedName}" missing required URL`);
      return;
    }

    if (!feed.name) {
      this.fail('Feed missing required name');
      return;
    }

    // Validate URL format
    try {
      new URL(feed.url);
      this.pass(`Feed "${feedName}" has valid URL format`);
    } catch (error) {
      this.fail(`Feed "${feedName}" has invalid URL: ${feed.url}`);
    }

    // Check enabled status
    if (feed.enabled === false) {
      this.warning(`Feed "${feedName}" is disabled`);
    }

    // Validate filters if present
    if (feed.filters) {
      this.validateFeedFilters(feed);
    }

    // Check parser reference
    if (feed.parser && feed.parser !== 'defaultParser') {
      const parserPath = `./parsers/${feed.parser}.js`;
      try {
        await fs.access(parserPath);
        this.pass(`Feed "${feedName}" parser exists: ${feed.parser}`);
      } catch (error) {
        this.fail(`Feed "${feedName}" references non-existent parser: ${feed.parser}`);
      }
    }
  }

  /**
   * Validate feed filters configuration
   */
  validateFeedFilters(feed) {
    const filters = feed.filters;
    const feedName = feed.name;

    // Validate filter structure
    if (filters.requiredKeywords && !Array.isArray(filters.requiredKeywords)) {
      this.fail(`Feed "${feedName}" requiredKeywords must be an array`);
    }

    if (filters.blockedKeywords && !Array.isArray(filters.blockedKeywords)) {
      this.fail(`Feed "${feedName}" blockedKeywords must be an array`);
    }

    if (filters.threatTypes && !Array.isArray(filters.threatTypes)) {
      this.fail(`Feed "${feedName}" threatTypes must be an array`);
    }

    // Validate severity level
    const validSeverities = ['info', 'low', 'medium', 'high', 'critical'];
    if (filters.minimumSeverity && !validSeverities.includes(filters.minimumSeverity)) {
      this.fail(`Feed "${feedName}" has invalid minimumSeverity: ${filters.minimumSeverity}`);
    }

    // Validate maxAge
    if (filters.maxAge && (typeof filters.maxAge !== 'number' || filters.maxAge <= 0)) {
      this.fail(`Feed "${feedName}" maxAge must be a positive number`);
    }

    this.pass(`Feed "${feedName}" filters are valid`);
  }

  /**
   * Validate environment variables and settings
   */
  async validateEnvironment() {
    console.log('🌍 Validating environment...');

    // Check required environment variables
    const requiredEnvVars = ['TEAMS_WEBHOOK_URL'];
    const optionalEnvVars = ['LOG_TO_FILE', 'ENABLE_GITHUB_PAGES', 'DRY_RUN'];

    for (const envVar of requiredEnvVars) {
      if (process.env[envVar]) {
        this.pass(`Required environment variable ${envVar} is set`);
        
        // Validate Teams webhook URL format
        if (envVar === 'TEAMS_WEBHOOK_URL') {
          try {
            new URL(process.env[envVar]);
            this.pass('Teams webhook URL has valid format');
          } catch (error) {
            this.fail('Teams webhook URL has invalid format');
          }
        }
      } else {
        this.fail(`Required environment variable ${envVar} is not set`);
      }
    }

    for (const envVar of optionalEnvVars) {
      if (process.env[envVar]) {
        this.pass(`Optional environment variable ${envVar} is set`);
      }
    }

    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
    
    if (majorVersion >= 18) {
      this.pass(`Node.js version is compatible: ${nodeVersion}`);
    } else {
      this.fail(`Node.js version is too old: ${nodeVersion} (requires 18+)`);
    }

    console.log('✅ Environment validation complete\n');
  }

  /**
   * Validate dependencies
   */
  async validateDependencies() {
    console.log('📦 Validating dependencies...');

    try {
      const packagePath = './package.json';
      const packageContent = await fs.readFile(packagePath, 'utf-8');
      const packageData = JSON.parse(packageContent);

      this.pass('package.json is valid');

      // Check for required dependencies
      const requiredDeps = ['rss-parser', 'node-fetch'];
      const dependencies = { ...packageData.dependencies, ...packageData.devDependencies };

      for (const dep of requiredDeps) {
        if (dependencies[dep]) {
          this.pass(`Required dependency ${dep} is listed`);
        } else {
          this.fail(`Required dependency ${dep} is missing`);
        }
      }

      // Try to import key modules
      const modules = [
        'rss-parser',
        'fs',
        'path'
      ];

      for (const moduleName of modules) {
        try {
          await import(moduleName);
          this.pass(`Module ${moduleName} can be imported`);
        } catch (error) {
          this.fail(`Module ${moduleName} cannot be imported: ${error.message}`);
        }
      }

    } catch (error) {
      this.fail('Failed to validate package.json', error.message);
    }

    console.log('✅ Dependencies validation complete\n');
  }

  /**
   * Validate filesystem permissions and paths
   */
  async validateFilesystem() {
    console.log('💾 Validating filesystem...');

    // Check write permissions for data directory
    try {
      const testFile = './data/.write-test';
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      this.pass('Data directory is writable');
    } catch (error) {
      this.fail('Data directory is not writable', error.message);
    }

    // Check docs directory for GitHub Pages
    try {
      await fs.mkdir('./docs', { recursive: true });
      this.pass('Docs directory can be created');
    } catch (error) {
      this.fail('Cannot create docs directory', error.message);
    }

    // Check state file
    try {
      await fs.access('./data/state.json');
      this.pass('State file exists');
    } catch (error) {
      this.warning('State file does not exist (will be created on first run)');
    }

    console.log('✅ Filesystem validation complete\n');
  }

  /**
   * Validate custom modules and imports
   */
  async validateModules() {
    console.log('🔧 Validating custom modules...');

    const modules = [
      { path: './utils/formatter.js', name: 'Formatter' },
      { path: './utils/validator.js', name: 'Validator' },
      { path: './outputs/outputManager.js', name: 'Output Manager' },
      { path: './utils/stateManager.js', name: 'State Manager' },
      { path: './utils/threatFilter.js', name: 'Threat Filter' },
      { path: './utils/healthMonitor.js', name: 'Health Monitor' }
    ];

    for (const module of modules) {
      try {
        await import(module.path);
        this.pass(`${module.name} module loads successfully`);
      } catch (error) {
        this.fail(`${module.name} module failed to load: ${error.message}`);
      }
    }

    // Test key functionality
    try {
      const stateManager = new StateManager({ stateFile: './data/test-state.json' });
      await stateManager.createEmptyState();
      this.pass('State Manager can create empty state');
    } catch (error) {
      this.fail('State Manager basic functionality failed', error.message);
    }

    try {
      const healthMonitor = new HealthMonitor();
      healthMonitor.getHealthMetrics();
      this.pass('Health Monitor can generate metrics');
    } catch (error) {
      this.fail('Health Monitor basic functionality failed', error.message);
    }

    try {
      const threatFilter = new ThreatFilter();
      await threatFilter.classifyEntry({ title: 'test', description: 'test' });
      this.pass('Threat Filter can classify entries');
    } catch (error) {
      this.fail('Threat Filter basic functionality failed', error.message);
    }

    console.log('✅ Modules validation complete\n');
  }

  /**
   * Check if a path exists and is of the expected type
   */
  async checkPath(pathToCheck, expectedType) {
    try {
      const stats = await fs.stat(pathToCheck);
      
      if (expectedType === 'directory' && stats.isDirectory()) {
        this.pass(`Directory exists: ${pathToCheck}`);
      } else if (expectedType === 'file' && stats.isFile()) {
        this.pass(`File exists: ${pathToCheck}`);
      } else {
        this.fail(`Path exists but wrong type: ${pathToCheck} (expected ${expectedType})`);
      }
    } catch (error) {
      this.fail(`${expectedType} missing: ${pathToCheck}`);
    }
  }

  /**
   * Record a successful check
   */
  pass(message) {
    this.checks++;
    this.passed++;
    console.log(`   ✅ ${message}`);
  }

  /**
   * Record a failed check
   */
  fail(message, details = null) {
    this.checks++;
    this.errors.push({ message, details });
    console.log(`   ❌ ${message}`);
    if (details) {
      console.log(`      Details: ${details}`);
    }
  }

  /**
   * Record a warning
   */
  warning(message) {
    this.warnings.push(message);
    console.log(`   ⚠️  ${message}`);
  }

  /**
   * Record a check (used by simple validation)
   */
  check(message) {
    this.checks++;
    console.log(`   🔍 ${message}`);
  }

  /**
   * Print validation summary
   */
  printSummary() {
    console.log('=' .repeat(60));
    console.log('📊 VALIDATION SUMMARY');
    console.log('=' .repeat(60));
    console.log(`Total checks: ${this.checks}`);
    console.log(`Passed: ${this.passed}`);
    console.log(`Failed: ${this.errors.length}`);
    console.log(`Warnings: ${this.warnings.length}`);
    console.log('');

    if (this.errors.length > 0) {
      console.log('❌ ERRORS FOUND:');
      this.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error.message}`);
        if (error.details) {
          console.log(`   ${error.details}`);
        }
      });
      console.log('');
    }

    if (this.warnings.length > 0) {
      console.log('⚠️  WARNINGS:');
      this.warnings.forEach((warning, index) => {
        console.log(`${index + 1}. ${warning}`);
      });
      console.log('');
    }

    if (this.errors.length === 0) {
      console.log('🎉 All validations passed! Configuration is ready for production.');
    } else {
      console.log('🚨 Configuration has issues that need to be resolved.');
    }
  }
}

// CLI entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new ConfigValidator();
  await validator.validate();
}

export default ConfigValidator;
