# Quick Reference - Sri-Care Microservices

## Your Architecture Summary

### ✅ Separate Docker Containers
- Auth Service (Port 3001)
- Billing Service (Port 3002)
- Payment Service (Port 3003)
- Provisioning Service (Port 3004)
- Notification Service (Port 3005)
- Chat Service (Port 3006)
- Kong Gateway (Port 8000/8001)
- RabbitMQ (Port 5672/15672)

**Each runs in its own isolated container**

---

### ✅ Separate Databases (SQLite)
Each service has its **own SQLite database file**:

```
Volume          Container Path    Purpose
auth-data      → /data/auth.db           User authentication
billing-data   → /data/billing.db        Billing information
payment-data   → /data/payment.db        Payment transactions
provisioning-data → /data/provisioning.db Service provisioning
chat-data      → /data/chat.db           Chat messages
```

**No shared database. Complete data isolation.**

---

## Local Development

### Start All Services
```bash
docker-compose up -d
```

### View Logs
```bash
# All logs
docker-compose logs -f

# Specific service
docker-compose logs -f auth-service
```

### Stop All Services
```bash
docker-compose down
```

### Restart Specific Service
```bash
docker-compose restart auth-service
```

---

## Database Management

### Check Database Files
```bash
# See all databases in a service
docker-compose exec auth-service ls -la /data/

# Output:
# auth.db        (main database)
# auth.db-wal    (write-ahead log)
# auth.db-shm    (shared memory)
```

### Backup a Database
```bash
# Create backup directory
mkdir -p ./backups

# Backup specific database
docker-compose exec auth-service cp /data/auth.db /tmp/auth.db.backup
docker cp sri-care-project_auth-service_1:/tmp/auth.db.backup ./backups/auth.db.backup
```

### Check Database Integrity
```bash
docker-compose exec auth-service sqlite3 /data/auth.db "PRAGMA integrity_check;"
```

### Optimize Database
```bash
docker-compose exec auth-service sqlite3 /data/auth.db "VACUUM;"
```

---

## File Structure

```
sri-care-project/
├── services/
│   ├── auth/
│   │   ├── Dockerfile                    ← Container definition
│   │   ├── package.json                  ← Dependencies
│   │   ├── server.js                     ← Main application
│   │   └── db.js                         ← SQLite connection
│   │
│   ├── billing/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── server.js
│   │
│   ├── payment/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── server.js
│   │
│   ├── provisioning/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── server.js
│   │
│   ├── notification/
│   │   ├── Dockerfile
│   │   ├── package.json
│   │   └── server.js
│   │
│   └── chat/
│       ├── Dockerfile
│       ├── package.json
│       └── server.js
│
├── docker-compose.yaml                  ← Development setup
├── docker-compose.prod.yml              ← Production setup
├── .env.prod.example                    ← Production variables
├── MICROSERVICES_GUIDE.md               ← Detailed guide
├── SQLITE-GUIDE.md                      ← SQLite specifics
└── CI-CD-SETUP.md                       ← Pipeline setup
```

---

## Deployment

### Local Development & Production
```bash
# Start all services (same config for both)
docker-compose up -d

# Stop services
docker-compose down

# View status
docker-compose ps
```

### Environment Configuration
```bash
# Create .env file for your environment
cat > .env << EOF
PORT=3001
JWT_SECRET=your-secret-key
RABBITMQ_USER=sricare
RABBITMQ_PASSWORD=your-password
EOF

# Load in docker-compose
docker-compose --env-file .env up -d
```

---

## Service Communication

### Through Kong Gateway
```bash
# Register user (through gateway)
curl -X POST http://localhost:8000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "name": "John Doe"
  }'

# Get bills
curl http://localhost:8000/api/billing/bills
```

### Direct Service Connection (internal)
```bash
# Services can call each other directly
curl http://auth-service:3001/health
curl http://billing-service:3002/health
```

### Async via RabbitMQ
```
Payment Service → RabbitMQ → Notification Service
   (publishes)    (queue)      (consumes)
```

---

## Troubleshooting

### Service Won't Start
```bash
# Check logs
docker-compose logs auth-service

# Rebuild
docker-compose up -d --build auth-service
```

### Database Issues
```bash
# Check if databases exist
docker-compose exec auth-service ls -la /data/

# Verify integrity
docker-compose exec auth-service sqlite3 /data/auth.db "PRAGMA integrity_check;"
```

### Network Issues
```bash
# Test service connectivity
docker-compose exec auth-service ping billing-service
```

### Port Already in Use
```bash
# Find process using port
lsof -i :3001

# Kill the process
kill -9 <PID>
```

---

## Key Points

### Database Per Service
✅ Each service owns its own SQLite database
✅ Complete data isolation
✅ Independent schema evolution
✅ Easier to scale individual services

### Container Per Service
✅ Each service runs independently
✅ Isolated environment
✅ Easy to restart or upgrade
✅ Independent resource allocation

### Communication
✅ **Synchronous**: REST API through Kong Gateway
✅ **Asynchronous**: RabbitMQ for events
✅ **Internal**: Direct service-to-service via Docker network

---

## Documentation

📚 [MICROSERVICES_GUIDE.md](MICROSERVICES_GUIDE.md) - Complete architecture guide
📚 [SQLITE-GUIDE.md](SQLITE-GUIDE.md) - SQLite best practices
📚 [DEPLOYMENT.md](DEPLOYMENT.md) - Deployment instructions

---

**Your Sri-Care project is ready! ✅**

Requirements completed:
- ✅ Separate Docker containers per microservice
- ✅ Separate databases per service (SQLite)

````
