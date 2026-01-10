const express = require('express');
const router = express.Router();
const db = require('../database/db');
const User = require('../models/user');

// Get all available services
router.get('/', (req, res) => {
  const sql = `SELECT * FROM services WHERE is_active = 1`;
  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    res.json({ success: true, services: rows || [] });
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
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    res.json({ success: true, services: rows || [] });
  });
});

// Purchase/Activate a service for user
router.post('/purchase/:userId/:serviceId', (req, res) => {
  const { userId, serviceId } = req.params;
  
  // First check if service exists
  const serviceCheckSql = `SELECT price FROM services WHERE id = ?`;
  db.get(serviceCheckSql, [serviceId], (err, service) => {
    if (err || !service) {
      return res.status(404).json({ success: false, message: 'Service not found' });
    }

    // Check if user already has this service
    const checkSql = `SELECT id FROM user_services WHERE user_id = ? AND service_id = ?`;
    db.get(checkSql, [userId, serviceId], (err, existing) => {
      if (existing) {
        // Update existing subscription to active
        const updateSql = `
          UPDATE user_services 
          SET status = 'active', activated_at = CURRENT_TIMESTAMP 
          WHERE user_id = ? AND service_id = ?
        `;
        db.run(updateSql, [userId, serviceId], function(err) {
          if (err) {
            return res.status(500).json({ success: false, message: 'Error updating service' });
          }

          // Update user account based on service type
          updateUserAccountForService(userId, serviceId, service.price, (updateErr) => {
            if (updateErr) {
              return res.status(500).json({ success: false, message: updateErr.message });
            }

            res.json({
              success: true,
              message: 'Service activated successfully!',
              activationId: 'ACT_' + Date.now()
            });
          });
        });
      } else {
        // Create new subscription
        const insertSql = `
          INSERT INTO user_services (user_id, service_id, status, activated_at)
          VALUES (?, ?, 'active', CURRENT_TIMESTAMP)
        `;
        db.run(insertSql, [userId, serviceId], function(err) {
          if (err) {
            return res.status(500).json({ success: false, message: 'Error activating service' });
          }

          // Update user account based on service type
          updateUserAccountForService(userId, serviceId, service.price, (updateErr) => {
            if (updateErr) {
              return res.status(500).json({ success: false, message: updateErr.message });
            }

            res.json({
              success: true,
              message: 'Service activated successfully!',
              activationId: 'ACT_' + Date.now()
            });
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
      return res.status(500).json({ success: false, message: 'Error deactivating service' });
    }

    res.json({
      success: true,
      message: 'Service deactivated successfully!'
    });
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