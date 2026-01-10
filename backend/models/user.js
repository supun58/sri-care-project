const db = require('../database/db');
const bcrypt = require('bcryptjs');

class User {
  // Create new user
  static create(userData, callback) {
    const { phone, email, name, password, accountType = 'prepaid' } = userData;
    
    // Hash password
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);
    
    const accountNumber = 'STL' + Date.now().toString().slice(-6);
    
    const sql = `
      INSERT INTO users (phone, email, name, password_hash, account_number, account_type, account_balance, current_bill, data_remaining, minutes_remaining) 
      VALUES (?, ?, ?, ?, ?, ?, 0, 0, 0, 0)
    `;
    
    db.run(sql, [phone, email, name, passwordHash, accountNumber, accountType], function(err) {
      if (err) {
        callback(err, null);
      } else {
        callback(null, {
          id: this.lastID,
          phone,
          email,
          name,
          account_number: accountNumber,
          account_type: accountType,
          account_balance: 0,
          current_bill: 0,
          data_remaining: 0,
          minutes_remaining: 0
        });
      }
    });
  }

  // Find user by phone
  static findByPhone(phone, callback) {
    const sql = `SELECT * FROM users WHERE phone = ?`;
    db.get(sql, [phone], (err, row) => {
      callback(err, row);
    });
  }

  // Find user by ID
  static findById(id, callback) {
    const sql = `SELECT id, phone, email, name, account_number, account_type, account_balance, current_bill, data_remaining, minutes_remaining FROM users WHERE id = ?`;
    db.get(sql, [id], (err, row) => {
      callback(err, row);
    });
  }

  // Verify password
  static verifyPassword(inputPassword, storedHash) {
    return bcrypt.compareSync(inputPassword, storedHash);
  }

  // Get user bills
  static getBills(userId, callback) {
    const sql = `
      SELECT * FROM bills 
      WHERE user_id = ? 
      ORDER BY due_date DESC
    `;
    db.all(sql, [userId], (err, rows) => {
      callback(err, rows);
    });
  }

  // Update user account values
  static updateAccountValues(userId, updateData, callback) {
    const { accountBalance, currentBill, dataRemaining, minutesRemaining } = updateData;
    
    const updates = [];
    const values = [];

    if (accountBalance !== undefined && accountBalance !== null) {
      updates.push('account_balance = ?');
      values.push(accountBalance);
    }
    if (currentBill !== undefined && currentBill !== null) {
      updates.push('current_bill = ?');
      values.push(currentBill);
    }
    if (dataRemaining !== undefined && dataRemaining !== null) {
      updates.push('data_remaining = ?');
      values.push(dataRemaining);
    }
    if (minutesRemaining !== undefined && minutesRemaining !== null) {
      updates.push('minutes_remaining = ?');
      values.push(minutesRemaining);
    }

    if (updates.length === 0) {
      callback(new Error('No fields to update'), null);
      return;
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');
    values.push(userId);

    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;

    db.run(sql, values, function(err) {
      if (err) {
        callback(err, null);
      } else {
        callback(null, { success: true });
      }
    });
  }
}

module.exports = User;