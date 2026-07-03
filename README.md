# AIVTER — Clinic Booking Backend

A production-grade, resilient clinic booking system built with **VAPI** (Voice API) integration, featuring real-time monitoring, rate limiting, and comprehensive flow debugging capabilities.

## Overview

AIVTER is a backend service that handles voice-based clinic booking requests from VAPI webhooks. It provides deterministic booking logic with SQLite persistence, comprehensive error tracking, real-time metrics, and a Stripe-style flow debugger for observability. The system is designed to be lightweight, resilient, and easy to deploy without external infrastructure.

**Status:** Production-ready with built-in hardening, monitoring, and debugging tools.

## Features

- **SQLite Persistence**: Booking storage with unique slot constraints preventing double-bookings
- **VAPI Webhook Integration**: Handles voice assistant booking requests via webhook
- **Deterministic Booking Logic**: Conflict detection and idempotency key handling
- **Rate Limiting**: Configurable per-second rate limits with token bucket algorithm
- **Request Tracing**: Flow debugger with SQLite-backed request lifecycle tracking
- **Real-time Metrics**: In-memory metrics tracking with alerts
- **Health Checks**: Comprehensive health endpoint with status and failure rate monitoring
- **Load Testing**: Built-in load testing utility with configurable request patterns
- **CLI Monitor**: Real-time metrics and status monitoring from command line
- **Error Resilience**: Graceful degradation and automatic recovery

## Architecture

### System Components

```
VAPI Voice Assistant
         ↓
    Webhook Handler
         ↓
  Booking Logic (SQLite)
         ↓
  Metrics & Alerts
         ↓
  Flow Debugger (Stripe-style)
```

### Database Schema

**bookings** table
- `id` (INTEGER PRIMARY KEY)
- `date` (TEXT)
- `time` (TEXT)
- `service` (TEXT)
- Unique constraint on `(date, time, service)` prevents double bookings
- Stores booking details, status, and metadata

**flows** table
- Persists request lifecycle events
- Automatic cleanup keeps last 1000 records
- Used for debugging and audit trails

**idempotency** table
- Keyed by `toolCallId`
- Stores responses for duplicate requests
- Prevents side effects from retries

**call_state** table
- Tracks call context and state transitions
- Links flows to booking operations

### Request Flow

1. **VAPI sends webhook** → `POST /vapi-webhook`
2. **Validation stage** → Input sanitization, schema checks
3. **Business rules** → Slot availability, conflict detection
4. **Database write** → SQLite transaction
5. **Response** → Success or structured error

### Monitoring & Alerts

**Metrics tracked:**
- Total requests (success/failure/validation errors)
- Failure rates by stage (VALIDATION, BUSINESS_RULES, DB_WRITE)
- Response times (average, max, p95)
- Slot conflicts and idempotency hits
- DB error patterns

**Alerts trigger for:**
- High failure rate (>20% degraded, >40% critical)
- DB error spikes (3+ in last minute)
- Excessive slot conflicts
- Slow responses (>1 second)

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.18
- **Database**: SQLite3 6.0
- **API Security**: Helmet, CORS, express-rate-limit
- **Async**: Native async/await
- **Environment**: dotenv for configuration

### Key Dependencies

- **express** - Web framework
- **sqlite3** - Embedded database
- **cors** - Cross-origin requests
- **helmet** - Security headers
- **express-rate-limit** - DDoS protection
- **dotenv** - Environment management
- **ws** - WebSocket support (optional)

## Project Structure

```
AIVTER/
├── server.js              # Main Express app, routes, middleware
├── monitor.js             # CLI monitoring tool
├── loadTest.js            # Load testing utility
├── package.json           # Dependencies
├── README.md              # This file
├── db/
│   ├── bookings.js        # Bookings table operations
│   ├── flows.js           # Flow debugger persistence
│   ├── idempotency.js     # Idempotency key storage
│   └── callState.js       # Call state tracking
├── routes/
│   └── webhook.js         # VAPI webhook router
├── services/              # Business logic (TODO: extract if needed)
├── utils/
│   ├── flowDebugger.js    # Stripe-style debug endpoints
│   ├── metrics.js         # In-memory metrics tracking
│   └── alerts.js          # Alert logic
└── events/                # Event handlers (placeholder)
```

## Installation

### Prerequisites
- **Node.js** 18 or higher
- **npm** or **yarn**

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/lenchobel/AIVTER.git
   cd AIVTER
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. **Start the server**
   ```bash
   npm start
   ```
   Server runs on `http://localhost:3001` by default.

## Configuration

### Environment Variables

```env
# Server
PORT=3001
NODE_ENV=development
LOG_LEVEL=info

# Database
DB_PATH=./bookings.db

# Rate Limiting
RATE_LIMIT_PER_SEC=10

# VAPI Integration
VAPI_API_KEY=your_vapi_key_here
PUBLIC_WEBHOOK_URL=https://your-ngrok-url  # For local testing

# Monitoring
METRICS_ENABLED=true
ALERTS_ENABLED=true
```

### Environment Notes

- **PORT**: Server port (default: 3001)
- **DB_PATH**: SQLite database file location
- **RATE_LIMIT_PER_SEC**: Requests per second limit (default: 10)
- **LOG_LEVEL**: Logging verbosity (`info`, `debug`, `error`)
- **PUBLIC_WEBHOOK_URL**: External webhook URL (required for VAPI to reach you locally; use ngrok)

## Running the Project

### Development

```bash
# Start with auto-reload
npm run dev

# In another terminal, monitor metrics
node monitor.js
```

### Production

```bash
# Build and start
npm start
```

### Load Testing

```bash
# Default: 10 req/s for 30 seconds
node loadTest.js

# Custom parameters
RPS=50 DURATION=60 node loadTest.js

# Against remote endpoint
WEBHOOK_URL=https://your-ngrok-url/vapi-webhook node loadTest.js
```

**Load test mix:**
- 55% valid bookings
- 15% validation failures
- 10% idempotency duplicates
- 10% slot conflicts
- 10% malformed payloads

### CLI Monitoring

```bash
# Watch metrics in real-time
node monitor.js
```

Output shows:
- Request counts (total, success, failed)
- Failure rate
- Response times (avg/max)
- Recent alerts
- Slot conflicts

## API Documentation

### Core Endpoints

#### **POST** `/vapi-webhook`
Receives booking requests from VAPI voice assistant.

**Request body:**
```json
{
  "message": {
    "type": "booking",
    "data": {
      "date": "2025-07-15",
      "time": "14:30",
      "service": "general-checkup",
      "patientName": "John Doe",
      "phone": "+251900000000"
    }
  },
  "toolCallId": "call_xyz123"
}
```

**Response:**
```json
{
  "success": true,
  "bookingId": 42,
  "message": "Booking confirmed for July 15 at 2:30 PM"
}
```

#### **GET** `/health`
Health check with status and metrics.

**Response:**
```json
{
  "status": "ok",
  "uptime": 3600,
  "totalRequests": 5000,
  "failureRate": 0.02,
  "avgResponseTime": 145.3,
  "recentFailures": [...]
}
```

#### **GET** `/bookings`
List all bookings.

**Response:**
```json
{
  "success": true,
  "bookings": [
    {
      "id": 1,
      "date": "2025-07-15",
      "time": "14:30",
      "service": "general-checkup",
      "patientName": "John Doe",
      "createdAt": "2025-07-10T10:30:00Z"
    }
  ]
}
```

### Monitoring Endpoints

#### **GET** `/metrics`
Full metrics snapshot.

#### **GET** `/alerts`
Recent alerts (limit query parameter, max 100).

### Debug Endpoints

#### **GET** `/debug/flows?limit=50&offset=0`
Paginated flow records (Stripe-style debugger).

#### **GET** `/debug/stream?count=20`
Latest flow events (lightweight polling).

#### **GET** `/debug/flow/:callId`
Single flow with navigation context.

#### **GET** `/debug/stats`
Flow statistics and aggregates.

#### **DELETE** `/debug/flows`
Clear all flow records (dev only).

## Challenges Solved

### 1. **Double Booking Prevention**
   - Implemented unique constraint on `(date, time, service)` tuple
   - SQLite transactions ensure atomicity
   - Race condition eliminated with database-level enforcement

### 2. **Deterministic Request Handling**
   - Idempotency key tracking prevents side effects on retries
   - Flow debugger records every stage for troubleshooting
   - Clear error codes and messages for debugging

### 3. **Production Resilience**
   - Rate limiting prevents DDoS/abuse
   - Graceful error handling with structured responses
   - In-memory metrics don't require external infrastructure
   - Automatic cleanup of old flow records

### 4. **Observability Without External Tools**
   - Stripe-style flow debugger built into the service
   - Real-time metrics with alert thresholds
   - SQLite-backed audit trail
   - CLI monitoring tool for operators

## Roadmap

### Near-term (v1.1)
- [ ] WebSocket support for real-time flow updates
- [ ] Frontend dashboard for flow visualization
- [ ] Booking cancellation/rescheduling
- [ ] SMS/email notifications
- [ ] Calendar integration

### Medium-term (v2.0)
- [ ] Multi-clinic support
- [ ] Payment integration (Chapa/Stripe)
- [ ] Doctor scheduling
- [ ] Analytics dashboard
- [ ] API rate limit by user/clinic

### Long-term (v3.0)
- [ ] Machine learning for no-show prediction
- [ ] Automated reminder system
- [ ] Telehealth integration
- [ ] Multi-language support
- [ ] Mobile app backend

## Future Improvements

1. **Horizontal Scaling**
   - Replace in-memory metrics with Redis
   - Move SQLite to PostgreSQL
   - Implement distributed tracing

2. **Performance**
   - Add caching layer (Redis) for frequent queries
   - Implement database indexing on common queries
   - Use connection pooling

3. **Observability**
   - Integrate with Datadog/New Relic
   - Add OpenTelemetry instrumentation
   - Build advanced alerting (PagerDuty)

4. **Testing**
   - Add comprehensive unit tests
   - Integration tests with mock VAPI
   - End-to-end load testing

5. **Documentation**
   - API documentation with Swagger/OpenAPI
   - Architecture decision records (ADRs)
   - Deployment guides

## Development

### Quick Commands

```bash
npm start          # Start server
npm run dev        # Start with auto-reload
npm test           # Run tests (TODO)
npm run lint       # Lint code (TODO)
npm run build      # Build for production (TODO)
```

### Testing

Load test against staging:
```bash
WEBHOOK_URL=https://staging.example.com/vapi-webhook node loadTest.js
```

### Debugging

Enable verbose logging:
```bash
LOG_LEVEL=debug npm start
```

View flows in real-time:
```bash
curl http://localhost:3001/debug/stream
```

## Troubleshooting

### Port Already in Use
```bash
# Use a different port
PORT=3002 npm start

# Or kill the process on port 3001
lsof -i :3001
kill -9 <PID>
```

### Database Locked
```bash
# SQLite locks if multiple processes write simultaneously
# Ensure only one server instance is running
ps aux | grep "node server.js"
```

### High Failure Rate
1. Check recent failures: `curl http://localhost:3001/alerts`
2. Review flow debugger: `curl http://localhost:3001/debug/flows`
3. Check database connection: `curl http://localhost:3001/health`

## License

MIT License — See LICENSE file for details.

---

**Maintainer:** Lencho Belay Abdisa  
**Last Updated:** July 2025  
**Status:** Production Ready
