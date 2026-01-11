const db = require('../database/chat-db');
const crypto = require('crypto');
const User = require('../models/user');

// Helper to generate session ID
function generateSessionId() {
  return 'chat-' + crypto.randomBytes(16).toString('hex');
}

// Response helpers
const success = (data) => ({ success: true, data });
const failure = (code, message) => ({ success: false, error: { code, message } });

// Get or create a chat session
function getOrCreateSession(userId, userName, callback) {
  // Check for existing active session
  db.get(
    'SELECT * FROM chat_sessions WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1',
    [userId, 'active'],
    (err, session) => {
      if (err) {
        return callback(err);
      }
      
      if (session) {
        return callback(null, session);
      }
      
      // Create new session
      const sessionId = generateSessionId();
      db.run(
        'INSERT INTO chat_sessions (session_id, user_id, user_name, status) VALUES (?, ?, ?, ?)',
        [sessionId, userId, userName, 'active'],
        function(err) {
          if (err) {
            return callback(err);
          }
          
          db.get('SELECT * FROM chat_sessions WHERE id = ?', [this.lastID], callback);
        }
      );
    }
  );
}

// Assign an agent to a session
function assignAgent(sessionId, callback) {
  // Find available agent with least current chats
  db.get(
    `SELECT * FROM agents 
     WHERE status = 'available' AND current_chats < max_chats 
     ORDER BY current_chats ASC, RANDOM() 
     LIMIT 1`,
    (err, agent) => {
      if (err) {
        return callback(err);
      }
      
      if (!agent) {
        return callback(new Error('No agents available'));
      }
      
      // Update session with agent
      db.run(
        'UPDATE chat_sessions SET agent_id = ?, agent_name = ? WHERE session_id = ?',
        [agent.agent_id, agent.name, sessionId],
        (err) => {
          if (err) {
            return callback(err);
          }
          
          // Increment agent's chat count
          db.run(
            'UPDATE agents SET current_chats = current_chats + 1 WHERE agent_id = ?',
            [agent.agent_id],
            (err) => {
              callback(err, agent);
            }
          );
        }
      );
    }
  );
}

// Generate bot response
function generateBotResponse(userId, userMessage, callback) {
  const msg = (userMessage || '').toLowerCase();

  // Helper to return static fallbacks
  const fallback = () => callback(null, "I'm here to help! I can assist with:\n• Bill inquiries\n• Data usage\n• Account balance\n• Or type 'agent' to speak with a customer service representative");

  // If asking for bill/balance, fetch live values
  if (msg.includes('bill') || msg.includes('payment') || msg.includes('invoice') || msg.includes('balance')) {
    return User.findById(userId, (err, user) => {
      if (err || !user) {
        return callback(null, "I couldn't fetch your billing right now. Please try again later.");
      }

      const isPrepaid = (user.account_type || '').toLowerCase() === 'prepaid';
      if (msg.includes('balance') && isPrepaid) {
        const balance = user.account_balance ?? 0;
        return callback(null, `Your prepaid account balance is Rs. ${Number(balance).toFixed(2)}. Would you like to top up?`);
      }

      const bill = user.current_bill ?? 0;
      const formatted = `Your current bill is Rs. ${Number(bill).toFixed(2)}. Would you like me to show you the bill details?`;
      return callback(null, formatted);
    });
  }

  if (msg.includes('data') || msg.includes('usage')) {
    return User.findById(userId, (err, user) => {
      if (err || !user) {
        return callback(null, "I couldn't fetch your data usage right now. Please try again later.");
      }
      const used = Math.max(0, 100 - (user.data_remaining ?? 0));
      const remaining = user.data_remaining ?? 0;
      return callback(null, `You've used ${used}GB out of 100GB. You have ${remaining}GB remaining for this month.`);
    });
  }

  if (msg.includes('hello') || msg.includes('hi') || msg.includes('hey')) {
    return callback(null, "Hello! I'm the Sri-Care support bot. I can help you with bills, data usage, and account balance. How can I assist you today?");
  }
  
  if (msg.includes('thank') || msg.includes('thanks')) {
    return callback(null, "You're welcome! Is there anything else I can help you with?");
  }
  
  if (msg.includes('agent') || msg.includes('human') || msg.includes('person') || msg.includes('representative')) {
    return callback(null, "I'll connect you with a customer service agent right away. Please wait a moment...");
  }
  
  return fallback();
}

// Save a message
function saveMessage(sessionId, senderType, senderId, senderName, message, messageType = 'text', callback) {
  db.run(
    `INSERT INTO messages (session_id, sender_type, sender_id, sender_name, message, message_type) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, senderType, senderId, senderName, message, messageType],
    function(err) {
      if (err) {
        return callback(err);
      }
      
      db.get('SELECT * FROM messages WHERE id = ?', [this.lastID], callback);
    }
  );
}

// Get chat history
function getChatHistory(sessionId, limit = 50, callback) {
  db.all(
    'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC LIMIT ?',
    [sessionId, limit],
    callback
  );
}

// Mark messages as read
function markAsRead(sessionId, readerType, callback) {
  const field = readerType === 'agent' ? 'read_by_agent' : 'read_by_user';
  
  db.run(
    `UPDATE messages SET ${field} = 1 WHERE session_id = ? AND ${field} = 0`,
    [sessionId],
    callback
  );
}

// Close a chat session
function closeSession(sessionId, callback) {
  // Get session to find agent
  db.get('SELECT * FROM chat_sessions WHERE session_id = ?', [sessionId], (err, session) => {
    if (err) {
      return callback(err);
    }
    
    // Update session status
    db.run(
      'UPDATE chat_sessions SET status = ?, closed_at = CURRENT_TIMESTAMP WHERE session_id = ?',
      ['closed', sessionId],
      (err) => {
        if (err) {
          return callback(err);
        }
        
        // Decrement agent's chat count if assigned
        if (session && session.agent_id) {
          db.run(
            'UPDATE agents SET current_chats = MAX(0, current_chats - 1) WHERE agent_id = ?',
            [session.agent_id],
            callback
          );
        } else {
          callback(null);
        }
      }
    );
  });
}

module.exports = {
  success,
  failure,
  getOrCreateSession,
  assignAgent,
  generateBotResponse,
  saveMessage,
  getChatHistory,
  markAsRead,
  closeSession
};
