const express = require('express');
const cors = require('cors');
const paymentRoutes = require('./paymentService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ service: 'payment', status: 'healthy', timestamp: new Date().toISOString() });
});

app.use('/', paymentRoutes);

app.listen(PORT, () => {
  console.log(`✅ Payment Service running on port ${PORT}`);
});
