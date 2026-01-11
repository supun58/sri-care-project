const express = require('express');
const router = express.Router();
const db = require('./db');
const User = require('./user');
const { publishToQueue } = require('./rabbitmq');

const idempotencyStore = new Map();
const breaker = {
  state: 'closed',
  failures: 0,
  threshold: 3,
  nextTry: 0,
  coolOffMs: 15000
};

const success = (code, message, data = {}) => ({ success: true, code, message, data });
const failure = (code, message, data = {}) => ({ success: false, code, message, data });

function getIdempotencyKey(req) {
  return req.headers['idempotency-key'] || req.headers['idempotency_key'];
}

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

async function simulateProvisioningCall() {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() < 0.2) {
        return reject(new Error('Provisioning timeout'));
      }
      resolve(true);
    }, 250);
  });
}

// Get all available services
router.get('/', (req, res) => {
  const sql = `SELECT * FROM services WHERE is_active = 1`;
  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json(failure('services_db_error', 'Database error'));
    }
    const response = success('services_list', 'Services fetched', { services: rows || [] });
    res.json({ ...response, services: response.data.services });
  });
});

// Get user's subscribed services
router.get('/user/:userId', (req, res) => {
  const { userId } = req.params;
  
  const sql = `
    SELECT 
      us.id,
      us.service_id,
      us.user_id,
      us.status,
      us.activated_at,
      s.name as service_name,
      s.description,
      s.price
    FROM user_services us
    JOIN services s ON us.service_id = s.id
    WHERE us.user_id = ?
    ORDER BY us.activated_at DESC
  `;
  
  db.all(sql, [userId], (err, rows) => {
    if (err) {
      return res.status(500).json(failure('services_db_error', 'Database error'));
    }
    const response = success('user_services', 'User services fetched', { services: rows || [] });
    res.json({ ...response, services: response.data.services });
  });
});

// Purchase/Activate a service for user
router.post('/purchase/:userId/:serviceId', async (req, res) => {
  const { userId, serviceId } = req.params;
  const idempotencyKey = getIdempotencyKey(req);

  if (!idempotencyKey) {
    return res.status(400).json(failure('missing_idempotency_key', 'Idempotency-Key header is required'));
  }

  if (idempotencyStore.has(idempotencyKey)) {
    return res.json({ ...idempotencyStore.get(idempotencyKey), idempotent: true });
  }

  if (isCircuitOpen()) {
    return res.status(503).json(failure('provisioning_circuit_open', 'Provisioning temporarily unavailable, please retry'));
  }
  
  // First check if service exists
  const serviceCheckSql = `SELECT price FROM services WHERE id = ?`;
  db.get(serviceCheckSql, [serviceId], (err, service) => {
    if (err || !service) {
      return res.status(404).json(failure('service_not_found', 'Service not found'));
    }

    // Check if user already has this service
    const checkSql = `SELECT id FROM user_services WHERE user_id = ? AND service_id = ?`;
    db.get(checkSql, [userId, serviceId], (err, existing) => {
      if (existing) {
        const updateSql = `
          UPDATE user_services 
          SET status = 'active', activated_at = CURRENT_TIMESTAMP 
          WHERE user_id = ? AND service_id = ?
        `;
        db.run(updateSql, [userId, serviceId], async function(err) {
          if (err) {
            return res.status(500).json(failure('service_update_error', 'Error updating service'));
          }

          try {
            await simulateProvisioningCall();
            recordSuccess();
          } catch (e) {
            try {
              await simulateProvisioningCall();
              recordSuccess();
            } catch (retryErr) {
              recordFailure();
              return res.status(503).json(failure('provisioning_unavailable', 'Provisioning unavailable, please retry', { reason: retryErr.message }));
            }
          }

          updateUserAccountForService(userId, serviceId, service.price, (updateErr) => {
            if (updateErr) {
              return res.status(500).json(failure('account_update_error', updateErr.message));
            }

            const response = success('service_activated', 'Service activated successfully', {
              activationId: 'ACT_' + Date.now(),
              serviceId,
              userId,
              idempotencyKey
            });
            idempotencyStore.set(idempotencyKey, response);
            
            publishToQueue('provisioning.events', {
              userId,
              event: 'service.provisioned',
              payload: response.data
            }).catch(console.error);

            res.json(response);
          });
        });
      } else {
        const insertSql = `
          INSERT INTO user_services (user_id, service_id, status, activated_at)
          VALUES (?, ?, 'active', CURRENT_TIMESTAMP)
        `;
        db.run(insertSql, [userId, serviceId], async function(err) {
          if (err) {
            return res.status(500).json(failure('service_insert_error', 'Error activating service'));
          }

          try {
            await simulateProvisioningCall();
            recordSuccess();
          } catch (e) {
            try {
              await simulateProvisioningCall();
              recordSuccess();
            } catch (retryErr) {
              recordFailure();
              return res.status(503).json(failure('provisioning_unavailable', 'Provisioning unavailable, please retry', { reason: retryErr.message }));
            }
          }

          updateUserAccountForService(userId, serviceId, service.price, (updateErr) => {
            if (updateErr) {
              return res.status(500).json(failure('account_update_error', updateErr.message));
            }

            const response = success('service_activated', 'Service activated successfully', {
              activationId: 'ACT_' + Date.now(),
              serviceId,
              userId,
              idempotencyKey
            });
            idempotencyStore.set(idempotencyKey, response);
            
            publishToQueue('provisioning.events', {
              userId,
              event: 'service.provisioned',
              payload: response.data
            }).catch(console.error);

            res.json(response);
          });
        });
      }
    });
  });
});

// Deactivate a service
router.post('/deactivate/:userId/:serviceId', (req, res) => {
  const { userId, serviceId } = req.params;
  
  const sql = `
    UPDATE user_services 
    SET status = 'inactive', deactivated_at = CURRENT_TIMESTAMP 
    WHERE user_id = ? AND service_id = ?
  `;
  
  db.run(sql, [userId, serviceId], function(err) {
    if (err) {
      return res.status(500).json(failure('service_deactivate_error', 'Error deactivating service'));
    }

    res.json(success('service_deactivated', 'Service deactivated successfully'));
  });
});

// Helper function to update user account based on service
function updateUserAccountForService(userId, serviceId, servicePrice, callback) {
  // Get service details and user account type
  const serviceSql = `SELECT name, price FROM services WHERE id = ?`;
  db.get(serviceSql, [serviceId], (err, service) => {
    if (err || !service) {
      return callback(new Error('Service not found'));
    }

    // Get user account type
    const userSql = `SELECT account_type, account_balance, current_bill, data_remaining, minutes_remaining FROM users WHERE id = ?`;
    db.get(userSql, [userId], (userErr, user) => {
      if (userErr || !user) {
        return callback(new Error('User not found'));
      }

      const serviceName = service.name.toLowerCase();
      const updates = {};

      // Update data remaining if it's a data service
      if (serviceName.includes('data') || serviceName.includes('5gb') || serviceName.includes('10gb') || serviceName.includes('50gb')) {
        if (serviceName.includes('5gb')) {
          updates.dataRemaining = (user.data_remaining || 0) + 5;
        } else if (serviceName.includes('10gb')) {
          updates.dataRemaining = (user.data_remaining || 0) + 10;
        } else if (serviceName.includes('50gb')) {
          updates.dataRemaining = (user.data_remaining || 0) + 50;
        } else {
          updates.dataRemaining = (user.data_remaining || 0) + 5; // default
        }
      }

      // Update minutes remaining if it's a voice service
      if (serviceName.includes('call') || serviceName.includes('voice') || serviceName.includes('minute') || 
          serviceName.includes('unlimited') || serviceName.includes('roaming')) {
        updates.minutesRemaining = (user.minutes_remaining || 0) + 500; // Default 500 minutes per voice service
      }

      // Handle billing based on account type
      if (user.account_type === 'prepaid') {
        // Prepaid: Deduct from account balance
        updates.accountBalance = (user.account_balance || 0) - servicePrice;
        if (updates.accountBalance < 0) {
          return callback(new Error('Insufficient account balance'));
        }
      } else {
        // Postpaid: Add to current bill
        updates.currentBill = (user.current_bill || 0) + servicePrice;
      }

      // Apply all updates
      User.updateAccountValues(userId, updates, callback);
    });
  });
}

module.exports = router;