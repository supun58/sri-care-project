# Sri-Care Microservices Architecture

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Web Browser  │  │ Mobile App   │  │ Third Party  │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                  │                  │                       │
└─────────┼──────────────────┼──────────────────┼───────────────────────┘
          │                  │                  │
          └──────────────────┴──────────────────┘
                             │
                    HTTP/HTTPS Requests
                             │
          ┌──────────────────▼──────────────────┐
          │      Kong API Gateway (Port 8000)   │
          │  • Routing                          │
          │  • Rate Limiting                    │
          │  • CORS                             │
          │  • Authentication                   │
          └──────────────────┬──────────────────┘
                             │
          ┌──────────────────┴──────────────────┐
          │                                     │
          │     Service Discovery & Routing     │
          │                                     │
    ┌─────┴─────┬─────┬─────┬─────┬─────┬─────┴─────┐
    │           │     │     │     │     │           │
┌───▼────┐ ┌───▼────┐│┌───▼────┐│┌───▼────┐│┌───▼────┐│┌───▼────┐
│  Auth  │ │Billing││ │Payment││ │Provision││ │Notify ││ │ Chat  │
│Service │ │Service││ │Service││ │ Service││ │Service││ │Service│
│:3001   │ │:3002  ││ │:3003  ││ │ :3004  ││ │:3005  ││ │:3006  │
└───┬────┘ └───┬───┘│ └───┬───┘│ └───┬────┘│ └───┬───┘│ └───┬────┘
    │          │    │     │    │     │     │     │    │     │
    │  ┌───────┴────┴─────┴────┴─────┴─────┴─────┴────┘     │
    │  │                                                      │
┌───▼──▼──────────────────────────────────────────────┐      │
│          RabbitMQ Message Broker (:5672)            │      │
│  • Async Communication                              │      │
│  • Event Publishing/Subscribing                     │      │
│  • Payment Events → Notification Consumer           │      │
│  • Provisioning Events → Notification Consumer      │      │
└─────────────────────────────────────────────────────┘      │
                                                             │
┌────────────────────────────────────────────────────────────┴──────┐
│                        DATA LAYER                                  │
│                                                                    │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐│
│  │ auth.db │  │billing  │  │payment  │  │provision│  │ chat.db ││
│  │ (SQLite)│  │.db      │  │.db      │  │.db      │  │         ││
│  │         │  │(SQLite) │  │(SQLite) │  │(SQLite) │  │(SQLite) ││
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘  └─────────┘│
│                                                                    │
│     Each service has its OWN database (Database per Service)      │
└────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────┐
│                    INFRASTRUCTURE LAYER                            │
│                                                                    │
│  ┌──────────────┐          ┌──────────────┐                      │
│  │Kong Database │          │Docker Network│                      │
│  │(PostgreSQL)  │          │sri-care-net  │                      │
│  └──────────────┘          └──────────────┘                      │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │           Docker Volumes (Persistent Storage)              │ │
│  │  • auth-data    • billing-data    • payment-data           │ │
│  │  • provisioning-data  • chat-data  • kong-db               │ │
│  │  • rabbitmq-data                                           │ │
│  └─────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────────┘
```

## Service Communication Patterns

### Synchronous (REST API)
```
Client → Kong Gateway → Service → Response
```

### Asynchronous (Message Queue)
```
Service A → Publish to RabbitMQ → Service B Consumes
```

### Example Flow: User Registration
```
1. Client → POST /api/auth/register
2. Kong → Auth Service
3. Auth Service → Creates user in auth.db
4. Auth Service → Publishes "user.created" event to RabbitMQ
5. Notification Service → Consumes event
6. Notification Service → Sends welcome email
7. Auth Service → Returns JWT token to client
```

### Example Flow: Payment Processing
```
1. Client → POST /api/payment/process
2. Kong → Payment Service
3. Payment Service → Processes payment
4. Payment Service → Stores in payment.db
5. Payment Service → Publishes "payment.completed" event
6. Provisioning Service → Consumes event → Provisions service
7. Notification Service → Consumes event → Sends confirmation
8. Billing Service → Updates invoice status
```

## Deployment Architecture

### Development (Local)
```
docker-compose.yaml
  └─ Builds images from source
  └─ Uses local SQLite databases
  └─ All services on same network
```

### Production
```
docker-compose.prod.yml
  └─ Pulls pre-built images from registry
  └─ Uses environment variables from .env.prod
  └─ Health checks enabled
  └─ Automatic restart policies
```

### CI/CD Pipeline
```
┌──────────────┐
│ Code Change  │
│ (git push)   │
└──────┬───────┘
       │
┌──────▼───────────────────────────────────────┐
│  GitHub Actions / GitLab CI / Jenkins        │
└──────┬───────────────────────────────────────┘
       │
┌──────▼────────┐
│  1. Test      │  ← npm test
│  2. Build     │  ← docker build
│  3. Push      │  ← docker push to registry
│  4. Deploy    │  ← SSH to prod + docker-compose up
└───────────────┘
```

## Service Independence Matrix

| Aspect              | Auth | Billing | Payment | Provision | Notify | Chat |
|---------------------|------|---------|---------|-----------|--------|------|
| Own Dockerfile      | ✅   | ✅      | ✅      | ✅        | ✅     | ✅   |
| Own Database        | ✅   | ✅      | ✅      | ✅        | ❌     | ✅   |
| Own Package.json    | ✅   | ✅      | ✅      | ✅        | ✅     | ✅   |
| CI/CD Pipeline      | ✅   | ✅      | ✅      | ✅        | ✅     | ✅   |
| Independent Deploy  | ✅   | ✅      | ✅      | ✅        | ✅     | ✅   |
| Health Endpoint     | ⚠️   | ⚠️      | ⚠️      | ⚠️        | ⚠️     | ⚠️   |

✅ = Implemented  
⚠️ = To be implemented  
❌ = Not applicable

## Technology Stack

### Backend Services
- **Runtime**: Node.js 20
- **Framework**: Express.js
- **Database**: SQLite (dev), PostgreSQL (prod recommended)
- **Authentication**: JWT
- **Message Queue**: RabbitMQ

### Infrastructure
- **API Gateway**: Kong 3.4
- **Container**: Docker
- **Orchestration**: Docker Compose (dev), Kubernetes (prod optional)
- **CI/CD**: GitHub Actions

### Monitoring (To be added)
- **Metrics**: Prometheus
- **Visualization**: Grafana
- **Logging**: ELK Stack
- **Tracing**: Jaeger

## Port Mapping

| Service        | Port | Protocol | Access      |
|----------------|------|----------|-------------|
| Kong Proxy     | 8000 | HTTP     | Public      |
| Kong Admin     | 8001 | HTTP     | Internal    |
| Auth Service   | 3001 | HTTP     | Internal    |
| Billing        | 3002 | HTTP     | Internal    |
| Payment        | 3003 | HTTP     | Internal    |
| Provisioning   | 3004 | HTTP     | Internal    |
| Notification   | 3005 | HTTP     | Internal    |
| Chat (REST)    | 3006 | HTTP     | Internal    |
| Chat (WebSocket)| 3006| WebSocket| Public      |
| RabbitMQ       | 5672 | AMQP     | Internal    |
| RabbitMQ UI    | 15672| HTTP     | Internal    |

## Scaling Strategy

### Horizontal Scaling (Multiple Instances)
```bash
# Scale auth service to 3 instances
docker-compose up -d --scale auth-service=3
```

### Vertical Scaling (More Resources)
```yaml
# docker-compose.yml
services:
  auth-service:
    deploy:
      resources:
        limits:
          cpus: '0.50'
          memory: 512M
```

### Database Scaling
- **Read Replicas**: For read-heavy services
- **Sharding**: For data distribution
- **Caching**: Redis for frequently accessed data

## Security Best Practices

1. **Secrets Management**
   - Use environment variables
   - Never commit secrets to Git
   - Use Docker secrets in production

2. **Network Isolation**
   - Services communicate via internal network
   - Only Kong and WebSocket exposed publicly

3. **Authentication**
   - JWT tokens for stateless auth
   - Token expiration and refresh

4. **API Gateway**
   - Rate limiting
   - CORS configuration
   - Request validation

## Quick Commands Reference

```bash
# Development
docker-compose up -d                    # Start all services
docker-compose logs -f auth-service     # View logs
docker-compose restart auth-service     # Restart service
docker-compose down -v                  # Stop and remove all

# Production
docker-compose -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml ps

# Individual Service
docker-compose up -d --build auth-service
docker-compose exec auth-service sh

# Health Check
curl http://localhost:3001/health
```
