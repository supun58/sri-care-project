const express = require('express');
const router = express.Router();

router.post('/pay', (req, res) => {
  const { amount, cardNumber, billId } = req.body;
  
  // Simulate processing delay
  setTimeout(() => {
    res.json({
      success: true,
      transactionId: 'TXN_' + Date.now(),
      amount: amount,
      timestamp: new Date().toISOString(),
      message: 'Payment successful!'
    });
  }, 1500);
});

module.exports = router;