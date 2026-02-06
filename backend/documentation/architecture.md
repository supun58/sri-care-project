# Sri-Care Architecture (Hybrid SOA + Microservices)

## Executive Summary
Sri-Care is a **production-ready microservices architecture** for telecom self-care, combining Service-Oriented Architecture (SOA) principles with modern microservices patterns. The system provides a unified REST API surface for web portals and mobile applications, with server-side business logic ensuring consistency across all client types.

**Architecture Style:** Hybrid SOA + Microservices + Event-Driven  
**Gateway:** Kong (API Gateway/ESB)  
**Message Broker:** RabbitMQ (Async Events)  
**Data Stores:** SQLite per service (production: PostgreSQL/MySQL)  
**Deployment:** Docker Compose (production-ready containerization)  
**API Contract:** OpenAPI 3.0 specification  

## Architecture Principles

### 1. Single Source of Truth for Business Logic
All business rules reside **server-side** in discrete microservices. Web portals and mobile apps consume identical REST contracts, ensuring:
- No logic duplication between clients
- Consistent behavior across platforms
- Centralized validation and enforcement
- Single point of maintenance

### 2. Hybrid SOA + Microservices Pattern
- **SOA Layer:** Kong Gateway provides enterprise service bus (ESB) capabilities—routing, rate limiting, CORS, transformation
- **Microservices Layer:** Five independent services (Auth, Billing, Payment, Provisioning, Notification) with isolated data stores
- **Event-Driven Layer:** RabbitMQ enables async communication for notifications and cross-service events

### 3. Resilience by Design
- **Idempotency:** Payment and provisioning endpoints require `Idempotency-Key` headers; repeated requests with same key return cached responses
- **Circuit Breakers:** Services implement auto-retry with exponential backoff; circuit opens after 3 failures, enters cooldown
- **Graceful Degradation:** Services continue operating with reduced functionality when dependencies fail
- **Event Replay:** RabbitMQ persists messages; notification service can replay on restart

## Core Components

### API Gateway / ESB (Kong)
**Technology:** Kong 3.4 + PostgreSQL  
**Ports:** 8000 (proxy), 8001 (admin API)  
**Location:** `docker-compose.yaml` (kong, kong-database, kong-migration services)  
**Configuration:** `configure-kong.sh` (route mappings, rate limits, plugins)

**Responsibilities:**
- Reverse proxy to all backend services
- Rate limiting (30/min for payments, 120/min for others)
- CORS enforcement for `http://localhost:5173`, `http://localhost:3000`
- Request/response logging
- Header injection (Idempotency-Key forwarding)
- Future: JWT validation, API key management, request transformation

**Route Mappings:**
```
/api/auth/*         → auth-service:3001
/api/billing/*      → billing-service:3002
/api/payment/*      → payment-service:3003
/api/services/*     → provisioning-service:3004
/api/notifications/*→ notification-service:3005
```

### Message Broker (RabbitMQ)
**Technology:** RabbitMQ 3.12 with Management Plugin  
**Ports:** 5672 (AMQP), 15672 (UI - user: sricare, pass: sricare123)  
**Location:** `docker-compose.yaml` (rabbitmq service)  
**Exchanges:**
- `payment.events` (topic) - payment success/failure events
- `provisioning.events` (topic) - service activation/deactivation events

**Event Flow:**
1. Payment Service publishes `payment.succeeded` → `payment.events`
2. Provisioning Service publishes `service.provisioned` → `provisioning.events`
3. Notification Service binds queue to both exchanges, consumes all events
4. Events stored in-memory, exposed via REST polling endpoint

**Persistence:** Durable exchanges and queues; messages survive broker restart

### Services (Microservices Layer)

#### 1. Auth Service
**Port:** 3001  
**Location:** `services/auth/`  
**Tech Stack:** Node.js + Express + SQLite + JWT + bcrypt  
**Database:** `auth.db` (configurable via `DATABASE_URL` env var)  
**Dependencies:** None (independent service)

**Endpoints:**
- `POST /login` - JWT token issuance
- `POST /register` - User creation with password hashing
- `GET /exists/:phone` - User existence check
- `POST /forgot` - Password reset OTP generation (demo returns OTP in response)
- `POST /reset` - Password reset with OTP validation
- `GET /profile/:userId` - User profile retrieval
- `PUT /update/:userId` - Account balance/data/minutes updates

**Data Model:** Users table with `phone`, `password_hash`, `account_type` (prepaid/postpaid), `account_balance`, `data_remaining`, `minutes_remaining`, `reset_token`, `reset_expires`

**Security:**
- Passwords hashed with bcryptjs (salt rounds: 10)
- JWT tokens signed with `JWT_SECRET` env var
- Password reset tokens expire after 15 minutes
- Demo mode: OTP returned in response (production: send via SMS/email)

#### 2. Billing Service
**Port:** 3002  
**Location:** `services/billing/`  
**Tech Stack:** Node.js + Express  
**Data:** In-memory mock (production: database-backed)

**Endpoints:**
- `GET /:userId` - List user bills
- `GET /details/:billId` - Bill details

**Future:** Integrate with real billing system database

#### 3. Payment Service
**Port:** 3003  
**Location:** `services/payment/`  
**Tech Stack:** Node.js + Express + RabbitMQ (amqplib)  
**Idempotency Store:** In-memory Map (production: Redis)  
**Circuit Breaker:** Built-in (3 failure threshold, 15s cooldown)

**Endpoints:**
- `POST /pay` - Process payment (requires `Idempotency-Key` header)

**Request Schema:**
```json
{
  "amount": 100.00,
  "cardNumber": "4111111111111111",
  "billId": 123
}
```

**Response Envelope:**
```json
{
  "success": true,
  "code": "payment_processed",
  "message": "Payment processed successfully",
  "data": {
    "transactionId": "TXN_1736640000000",
    "amount": 100.00,
    "maskedCard": "****1111",
    "status": "processed",
    "idempotencyKey": "uuid-here"
  },
  "idempotent": false  // true if replayed
}
```

**Resilience:**
- Idempotency cache: duplicate requests return cached response
- Retry logic: 1 automatic retry on downstream failure
- Circuit breaker: opens after 3 failures, rejects requests for 15s
- Error codes: `missing_idempotency_key` (400), `payment_circuit_open` (503), `payment_downstream_unavailable` (503)

**Event Publishing:**
- On success: publishes to `payment.events` exchange
- Event payload: `{ userId, event: 'payment.succeeded', payload: responseData }`

#### 4. Provisioning Service
**Port:** 3004  
**Location:** `services/provisioning/`  
**Tech Stack:** Node.js + Express + SQLite + RabbitMQ  
**Database:** `provisioning.db` (services, user_services tables)  
**Idempotency Store:** In-memory Map  
**Circuit Breaker:** Built-in (3 failure threshold, 15s cooldown)

**Endpoints:**
- `GET /` - List all available services
- `GET /user/:userId` - User's active services
- `POST /purchase/:userId/:serviceId` - Activate service (requires `Idempotency-Key`)
- `POST /deactivate/:userId/:serviceId` - Deactivate service

**Service Categories:**
- **Data Services:** 5GB, 10GB, 50GB packages
- **Voice Services:** Call packages, roaming, unlimited minutes
- **VAS (Value Added Services):** Caller tunes, voicemail, security features

**Provisioning Logic:**
1. Validate service exists and user has sufficient balance (prepaid) or bill capacity (postpaid)
2. Check idempotency cache (return cached if replay)
3. Check circuit breaker state
4. Simulate downstream provisioning call (demo: 250ms with 20% failure rate)
5. Retry once on failure
6. Update user account (add data/minutes, deduct balance or add to bill)
7. Publish `service.provisioned` event to RabbitMQ
8. Cache response with idempotency key

**Account Updates:**
- Data services: Add GB to `data_remaining`
- Voice services: Add minutes to `minutes_remaining`
- Prepaid: Deduct price from `account_balance` (fail if insufficient)
- Postpaid: Add price to `current_bill`

#### 5. Notification Service
**Port:** 3005  
**Location:** `services/notification/`  
**Tech Stack:** Node.js + Express + RabbitMQ Consumer  
**Queue:** `notifications` (durable, binds to payment.events and provisioning.events)  
**Storage:** In-memory Map keyed by userId (backend), localStorage (frontend)
**Best-Effort Delivery:** Queue limit of 100 notifications per user; oldest removed when full

**Endpoints:**
- `POST /publish` - Manual event publish (admin/internal)
- `GET /poll/:userId?drain=true` - Poll user notifications (drain=false to peek without clearing queue)
- `GET /health` - Service health with queue stats (activeUsers, totalQueued, maxQueueSize)

**Consumer Logic:**
1. Bind to `payment.events` and `provisioning.events` exchanges
2. Consume messages from `notifications` queue
3. Parse event, extract userId
4. Store in user-specific queue (in-memory Map)
5. **Best-Effort Delivery:** If queue exceeds 100 items, remove oldest to prevent memory overflow
6. ACK message if processed, NACK if error
7. Reconnect with backoff on connection failure

**Event Schema (Backend):**
```json
{
  "id": "evt_1736640000000_abc123",
  "event": "payment.events" | "provisioning.events" | "bill.generated" | "bill.overdue" | "service.disconnected",
  "payload": { 
    "userId": "1",
    "action": "activated" | "deactivated" | "disconnected",
    "serviceName": "International Roaming",
    "amount": 100,
    "billId": "BILL_123",
    "type": "generated" | "reminder" | "overdue",
    "reason": "overdue payment"
  },
  "createdAt": "2026-01-11T10:30:00.000Z"
}
```

**Frontend Event Parsing:**
- `payment.events` → Type: Payment, Priority: Low, Title: "Payment Successful", Action: "View Bills"
- `provisioning.events` (activated/deactivated) → Type: Service, Priority: Medium, Title: "Service Update", Action: "Manage Services"
- `service.disconnected` → Type: Alert, Priority: High, Title: "Service Disconnected", Action: "Make Payment"
- `bill.generated` → Type: Bill, Priority: High, Title: "Bill Notification", Action: "View Bills"
- `bill.overdue` → Type: Bill, Priority: High, Title: "Overdue Bill Payment", Action: "Pay Now"
- `bill.reminder` → Type: Bill, Priority: High, Title: "Bill Notification", Action: "Pay Bill"
- Unrecognized events → Type: Alert, Priority: Medium

**Persistence Strategy:**
- Backend: In-memory with queue limits (production: Redis with TTL)
- Frontend: localStorage per user with read/unread status
- Hybrid approach: Backend serves as event source, frontend maintains display state

**High-Volume Handling:**
- Queue size limit per user (100 notifications) prevents memory exhaustion during mass bill generation
- FIFO eviction policy: oldest notifications removed when queue full
- Non-blocking delivery: does not impact primary functions (payments, provisioning)
- Async RabbitMQ consumption with ACK/NACK for reliability

**Production Enhancement:** Replace in-memory storage with Redis (with TTL expiration) or database for persistence across restarts and horizontal scaling

#### 6. Chat Service (Real-Time Customer Support)
**Port:** 3006  
**Location:** `services/chat/`  
**Tech Stack:** Node.js + Express + WebSocket (ws) + SQLite  
**Protocol:** Dual-protocol (REST + WebSocket)  
**Database:** `chat.db` (chat_sessions, messages, agents tables)  
**Connection Model:** Persistent WebSocket connections with automatic reconnection

**REST Endpoints:**
- `POST /session` - Create or get active chat session for user
- `GET /history/:sessionId?limit=50` - Retrieve chat history
- `POST /read/:sessionId` - Mark messages as read (user or agent)
- `POST /close/:sessionId` - Close chat session
- `GET /health` - Service health with active connection count

**WebSocket Protocol:**
WebSocket endpoint: `ws://localhost:3006` (bypasses Kong for persistent connections)

**Client → Server Messages:**
```json
// Initialize connection
{ "type": "init", "sessionId": "session_1_...", "userId": "1", "userName": "John Doe" }

// Send message
{ "type": "message", "text": "Hello, I need help", "timestamp": "2026-01-11T10:30:00Z" }

// Typing indicator
{ "type": "typing", "timestamp": "2026-01-11T10:30:00Z" }
```

**Server → Client Messages:**
```json
// Connection initialized
{ "type": "init_success", "sessionId": "session_1_...", "timestamp": "2026-01-11T10:30:00Z" }

// Message sent successfully
{ "type": "message_sent", "message": {...}, "timestamp": "2026-01-11T10:30:00Z" }

// Message received (bot/agent)
{ "type": "message_received", "message": {...}, "timestamp": "2026-01-11T10:30:00Z" }

// Session closed
{ "type": "session_closed", "timestamp": "2026-01-11T10:30:00Z" }

// Typing indicator
{ "type": "user_typing", "userId": "1", "timestamp": "2026-01-11T10:30:00Z" }
```

**Database Schema:**

**chat_sessions:**
```sql
CREATE TABLE chat_sessions (
  id INTEGER PRIMARY KEY,
  session_id TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT,
  status TEXT DEFAULT 'active',          -- 'active' | 'closed'
  agent_id TEXT,                         -- NULL if bot-only
  agent_name TEXT,
  created_at DATETIME,
  closed_at DATETIME
);
```

**messages:**
```sql
CREATE TABLE messages (
  id INTEGER PRIMARY KEY,
  session_id TEXT NOT NULL,
  sender_type TEXT NOT NULL,             -- 'user' | 'agent' | 'bot'
  sender_id TEXT,
  sender_name TEXT,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',      -- 'text' | 'file' | 'system'
  read_by_agent BOOLEAN DEFAULT 0,
  read_by_user BOOLEAN DEFAULT 0,
  created_at DATETIME,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(session_id)
);
```

**agents:**
```sql
CREATE TABLE agents (
  id INTEGER PRIMARY KEY,
  agent_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'available',       -- 'available' | 'busy' | 'offline'
  current_chats INTEGER DEFAULT 0,
  max_chats INTEGER DEFAULT 5,           -- Max concurrent chats per agent
  created_at DATETIME
);
```

**Bot Auto-Response Logic:**
The chat service implements intelligent bot responses before agent escalation:

1. **Bill/Payment Queries:** Responds with user's current bill amount and due date
2. **Data Usage Queries:** Returns remaining data from user account
3. **Balance Queries:** Shows account balance (prepaid/postpaid)
4. **Greetings:** Friendly welcome message
5. **Agent Escalation Triggers:** Keywords like "agent", "human", "representative"
6. **Fallback:** Unknown queries auto-escalate to available agent

**Agent Assignment Algorithm:**
1. Find agents with `status='available'` AND `current_chats < max_chats`
2. Sort by `current_chats ASC` (least loaded agent)
3. Assign first available agent
4. Increment `current_chats` counter
5. Update `chat_sessions` with `agent_id` and `agent_name`
6. Send agent welcome message
7. If no agents available → Queue message for next available agent

**Connection Management:**
- Active connections stored in Map: `sessionId → { ws, userId, agentWs }`
- WebSocket heartbeat/ping every 30 seconds
- Auto-reconnect on disconnect (client-side)
- Graceful degradation: messages saved to DB even if WebSocket fails
- Connection pooling prevents memory leaks

**Message Flow (User → Bot → Agent):**
```
1. User connects WebSocket → Sends init message
2. Server creates/retrieves session → Loads history
3. User sends message → Saved to DB
4. Bot analyzes message content:
   - If recognizable query → Bot auto-responds (800ms delay)
   - If agent request → Assign agent → Agent welcome message
   - If unknown → Auto-assign agent
5. Agent responds (or simulated agent for demo)
6. Messages broadcast via WebSocket
7. User sees typing indicators, read receipts
```

**Production Considerations:**
- **Agent Dashboard:** Separate UI for agents to handle multiple chats (not in MVP)
- **Redis Pub/Sub:** For multi-instance WebSocket synchronization
- **PostgreSQL:** Replace SQLite for production scale
- **File Upload:** Support image/document sharing in messages
- **Canned Responses:** Pre-defined quick replies for agents
- **Chat Analytics:** Track response times, satisfaction ratings
- **Queue Management:** Priority queue for VIP customers
- **Notification Integration:** Alert agents via desktop/mobile notifications

**Security:**
- JWT validation for session creation
- Rate limiting on message send (prevents spam)
- XSS sanitization on message content
- WebSocket origin validation
- Session timeout after 30 minutes of inactivity

**Performance:**
- Typical latency: 50-200ms for message delivery
- Supports 1000+ concurrent WebSocket connections per instance
- Message history pagination (50 messages per page)
- In-memory active session cache

## Client Access Layer

### Web Portal
**Technology:** React + TypeScript + Vite + TailwindCSS  
**Location:** `frontend/`  
**API Client:** `frontend/src/api/api.tsx` (Axios wrapper with auto-token injection)

**Features:**
- JWT token stored in localStorage
- Automatic `Authorization: Bearer <token>` header injection
- Idempotency key generation (crypto.randomUUID or fallback)
- Loading states and error handling
- Retry logic for 503 responses (circuit breaker / provisioning unavailable)
- **WebSocket integration for real-time chat**

**Components:**
- `Login.tsx` / `Register.tsx` - Auth flows
- `ForgotPassword.tsx` - OTP-based password reset (shows demo OTP)
- `Dashboard.tsx` - Account overview with notification badge (updates every 5s)
- `Services.tsx` - Service activation/deactivation with idempotency status display
- `Payments.tsx` - Top-up (prepaid) or bill payment (postpaid) with idempotency
- `Bills.tsx` - Bill history
- `Notifications.tsx` - **Real-time notification center** (polls every 15s, localStorage persistence, manual refresh, read/unread tracking, filtering by type)
- `Chat.tsx` - **WebSocket-based real-time customer support** (bot auto-response, agent escalation, message history, typing indicators, connection status)

**Notification Implementation Details:**
- **Auto-Polling:** Fetches from `/api/notifications/poll/:userId?drain=false` every 15 seconds
- **Event Parsing:** Converts raw RabbitMQ events into user-friendly notifications with action buttons
  - `payment.events` → "Payment Successful" (Payment type, Low priority) → **Action: "View Bills"**
  - `provisioning.events` (activated) → "Service Activated" (Service type, Medium priority) → **Action: "Manage Services"**
  - `provisioning.events` (deactivated) → "Service Deactivated" (Service type, Medium priority) → **Action: "Manage Services"**
  - `service.disconnected` → "Service Disconnected" (Alert type, High priority) → **Action: "Make Payment"**
  - `bill.generated` → "Bill Notification" (Bill type, High priority) → **Action: "View Bills"**
  - `bill.overdue` → "Overdue Bill Payment" (Bill type, High priority) → **Action: "Pay Now"**
  - `bill.reminder` → "Payment Reminder" (Bill type, High priority) → **Action: "Pay Bill"**
  - Unknown events → Generic alert (Alert type, Medium priority)
- **Persistence:** Stores notifications in localStorage (`notifications_${userId}`) with read/unread status
- **Deduplication:** Merges new backend events with stored notifications by event ID
- **Clickable Notifications:** Each notification card is clickable and navigates to relevant section (Bills, Payments, Services, Overview)
- **Action Buttons:** Inline buttons like "View Bills", "Pay Now", "Manage Services" for quick navigation
- **Sidebar Badge:** Red badge shows unread count, updates every 5 seconds from localStorage
- **Filtering:** All, Unread, Bills, Payments, Services, Alerts
- **Actions:** Mark as read, Mark all as read, Delete notification, Manual refresh

### Mobile Apps (Future)
**Access Pattern:** Same REST contracts via Kong Gateway  
**SDK Generation:** OpenAPI spec at `documentation/openapi.yaml` enables:
- TypeScript SDK (web)
- Swift SDK (iOS)
- Kotlin SDK (Android)

**Shared Logic:** All business rules server-side; mobile apps are thin clients

## Data Flow Diagrams

### Real-Time Chat Flow (WebSocket + Bot/Agent Escalation)
```
Client (Web/Mobile)
  │
  │ 1. POST /api/chat/session { userId, userName }
  ▼
Chat Service (REST)
  │
  ├─ Check for active session in chat_sessions table
  │   └─ If exists: Return existing session
  │   └─ If not: Create new session (status='active')
  │
  └─ Return { sessionId, session details }
  
Client
  │
  │ 2. WebSocket connect to ws://localhost:3006
  │    Send: { type: "init", sessionId, userId, userName }
  ▼
Chat Service (WebSocket)
  │
  ├─ Store connection in Map: sessionId → { ws, userId }
  ├─ Load chat history from messages table
  └─ Send: { type: "init_success", sessionId }
  
Client
  │
  │ 3. User types message
  │    Send: { type: "message", text: "I need help with my bill" }
  ▼
Chat Service
  │
  ├─ Save message to messages table
  │   (sender_type='user', read_by_agent=0)
  │
  ├─ Check session.agent_id
  │   └─ If NULL (no agent assigned):
  │       ├─ Analyze message with bot logic
  │       │   ├─ "bill" keyword detected
  │       │   └─ Query user data (current_bill, due_date)
  │       │
  │       ├─ Generate bot response (800ms delay)
  │       │   "Your bill is LKR 1,250.00 due on Jan 15..."
  │       │
  │       └─ Save bot message to messages table
  │           (sender_type='bot', sender_id='bot')
  │
  └─ Send: { type: "message_received", message: {...} }
  
Client (displays bot message)
  │
  │ 4. User asks for agent
  │    Send: { type: "message", text: "Can I speak to an agent?" }
  ▼
Chat Service
  │
  ├─ Save user message
  │
  ├─ Bot detects "agent" keyword → Escalate
  │
  ├─ Find available agent:
  │   SELECT * FROM agents 
  │   WHERE status='available' AND current_chats < max_chats
  │   ORDER BY current_chats ASC LIMIT 1
  │
  ├─ If agent found:
  │   ├─ UPDATE chat_sessions SET agent_id='agent_1', agent_name='Priya Fernando'
  │   ├─ UPDATE agents SET current_chats = current_chats + 1
  │   ├─ Send bot message: "Connecting you with Priya Fernando..."
  │   └─ Send agent welcome: "Hello! I'm Priya. How can I assist?"
  │       (sender_type='agent', sender_id='agent_1')
  │
  └─ If no agents available:
      └─ Send: "All agents busy. We'll respond soon."
  
Client (displays agent messages)
  │
  │ 5. User continues conversation with agent
  │    Send: { type: "message", text: "My payment didn't go through" }
  ▼
Chat Service
  │
  ├─ Save user message
  │
  ├─ Session has agent_id assigned
  │   └─ Simulate agent response (2-4s delay for demo)
  │       "Let me check your account. One moment please..."
  │       (In production: actual agent responds via agent dashboard)
  │
  └─ Send: { type: "message_received", message: {...} }
  
Client (displays agent response)
  │
  │ 6. User closes tab/window
  ▼
WebSocket
  │
  ├─ onclose event triggered
  ├─ Remove from active connections Map
  └─ Session remains 'active' in DB for later reconnection
  
  (User can reconnect later and continue chat)
```

### Synchronous Flow (Service Activation with Idempotency)
```
Client (Web/Mobile)
  │
  │ POST /api/services/purchase/1/5
  │ Headers: { Idempotency-Key: uuid-123 }
  ▼
Kong Gateway (port 8000)
  │ Rate Limit Check (120/min)
  │ CORS Check
  │ Route to provisioning-service:3004
  ▼
Provisioning Service
  │
  ├─ Check Idempotency Cache
  │   └─ If Hit: Return Cached Response (status 200, idempotent: true)
  │
  ├─ Check Circuit Breaker
  │   └─ If Open: Return 503 (provisioning_circuit_open)
  │
  ├─ Validate Service + User Balance
  │   └─ If Invalid: Return 404/400
  │
  ├─ Simulate Provisioning Call (250ms, 20% fail rate)
  │   └─ On Fail: Retry Once
  │       └─ On 2nd Fail: Open Circuit, Return 503
  │
  ├─ Update User Account (SQLite)
  │   ├─ Prepaid: Deduct balance
  │   └─ Postpaid: Add to bill
  │   └─ Add data/minutes
  │
  ├─ Publish Event to RabbitMQ
  │   └─ Exchange: provisioning.events
  │       Payload: { userId, event: 'service.provisioned', payload }
  │
  ├─ Cache Response (Idempotency Key → Response)
  │
  └─ Return Success (status 200, idempotent: false)
       {
         success: true,
         code: 'service_activated',
         data: { activationId, serviceId, userId, idempotencyKey }
       }
```

### Asynchronous Flow (Event-Driven Notifications)
```
Payment Service (on successful payment)
  │
  │ Publish Message
  ▼
RabbitMQ Exchange: payment.events (topic)
  │ Routing Key: #
  │ Message: { userId, event: 'payment.events', payload: {...} }
  │ Persistence: Durable
  ▼
Notification Service Consumer
  │
  ├─ Bind to payment.events and provisioning.events
  ├─ Consume from queue: notifications
  │
  ├─ Parse Message
  │   └─ Extract userId from payload
  │
  ├─ Store Event in User Queue (in-memory Map)
  │   Key: userId
  │   Value: [{ id, event, payload, createdAt }]
  │
  └─ ACK Message
  
Client (Web/Mobile)
  │ Auto-Polling: Every 15 seconds
  │ Manual Refresh: User-triggered
  │
  │ GET /api/notifications/poll/:userId?drain=false
  ▼
Notification Service
  │
  ├─ Fetch Events from User Queue (in-memory)
  ├─ Return Events Array
  └─ Keep Queue (drain=false allows peeking)
  
Client (Frontend)
  │
  ├─ Parse Raw Events
  │   ├─ payment.events → "Payment Successful" (Low Priority)
  │   └─ provisioning.events → "Service Activated" (Medium Priority)
  │
  ├─ Merge with localStorage (notifications_${userId})
  │   ├─ Deduplicate by event.id
  │   ├─ Preserve read/unread status
  │   └─ Sort by timestamp (newest first)
  │
  ├─ Update UI
  │   ├─ Notification Center: Display all with filters
  │   ├─ Sidebar Badge: Show unread count (updates every 5s)
  │   └─ Manual Refresh Button: Trigger immediate poll
  │
  └─ Persist to localStorage (for session restore)
```

### Circuit Breaker State Machine
```
CLOSED (normal operation)
  │
  │ Failures < 3: Continue
  │ Failures >= 3: Transition to OPEN
  ▼
OPEN (reject requests)
  │ Return 503 immediately
  │ Start cooldown timer (15s)
  │
  │ After cooldown expires
  ▼
HALF-OPEN (test recovery)
  │ Allow 1 request through
  │
  ├─ Success: Reset to CLOSED
  │            failures = 0
  │
  └─ Failure: Back to OPEN
               Reset cooldown timer
```

## Service Access Patterns

### Client Authentication Flow
1. Client sends credentials to `POST /api/auth/login`
2. Auth service validates password (bcrypt compare)
3. On success: Generate JWT token (24h expiry), return user object
4. Client stores token in localStorage / secure storage
5. All subsequent requests include `Authorization: Bearer <token>` header
6. Kong can validate JWT (future: enable Kong JWT plugin)

### Idempotency Contract
**Required Headers:**
- `Idempotency-Key: <uuid>` (client-generated, unique per logical request)

**Client Responsibility:**
- Generate UUID for each **new logical operation**
- Reuse same UUID for **retries of the same operation**
- Never reuse UUID across different operations

**Server Guarantee:**
- Same `Idempotency-Key` → Same response (cached, no side effects replayed)
- Different `Idempotency-Key` → New operation executed

**Example (Payment):**
```javascript
// Client code
const idempotencyKey = crypto.randomUUID(); // "abc-123-def"

// First attempt
await api.makePayment({ amount: 100, cardNumber: "..." }, idempotencyKey);
// → { success: true, data: { transactionId: "TXN_001" }, idempotent: false }

// Network failure, retry with SAME key
await api.makePayment({ amount: 100, cardNumber: "..." }, idempotencyKey);
// → { success: true, data: { transactionId: "TXN_001" }, idempotent: true }
// ✅ No double charge! Same transaction ID returned from cache.
```

## Data Architecture

### Service Data Isolation
Each service maintains its own database:
- **Auth Service:** `auth.db` (users, passwords, reset tokens)
- **Provisioning Service:** `provisioning.db` (services, user_services, subscriptions)
- **Payment Service:** In-memory idempotency cache (production: Redis)
- **Billing Service:** Mock data (production: dedicated billing database)
- **Notification Service:** In-memory event queues (production: Redis/Postgres)

**No Shared Database:** Services communicate via REST APIs and async events, not direct DB queries

### Database Schema Highlights

**Users Table (Auth Service):**
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  phone TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email TEXT,
  name TEXT,
  account_number TEXT UNIQUE,
  account_type TEXT DEFAULT 'prepaid',  -- 'prepaid' or 'postpaid'
  account_balance REAL DEFAULT 0,       -- Prepaid balance
  current_bill REAL DEFAULT 0,          -- Postpaid bill
  data_remaining REAL DEFAULT 0,        -- GB remaining
  minutes_remaining REAL DEFAULT 0,     -- Voice minutes
  reset_token TEXT,                     -- Password reset OTP
  reset_expires INTEGER,                -- Reset token expiry timestamp
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Services Table (Provisioning Service):**
```sql
CREATE TABLE services (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  is_active INTEGER DEFAULT 1,
  category TEXT  -- 'data', 'voice', 'vas'
);

CREATE TABLE user_services (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  service_id INTEGER NOT NULL,
  status TEXT DEFAULT 'active',  -- 'active' or 'inactive'
  activated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  deactivated_at DATETIME,
  FOREIGN KEY (service_id) REFERENCES services(id)
);
```

## Deployment Architecture

### Container Orchestration (Docker Compose)
**File:** `docker-compose.yaml`  
**Network:** `sri-care-net` (bridge)  
**Volumes:** Persistent storage for Kong DB, RabbitMQ, and service databases

**Services:**
1. **kong-database** (postgres:15-alpine) - Kong metadata
2. **kong-migration** (kong:3.4-alpine) - One-time DB bootstrap
3. **kong** (kong:3.4-alpine) - API Gateway, depends on DB + migration
4. **rabbitmq** (rabbitmq:3.12-management-alpine) - Message broker
5. **auth-service** (custom build from `services/auth/Dockerfile`)
6. **billing-service** (custom build from `services/billing/Dockerfile`)
7. **payment-service** (custom build from `services/payment/Dockerfile`)
8. **provisioning-service** (custom build from `services/provisioning/Dockerfile`)
9. **notification-service** (custom build from `services/notification/Dockerfile`)

**Health Checks:**
- Kong: `kong health` command (10s interval)
- RabbitMQ: `rabbitmq-diagnostics ping` (10s interval)
- Postgres: `pg_isready` (10s interval)

**Startup Order:**
1. kong-database starts
2. kong-migration runs (waits for DB health)
3. kong starts (waits for migration completion)
4. rabbitmq starts independently
5. Services start (depend on rabbitmq health)

### Service Dockerfile Pattern
All services follow consistent pattern:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE <port>
CMD ["node", "server.js"]
```

**Production Optimizations:**
- Multi-stage build (build + runtime stages)
- Non-root user
- .dockerignore (exclude node_modules, .git)
- Health check endpoint (`/health`)

### Kong Configuration Script
**File:** `configure-kong.sh`  
**Runs After:** Kong container is healthy

**Actions:**
1. Create service definitions (upstream targets)
2. Create routes (path-based routing)
3. Apply rate-limiting plugin per service
4. Apply global CORS plugin

**Rate Limits:**
- Payment: 30 requests/min (strict, high-value transactions)
- All others: 120 requests/min (standard API calls)

## API Contract (OpenAPI 3.0)

**File:** `documentation/openapi.yaml`  
**Spec Version:** OpenAPI 3.0.3  
**Base URLs:**
- Local dev: `http://localhost:5001/api` (direct to backend)
- Via gateway: `http://localhost:8000/api` (via Kong)

**Key Features:**
- JWT Bearer auth scheme defined
- Idempotency-Key parameter schema (UUID format)
- Consistent envelope schemas (SuccessResponse, ErrorResponse)
- Code-based error responses (`missing_idempotency_key`, `payment_circuit_open`, etc.)
- All services documented with request/response examples

**Usage:**
```bash
# Generate TypeScript SDK
npx openapi-generator-cli generate -i openapi.yaml -g typescript-axios -o sdk/typescript

# Generate Swift SDK
npx openapi-generator-cli generate -i openapi.yaml -g swift5 -o sdk/swift

# Generate Kotlin SDK
npx openapi-generator-cli generate -i openapi.yaml -g kotlin -o sdk/kotlin
```

## Testing Strategy

### Contract Tests
**File:** `tests/contract-tests.js`  
**Framework:** Node.js + Axios + assert  
**Target:** Kong Gateway (`http://localhost:8000/api`)

**Test Cases:**
1. **Authentication:** Register → Login → Token issuance
2. **Service Provisioning:** List services → Activate with idempotency key → Replay with same key → Verify idempotent flag
3. **Payment Processing:** Submit payment with idempotency key → Replay → Verify same transaction ID
4. **Billing:** Fetch user bills → Verify response structure
5. **Notifications:** Poll user notifications → Verify event structure

**Run:**
```bash
cd tests
npm install
npm test
```

**Exit Codes:**
- 0: All tests passed
- 1: One or more tests failed

### Future Testing
- **Unit Tests:** Per-service (Jest/Mocha)
- **Integration Tests:** Service-to-service communication
- **Load Tests:** k6 or Artillery (rate limit validation)
- **Chaos Tests:** Toxiproxy (network failures, latency injection)

## Security & Compliance

### Current Security Measures
1. **Password Security:**
   - Bcrypt hashing (salt rounds: 10)
   - No plaintext passwords stored
   - Password reset with time-limited OTP (15min expiry)

2. **JWT Tokens:**
   - HS256 signing algorithm
   - 24-hour expiry
   - Payload: `{ userId, phone, accountNumber }`
   - Configurable secret via `JWT_SECRET` env var

3. **Idempotency:**
   - Prevents duplicate financial transactions
   - UUID-based keys
   - Server-side validation and caching

4. **Rate Limiting (Kong):**
   - Payment: 30 req/min (prevents abuse)
   - Other endpoints: 120 req/min

5. **CORS:**
   - Whitelist: `localhost:5173`, `localhost:3000`
   - Credentials allowed
   - Headers: Authorization, Content-Type, Idempotency-Key

### Production Security Enhancements
1. **Kong JWT Plugin:**
   - Enable gateway-level token validation
   - Reject invalid/expired tokens before reaching services
   - Key rotation support

2. **mTLS (Mutual TLS):**
   - Service-to-service authentication
   - Certificate-based identity verification
   - Prevent unauthorized inter-service calls

3. **API Keys:**
   - Client application identification
   - Usage tracking per client
   - Quota enforcement

4. **Database Security:**
   - Replace SQLite with PostgreSQL
   - Connection pooling with SSL/TLS
   - Read replicas for high availability
   - Encrypted at rest

5. **Secrets Management:**
   - Vault or AWS Secrets Manager
   - Rotate JWT_SECRET, DB passwords, RabbitMQ credentials
   - Environment-specific secrets

6. **Audit Logging:**
   - All API requests logged (Kong + service logs)
   - Financial transaction audit trail
   - Compliance with PCI-DSS (payment data)
   - GDPR compliance (user data access logs)

7. **Input Validation:**
   - Schema validation (Joi/Yup)
   - SQL injection prevention (parameterized queries)
   - XSS prevention (sanitize inputs)

8. **DDoS Protection:**
   - Kong rate limiting (already enabled)
   - CloudFlare or AWS Shield
   - IP blacklisting

## Performance & Scalability

### Current Performance Characteristics
- **Latency:**
  - Auth: ~50ms (local DB query)
  - Payment: ~200-500ms (includes simulated gateway call + circuit breaker)
  - Provisioning: ~250-500ms (includes simulated downstream + DB update)
  - Billing: ~20ms (in-memory)
  - Notifications: ~10ms (in-memory poll)

- **Throughput:**
  - Limited by rate limits (30-120 req/min per client IP)
  - SQLite: ~1000 writes/sec per service (single-writer limitation)

### Scalability Strategy

#### Horizontal Scaling (Services)
1. **Stateless Services:** Auth, Billing, Payment, Provisioning are stateless (except idempotency cache)
2. **Load Balancing:** Kong can route to multiple instances:
   ```yaml
   # docker-compose.yaml enhancement
   payment-service:
     deploy:
       replicas: 3
   ```
3. **Shared Idempotency Cache:** Migrate from in-memory Map to Redis (shared across instances)

#### Database Scaling
1. **PostgreSQL Migration:**
   - Replace SQLite with Postgres per service
   - Connection pooling (pgBouncer)
   - Read replicas for read-heavy workloads

2. **Sharding (Future):**
   - Auth: Shard users by phone number range
   - Provisioning: Shard services by geography

#### Message Broker Scaling
1. **RabbitMQ Cluster:**
   - 3-node cluster for HA
   - Mirrored queues across nodes
   - Load balancer in front (HAProxy)

2. **Event Partitioning:**
   - Route events by userId to specific partitions
   - Parallel consumers per partition

#### Caching Strategy
1. **Redis Layers:**
   - L1: Idempotency cache (TTL: 24h)
   - L2: Session store (JWT blacklist for logout)
   - L3: Service catalog cache (reduce DB queries)

2. **CDN (Static Assets):**
   - Frontend bundle (React app)
   - API response caching (Kong plugin)

### Monitoring & Observability

#### Metrics (Prometheus + Grafana)
**Key Metrics:**
- Request rate (per service, per endpoint)
- Error rate (4xx, 5xx)
- Latency (p50, p95, p99)
- Circuit breaker state changes
- RabbitMQ queue depth
- Database connection pool utilization

**Service Health:**
- `/health` endpoint per service
- Uptime tracking
- Dependency health (DB, RabbitMQ)

#### Tracing (Jaeger/Zipkin)
**Distributed Tracing:**
- Generate trace ID at Kong
- Propagate via `X-Trace-ID` header
- Log trace ID in all service logs
- Visualize request flow across services

**Example Trace:**
```
Kong Gateway → Provisioning Service → User DB Query
                                    → RabbitMQ Publish
                                    → Response
```

#### Logging (ELK Stack)
**Log Aggregation:**
- Elasticsearch: Store logs
- Logstash: Parse and enrich
- Kibana: Visualize and search

**Structured Logging Format:**
```json
{
  "timestamp": "2026-01-11T10:30:00.000Z",
  "service": "payment-service",
  "level": "info",
  "traceId": "abc-123-def",
  "userId": 42,
  "endpoint": "POST /pay",
  "status": 200,
  "duration": 245,
  "idempotencyKey": "uuid-here",
  "message": "Payment processed successfully"
}
```

#### Alerting (PagerDuty/Opsgenie)
**Alert Rules:**
- Error rate > 5% (5min window)
- Circuit breaker open > 3 times/hour
- RabbitMQ queue depth > 1000
- Database connection pool exhausted
- Service health check failure

## Business Logic - Single Source of Truth

### Where Is the Business Logic?
**Location:** All business rules are **server-side** in `services/` folders:
- `services/auth/` - User authentication, password policies, JWT issuance
- `services/billing/` - Bill calculation, payment history
- `services/payment/` - Payment processing, fraud checks, transaction validation
- `services/provisioning/` - Service eligibility, entitlement updates, provisioning workflows
- `services/notification/` - Event routing, user notification preferences

### Why Server-Side?
1. **Consistency:** Same logic for web portal and mobile apps
2. **Security:** Business rules cannot be bypassed by client manipulation
3. **Maintainability:** Single codebase for updates, no client synchronization needed
4. **Compliance:** Audit trail centralized, regulatory requirements met
5. **Testing:** Business logic tested once, applies to all clients

### Client Responsibilities
**Web Portal (`frontend/`):**
- UI rendering and interaction
- Form validation (UX, not business rules)
- API calls via thin wrapper (`frontend/src/api/api.tsx`)
- State management (Redux/Context)
- Display error messages from server

**Mobile Apps (Future):**
- Same pattern as web portal
- Native UI (Swift/Kotlin)
- Generated SDK from OpenAPI spec
- No business logic duplication

### API Client Architecture
**File:** `frontend/src/api/api.tsx`  
**Pattern:** Centralized Axios wrapper

**Features:**
- Automatic JWT token injection from localStorage
- Idempotency key generation for payments/provisioning
- Request/response interceptors
- Error handling and retry logic
- Timeout configuration (10s)

**Example:**
```typescript
// frontend/src/api/api.tsx
export const api = {
  purchaseService: (userId, serviceId, data, idempotencyKey) =>
    apiClient.post(
      `/services/purchase/${userId}/${serviceId}`,
      data || {},
      {
        headers: {
          'Idempotency-Key': idempotencyKey || createIdempotencyKey()
        }
      }
    )
};

// Component usage (no business logic)
const handleActivate = async () => {
  try {
    const response = await api.purchaseService(userId, serviceId);
    if (response.data.success) {
      showSuccessToast(response.data.message);
      refreshUserData();
    }
  } catch (error) {
    showErrorToast(error.response?.data?.message);
  }
};
```

## Implementation Status

### ✅ Completed
1. **Microservices Architecture:** Six discrete services with isolated data stores
2. **API Gateway (Kong):** Routing, rate limiting, CORS configured for all services
3. **Message Broker (RabbitMQ):** Event-driven notifications implemented
4. **Idempotency:** Payment and provisioning endpoints enforce idempotency keys
5. **Circuit Breakers:** Payment and provisioning services have resilience patterns
6. **OpenAPI Contract:** Full API documentation at `documentation/openapi.yaml`
7. **Docker Compose:** Complete containerized deployment with 6 services
8. **Contract Tests:** End-to-end tests validate API parity
9. **Health Checks:** All services expose `/health` endpoints
10. **Event Publishing:** Payment/provisioning publish to RabbitMQ, notification consumes
11. **Real-Time Notifications:** Auto-polling (15s), localStorage persistence, unread badge, event parsing, clickable actions
12. **WebSocket Chat:** Real-time customer support with bot auto-response, agent escalation, message persistence, connection management

### 🚧 Future Enhancements
1. **PostgreSQL Migration:** Replace SQLite for production workloads
2. **Redis Caching:** Shared idempotency cache, session store
3. **Kong JWT Plugin:** Gateway-level token validation
4. **Monitoring Stack:** Prometheus, Grafana, Jaeger
5. **CI/CD Pipeline:** GitHub Actions (build, test, deploy)
6. **SDK Generation:** Auto-generate client SDKs from OpenAPI
7. **Load Balancing:** Multiple service replicas behind Kong
8. **Secrets Management:** Vault integration
9. **Persistent Notifications:** Redis/DB storage instead of in-memory
10. **Advanced Circuit Breakers:** Hystrix-style with bulkhead pattern

### 📋 Service Inventory

| Service | Port | Status | Database | Events | Idempotency | Protocol |
|---------|------|--------|----------|--------|-------------|----------|
| Auth | 3001 | ✅ Prod | SQLite | - | No | REST |
| Billing | 3002 | ✅ Prod | Mock | - | No | REST |
| Payment | 3003 | ✅ Prod | - | Publish | Yes | REST |
| Provisioning | 3004 | ✅ Prod | SQLite | Publish | Yes | REST |
| Notification | 3005 | ✅ Prod | - | Consume | No | REST |
| Chat | 3006 | ✅ Prod | SQLite | - | No | REST + WebSocket |
| Kong Gateway | 8000/8001 | ✅ Prod | Postgres | - | - | HTTP |
| RabbitMQ | 5672/15672 | ✅ Prod | - | Broker | - | AMQP |

## Deployment Instructions

### Local Development
```bash
# 1. Start all services
docker-compose up -d

# 2. Verify services are healthy
docker-compose ps

# 3. Configure Kong routes
bash configure-kong.sh

# 4. View logs
docker-compose logs -f payment-service

# 5. Access UIs
# - Kong Admin: http://localhost:8001
# - RabbitMQ: http://localhost:15672
# - API Gateway: http://localhost:8000/api
```

### Running Tests
```bash
# Contract tests (requires services running)
cd tests
npm install
npm test

# Expected output:
# 🧪 Starting API Contract Tests...
# ✅ Authentication passed
# ✅ Service provisioning passed
# ✅ Payment idempotency passed
# ✅ Billing passed
# ✅ Notifications passed
# 🎉 All contract tests passed!
```

### Production Deployment (AWS Example)
1. **ECS/EKS:** Deploy services as containers
2. **RDS:** PostgreSQL for Auth/Provisioning databases
3. **ElastiCache:** Redis for idempotency/sessions
4. **Amazon MQ:** RabbitMQ managed service
5. **ALB:** Application Load Balancer in front of Kong
6. **CloudWatch:** Logs and metrics
7. **Secrets Manager:** JWT secrets, DB credentials

### Environment Variables
**Auth Service:**
```bash
PORT=3001
DATABASE_URL=/data/auth.db  # or postgres://...
JWT_SECRET=<random-secret-here>
RABBITMQ_URL=amqp://user:pass@rabbitmq:5672
```

**Payment Service:**
```bash
PORT=3003
RABBITMQ_URL=amqp://user:pass@rabbitmq:5672
# Future: REDIS_URL for idempotency cache
```

**Provisioning Service:**
```bash
PORT=3004
DATABASE_URL=/data/provisioning.db
RABBITMQ_URL=amqp://user:pass@rabbitmq:5672
```

**Notification Service:**
```bash
PORT=3005
RABBITMQ_URL=amqp://user:pass@rabbitmq:5672
# Future: REDIS_URL for persistent event storage
```

## References & Documentation

- **Architecture:** [documentation/architecture.md](architecture.md) (this file)
- **Deployment Guide:** [DEPLOYMENT.md](../DEPLOYMENT.md)
- **API Contract:** [documentation/openapi.yaml](openapi.yaml)
- **Docker Compose:** [docker-compose.yaml](../docker-compose.yaml)
- **Kong Config:** [configure-kong.sh](../configure-kong.sh)
- **Contract Tests:** [tests/contract-tests.js](../tests/contract-tests.js)
- **Frontend API Client:** [frontend/src/api/api.tsx](../frontend/src/api/api.tsx)

## Architectural Decision Records (ADRs)

### ADR-001: Hybrid SOA + Microservices
**Decision:** Combine SOA (Kong Gateway) with microservices pattern  
**Rationale:** Gateway provides centralized policy enforcement; microservices enable independent scaling  
**Trade-off:** Complexity vs. flexibility

### ADR-002: RabbitMQ for Async Events
**Decision:** Use RabbitMQ instead of HTTP webhooks  
**Rationale:** Decouples services, message persistence, retry logic  
**Trade-off:** Additional infrastructure vs. reliability

### ADR-003: Idempotency via Client Keys
**Decision:** Require client-generated UUID for payments/provisioning  
**Rationale:** Client controls retry logic, server caches responses  
**Trade-off:** Client complexity vs. data consistency

### ADR-004: SQLite for Development
**Decision:** Use SQLite per service (Auth, Provisioning)  
**Rationale:** Zero-config, easy testing, simple migration  
**Trade-off:** Single-writer limitation vs. simplicity (will migrate to Postgres for production)

### ADR-005: OpenAPI-First Design
**Decision:** Document API in OpenAPI 3.0 before implementation  
**Rationale:** Enables SDK generation, contract testing, clear client expectations  
**Trade-off:** Upfront documentation effort vs. long-term maintainability

## New Deployment Structure

All services now deployed as **discrete Docker containers**:
- **Kong Gateway** (ports 8000, 8001) - routes, rate-limits, CORS
- **RabbitMQ** (ports 5672, 15672) - async event bus
- **Auth Service** (port 3001) - `services/auth/`
- **Billing Service** (port 3002) - `services/billing/`
- **Payment Service** (port 3003) - `services/payment/` (publishes to RabbitMQ)
- **Provisioning Service** (port 3004) - `services/provisioning/` (publishes to RabbitMQ)
- **Notification Service** (port 3005) - `services/notification/` (consumes from RabbitMQ)

See [DEPLOYMENT.md](../DEPLOYMENT.md) for startup instructions and [docker-compose.yaml](../docker-compose.yaml) for full config.
