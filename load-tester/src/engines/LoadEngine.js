/**
 * Load Engine Interface
 * All load engines must implement this interface for pluggability
 */
class LoadEngine {
  constructor(config = {}) {
    this.config = config;
    this.running = false;
    this.stats = {
      requests: 0,
      successes: 0,
      errors: 0,
      latency: { min: Infinity, max: 0, sum: 0, count: 0 },
      startTime: null
    };
    this.interval = null;
  }

  async start() {
    throw new Error('start() must be implemented by subclass');
  }

  async stop() {
    throw new Error('stop() must be implemented by subclass');
  }

  setTarget(url) {
    this.config.targetUrl = url;
  }

  setRate(rps) {
    this.config.rate = Math.max(0, Math.floor(rps));
  }

  getStats() {
    const { requests, successes, errors, latency, startTime } = this.stats;
    const duration = startTime ? (Date.now() - startTime) / 1000 : 0;
    return {
      running: this.running,
      requests,
      successes,
      errors,
      errorRate: requests > 0 ? (errors / requests * 100).toFixed(2) : 0,
      rps: duration > 0 ? (requests / duration).toFixed(2) : 0,
      latency: latency.count > 0 ? {
        min: latency.min === Infinity ? 0 : latency.min,
        max: latency.max,
        avg: (latency.sum / latency.count).toFixed(2)
      } : { min: 0, max: 0, avg: 0 }
    };
  }

  recordRequest(success, latencyMs) {
    this.stats.requests++;
    if (success) this.stats.successes++;
    else this.stats.errors++;
    this.stats.latency.min = Math.min(this.stats.latency.min, latencyMs);
    this.stats.latency.max = Math.max(this.stats.latency.max, latencyMs);
    this.stats.latency.sum += latencyMs;
    this.stats.latency.count++;
  }

  resetStats() {
    this.stats = {
      requests: 0,
      successes: 0,
      errors: 0,
      latency: { min: Infinity, max: 0, sum: 0, count: 0 },
      startTime: Date.now()
    };
  }
}

module.exports = LoadEngine;
