/**
 * Node.js Load Engine Implementation
 * Uses axios for HTTP requests with configurable patterns
 */
const axios = require('axios');
const LoadEngine = require('./LoadEngine');

class NodeEngine extends LoadEngine {
  constructor(config = {}) {
    super(config);
    this.options = {
      method: config.options?.method || 'GET',
      headers: config.options?.headers || {
        'User-Agent': 'GitOps-LoadTester/1.0 (Node.js)'
      },
      timeout: config.options?.timeout || 10000,
      validateStatus: () => true,
      ...config.options
    };
    this.pattern = config.options?.pattern || 'constant';
    this.virtualUsers = config.options?.virtualUsers || 10;
    this.thinkTime = config.options?.thinkTime || 0;
    this.userAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1'
    ];
    this.currentRate = 0;
    this.targetRate = 0;
  }

  async start() {
    if (this.running) return;
    if (!this.config.targetUrl) throw new Error('Target URL not configured');

    this.running = true;
    this.resetStats();
    this.targetRate = this.config.rate || 10;
    this.currentRate = this.pattern === 'ramp' ? 1 : this.targetRate;

    this.client = axios.create({
      timeout: this.options.timeout,
      validateStatus: this.options.validateStatus
    });

    this._runLoop();
    if (this.pattern === 'ramp') this._startRamp();
  }

  async stop() {
    this.running = false;
    if (this.interval) clearInterval(this.interval);
    if (this.rampInterval) clearInterval(this.rampInterval);
  }

  setRate(rps) {
    this.targetRate = Math.max(0, Math.floor(rps));
    if (this.pattern === 'constant') this.currentRate = this.targetRate;
  }

  _runLoop() {
    const sendRequest = async () => {
      if (!this.running || this.currentRate <= 0) return;
      const requestsPerTick = Math.max(1, this.currentRate / 10);
      const promises = [];
      for (let i = 0; i < requestsPerTick; i++) {
        promises.push(this._makeRequest());
      }
      await Promise.allSettled(promises);
    };
    this.interval = setInterval(sendRequest, 100);
  }

  _startRamp() {
    const rampDuration = this.options.rampDuration || 60000;
    const steps = rampDuration / 1000;
    const increment = this.targetRate / steps;
    this.rampInterval = setInterval(() => {
      if (this.currentRate < this.targetRate) {
        this.currentRate = Math.min(this.targetRate, this.currentRate + increment);
      } else {
        clearInterval(this.rampInterval);
      }
    }, 1000);
  }

  async _makeRequest() {
    const start = Date.now();
    const ua = this.userAgents[Math.floor(Math.random() * this.userAgents.length)];
    try {
      const response = await this.client({
        method: this.options.method,
        url: this.config.targetUrl,
        headers: { ...this.options.headers, 'User-Agent': ua },
        timeout: this.options.timeout
      });
      const latency = Date.now() - start;
      const success = response.status >= 200 && response.status < 400;
      this.recordRequest(success, latency);
    } catch (error) {
      const latency = Date.now() - start;
      this.recordRequest(false, latency);
    }
  }
}

module.exports = NodeEngine;
