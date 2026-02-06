#!/bin/bash
# Kong Gateway Configuration Script
# Run after Kong is up: ./configure-kong.sh

KONG_ADMIN="http://localhost:8001"

echo "🔧 Configuring Kong Gateway..."

# Auth Service
echo "📝 Adding Auth Service..."
curl -i -X POST $KONG_ADMIN/services \
  --data name=auth-service \
  --data url=http://auth-service:3001

curl -i -X POST $KONG_ADMIN/services/auth-service/routes \
  --data 'paths[]=/api/auth' \
  --data name=auth-route

curl -i -X POST $KONG_ADMIN/services/auth-service/plugins \
  --data name=rate-limiting \
  --data config.minute=120 \
  --data config.policy=local

# Billing Service
echo "📝 Adding Billing Service..."
curl -i -X POST $KONG_ADMIN/services \
  --data name=billing-service \
  --data url=http://billing-service:3002

curl -i -X POST $KONG_ADMIN/services/billing-service/routes \
  --data 'paths[]=/api/billing' \
  --data name=billing-route

curl -i -X POST $KONG_ADMIN/services/billing-service/plugins \
  --data name=rate-limiting \
  --data config.minute=120 \
  --data config.policy=local

# Payment Service (strict rate limit)
echo "📝 Adding Payment Service..."
curl -i -X POST $KONG_ADMIN/services \
  --data name=payment-service \
  --data url=http://payment-service:3003

curl -i -X POST $KONG_ADMIN/services/payment-service/routes \
  --data 'paths[]=/api/payment' \
  --data name=payment-route

curl -i -X POST $KONG_ADMIN/services/payment-service/plugins \
  --data name=rate-limiting \
  --data config.minute=30 \
  --data config.policy=local

# Provisioning Service
echo "📝 Adding Provisioning Service..."
curl -i -X POST $KONG_ADMIN/services \
  --data name=provisioning-service \
  --data url=http://provisioning-service:3004

curl -i -X POST $KONG_ADMIN/services/provisioning-service/routes \
  --data 'paths[]=/api/services' \
  --data name=provisioning-route

curl -i -X POST $KONG_ADMIN/services/provisioning-service/plugins \
  --data name=rate-limiting \
  --data config.minute=120 \
  --data config.policy=local

# Notification Service
echo "📝 Adding Notification Service..."
curl -i -X POST $KONG_ADMIN/services \
  --data name=notification-service \
  --data url=http://notification-service:3005

curl -i -X POST $KONG_ADMIN/services/notification-service/routes \
  --data 'paths[]=/api/notifications' \
  --data name=notification-route

curl -i -X POST $KONG_ADMIN/services/notification-service/plugins \
  --data name=rate-limiting \
  --data config.minute=120 \
  --data config.policy=local

# Chat Service (REST API only, WebSocket bypasses Kong for now)
echo "📝 Adding Chat Service..."
curl -i -X POST $KONG_ADMIN/services \
  --data name=chat-service \
  --data url=http://chat-service:3006

curl -i -X POST $KONG_ADMIN/services/chat-service/routes \
  --data 'paths[]=/api/chat' \
  --data name=chat-route

curl -i -X POST $KONG_ADMIN/services/chat-service/plugins \
  --data name=rate-limiting \
  --data config.minute=120 \
  --data config.policy=local

# Global CORS
echo "📝 Adding Global CORS..."
curl -i -X POST $KONG_ADMIN/plugins \
  --data name=cors \
  --data config.origins=http://localhost:5173,http://localhost:3000,http://localhost:5174 \
  --data config.methods=GET,POST,PUT,DELETE,OPTIONS \
  --data config.headers=Authorization,Content-Type,Idempotency-Key \
  --data config.credentials=true

echo "✅ Kong configuration complete!"
echo "Gateway available at: http://localhost:8000/api"
echo "Chat WebSocket at: ws://localhost:3006 (direct connection)"
echo "Admin API at: http://localhost:8001"
