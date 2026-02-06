const express = require('express');
const cors = require('cors');
const { startConsumer } = require('./notificationConsumer');
const notificationRoutes = require('./notificationService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3005;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ service: 'notification', status: 'healthy', timestamp: new Date().toISOString() });
});

app.use('/', notificationRoutes);

// Start consuming from RabbitMQ
startConsumer();

app.listen(PORT, () => {
  console.log(`✅ Notification Service running on port ${PORT}`);
});
