const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('./user');

const JWT_SECRET = process.env.JWT_SECRET || 'sri-care-secret-key-2025';

// Login
router.post('/login', async (req, res) => {
  try {
    const { phone, password } = req.body;
    
    if (!phone || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Mobile number and password are required' 
      });
    }

    // Find user
    User.findByPhone(phone, (err, user) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Database error' 
        });
      }
      
      if (!user) {
        return res.status(404).json({ 
          success: false, 
          message: 'User not found. Please register first.' 
        });
      }

      // Verify password
      const isValid = User.verifyPassword(password, user.password_hash);
      if (!isValid) {
        return res.status(401).json({ 
          success: false, 
          message: 'Invalid password' 
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { 
          userId: user.id, 
          phone: user.phone,
          accountNumber: user.account_number 
        },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Return user data (without password)
      const userResponse = {
        id: user.id,
        phone: user.phone,
        email: user.email,
        name: user.name,
        accountNumber: user.account_number,
        accountType: user.account_type || 'prepaid',
        accountBalance: user.account_balance || 0,
        currentBill: user.current_bill || 0,
        dataRemaining: user.data_remaining || 0,
        minutesRemaining: user.minutes_remaining || 0
      };

      res.json({
        success: true,
        token,
        user: userResponse,
        message: 'Login successful!'
      });
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Register
router.post('/register', async (req, res) => {
  try {
    const { phone, password, email, name } = req.body;
    
    // Validate
    if (!phone || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Mobile number and password are required' 
      });
    }

    // Check if user exists
    User.findByPhone(phone, (err, existingUser) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: 'Database error' 
        });
      }
      
      if (existingUser) {
        return res.status(409).json({ 
          success: false, 
          message: 'User already exists. Please login.' 
        });
      }

      // Create new user
      User.create({ phone, email, name, password }, (err, newUser) => {
        if (err) {
          return res.status(500).json({ 
            success: false, 
            message: 'Error creating user' 
          });
        }

        // Generate token
        const token = jwt.sign(
          { 
            userId: newUser.id, 
            phone: newUser.phone,
            accountNumber: newUser.account_number 
          },
          JWT_SECRET,
          { expiresIn: '24h' }
        );

        res.status(201).json({
          success: true,
          token,
          user: newUser,
          message: 'Registration successful!'
        });
      });
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Get user profile
router.get('/profile/:userId', (req, res) => {
  const { userId } = req.params;
  
  User.findById(userId, (err, user) => {
    if (err) {
      return res.status(500).json({ 
        success: false, 
        message: 'Database error' 
      });
    }
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    res.json({
      success: true,
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        name: user.name,
        accountNumber: user.account_number,
        accountType: user.account_type || 'prepaid',
        accountBalance: user.account_balance || 0,
        currentBill: user.current_bill || 0,
        dataRemaining: user.data_remaining || 0,
        minutesRemaining: user.minutes_remaining || 0
      }
    });
  });
});

// Check if user exists by phone
router.get('/exists/:phone', (req, res) => {
  const { phone } = req.params;
  if (!phone) {
    return res.status(400).json({ success: false, message: 'Phone is required' });
  }

  User.findByPhone(phone, (err, user) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }
    if (!user) {
      return res.json({ success: true, exists: false });
    }
    const userResponse = {
      id: user.id,
      phone: user.phone,
      email: user.email,
      name: user.name,
      accountNumber: user.account_number,
      accountType: user.account_type || 'prepaid',
      accountBalance: user.account_balance || 0,
      currentBill: user.current_bill || 0,
      dataRemaining: user.data_remaining || 0,
      minutesRemaining: user.minutes_remaining || 0
    };
    return res.json({ success: true, exists: true, user: userResponse });
  });
});

// Update user account values (balance, data, minutes, bill)
router.put('/update/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const { accountBalance, dataRemaining, minutesRemaining, currentBill } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required' 
      });
    }

    User.updateAccountValues(userId, { accountBalance, dataRemaining, minutesRemaining, currentBill }, (err) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: err.message || 'Error updating user' 
        });
      }

      // Fetch and return updated user
      User.findById(userId, (findErr, user) => {
        if (findErr || !user) {
          return res.status(500).json({ 
            success: false, 
            message: 'Error fetching updated user' 
          });
        }

        const userResponse = {
          id: user.id,
          phone: user.phone,
          email: user.email,
          name: user.name,
          accountNumber: user.account_number,
          accountType: user.account_type || 'prepaid',
          accountBalance: user.account_balance || 0,
          currentBill: user.current_bill || 0,
          dataRemaining: user.data_remaining || 0,
          minutesRemaining: user.minutes_remaining || 0
        };

        res.json({
          success: true,
          user: userResponse,
          message: 'User account updated successfully'
        });
      });
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// Request password reset - generates OTP and stores hashed token
router.post('/forgot', (req, res) => {
  const phone = (req.body.phone || '').trim();

  if (!phone) {
    return res.status(400).json({ success: false, message: 'Mobile number is required' });
  }

  User.findByPhone(phone, (err, user) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (!user) {
      return res.json({ success: false, message: 'User not found. Please register first.' });
    }

    // Generate 6-digit OTP and hash it
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = bcrypt.hashSync(otp, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutes

    User.setResetToken(user.id, otpHash, expiresAt, (tokenErr) => {
      if (tokenErr) {
        return res.status(500).json({ success: false, message: 'Could not set reset token' });
      }

      // In a real app, send via SMS/email. For demo, return the code.
      res.json({
        success: true,
        message: 'OTP generated. Please verify within 15 minutes.',
        otp: otp
      });
    });
  });
});

// Reset password with OTP
router.post('/reset', (req, res) => {
  const { phone, otp, newPassword } = req.body;

  if (!phone || !otp || !newPassword) {
    return res.status(400).json({ success: false, message: 'Phone, OTP, and new password are required' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ success: false, message: 'Password must be at least 8 characters' });
  }

  User.findByPhone(phone, (err, user) => {
    if (err) {
      return res.status(500).json({ success: false, message: 'Database error' });
    }

    if (!user || !user.reset_token || !user.reset_expires) {
      return res.status(400).json({ success: false, message: 'No reset request found. Please request a new OTP.' });
    }

    const now = new Date();
    if (new Date(user.reset_expires) < now) {
      return res.status(400).json({ success: false, message: 'OTP expired. Please request a new one.' });
    }

    const isValid = bcrypt.compareSync(otp, user.reset_token);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid OTP' });
    }

    User.updatePassword(user.id, newPassword, (updateErr) => {
      if (updateErr) {
        return res.status(500).json({ success: false, message: 'Could not update password' });
      }

      res.json({ success: true, message: 'Password reset successful. You can now log in.' });
    });
  });
});

module.exports = router;