# Microservices Architecture Guide - Sri-Care Project

## Overview

Your Sri-Care project implements a microservices architecture with:
- ✅ **6 separate microservices** (Auth, Billing, Payment, Provisioning, Notification, Chat)
- ✅ **Separate Docker containers** per service
- ✅ **Separate databases** per service (SQLite)
- ✅ **API Gateway** (Kong)
- ✅ **Message Broker** (RabbitMQ)

This guide covers the implemented microservices architecture.

---

## 1. Separate Docker Containers Per Microservice

### Current Status: ✅ IMPLEMENTED

Each service has its own Dockerfile and runs in an isolated container:

```
services/
├── auth/Dockerfile
├── billing/Dockerfile
├── payment/Dockerfile
├── provisioning/Dockerfile
├── notification/Dockerfile
└── chat/Dockerfile
```

### How It Works

**Example: Auth Service Dockerfile**
```dockerfile
FROM node:20-alpine          # Lightweight base image
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production # Install dependencies
COPY . .
EXPOSE 3001
CMD ["node", "server.js"]
```

### Key Benefits
- **Isolation**: Each service runs independently
- **Scalability**: Scale services individually
- **Technology Freedom**: Different services can use different tech stacks
- **Fault Isolation**: One service crash doesn't affect others

### Building Individual Containers

```bash
# Build a specific service
docker build -t sri-care-auth ./services/auth
docker build -t sri-care-billing ./services/billing

# Or build all via docker-compose
docker-compose build
```

### Running Individual Containers

```bash
# Run auth service independently
docker run -p 3001:3001 \
  -e PORT=3001 \
  -e JWT_SECRET=your-secret \
  -e DATABASE_URL=/data/auth.db \
  sri-care-auth
```

---

## 2. Separate Databases Per Service

### Current Status: ✅ IMPLEMENTED

Each service has its **own isolated database** following the "Database per Service" pattern.

### Current Database Setup

| Service | Database | Location | Type |
|---------|----------|----------|------|
| Auth | `auth.db` | `/data/auth.db` | SQLite |
| Billing | `billing.db` | `/data/billing.db` | SQLite |
| Payment | `payment.db` | `/data/payment.db` | SQLite |
| Provisioning | `provisioning.db` | `/data/provisioning.db` | SQLite |
| Chat | `chat.db` | `/data/chat.db` | SQLite |
| Kong Gateway | PostgreSQL | `kong-database` | PostgreSQL |

### Docker Volume Mapping

```yaml
# docker-compose.yaml
services:
  auth-service:
    volumes:
      - auth-data:/data      # Persistent storage for auth.db
  billing-service:
    volumes:
      - billing-data:/data   # Persistent storage for billing.db

volumes:
  auth-data:     # Named volume for auth database
  billing-data:  # Named volume for billing database
  # ... etc
```

### Key Benefits
- **Data Isolation**: Services don't share database tables
- **Independent Schema Evolution**: Change one DB without affecting others
- **Technology Flexibility**: Each service can use different DB engines
- **Scalability**: Scale databases independently

### Upgrading to Production Databases

For production, consider upgrading from SQLite to dedicated database containers:

#### Option 1: PostgreSQL per Service (Recommended)

```yaml
# Enhanced docker-compose.yaml
services:
  # Auth Service with PostgreSQL
  auth-db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: auth_user
      POSTGRES_PASSWORD: auth_password
      POSTGRES_DB: auth_db
    volumes:
      - auth-postgres-data:/var/lib/postgresql/data
    networks:
      - sri-care-net

  auth-service:
    environment:
      DATABASE_URL: postgresql://auth_user:auth_password@auth-db:5432/auth_db
    depends_on:
      - auth-db

  # Billing Service with PostgreSQL
  billing-db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: billing_user
      POSTGRES_PASSWORD: billing_password
      POSTGRES_DB: billing_db
    volumes:
      - billing-postgres-data:/var/lib/postgresql/data
    networks:
      - sri-care-net

  billing-service:
    environment:
      DATABASE_URL: postgresql://billing_user:billing_password@billing-db:5432/billing_db
    depends_on:
      - billing-db
```

#### Option 2: MongoDB for Specific Services

```yaml
  chat-db:
    image: mongo:7-alpine
    environment:
      MONGO_INITDB_ROOT_USERNAME: chat_admin
      MONGO_INITDB_ROOT_PASSWORD: chat_password
    volumes:
      - chat-mongo-data:/data/db
    networks:
      - sri-care-net

  chat-service:
    environment:
      DATABASE_URL: mongodb://chat_admin:chat_password@chat-db:27017/chat_db
```

---

## 3. Production Deployment

### Docker Compose Production Setup

```bash
# Pull latest images
docker-compose -f docker-compose.prod.yml pull

# Start all services
docker-compose -f docker-compose.prod.yml up -d

# Verify services are running
docker-compose -f docker-compose.prod.yml ps
```

### Build Production Images

```bash
# Build all service images
docker-compose build --no-cache

# Build specific service
docker build -t sri-care-auth:latest ./services/auth

# Tag for registry
docker tag sri-care-auth:latest your-registry.com/sri-care-auth:v1.0.0

# Push to registry
docker push your-registry.com/sri-care-auth:v1.0.0
```

---

## 4. Quick Start Commands

### Add Health Checks to Each Service

**Example: Add to `services/auth/server.js`**

```javascript
// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    service: 'auth-service',
    timestamp: new Date().toISOString()
  });
});

// Readiness check endpoint
app.get('/ready', async (req, res) => {
  try {
    // Check database connection
    await db.get('SELECT 1');
    res.status(200).json({ 
      status: 'ready',
      database: 'connected'
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'not ready',
      database: 'disconnected'
    });
  }
});
```

### Docker Compose Health Checks

Already implemented in your `docker-compose.yaml`:

```yaml
services:
  auth-service:
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

---

### ✅ What You're Already Doing Right

1. **Service Isolation**: Each service has its own codebase and Dockerfile
2. **Database Separation**: Each service has its own database
3. **API Gateway**: Kong handles routing and cross-cutting concerns
4. **Message Broker**: RabbitMQ for async communication
5. **Docker Volumes**: Persistent storage for databases
6. **Network Isolation**: Custom Docker network for service communication

---

## 5. Recommended Next Steps (Optional)

### Local Development

```bash
# Start all services
docker-compose up -d

# View logs for specific service
docker-compose logs -f auth-service

# Restart specific service
docker-compose restart auth-service

# Rebuild and restart specific service
docker-compose up -d --build auth-service

# Stop all services
docker-compose down

# Stop and remove volumes (fresh start)
docker-compose down -v
```

### Production Deployment

```bash
# Build production images
docker-compose build --no-cache

# Tag images for registry
docker tag sri-care-auth:latest your-registry.com/sri-care-auth:v1.0.0

# Push to registry
docker push your-registry.com/sri-care-auth:v1.0.0

# Deploy on production server
docker-compose -f docker-compose.prod.yml up -d
```

---

## 7. Architecture Checklist

### ✅ Completed Requirements

- [x] Separate Docker containers per microservice
- [x] Separate databases per service (SQLite)
- [x] Kong API Gateway for routing
- [x] RabbitMQ for async communication
- [x] Docker volumes for data persistence
- [x] Custom Docker network for service communication

### Service Independence

- [x] Each service has its own Git directory
- [x] Each service has its own Dockerfile
- [x] Each service has its own package.json
- [x] Each service has its own database
- [x] Each service can be built independently
- [x] Each service can be deployed independently
- [x] Each service exposes its own API

---

## 8. Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Kong Gateway Documentation](https://docs.konghq.com/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
- [Microservices Patterns](https://microservices.io/patterns/index.html)
- [The Twelve-Factor App](https://12factor.net/)

---

**Your Sri-Care project is complete!** ✅

All required microservices features are implemented:
- ✅ Separate Docker containers per microservice
- ✅ Separate databases per service
