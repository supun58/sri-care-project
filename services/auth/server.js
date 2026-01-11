const express = require('express');
const cors = require('cors');
const authRoutes = require('./authService');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ service: 'auth', status: 'healthy', timestamp: new Date().toISOString() });
});

app.use('/', authRoutes);

app.listen(PORT, () => {
  console.log(`✅ Auth Service running on port ${PORT}`);
});
