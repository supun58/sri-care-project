# SQLite Microservices Setup Guide

## Your Current Setup ✅

You're already using **SQLite** for your microservices, which is excellent for:
- ✅ Development and testing
- ✅ Lightweight deployments
- ✅ Easy containerization
- ✅ Simple data persistence

### Current Database Files per Service

```
services/
├── auth/
│   └── /data/auth.db          (SQLite database)
├── billing/
│   └── /data/billing.db       (SQLite database)
├── payment/
│   └── /data/payment.db       (SQLite database)
├── provisioning/
│   └── /data/provisioning.db  (SQLite database)
├── chat/
│   └── /data/chat.db          (SQLite database)
└── notification/              (No database needed)
```

---

## Docker Setup for SQLite

### Volume Mapping (Already Correct)

```yaml
auth-service:
  volumes:
    - auth-data:/data          # Persistent volume for auth.db

volumes:
  auth-data:                   # Named Docker volume
```

This ensures your SQLite databases persist even when containers restart.

---

## Database per Service Pattern with SQLite

Each service has **complete database independence**:

| Service | Database | Location | Features |
|---------|----------|----------|----------|
| **Auth** | `auth.db` | `/data/auth.db` | Users, JWT tokens |
| **Billing** | `billing.db` | `/data/billing.db` | Bills, invoices |
| **Payment** | `payment.db` | `/data/payment.db` | Transactions, payments |
| **Provisioning** | `provisioning.db` | `/data/provisioning.db` | Services, provisioning |
| **Chat** | `chat.db` | `/data/chat.db` | Messages, conversations |
| **Notification** | N/A | N/A | Queue-based (RabbitMQ) |

---

## Best Practices for SQLite in Microservices

### 1. Connection Management

```javascript
// Example: services/auth/db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DATABASE_URL || './data/auth.db';

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }
  console.log('Connected to SQLite database:', dbPath);
});

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

module.exports = db;
```

### 2. Health Check Endpoint

```javascript
// Add to each service (e.g., server.js)
app.get('/health', (req, res) => {
  db.get('SELECT 1', (err) => {
    if (err) {
      return res.status(503).json({ 
        status: 'unhealthy',
        database: 'disconnected'
      });
    }
    res.status(200).json({ 
      status: 'healthy',
      database: 'connected',
      service: 'auth-service'
    });
  });
});
```

### 3. Database Initialization

```javascript
// Create tables on startup
const initDatabase = (db) => {
  db.serialize(() => {
    // Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Add other tables...
  });
};

initDatabase(db);
```

### 4. Connection Pooling (Optional)

```javascript
// For better concurrency, use a connection pool
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');

let db;

async function getDb() {
  if (!db) {
    db = await open({
      filename: process.env.DATABASE_URL || './data/auth.db',
      driver: sqlite3.Database
    });
    await db.exec('PRAGMA foreign_keys = ON');
  }
  return db;
}

module.exports = { getDb };
```

---

## Production Deployment with SQLite

### Option 1: Single Server (Recommended for your case)

```bash
# On production server
cd /opt/sri-care
docker-compose -f docker-compose.prod.yml up -d

# Verify databases are created
docker-compose exec auth-service ls -la /data/
docker-compose exec billing-service ls -la /data/
```

### Option 2: Backup Strategy

```bash
#!/bin/bash
# backup-databases.sh

BACKUP_DIR="/opt/sri-care/backups"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# Backup each service database
docker-compose exec -T auth-service cp /data/auth.db /data/auth.db.backup
docker cp sri-care-project_auth-service_1:/data/auth.db.backup \
  $BACKUP_DIR/auth.db.$DATE

docker-compose exec -T billing-service cp /data/billing.db /data/billing.db.backup
docker cp sri-care-project_billing-service_1:/data/billing.db.backup \
  $BACKUP_DIR/billing.db.$DATE

echo "Databases backed up to $BACKUP_DIR"

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.db.*" -mtime +7 -delete
```

### Option 3: Automated Daily Backups

```yaml
# Add to crontab: crontab -e
0 2 * * * /opt/sri-care/backup-databases.sh

# Or use Docker container
backup-service:
  image: mcr.microsoft.com/windows/servercore:ltsc2022
  command: powershell -Command "while(1) { sleep 86400; /opt/sri-care/backup-databases.sh }"
```

---

## Scaling Considerations with SQLite

### ✅ What Works Well
- Single server deployment
- Development and testing
- Up to moderate traffic loads
- Easy backup and migration

### ⚠️ Limitations
- **Write contention**: SQLite locks during writes
- **Concurrent writes**: Can be slow with many simultaneous connections
- **Single server**: Not distributed

### If You Need to Scale Later

**Option A: Upgrade to PostgreSQL** (drop-in replacement)

```bash
# Install postgres driver
npm install pg

# Change connection string
DATABASE_URL=postgresql://user:pass@postgres:5432/auth_db
```

**Option B: Database Sharding** (advanced)

Shard by user ID across multiple SQLite databases:
- `auth-1.db` (users 1-1000)
- `auth-2.db` (users 1001-2000)

---

## Monitoring SQLite Databases

### Check Database Size

```bash
# Check individual service databases
docker-compose exec auth-service du -sh /data/auth.db
docker-compose exec billing-service du -sh /data/billing.db
docker-compose exec payment-service du -sh /data/payment.db

# Or get all sizes
docker-compose exec auth-service sh -c 'ls -lh /data/*.db'
```

### Database Health Check

```bash
# Verify database integrity
docker-compose exec auth-service sqlite3 /data/auth.db "PRAGMA integrity_check;"

# Optimize database
docker-compose exec auth-service sqlite3 /data/auth.db "VACUUM;"
```

### Log WAL (Write-Ahead Log)

```bash
# SQLite creates WAL files for performance
docker-compose exec auth-service ls -la /data/
# You'll see:
# auth.db       (main database)
# auth.db-wal   (write-ahead log)
# auth.db-shm   (shared memory)
```

---

## Environment Variables for SQLite

```bash
# .env (local development)
DATABASE_URL=./data/auth.db
PORT=3001
JWT_SECRET=dev-secret

# .env.prod (production)
DATABASE_URL=/data/auth.db          # Absolute path in container
PORT=3001
JWT_SECRET=production-secret-here
```

---

## Docker Compose Configuration for SQLite

**Your current setup is optimal**:

```yaml
auth-service:
  build:
    context: ./services/auth
    dockerfile: Dockerfile
  environment:
    PORT: 3001
    DATABASE_URL: /data/auth.db      # SQLite path
    JWT_SECRET: ${JWT_SECRET}
    RABBITMQ_URL: amqp://...
  volumes:
    - auth-data:/data                # Persistent volume
  networks:
    - sri-care-net

volumes:
  auth-data:                         # Named volume
```

---

## Database Backup & Restore

### Backup All Databases

```bash
# Create backup directory on production server
mkdir -p /opt/sri-care/backups

# Backup all service databases
docker-compose exec auth-service cp /data/auth.db /tmp/auth.db.backup
docker cp sri-care-project_auth-service_1:/tmp/auth.db.backup \
  /opt/sri-care/backups/auth.db.$(date +%Y%m%d_%H%M%S)
```

### Restore from Backup

```bash
# Stop services
docker-compose down

# Restore database
docker run -v auth-data:/data -v /opt/sri-care/backups:/backups \
  alpine sh -c "cp /backups/auth.db.20260206_120000 /data/auth.db"

# Restart services
docker-compose up -d
```

---

## SQLite-Specific Optimizations

### 1. Enable WAL Mode (Better Concurrency)

```javascript
db.run('PRAGMA journal_mode = WAL;', (err) => {
  if (!err) console.log('WAL mode enabled');
});
```

### 2. Optimize Cache Size

```javascript
db.run('PRAGMA cache_size = -64000;'); // 64MB cache
```

### 3. Synchronous Mode (Balance speed/safety)

```javascript
db.run('PRAGMA synchronous = NORMAL;'); // Or FULL for safety
```

### 4. Connection Timeout

```javascript
db.configure('busyTimeout', 5000); // 5 second timeout
```

---

## Database Separation Benefits

With your **database-per-service** approach:

✅ **Schema Independence**: Each service evolves independently
✅ **Data Ownership**: Clear responsibility for data
✅ **Easier Scaling**: When needed, upgrade individual services
✅ **Fault Isolation**: One DB issue doesn't affect others
✅ **Technology Freedom**: Can migrate one service to PostgreSQL later

---

## Next Steps

1. **Add health check endpoints** to each service (see above)
2. **Set up automated backups** using cron jobs
3. **Monitor database sizes** to detect growth issues
4. **Add database optimization** (VACUUM, analyze)
5. **Implement transactions** for multi-step operations

---

## SQLite Resources

- [SQLite Official Documentation](https://www.sqlite.org/docs.html)
- [SQLite Pragma Statements](https://www.sqlite.org/pragma.html)
- [SQLite Performance Tuning](https://www.sqlite.org/compile.html)
- [Node.js sqlite3 Module](https://github.com/mapbox/node-sqlite3)

---

## Summary

Your SQLite setup is **perfect for microservices** development and deployment. Each service has:
- ✅ Independent database file
- ✅ Persistent Docker volume
- ✅ Easy backup capability
- ✅ Zero external dependencies

The separation is clean and follows best practices. When (if) you need to scale to PostgreSQL, it's a straightforward migration since you already have the database-per-service pattern.
