import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { StateManager } from '../utils/stateManager.js';
import fs from 'fs/promises';
import path from 'path';

// Mock the filesystem
jest.mock('fs/promises');
jest.mock('os', () => ({
  hostname: () => 'test-host'
}));

describe('StateManager', () => {
  let stateManager;
  let mockConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockConfig = {
      stateFile: './test-state.json',
      backupDir: './test-backups',
      maxBackups: 5,
      lockTimeout: 5000,
      retryDelay: 10,
      maxRetries: 5
    };
    stateManager = new StateManager(mockConfig);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('loadState', () => {
    it('should load valid state file', async () => {
      const mockState = {
        seen: { 'entry1': true },
        lastRun: '2023-01-01T00:00:00Z',
        version: '2.0'
      };

      fs.readFile.mockResolvedValueOnce(JSON.stringify(mockState));
      fs.writeFile.mockResolvedValue();
      fs.unlink.mockResolvedValue();

      const result = await stateManager.loadState();
      
      expect(result).toEqual(expect.objectContaining(mockState));
      expect(result.seen).toEqual(mockState.seen);
      expect(result.lastRun).toBe(mockState.lastRun);
    });

    it('should create empty state if file does not exist', async () => {
      fs.readFile.mockRejectedValueOnce({ code: 'ENOENT' });
      fs.writeFile.mockResolvedValue();
      fs.unlink.mockResolvedValue();

      const result = await stateManager.loadState();
      
      expect(result).toEqual(expect.objectContaining({
        seen: {},
        lastRun: null,
        version: '2.0'
      }));
    });

    it('should recover from backup on corrupted main file', async () => {
      const mockBackupState = {
        seen: { 'entry1': true },
        lastRun: '2023-01-01T00:00:00Z',
        version: '2.0'
      };

      // Main file is corrupted
      fs.readFile.mockRejectedValueOnce(new Error('File corrupted'));
      
      // Backup directory exists and has files
      fs.readdir.mockResolvedValueOnce(['state-2023-01-01T10-00-00Z.json']);
      fs.readFile.mockResolvedValueOnce(JSON.stringify(mockBackupState));
      fs.writeFile.mockResolvedValue();
      fs.unlink.mockResolvedValue();

      const result = await stateManager.loadState();
      
      expect(result).toEqual(expect.objectContaining(mockBackupState));
    });

    it('should handle lock acquisition', async () => {
      const mockState = { seen: {}, version: '2.0' };
      
      fs.readFile.mockResolvedValueOnce(JSON.stringify(mockState));
      fs.writeFile.mockResolvedValue();
      fs.unlink.mockResolvedValue();

      const result = await stateManager.loadState();
      
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.lock'),
        expect.any(String),
        { flag: 'wx' }
      );
      expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('.lock'));
    });
  });

  describe('saveState', () => {
    it('should save valid state with backup', async () => {
      const stateToSave = {
        seen: { 'entry1': true, 'entry2': true },
        lastRun: '2023-01-01T00:00:00Z',
        version: '2.0'
      };

      fs.access.mockResolvedValue(); // Main file exists for backup
      fs.mkdir.mockResolvedValue();
      fs.copyFile.mockResolvedValue();
      fs.writeFile.mockResolvedValue();
      fs.rename.mockResolvedValue();
      fs.readdir.mockResolvedValue(['state-old.json']);
      fs.unlink.mockResolvedValue();

      await stateManager.saveState(stateToSave);

      expect(fs.copyFile).toHaveBeenCalled(); // Backup created
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.tmp'),
        JSON.stringify(stateToSave, null, 2),
        'utf-8'
      );
      expect(fs.rename).toHaveBeenCalled(); // Atomic write
    });

    it('should validate state before saving', async () => {
      const invalidState = {
        seen: 'invalid', // Should be object
        lastRun: 'invalid-date',
        version: null
      };

      fs.access.mockResolvedValue();
      fs.mkdir.mockResolvedValue();
      fs.copyFile.mockResolvedValue();
      fs.writeFile.mockResolvedValue();
      fs.rename.mockResolvedValue();
      fs.readdir.mockResolvedValue([]);
      fs.unlink.mockResolvedValue();

      await stateManager.saveState(invalidState);

      // Check that the saved state was normalized
      const savedState = JSON.parse(fs.writeFile.mock.calls[1][1]); // Second call (first is lock file)
      expect(savedState.seen).toEqual({});
      expect(savedState.lastRun).toBeNull();
      expect(savedState.version).toBe('2.0');
    });
  });

  describe('lock management', () => {
    it('should acquire lock successfully', async () => {
      fs.readFile.mockRejectedValueOnce({ code: 'ENOENT' }); // No existing lock
      fs.writeFile.mockResolvedValue();

      const result = await stateManager.acquireLock();
      
      expect(result).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('.lock'),
        expect.stringContaining('"pid"'),
        { flag: 'wx' }
      );
    });

    it('should retry on lock conflict', async () => {
      fs.readFile.mockRejectedValueOnce({ code: 'ENOENT' }); // First check: no lock
      fs.writeFile
        .mockRejectedValueOnce({ code: 'EEXIST' }) // First attempt: conflict
        .mockResolvedValueOnce(); // Second attempt: success

      const result = await stateManager.acquireLock();
      
      expect(result).toBe(true);
      expect(fs.writeFile).toHaveBeenCalledTimes(2);
    });

    it('should remove stale locks', async () => {
      const staleLock = {
        pid: 99999,
        timestamp: Date.now() - 60000, // 1 minute ago
        hostname: 'test-host'
      };

      fs.readFile.mockResolvedValueOnce(JSON.stringify(staleLock));
      fs.unlink.mockResolvedValue();
      fs.writeFile.mockResolvedValue();

      // Mock process.kill to throw (process doesn't exist)
      const originalKill = process.kill;
      process.kill = jest.fn().mockImplementation(() => {
        throw new Error('No such process');
      });

      const result = await stateManager.acquireLock();
      
      expect(result).toBe(true);
      expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('.lock'));
      
      process.kill = originalKill;
    });

    it('should release lock', async () => {
      fs.unlink.mockResolvedValue();

      await stateManager.releaseLock();
      
      expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('.lock'));
    });
  });

  describe('backup and recovery', () => {
    it('should create backup before saving', async () => {
      fs.access.mockResolvedValue();
      fs.mkdir.mockResolvedValue();
      fs.copyFile.mockResolvedValue();
      fs.writeFile.mockResolvedValue();
      fs.rename.mockResolvedValue();
      fs.readdir.mockResolvedValue([]);
      fs.unlink.mockResolvedValue();

      await stateManager.createBackup();

      expect(fs.copyFile).toHaveBeenCalledWith(
        mockConfig.stateFile,
        expect.stringContaining('state-')
      );
    });

    it('should clean up old backups', async () => {
      const oldBackups = [
        'state-2023-01-01.json',
        'state-2023-01-02.json',
        'state-2023-01-03.json',
        'state-2023-01-04.json',
        'state-2023-01-05.json',
        'state-2023-01-06.json', // Should be deleted
        'state-2023-01-07.json'  // Should be deleted
      ];

      fs.readdir.mockResolvedValue(oldBackups);
      fs.unlink.mockResolvedValue();

      await stateManager.cleanupOldBackups();

      expect(fs.unlink).toHaveBeenCalledTimes(2); // Delete 2 oldest
    });

    it('should recover from most recent valid backup', async () => {
      const validBackup = {
        seen: { 'entry1': true },
        version: '2.0'
      };

      fs.readdir.mockResolvedValue([
        'state-2023-01-01.json',
        'state-2023-01-02.json',
        'state-2023-01-03.json'
      ]);

      fs.readFile.mockResolvedValueOnce(JSON.stringify(validBackup));

      const result = await stateManager.recoverFromBackup();

      expect(result).toEqual(expect.objectContaining(validBackup));
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('state-2023-01-03.json'),
        'utf-8'
      );
    });
  });

  describe('validation', () => {
    it('should validate state structure', () => {
      const invalidState = {
        seen: 'not-an-object',
        lastRun: 'invalid-date',
        feedStats: null,
        filterStats: 'invalid'
      };

      const result = stateManager.validateState(invalidState);

      expect(result.seen).toEqual({});
      expect(result.lastRun).toBeNull();
      expect(result.feedStats).toEqual({});
      expect(result.filterStats).toEqual({});
      expect(result.version).toBe('2.0');
    });

    it('should preserve valid state data', () => {
      const validState = {
        seen: { 'entry1': true },
        lastRun: '2023-01-01T00:00:00Z',
        feedStats: { 'feed1': { count: 5 } },
        filterStats: { total: 10 },
        version: '2.0'
      };

      const result = stateManager.validateState(validState);

      expect(result).toEqual(validState);
    });

    it('should handle null/undefined state', () => {
      expect(stateManager.validateState(null)).toEqual(stateManager.createEmptyState());
      expect(stateManager.validateState(undefined)).toEqual(stateManager.createEmptyState());
    });
  });

  describe('statistics', () => {
    it('should return state statistics', async () => {
      const mockState = {
        seen: { 'entry1': true, 'entry2': true },
        lastRun: '2023-01-01T00:00:00Z',
        feedStats: { 'feed1': { count: 5 } },
        filterStats: { total: 10 },
        version: '2.0'
      };

      fs.readFile.mockResolvedValueOnce(JSON.stringify(mockState));
      fs.readdir.mockResolvedValueOnce(['backup1.json', 'backup2.json']);
      fs.writeFile.mockResolvedValue();
      fs.unlink.mockResolvedValue();

      const stats = await stateManager.getStats();

      expect(stats.totalSeen).toBe(2);
      expect(stats.lastRun).toBe(mockState.lastRun);
      expect(stats.version).toBe('2.0');
      expect(stats.backupCount).toBe(2);
    });
  });

  describe('error handling', () => {
    it('should handle lock timeout', async () => {
      // Mock repeated lock conflicts
      fs.readFile.mockResolvedValue(JSON.stringify({
        pid: 1234,
        timestamp: Date.now(),
        hostname: 'test-host'
      }));

      const originalKill = process.kill;
      process.kill = jest.fn(); // Process exists
      
      await expect(stateManager.acquireLock()).rejects.toThrow('Failed to acquire lock');
      
      process.kill = originalKill;
    });

    it('should handle backup creation errors gracefully', async () => {
      fs.access.mockRejectedValue(new Error('File not found'));
      fs.mkdir.mockResolvedValue();

      // Should not throw
      await expect(stateManager.createBackup()).resolves.not.toThrow();
    });

    it('should cleanup temp file on save error', async () => {
      fs.access.mockResolvedValue();
      fs.mkdir.mockResolvedValue();
      fs.copyFile.mockResolvedValue();
      fs.writeFile.mockResolvedValue();
      fs.rename.mockRejectedValue(new Error('Rename failed'));
      fs.unlink.mockResolvedValue();

      const state = { seen: {}, version: '2.0' };

      await expect(stateManager.saveState(state)).rejects.toThrow('Rename failed');
      expect(fs.unlink).toHaveBeenCalledWith(expect.stringContaining('.tmp'));
    });
  });
});
