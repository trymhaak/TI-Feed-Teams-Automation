import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * Enhanced state management with file locking and backup/recovery
 */
export class StateManager {
  constructor(config = {}) {
    this.stateFile = config.stateFile || './data/state.json';
    this.backupDir = config.backupDir || './data/backups';
    this.lockFile = `${this.stateFile}.lock`;
    this.maxBackups = config.maxBackups || 10;
    this.lockTimeout = config.lockTimeout || 30000; // 30 seconds
    this.retryDelay = config.retryDelay || 100; // 100ms
    this.maxRetries = config.maxRetries || 50;
  }

  /**
   * Acquire file lock with timeout
   * @returns {Promise<boolean>} True if lock acquired
   */
  async acquireLock() {
    const lockData = {
      pid: process.pid,
      timestamp: Date.now(),
      hostname: os.hostname()
    };

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        // Check if lock file exists and is still valid
        if (await this.isLockValid()) {
          await this.sleep(this.retryDelay);
          continue;
        }

        // Try to create lock file
        await fs.writeFile(this.lockFile, JSON.stringify(lockData), { flag: 'wx' });
        return true;
      } catch (error) {
        if (error.code === 'EEXIST') {
          // Lock file exists, wait and retry
          await this.sleep(this.retryDelay);
          continue;
        }
        throw error;
      }
    }

    throw new Error(`Failed to acquire lock after ${this.maxRetries} attempts`);
  }

  /**
   * Release file lock
   */
  async releaseLock() {
    try {
      await fs.unlink(this.lockFile);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('Warning: Failed to release lock file:', error.message);
      }
    }
  }

  /**
   * Check if existing lock is still valid
   * @returns {Promise<boolean>}
   */
  async isLockValid() {
    try {
      const lockContent = await fs.readFile(this.lockFile, 'utf-8');
      const lockData = JSON.parse(lockContent);
      
      // Check if lock has expired
      const lockAge = Date.now() - lockData.timestamp;
      if (lockAge > this.lockTimeout) {
        // Remove stale lock
        await fs.unlink(this.lockFile);
        return false;
      }

      // Check if process is still running (if on same machine)
      if (lockData.hostname === os.hostname()) {
        try {
          process.kill(lockData.pid, 0); // Check if process exists
          return true;
        } catch (error) {
          // Process doesn't exist, remove stale lock
          await fs.unlink(this.lockFile);
          return false;
        }
      }

      return true;
    } catch (error) {
      // Lock file doesn't exist or is corrupted
      return false;
    }
  }

  /**
   * Load state with locking and validation
   * @returns {Promise<Object>} State object
   */
  async loadState() {
    await this.acquireLock();
    
    try {
      // Try to load main state file
      const state = await this.loadStateFile(this.stateFile);
      
      // Validate state structure
      const validatedState = this.validateState(state);
      
      return validatedState;
    } catch (error) {
      console.warn('Failed to load main state file, attempting recovery:', error.message);
      
      // Try to recover from backup
      const recoveredState = await this.recoverFromBackup();
      
      if (recoveredState) {
        console.log('✅ State recovered from backup');
        // Save recovered state as new main state
        await this.saveStateFile(this.stateFile, recoveredState);
        return recoveredState;
      }
      
      // Create new empty state if recovery fails
      console.log('🔄 Creating new empty state');
      const newState = this.createEmptyState();
      await this.saveStateFile(this.stateFile, newState);
      return newState;
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * Save state with backup and locking
   * @param {Object} state - State object to save
   */
  async saveState(state) {
    await this.acquireLock();
    
    try {
      // Validate state before saving
      const validatedState = this.validateState(state);
      
      // Create backup before saving new state
      await this.createBackup();
      
      // Save new state
      await this.saveStateFile(this.stateFile, validatedState);
      
      // Clean up old backups
      await this.cleanupOldBackups();
      
      console.log(`✅ State saved successfully (${Object.keys(validatedState.seen || {}).length} entries tracked)`);
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * Load state from file with error handling
   * @param {string} filePath - Path to state file
   * @returns {Promise<Object>} State object
   */
  async loadStateFile(filePath) {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const state = JSON.parse(data);
      // Legacy migration: if file is a map of feedName -> lastUrl (strings) without 'seen'
      if (state && typeof state === 'object' && !state.seen) {
        const keys = Object.keys(state);
        const looksLegacy = keys.length > 0 && keys.every(k => typeof state[k] === 'string');
        if (looksLegacy) {
          const migrated = {
            seen: {},
            lastRun: null,
            feedStats: {},
            filterStats: {},
            version: '2.0'
          };
          const nowIso = new Date().toISOString();
          for (const [feedName, url] of Object.entries(state)) {
            if (typeof url === 'string' && url) {
              migrated.seen[url] = { timestamp: nowIso, source: feedName, title: '' };
            }
          }
          return migrated;
        }
      }
      
      // Check if state is corrupted (basic validation)
      if (typeof state !== 'object' || state === null) {
        throw new Error('State file contains invalid data');
      }
      
      return state;
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, return empty state
        return this.createEmptyState();
      }
      throw error;
    }
  }

  /**
   * Save state to file with atomic write
   * @param {string} filePath - Path to state file
   * @param {Object} state - State object
   */
  async saveStateFile(filePath, state) {
    const tempFile = `${filePath}.tmp`;
    
    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      
      // Write to temporary file first
      await fs.writeFile(tempFile, JSON.stringify(state, null, 2), 'utf-8');
      
      // Atomic rename
      await fs.rename(tempFile, filePath);
    } catch (error) {
      // Clean up temporary file on error
      try {
        await fs.unlink(tempFile);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Create backup of current state
   */
  async createBackup() {
    try {
      // Check if main state file exists
      await fs.access(this.stateFile);
      
      // Ensure backup directory exists
      await fs.mkdir(this.backupDir, { recursive: true });
      
      // Create backup with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFile = path.join(this.backupDir, `state-${timestamp}.json`);
      
      // Copy current state to backup
      await fs.copyFile(this.stateFile, backupFile);
      
      console.log(`📦 Backup created: ${backupFile}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('Warning: Failed to create backup:', error.message);
      }
    }
  }

  /**
   * Recover state from most recent valid backup
   * @returns {Promise<Object|null>} Recovered state or null
   */
  async recoverFromBackup() {
    try {
      // Get list of backup files
      const backupFiles = await fs.readdir(this.backupDir);
      const stateBackups = backupFiles
        .filter(file => file.startsWith('state-') && file.endsWith('.json'))
        .sort()
        .reverse(); // Most recent first

      for (const backupFile of stateBackups) {
        try {
          const backupPath = path.join(this.backupDir, backupFile);
          console.log(`🔄 Attempting recovery from: ${backupFile}`);
          
          const state = await this.loadStateFile(backupPath);
          const validatedState = this.validateState(state);
          
          console.log(`✅ Successfully recovered from: ${backupFile}`);
          return validatedState;
        } catch (error) {
          console.warn(`❌ Backup ${backupFile} is corrupted:`, error.message);
          continue;
        }
      }
      
      return null;
    } catch (error) {
      console.warn('Failed to access backup directory:', error.message);
      return null;
    }
  }

  /**
   * Clean up old backup files
   */
  async cleanupOldBackups() {
    try {
      const backupFiles = await fs.readdir(this.backupDir);
      const stateBackups = backupFiles
        .filter(file => file.startsWith('state-') && file.endsWith('.json'))
        .sort()
        .reverse(); // Most recent first

      // Remove excess backups
      const toDelete = stateBackups.slice(this.maxBackups);
      
      for (const file of toDelete) {
        try {
          await fs.unlink(path.join(this.backupDir, file));
          console.log(`🗑️  Cleaned up old backup: ${file}`);
        } catch (error) {
          console.warn(`Failed to delete backup ${file}:`, error.message);
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup old backups:', error.message);
    }
  }

  /**
   * Validate and normalize state structure
   * @param {Object} state - State object to validate
   * @returns {Object} Validated state
   */
  validateState(state) {
    if (!state || typeof state !== 'object') {
      return this.createEmptyState();
    }

    const validatedState = {
      seen: {},
      lastRun: null,
      feedStats: {},
      filterStats: {},
      version: '2.0',
      ...state
    };

    // Validate seen entries
    if (typeof validatedState.seen !== 'object' || validatedState.seen === null) {
      validatedState.seen = {};
    }

    // Validate lastRun
    if (validatedState.lastRun && !this.isValidDate(validatedState.lastRun)) {
      validatedState.lastRun = null;
    }

    // Validate feedStats
    if (typeof validatedState.feedStats !== 'object' || validatedState.feedStats === null) {
      validatedState.feedStats = {};
    }

    // Validate filterStats
    if (typeof validatedState.filterStats !== 'object' || validatedState.filterStats === null) {
      validatedState.filterStats = {};
    }

    return validatedState;
  }

  /**
   * Create empty initial state
   * @returns {Object} Empty state
   */
  createEmptyState() {
    return {
      seen: {},
      lastRun: null,
      feedStats: {},
      filterStats: {},
      version: '2.0',
      created: new Date().toISOString()
    };
  }

  /**
   * Check if date string is valid
   * @param {string} dateString - Date string to validate
   * @returns {boolean}
   */
  isValidDate(dateString) {
    if (typeof dateString !== 'string') return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get state statistics
   * @returns {Promise<Object>} State statistics
   */
  async getStats() {
    await this.acquireLock();
    
    try {
      const state = await this.loadStateFile(this.stateFile);
      
      return {
        totalSeen: Object.keys(state.seen || {}).length,
        lastRun: state.lastRun,
        feedStats: state.feedStats || {},
        filterStats: state.filterStats || {},
        version: state.version || '1.0',
        backupCount: await this.getBackupCount()
      };
    } finally {
      await this.releaseLock();
    }
  }

  /**
   * Get number of available backups
   * @returns {Promise<number>}
   */
  async getBackupCount() {
    try {
      const backupFiles = await fs.readdir(this.backupDir);
      return backupFiles.filter(file => 
        file.startsWith('state-') && file.endsWith('.json')
      ).length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Force cleanup of stale locks (use with caution)
   */
  async forceCleanupLocks() {
    try {
      await fs.unlink(this.lockFile);
      console.log('🔓 Stale lock file removed');
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('Failed to remove lock file:', error.message);
      }
    }
  }
}

export default StateManager;
