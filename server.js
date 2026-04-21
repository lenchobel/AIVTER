import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { initBookingsDb, listBookings } from './db/bookings.js';
import { initFlowsDb } from './db/flows.js';
import { initIdempotencyDb } from './db/idempotency.js';
import { initCallStateDb } from './db/callState.js';
import { createWebhookRouter } from './routes/webhook.js';
import { getAllFlows, getLatestFlows, getFlowByCallId, getFlowStats, clearAllFlows, updateFlowSummary } from './utils/flowDebugger.js';
import { getMetricsSnapshot, getFailureRate } from './utils/metrics.js';
import { getAlerts } from './utils/alerts.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const DATABASE_PATH = process.env.DB_PATH || process.env.DATABASE_PATH || './bookings.db';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';

// Trust proxy for ngrok (fixes rate limiter warning)
app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Handle invalid JSON bodies explicitly
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    console.log(`[${new Date().toISOString()}] [WEBHOOK] invalid_json error=${err.message}`);
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON'
    });
  }
  next(err);
});

// Database handles
let bookingsDbHandle;
let flowsDbHandle;
let idempotencyDbHandle;
let callStateDbHandle;

// WebSocket server disabled for now (will be re-enabled when frontend is ready)
// import { WebSocketServer } from 'ws';
// let wss;
// try {
//   wss = new WebSocketServer({ port: 3002 });
//   console.log(`[WS] WebSocket server running on port 3002`);
// } catch (error) {
//   console.log(`[WS] WebSocket server not available: ${error.message}`);
// }

// Logging utility
function log(level, message, data = null) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [${level}] ${message}`;

  if (data) {
    console.log(logMessage, data);
  } else {
    console.log(logMessage);
  }
}

// 2. VAPI Webhook (CRITICAL)
// NOTE: Router is responsible for event filtering + deterministic booking logic.
app.use(createWebhookRouter());

// 3. HEALTH CHECK
app.get('/health', (req, res) => {
  const m = getMetricsSnapshot();
  const failureRate = getFailureRate();
  const dbErrorSpike = m.recentFailures.filter(f => f.isDbError).length >= 3;

  let status = 'ok';
  if (failureRate > 0.4 || dbErrorSpike) status = 'critical';
  else if (failureRate > 0.2) status = 'degraded';

  res.status(200).json({
    status,
    uptime: process.uptime(),
    totalRequests: m.totalRequests,
    failureRate,
    avgResponseTime: m.responseTime.avgMs,
    recentFailures: m.recentFailures
  });
});

// Monitoring: Metrics snapshot
app.get('/metrics', (req, res) => {
  res.json({
    success: true,
    metrics: getMetricsSnapshot()
  });
});

// Monitoring: Alerts
app.get('/alerts', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  res.json({
    success: true,
    alerts: getAlerts(limit)
  });
});

// 4. GET ALL BOOKINGS
app.get('/bookings', (req, res) => {
  try {
    listBookings().then((rows) => {
      res.json({ success: true, bookings: rows });
    }).catch((err) => {
      log('ERROR', 'Failed to fetch bookings', err.message);
      res.status(500).json({ success: false, error: err.message });
    });
  } catch (error) {
    log('ERROR', 'Failed to fetch bookings', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. GET BOOKING BY ID
app.get('/bookings/:id', (req, res) => {
  const { id } = req.params;
  listBookings().then((rows) => {
    const booking = rows.find(b => String(b.id) === String(id));
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }
    res.json(booking);
  }).catch((err) => {
    log('ERROR', 'Failed to fetch booking by id', err.message);
    res.status(500).json({ success: false, error: err.message });
  });
});

// 4. LATEST BOOKING
app.get('/latest-booking', (req, res) => {
  listBookings().then((rows) => {
    const row = rows && rows.length > 0 ? rows[0] : null;
    if (!row) {
      return res.status(404).json({
        success: false,
        error: 'No bookings found'
      });
    }
    res.json(row);
  }).catch((err) => {
    log('ERROR', 'Failed to fetch latest booking', err.message);
    res.status(500).json({
      success: false,
      error: 'Database error'
    });
  });
});

// 5. DEBUG: STRIPE-STYLE FLOW DEBUGGER ENDPOINTS

// Get all flow records with pagination (UI-ready)
app.get('/debug/flows', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 100); // Max 100
    const offset = parseInt(req.query.offset) || 0;
    const data = await getAllFlows(limit, offset);

    res.json({
      success: true,
      ...data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get latest flows for real-time polling/streaming (lightweight)
app.get('/debug/stream', async (req, res) => {
  try {
    const count = Math.min(parseInt(req.query.count) || 20, 50); // Max 50
    const data = await getLatestFlows(count);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      ...data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get single flow by callId with navigation (previous/next)
app.get('/debug/flow/:callId', async (req, res) => {
  try {
    const { callId } = req.params;
    const data = await getFlowByCallId(callId);

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Flow not found'
      });
    }

    res.json({
      success: true,
      ...data
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get flow statistics for dashboard
app.get('/debug/stats', async (req, res) => {
  try {
    const stats = await getFlowStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Clear all flows (dev only)
app.delete('/debug/flows', (req, res) => {
  try {
    Promise.resolve(clearAllFlows()).then((result) => {
      res.json({
        success: true,
        message: 'All flows cleared',
        result
      });
    }).catch((error) => {
      res.status(500).json({
        success: false,
        error: error.message
      });
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  log('ERROR', 'Unhandled error', err.message);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

// Start server
async function startServer() {
  try {
    bookingsDbHandle = await initBookingsDb(DATABASE_PATH);
    flowsDbHandle = await initFlowsDb(DATABASE_PATH);
    idempotencyDbHandle = await initIdempotencyDb(DATABASE_PATH);
    callStateDbHandle = await initCallStateDb(DATABASE_PATH);
    
    const server = app.listen(PORT, () => {
      console.log(`\n=== VAPI BOOKING SERVER STARTED ===`);
      console.log(`Port: ${PORT}`);
      console.log(`Webhook URL: http://localhost:${PORT}/vapi-webhook`);
      const publicWebhookUrl = process.env.PUBLIC_WEBHOOK_URL || process.env.NGROK_URL || '';
      if (publicWebhookUrl) {
        console.log(`[STABILITY] Webhook URL active: ${publicWebhookUrl.replace(/\/+$/, '')}/vapi-webhook`);
      } else {
        console.log('[STABILITY] Webhook URL active: (not set) - set PUBLIC_WEBHOOK_URL to your ngrok base url');
      }
      console.log(`[STABILITY] Mode: ${process.env.NODE_ENV || 'development'} (ngrok allowed)`);
      if (!publicWebhookUrl || publicWebhookUrl.includes('localhost') || publicWebhookUrl.includes('127.0.0.1')) {
        console.log('[STABILITY] WARNING: Webhook URL looks like localhost. VAPI will not reach your machine without ngrok.');
      }
      console.log(`Database: ${DATABASE_PATH}`);
      console.log(`Health: http://localhost:${PORT}/health`);
      console.log(`Bookings: http://localhost:${PORT}/bookings`);
      console.log(`Debug Flows: http://localhost:${PORT}/debug/flows`);
      console.log(`Debug Stream: http://localhost:${PORT}/debug/stream`);
      console.log(`Debug Stats: http://localhost:${PORT}/debug/stats`);
      console.log(`Rate Limit: ${process.env.RATE_LIMIT_PER_SEC || 10}/sec`);
      console.log(`Log Level: ${LOG_LEVEL}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('=====================================');
    });

    server.on('error', (err) => {
      if (err && err.code === 'EADDRINUSE') {
        console.error(`[SERVER] Port ${PORT} already in use. Stop the other process or set PORT to a different value.`);
        process.exit(1);
      }
      console.error('[SERVER] Failed to start:', err?.message || err);
      process.exit(1);
    });
    
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  log('SHUTDOWN', 'Received SIGINT, closing database...');
  const handles = [bookingsDbHandle, flowsDbHandle, idempotencyDbHandle, callStateDbHandle].filter(Boolean);
  if (handles.length === 0) return process.exit(0);

  let remaining = handles.length;
  handles.forEach((h) => {
    try {
      h.close(() => {
        remaining -= 1;
        if (remaining === 0) process.exit(0);
      });
    } catch {
      remaining -= 1;
      if (remaining === 0) process.exit(0);
    }
  });
});

process.on('SIGTERM', () => {
  log('SHUTDOWN', 'Received SIGTERM, closing database...');
  const handles = [bookingsDbHandle, flowsDbHandle, idempotencyDbHandle, callStateDbHandle].filter(Boolean);
  if (handles.length === 0) return process.exit(0);

  let remaining = handles.length;
  handles.forEach((h) => {
    try {
      h.close(() => {
        remaining -= 1;
        if (remaining === 0) process.exit(0);
      });
    } catch {
      remaining -= 1;
      if (remaining === 0) process.exit(0);
    }
  });
});

startServer().catch(console.error);
