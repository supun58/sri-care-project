# Sri-Care Telecom Self-Service Platform

**Hybrid SOA + Microservices** architecture for telecom customer portal and mobile apps.

## 🏗️ Architecture

- **API Gateway:** Kong (reverse proxy, rate limiting, CORS)
- **Message Broker:** RabbitMQ (async events)
- **Services:** Auth, Billing, Payment, Provisioning, Notifications
- **Business Logic:** Server-side in `services/` — consumed by both web and mobile via REST
- **Resilience:** Idempotency keys, circuit breakers, event-driven notifications

See full details in [documentation/architecture.md](documentation/architecture.md).

## 🚀 Quick Start

### 1. Start all services:
```bash
docker-compose up -d
```

### 2. Configure Kong gateway:
```bash
bash configure-kong.sh
```

### 3. Access:
- **Gateway:** http://localhost:8000/api
- **Kong Admin:** http://localhost:8001
- **RabbitMQ UI:** http://localhost:15672 (user: sricare, pass: sricare123)
- **Frontend (dev):** `cd frontend && npm run dev`

### 4. Run contract tests:
```bash
cd tests
npm install
npm test
```

## 📁 Project Structure

```
├── services/                   # Discrete deployable microservices
│   ├── auth/                   # Authentication + JWT
│   ├── billing/                # Bill queries
│   ├── payment/                # Payment processing (idempotent)
│   ├── provisioning/           # Service activation (idempotent)
│   ├── notification/           # Event-driven notifications
│   └── chat/                   # Real-time customer support (WebSocket + REST)
├── backend/                    # Legacy monolith (for reference)
├── frontend/                   # React web portal
├── documentation/
│   ├── architecture.md         # Full architecture doc
│   └── openapi.yaml            # REST API contract
├── tests/                      # Contract tests
├── docker-compose.yaml         # Kong, RabbitMQ, all services
└── configure-kong.sh           # Kong route config script
```

## 🔑 Key Features

- **Single Business Logic Source:** All logic server-side; web/mobile consume same REST APIs
- **Idempotency:** Payment and provisioning endpoints require `Idempotency-Key` header
- **Circuit Breakers:** Auto-retry with backoff on downstream failures
- **Event-Driven:** Payment/provisioning publish events; notification service consumes
- **Real-Time Notifications:** Auto-polling every 15s, localStorage persistence, unread badge on sidebar
- **WebSocket Chat:** Real-time customer support with bot auto-response, agent escalation, message persistence
- **Gateway Enforced:** Rate limits (30/min payments, 120/min others), CORS, routing

## 📚 Documentation

- [Architecture Overview](documentation/architecture.md)
- [Deployment Guide](DEPLOYMENT.md)
- [OpenAPI Spec](documentation/openapi.yaml)

## 🧪 Testing

Contract tests verify:
- Auth flow (login/register)
- Service provisioning idempotency
- Payment idempotency
- Billing queries
- Notification polling

## 🔐 Security (Production)

- Enable Kong JWT plugin for gateway auth
- Replace SQLite with PostgreSQL per service
- Add service-to-service mTLS
- Configure production rate limits
- Enable request/response logging and audit trails

---

**Status:** All hardening steps complete. Services extracted, Kong deployed, RabbitMQ integrated, OpenAPI documented, contract tests added.
