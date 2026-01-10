const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Sri-Care Backend API' });
});

// Mock routes
app.use('/api/auth', require('./mock-services/authService'));
app.use('/api/billing', require('./mock-services/mock-billing'));
app.use('/api/services', require('./mock-services/mock-services'));
app.use('/api/payment', require('./mock-services/mock-payment'));

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!', timestamp: new Date() });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


