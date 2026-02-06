const express = require('express');
const cors = require('cors');
const http = require('http');
const { createProxyMiddleware } = require('http-proxy-middleware');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors());

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Sri-Care Backend API Gateway' });
});

// Service targets (override with env as needed)
const serviceTargets = {
  auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
  billing: process.env.BILLING_SERVICE_URL || 'http://localhost:3002',
  payment: process.env.PAYMENT_SERVICE_URL || 'http://localhost:3003',
  provisioning: process.env.PROVISIONING_SERVICE_URL || 'http://localhost:3004',
  notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005',
  chat: process.env.CHAT_SERVICE_URL || 'http://localhost:3006'
};

const createServiceProxy = (target) =>
  createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite: (path) => path.replace(/^\/api\/[^/]+/, ''),
    proxyTimeout: 20000,
    timeout: 20000
  });

app.use('/api/auth', createServiceProxy(serviceTargets.auth));
app.use('/api/billing', createServiceProxy(serviceTargets.billing));
app.use('/api/payment', createServiceProxy(serviceTargets.payment));
app.use('/api/provisioning', createServiceProxy(serviceTargets.provisioning));
app.use('/api/notifications', createServiceProxy(serviceTargets.notification));

// Chat proxy (HTTP + WebSocket)
const chatProxy = createProxyMiddleware({
  target: serviceTargets.chat,
  changeOrigin: true,
  ws: true,
  pathRewrite: (path) => path.replace(/^\/api\/chat/, ''),
  proxyTimeout: 20000,
  timeout: 20000
});
app.use('/api/chat', chatProxy);
server.on('upgrade', chatProxy.upgrade);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Sri-Care Backend API Gateway running on port ${PORT}`);
});
