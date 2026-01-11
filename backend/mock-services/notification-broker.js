const express = require('express');
const router = express.Router();

const queues = new Map();

const success = (code, message, data = {}) => ({ success: true, code, message, data });
const failure = (code, message, data = {}) => ({ success: false, code, message, data });

function publishEvent({ userId, event, payload }) {
  if (!userId) return false;
  const queue = queues.get(userId) || [];
  queue.push({
    id: `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    event,
    payload,
    createdAt: new Date().toISOString()
  });
  queues.set(userId, queue);
  return true;
}

router.post('/publish', (req, res) => {
  const { userId, event, payload } = req.body;
  if (!userId || !event) {
    return res.status(400).json(failure('invalid_event', 'userId and event are required'));
  }
  publishEvent({ userId, event, payload });
  res.json(success('event_accepted', 'Event accepted', { size: queues.get(userId)?.length || 0 }));
});

router.get('/poll/:userId', (req, res) => {
  const { userId } = req.params;
  const drain = req.query.drain !== 'false';
  const events = queues.get(userId) || [];
  if (drain) {
    queues.set(userId, []);
  }
  res.json(success('events_ready', 'Events fetched', { events }));
});

module.exports = router;
module.exports.publishEvent = publishEvent;
