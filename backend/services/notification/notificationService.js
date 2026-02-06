const express = require('express');
const router = express.Router();
const { queues } = require('./notificationConsumer');
const MAX_QUEUE_SIZE = 100; // Best effort: limit queue size per user to prevent memory overflow

const success = (code, message, data = {}) => ({ success: true, code, message, data });
const failure = (code, message, data = {}) => ({ success: false, code, message, data });

router.post('/publish', (req, res) => {
  const { userId, event, payload } = req.body;
  if (!userId || !event) {
    return res.status(400).json(failure('invalid_event', 'userId and event are required'));
  }
  
  const key = String(userId);
  const queue = queues.get(key) || [];
  
  // Best effort delivery: if queue is full, remove oldest notifications
  if (queue.length >= MAX_QUEUE_SIZE) {
    queue.shift(); // Remove oldest
    console.log(`⚠️  Queue full for user ${userId}, removed oldest notification (best effort)`);
  }
  
  queue.push({
    id: `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    event,
    payload,
    createdAt: new Date().toISOString()
  });
  queues.set(key, queue);
  
  res.json(success('event_accepted', 'Event accepted', { size: queues.get(key)?.length || 0 }));
});

router.get('/poll/:userId', (req, res) => {
  const { userId } = req.params;
  const drain = req.query.drain !== 'false';
  const key = String(userId);
  const events = queues.get(key) || [];
  if (drain) {
    queues.set(key, []);
  }
  res.json(success('events_ready', 'Events fetched', { events }));
});

// Health endpoint
router.get('/health', (req, res) => {
  const totalQueued = Array.from(queues.values()).reduce((sum, q) => sum + q.length, 0);
  res.json({ 
    service: 'notification', 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    stats: {
      activeUsers: queues.size,
      totalQueued,
      maxQueueSize: MAX_QUEUE_SIZE
    }
  });
});

module.exports = router;
