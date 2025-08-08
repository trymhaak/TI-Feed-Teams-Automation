import fs from 'fs/promises';
import path from 'path';

/**
 * Health monitoring and metrics system for threat intelligence bot
 */
export class HealthMonitor {
  constructor(config = {}) {
    this.config = {
      metricsFile: './data/metrics.json',
      healthFile: './data/health.json',
      alertThresholds: {
        feedFailureRate: 0.5, // 50% of feeds failing
        processingTime: 300000, // 5 minutes
        memoryUsage: 512 * 1024 * 1024, // 512MB
        consecutiveFailures: 3
      },
      retentionDays: 30,
      enableAlerts: true,
      ...config
    };
    
    this.startTime = Date.now();
    this.metrics = {
      runs: 0,
      successfulRuns: 0,
      failedRuns: 0,
      feedStats: {},
      processingTimes: [],
      errors: [],
      lastHealthCheck: null
    };
  }

  /**
   * Record start of a bot run
   * @param {Object} runInfo - Information about the run
   */
  async recordRunStart(runInfo = {}) {
    this.currentRun = {
      id: this.generateRunId(),
      startTime: Date.now(),
      feeds: runInfo.feeds || [],
      mode: runInfo.mode || 'normal',
      ...runInfo
    };

    console.log(`🏃 Run started: ${this.currentRun.id} (${this.currentRun.mode} mode)`);
  }

  /**
   * Record end of a bot run
   * @param {Object} result - Run result information
   */
  async recordRunEnd(result = {}) {
    if (!this.currentRun) {
      console.warn('No active run to record end for');
      return;
    }

    const endTime = Date.now();
    const duration = endTime - this.currentRun.startTime;
    
    const runResult = {
      ...this.currentRun,
      endTime,
      duration,
      success: result.success !== false,
      entriesProcessed: result.entriesProcessed || 0,
      entriesPosted: result.entriesPosted || 0,
      feedResults: result.feedResults || {},
      errors: result.errors || [],
      memoryUsage: process.memoryUsage(),
      ...result
    };

    // Update metrics
    this.metrics.runs++;
    if (runResult.success) {
      this.metrics.successfulRuns++;
    } else {
      this.metrics.failedRuns++;
    }

    this.metrics.processingTimes.push(duration);
    this.metrics.lastRun = runResult;

    // Update feed statistics
    this.updateFeedStats(runResult.feedResults);

    // Store run result
    await this.storeRunResult(runResult);

    // Perform health check
    await this.performHealthCheck();

    // Save metrics
    await this.saveMetrics();

    console.log(`✅ Run completed: ${runResult.id} (${duration}ms, ${runResult.entriesPosted} posted)`);
    
    this.currentRun = null;
  }

  /**
   * Record an error during processing
   * @param {Error} error - Error that occurred
   * @param {Object} context - Additional context
   */
  async recordError(error, context = {}) {
    const errorRecord = {
      timestamp: new Date().toISOString(),
      message: error.message,
      stack: error.stack,
      type: error.constructor.name,
      context,
      runId: this.currentRun?.id
    };

    this.metrics.errors.push(errorRecord);

    // Keep only recent errors (last 100)
    if (this.metrics.errors.length > 100) {
      this.metrics.errors = this.metrics.errors.slice(-100);
    }

    console.error(`❌ Error recorded: ${error.message}`, context);
  }

  /**
   * Update feed statistics
   * @param {Object} feedResults - Results from feed processing
   */
  updateFeedStats(feedResults) {
    for (const [feedName, result] of Object.entries(feedResults)) {
      if (!this.metrics.feedStats[feedName]) {
        this.metrics.feedStats[feedName] = {
          attempts: 0,
          successes: 0,
          failures: 0,
          lastSuccess: null,
          lastFailure: null,
          consecutiveFailures: 0,
          averageEntries: 0,
          totalEntries: 0
        };
      }

      const stats = this.metrics.feedStats[feedName];
      stats.attempts++;

      if (result.success) {
        stats.successes++;
        stats.lastSuccess = new Date().toISOString();
        stats.consecutiveFailures = 0;
        stats.totalEntries += result.entries || 0;
        stats.averageEntries = stats.totalEntries / stats.successes;
      } else {
        stats.failures++;
        stats.lastFailure = new Date().toISOString();
        stats.consecutiveFailures++;
      }
    }
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck() {
    const healthStatus = {
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      status: 'healthy',
      alerts: [],
      metrics: this.getHealthMetrics()
    };

    // Check feed failure rates
    const feedIssues = this.checkFeedHealth();
    if (feedIssues.length > 0) {
      healthStatus.alerts.push(...feedIssues);
      healthStatus.status = 'warning';
    }

    // Check processing times
    const processingIssues = this.checkProcessingTimes();
    if (processingIssues.length > 0) {
      healthStatus.alerts.push(...processingIssues);
      healthStatus.status = 'warning';
    }

    // Check memory usage
    const memoryIssues = this.checkMemoryUsage();
    if (memoryIssues.length > 0) {
      healthStatus.alerts.push(...memoryIssues);
      if (memoryIssues.some(issue => issue.severity === 'critical')) {
        healthStatus.status = 'critical';
      }
    }

    // Check error rates
    const errorIssues = this.checkErrorRates();
    if (errorIssues.length > 0) {
      healthStatus.alerts.push(...errorIssues);
      if (errorIssues.some(issue => issue.severity === 'critical')) {
        healthStatus.status = 'critical';
      }
    }

    this.metrics.lastHealthCheck = healthStatus;
    await this.saveHealthStatus(healthStatus);

    // Send alerts if enabled
    if (this.config.enableAlerts && healthStatus.status !== 'healthy') {
      await this.sendHealthAlert(healthStatus);
    }

    return healthStatus;
  }

  /**
   * Check feed health for issues
   * @returns {Array} Array of health issues
   */
  checkFeedHealth() {
    const issues = [];
    const totalFeeds = Object.keys(this.metrics.feedStats).length;
    let failingFeeds = 0;

    for (const [feedName, stats] of Object.entries(this.metrics.feedStats)) {
      // Check consecutive failures
      if (stats.consecutiveFailures >= this.config.alertThresholds.consecutiveFailures) {
        issues.push({
          type: 'feed_failures',
          severity: 'critical',
          message: `Feed "${feedName}" has ${stats.consecutiveFailures} consecutive failures`,
          feed: feedName,
          details: stats
        });
        failingFeeds++;
      }

      // Check if feed hasn't succeeded recently
      const lastSuccess = stats.lastSuccess ? new Date(stats.lastSuccess) : null;
      const daysSinceSuccess = lastSuccess ? 
        (Date.now() - lastSuccess.getTime()) / (1000 * 60 * 60 * 24) : Infinity;

      if (daysSinceSuccess > 2) {
        issues.push({
          type: 'feed_stale',
          severity: 'warning',
          message: `Feed "${feedName}" hasn't succeeded in ${Math.floor(daysSinceSuccess)} days`,
          feed: feedName,
          lastSuccess: stats.lastSuccess
        });
      }
    }

    // Check overall failure rate
    const failureRate = totalFeeds > 0 ? failingFeeds / totalFeeds : 0;
    if (failureRate >= this.config.alertThresholds.feedFailureRate) {
      issues.push({
        type: 'high_failure_rate',
        severity: 'critical',
        message: `${Math.round(failureRate * 100)}% of feeds are failing`,
        failureRate,
        failingFeeds,
        totalFeeds
      });
    }

    return issues;
  }

  /**
   * Check processing times for issues
   * @returns {Array} Array of processing time issues
   */
  checkProcessingTimes() {
    const issues = [];
    const recentTimes = this.metrics.processingTimes.slice(-10);

    if (recentTimes.length > 0) {
      const averageTime = recentTimes.reduce((sum, time) => sum + time, 0) / recentTimes.length;
      const maxTime = Math.max(...recentTimes);

      if (maxTime > this.config.alertThresholds.processingTime) {
        issues.push({
          type: 'slow_processing',
          severity: 'warning',
          message: `Processing time exceeded threshold: ${Math.round(maxTime / 1000)}s`,
          maxTime,
          averageTime,
          threshold: this.config.alertThresholds.processingTime
        });
      }
    }

    return issues;
  }

  /**
   * Check memory usage for issues
   * @returns {Array} Array of memory issues
   */
  checkMemoryUsage() {
    const issues = [];
    const memUsage = process.memoryUsage();

    if (memUsage.heapUsed > this.config.alertThresholds.memoryUsage) {
      issues.push({
        type: 'high_memory',
        severity: 'warning',
        message: `High memory usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        memoryUsage: memUsage,
        threshold: this.config.alertThresholds.memoryUsage
      });
    }

    if (memUsage.heapUsed > this.config.alertThresholds.memoryUsage * 2) {
      issues.push({
        type: 'critical_memory',
        severity: 'critical',
        message: `Critical memory usage: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        memoryUsage: memUsage
      });
    }

    return issues;
  }

  /**
   * Check error rates for issues
   * @returns {Array} Array of error issues
   */
  checkErrorRates() {
    const issues = [];
    const recentErrors = this.metrics.errors.filter(error => {
      const errorTime = new Date(error.timestamp).getTime();
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      return errorTime > oneHourAgo;
    });

    if (recentErrors.length > 10) {
      issues.push({
        type: 'high_error_rate',
        severity: 'critical',
        message: `High error rate: ${recentErrors.length} errors in the last hour`,
        errorCount: recentErrors.length,
        recentErrors: recentErrors.slice(-5) // Include last 5 errors
      });
    }

    return issues;
  }

  /**
   * Get current health metrics
   * @returns {Object} Health metrics
   */
  getHealthMetrics() {
    const memUsage = process.memoryUsage();
    const recentTimes = this.metrics.processingTimes.slice(-10);
    const averageProcessingTime = recentTimes.length > 0 ?
      recentTimes.reduce((sum, time) => sum + time, 0) / recentTimes.length : 0;

    const feedHealthSummary = Object.entries(this.metrics.feedStats).reduce((summary, [name, stats]) => {
      summary.total++;
      if (stats.consecutiveFailures === 0) summary.healthy++;
      else summary.failing++;
      return summary;
    }, { total: 0, healthy: 0, failing: 0 });

    return {
      uptime: Date.now() - this.startTime,
      totalRuns: this.metrics.runs,
      successRate: this.metrics.runs > 0 ? 
        (this.metrics.successfulRuns / this.metrics.runs * 100).toFixed(1) : 0,
      averageProcessingTime: Math.round(averageProcessingTime),
      memoryUsage: {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024)
      },
      feedHealth: feedHealthSummary,
      recentErrors: this.metrics.errors.slice(-5),
      lastRun: this.metrics.lastRun ? {
        id: this.metrics.lastRun.id,
        duration: this.metrics.lastRun.duration,
        success: this.metrics.lastRun.success,
        entriesPosted: this.metrics.lastRun.entriesPosted
      } : null
    };
  }

  /**
   * Store run result for historical analysis
   * @param {Object} runResult - Run result to store
   */
  async storeRunResult(runResult) {
    try {
      const runsDir = './data/runs';
      await fs.mkdir(runsDir, { recursive: true });
      
      const runFile = path.join(runsDir, `${runResult.id}.json`);
      await fs.writeFile(runFile, JSON.stringify(runResult, null, 2));

      // Clean up old run files
      await this.cleanupOldRuns(runsDir);
    } catch (error) {
      console.warn('Failed to store run result:', error.message);
    }
  }

  /**
   * Clean up old run files
   * @param {string} runsDir - Runs directory path
   */
  async cleanupOldRuns(runsDir) {
    try {
      const files = await fs.readdir(runsDir);
      const runFiles = files.filter(f => f.endsWith('.json'));
      
      // Keep only recent runs (last 100)
      if (runFiles.length > 100) {
        const sortedFiles = runFiles.sort().slice(0, -100);
        for (const file of sortedFiles) {
          await fs.unlink(path.join(runsDir, file));
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup old runs:', error.message);
    }
  }

  /**
   * Save health status to file
   * @param {Object} healthStatus - Health status to save
   */
  async saveHealthStatus(healthStatus) {
    try {
      await fs.mkdir(path.dirname(this.config.healthFile), { recursive: true });
      await fs.writeFile(this.config.healthFile, JSON.stringify(healthStatus, null, 2));
    } catch (error) {
      console.warn('Failed to save health status:', error.message);
    }
  }

  /**
   * Save metrics to file
   */
  async saveMetrics() {
    try {
      await fs.mkdir(path.dirname(this.config.metricsFile), { recursive: true });
      await fs.writeFile(this.config.metricsFile, JSON.stringify(this.metrics, null, 2));
    } catch (error) {
      console.warn('Failed to save metrics:', error.message);
    }
  }

  /**
   * Send health alert (placeholder for actual alerting)
   * @param {Object} healthStatus - Health status with alerts
   */
  async sendHealthAlert(healthStatus) {
    // In a real implementation, this would send alerts via email, Slack, etc.
    console.warn(`🚨 Health Alert (${healthStatus.status.toUpperCase()}):`, 
      healthStatus.alerts.map(alert => alert.message).join(', '));
  }

  /**
   * Generate periodic status messages
   * @returns {Object} Status message
   */
  generateStatusMessage() {
    const health = this.getHealthMetrics();
    const uptime = Math.floor(health.uptime / 1000 / 60); // minutes
    
    return {
      summary: `Bot health: ${health.feedHealth.healthy}/${health.feedHealth.total} feeds healthy, ` +
               `${health.successRate}% success rate, ${uptime}m uptime`,
      detailed: {
        uptime: `${uptime} minutes`,
        runs: `${health.totalRuns} total (${health.successRate}% success)`,
        feeds: `${health.feedHealth.healthy}/${health.feedHealth.total} healthy`,
        memory: `${health.memoryUsage.heapUsed}MB heap used`,
        lastRun: health.lastRun ? 
          `${health.lastRun.duration}ms, ${health.lastRun.entriesPosted} posted` : 'None'
      },
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate unique run ID
   * @returns {string} Run ID
   */
  generateRunId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `run-${timestamp}-${random}`;
  }

  /**
   * Get comprehensive health report
   * @returns {Promise<Object>} Health report
   */
  async getHealthReport() {
    const healthCheck = await this.performHealthCheck();
    const statusMessage = this.generateStatusMessage();
    
    return {
      health: healthCheck,
      status: statusMessage,
      metrics: this.getHealthMetrics(),
      timestamp: new Date().toISOString()
    };
  }
}

export default HealthMonitor;
