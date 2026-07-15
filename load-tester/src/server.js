const express = require('express');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const EngineFactory = require('./engines/EngineFactory');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 3000;

// Engine state
let engine = null;
let engineType = 'node';
let wsClients = new Set();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use(express.json());

// Broadcast to all WebSocket clients
function broadcast(data) {
  const msg = JSON.stringify(data);
  wsClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  });
}

wss.on('connection', (ws) => {
  wsClients.add(ws);
  ws.on('close', () => wsClients.delete(ws));
});

// REST API
app.get('/api/engines', (req, res) => {
  res.json({ available: EngineFactory.getAvailableEngines(), current: engineType });
});

app.get('/api/status', (req, res) => {
  res.json({
    running: engine?.running || false,
    engine: engineType,
    targetUrl: engine?.config?.targetUrl || '',
    rate: engine?.config?.rate || 0,
    stats: engine?.getStats() || {}
  });
});

app.post('/api/engine', async (req, res) => {
  try {
    const { type } = req.body;
    if (engine && engine.running) await engine.stop();
    engineType = type || 'node';
    engine = EngineFactory.create(engineType, { targetUrl: engine?.config?.targetUrl || '', rate: engine?.config?.rate || 10 });
    res.json({ success: true, engine: engineType });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/start', async (req, res) => {
  try {
    if (!engine) {
      engineType = req.body.engine || 'node';
      engine = EngineFactory.create(engineType, { targetUrl: req.body.targetUrl || '', rate: req.body.rate || 10 });
    } else {
      if (req.body.targetUrl) engine.setTarget(req.body.targetUrl);
      if (req.body.rate) engine.setRate(req.body.rate);
    }
    await engine.start();
    broadcast({ type: 'started', stats: engine.getStats() });
    res.json({ success: true, stats: engine.getStats() });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/stop', async (req, res) => {
  if (engine && engine.running) {
    await engine.stop();
    broadcast({ type: 'stopped' });
  }
  res.json({ success: true });
});

app.post('/api/rate', (req, res) => {
  if (engine) {
    engine.setRate(req.body.rate);
    res.json({ success: true, rate: engine.config.rate });
  } else {
    res.status(400).json({ error: 'No engine running' });
  }
});

app.post('/api/target', (req, res) => {
  if (engine) {
    engine.setTarget(req.body.url);
    res.json({ success: true, targetUrl: engine.config.targetUrl });
  } else {
    res.status(400).json({ error: 'No engine running' });
  }
});

// Main routes
app.get('/', (req, res) => res.render('index', { title: 'Load Tester' }));
app.get('/health', (req, res) => res.json({ status: 'ok' }));

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Load Tester v1.0.0 running on port ${PORT}`);
  console.log(`   Web UI: http://localhost:${PORT}`);
  console.log(`   API:    http://localhost:${PORT}/api`);
});
