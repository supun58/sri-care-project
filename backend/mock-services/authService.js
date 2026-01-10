const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/user');

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

// Update user account values (balance, data, minutes)
router.put('/update/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    const { accountBalance, dataRemaining, minutesRemaining } = req.body;

    if (!userId) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID is required' 
      });
    }

    // Update user values
    User.updateAccountValues(userId, { accountBalance, dataRemaining, minutesRemaining }, (err, result) => {
      if (err) {
        return res.status(500).json({ 
          success: false, 
          message: err.message || 'Error updating user' 
        });
      }

      // Fetch and return updated user
      User.findById(userId, (err, user) => {
        if (err) {
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
          accountBalance: user.account_balance || 0,
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

module.exports = router;