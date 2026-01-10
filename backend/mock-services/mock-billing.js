const express = require('express');
const router = express.Router();

// Mock bills
const bills = [
  { id: 1, userId: 1, amount: 2499.00, date: '2024-01-01', status: 'paid' },
  { id: 2, userId: 1, amount: 2750.50, date: '2024-02-01', status: 'pending' },
  { id: 3, userId: 1, amount: 2100.00, date: '2024-03-01', status: 'pending' }
];

router.get('/:userId', (req, res) => {
  res.json({ success: true, bills: bills });
});

router.get('/details/:billId', (req, res) => {
  const bill = bills.find(b => b.id == req.params.billId);
  res.json({ success: true, bill: bill || null });
});

module.exports = router;