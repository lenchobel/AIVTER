# Clinic Booking Backend

A production-grade, resilient clinic booking system with built-in monitoring and alerting.

## Features

- **SQLite Persistence**: Flow persistence, idempotency, bookings with unique slot constraints
- **Production Hardening**: Rate limiting, input validation, structured errors
- **Real-time Monitoring**: In-memory metrics, alerts, health endpoints
- **Load Testing**: Built-in load tester and CLI monitor
- **Flow Debugger**: SQLite-backed request tracing and debugging

## Quick Start

```bash
# Install dependencies
npm install

# Start the server
node server.js

# Monitor metrics (optional)
node monitor.js

# Load test (optional)
node loadTest.js
```

## API Endpoints

### Core
- `POST /vapi-webhook` - VAPI webhook for booking requests
- `GET /health` - Health check with status and metrics
- `GET /bookings` - List all bookings

### Monitoring
- `GET /metrics` - Full metrics snapshot
- `GET /alerts` - Recent alerts

### Debug
- `GET /debug/flows` - All flow records
- `GET /debug/stats` - Flow statistics
- `GET /debug/stream` - Live flow stream

## Environment Variables

```env
PORT=3001
DB_PATH=./bookings.db
RATE_LIMIT_PER_SEC=10
NODE_ENV=development
LOG_LEVEL=info
```

## Architecture

### Database Schema

**bookings**
- Unique constraint on `(date, time, service)` prevents double bookings
- Stores booking details and status

**flows**
- Persists request flows for debugging
- Automatic cleanup (last 1000 records)

**idempotency**
- Keyed by `toolCallId`
- Stores and returns responses for duplicate requests

### Monitoring

Metrics tracked:
- Request counts (total, success, failure)
- Failure rates by stage (VALIDATION, BUSINESS_RULES, DB_WRITE)
- Response times (avg, max)
- Slot conflicts and idempotency hits
- Recent failures

Alerts trigger for:
- High failure rate (>20% degraded, >40% critical)
- DB error spikes
- Too many slot conflicts
- Slow responses (>1s)

## Load Testing

```bash
# Default: 10 req/s for 30s
node loadTest.js

# Heavy load
RPS=50 DURATION=60 node loadTest.js

# Against remote endpoint
WEBHOOK_URL=https://your-ngrok-url/vapi-webhook node loadTest.js
```

Request mix:
- 55% valid bookings
- 15% validation failures
- 10% idempotency duplicates
- 10% slot conflicts
- 10% malformed payloads

## Development

The system is designed to be:
- **Lightweight**: No external dependencies like Redis or Kafka
- **Resilient**: Graceful degradation under load
- **Observable**: Full request tracing and metrics
- **Simple**: Minimal configuration, easy to deploy

## License

MIT
