const express = require('express');
const cors = require('cors');
const provisioningRoutes = require('./provisioningService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3004;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ service: 'provisioning', status: 'healthy', timestamp: new Date().toISOString() });
});

app.use('/', provisioningRoutes);

app.listen(PORT, () => {
  console.log(`✅ Provisioning Service running on port ${PORT}`);
});
