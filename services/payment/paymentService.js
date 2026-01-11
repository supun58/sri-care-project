const express = require('express');
const router = express.Router();
const { publishToQueue } = require('./rabbitmq');

const idempotencyStore = new Map();
const breaker = {
  state: 'closed',
  failures: 0,
  nextTry: 0,
  threshold: 3,
  coolOffMs: 15000
};

const success = (code, message, data = {}) => ({ success: true, code, message, data });
const failure = (code, message, data = {}) => ({ success: false, code, message, data });

function isCircuitOpen() {
  if (breaker.state !== 'open') return false;
  if (Date.now() >= breaker.nextTry) {
    breaker.state = 'half-open';
    return false;
  }
  return true;
}

function recordFailure() {
  breaker.failures += 1;
  if (breaker.failures >= breaker.threshold) {
    breaker.state = 'open';
    breaker.nextTry = Date.now() + breaker.coolOffMs;
  }
}

function recordSuccess() {
  breaker.state = 'closed';
  breaker.failures = 0;
}

function getIdempotencyKey(req) {
  return req.headers['idempotency-key'] || req.headers['idempotency_key'];
}

async function simulateBillingCall() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < 0.2) {
        return reject(new Error('Billing timeout'));
      }
      resolve(true);
    }, 200);
  });
}

router.post('/pay', async (req, res) => {
  const { amount, cardNumber, billId } = req.body;
  const idempotencyKey = getIdempotencyKey(req);

  if (!idempotencyKey) {
    return res.status(400).json(failure('missing_idempotency_key', 'Idempotency-Key header is required'));
  }

  if (idempotencyStore.has(idempotencyKey)) {
    const cached = idempotencyStore.get(idempotencyKey);
    return res.status(200).json({ ...cached, idempotent: true });
  }

  if (isCircuitOpen()) {
    return res.status(503).json(failure('payment_circuit_open', 'Payment processor temporarily unavailable, please retry'));
  }

  try {
    await simulateBillingCall();
    recordSuccess();
  } catch (err) {
    try {
      await simulateBillingCall();
      recordSuccess();
    } catch (retryErr) {
      recordFailure();
      return res.status(503).json(failure('payment_downstream_unavailable', 'Payment processor unavailable, please retry', { reason: retryErr.message }));
    }
  }

  const response = success('payment_processed', 'Payment processed successfully', {
    transactionId: 'TXN_' + Date.now(),
    amount,
    billId: billId || null,
    maskedCard: cardNumber ? `****${String(cardNumber).slice(-4)}` : undefined,
    status: 'processed',
    idempotencyKey
  });

  idempotencyStore.set(idempotencyKey, response);
  
  // Publish to RabbitMQ
  publishToQueue('payment.events', {
    userId: req.user?.id || null,
    event: 'payment.succeeded',
    payload: response.data
  }).catch(console.error);

  res.status(200).json(response);
});

module.exports = router;