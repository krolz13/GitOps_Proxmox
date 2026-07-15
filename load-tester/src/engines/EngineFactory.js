/**
 * Engine Factory - Creates load engine instances
 * Allows pluggable engine selection
 */
const NodeEngine = require('./NodeEngine');
// Future: const LocustEngine = require('./LocustEngine');
// Future: const K6Engine = require('./K6Engine');

class EngineFactory {
  static create(type, config) {
    switch (type) {
      case 'node':
        return new NodeEngine(config);
      // case 'locust': return new LocustEngine(config);
      // case 'k6': return new K6Engine(config);
      default:
        throw new Error(`Unknown engine type: ${type}`);
    }
  }

  static getAvailableEngines() {
    return ['node'];
  }
}

module.exports = EngineFactory;
