const express = require('express');
const cors = require('cors');
const billingRoutes = require('./billingService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ service: 'billing', status: 'healthy', timestamp: new Date().toISOString() });
});

app.use('/', billingRoutes);

app.listen(PORT, () => {
  console.log(`✅ Billing Service running on port ${PORT}`);
});
