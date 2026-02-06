# Sri-Care Deployment Guide

## Quick Start (Local Development)

### Start all services with Docker Compose:
```bash
docker-compose up -d
```

This starts:
- Kong Gateway (port 8000 proxy, 8001 admin)
- RabbitMQ (port 5672 AMQP, 15672 management UI)
- Auth Service (port 3001)
- Billing Service (port 3002)
- Payment Service (port 3003)
- Provisioning Service (port 3004)
- Notification Service (port 3005)
- Chat Service (port 3006 - REST + WebSocket)

### Configure Kong routes:
```bash
bash configure-kong.sh
```

### Run Contract Tests:
```bash
cd tests
npm install
npm test
```

## Architecture

All services are now **discrete deployables** with:
- Own Dockerfile and package.json
- Independent data stores (SQLite per service, configurable via DATABASE_URL)
- RabbitMQ for async events (payment and provisioning publish, notification consumes)
- Kong Gateway for routing, rate-limiting, and CORS

## Service Endpoints

Via Kong (port 8000):
- `http://localhost:8000/api/auth/*` → Auth Service
- `http://localhost:8000/api/billing/*` → Billing Service
- `http://localhost:8000/api/payment/*` → Payment Service
- `http://localhost:8000/api/services/*` → Provisioning Service
- `http://localhost:8000/api/notifications/*` → Notification Service
- `http://localhost:8000/api/chat/*` → Chat Service (REST API)
- `ws://localhost:3006` → Chat Service (WebSocket - direct connection)

Direct service ports (for debugging):
- Auth: 3001
- Billing: 3002
- Payment: 3003
- Provisioning: 3004
- Notification: 3005
- Chat: 3006 (REST + WebSocket)

## Business Logic

All business logic is **server-side** in the `services/` folders:
- `services/auth/` - Authentication, JWT, password reset
- `services/billing/` - Bill queries
- `services/payment/` - Idempotent payment processing with circuit breaker
- `services/provisioning/` - Service activation/deactivation with idempotency
- `services/notification/` - Event-driven notifications via RabbitMQ
- `services/chat/` - **Real-time customer support** (WebSocket + REST)
  - Bot auto-response for common queries (bills, data, balance)
  - Agent escalation algorithm (assigns least-loaded available agent)
  - Message persistence (SQLite: chat_sessions, messages, agents tables)
  - Connection management (WebSocket with auto-reconnect)

Web portal and mobile apps consume the same REST contracts via Kong.
**Chat WebSocket:** Direct connection to ws://localhost:3006 (bypasses Kong for persistent connections).

## Event Flow

1. **Payment succeeds** → publishes `payment.succeeded` to `payment.events` exchange
2. **Service provisioned** → publishes `service.provisioned` to `provisioning.events` exchange
3. **Notification service** consumes all events and stores them for user polling
4. **Frontend** polls `/api/notifications/poll/:userId` every 15 seconds
   - Merges events with localStorage (preserves read/unread status)
   - Displays unread badge on sidebar (updates every 5 seconds)
   - Allows manual refresh and filtering by notification type
   - **Clickable notifications** with action buttons navigate to relevant sections

## Testing High-Volume Notifications

To test the best-effort delivery mechanism during high-volume events (e.g., monthly bill generation):

```bash
# Generate 50 test notifications for user 1
cd services/notification
npm run test:generate 1 50

# Or use node directly
node generateTestNotifications.js <userId> <count>
```

The notification service will:
- Accept all events via `/publish` endpoint
- Queue up to 100 notifications per user (FIFO eviction when full)
- Continue accepting new notifications without blocking primary services
- Frontend will poll and display notifications with proper priorities

## Production Considerations

- Replace SQLite with PostgreSQL/MySQL per service
- Add service-to-service auth (JWT or mTLS)
- Enable Kong JWT plugin for gateway-level auth
- Configure Kong for production rate limits and logging
- Use RabbitMQ cluster for HA
- Add metrics (Prometheus) and tracing (Jaeger)
