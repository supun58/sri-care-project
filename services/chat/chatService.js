const db = require('./db');

const success = (code, message, data = {}) => ({ success: true, code, message, data });
const failure = (code, message, data = {}) => ({ success: false, code, message, data });

// Create or get chat session
function getOrCreateSession(userId, userName, callback) {
  const sessionId = `session_${userId}_${Date.now()}`;
  
  // Check if user has an active session
  db.get(
    'SELECT * FROM chat_sessions WHERE user_id = ? AND status = ? ORDER BY created_at DESC LIMIT 1',
    [userId, 'active'],
    (err, existingSession) => {
      if (err) {
        return callback(err, null);
      }
      
      if (existingSession) {
        return callback(null, existingSession);
      }
      
      // Create new session
      db.run(
        'INSERT INTO chat_sessions (session_id, user_id, user_name) VALUES (?, ?, ?)',
        [sessionId, userId, userName],
        function(err) {
          if (err) {
            return callback(err, null);
          }
          
          db.get(
            'SELECT * FROM chat_sessions WHERE id = ?',
            [this.lastID],
            callback
          );
        }
      );
    }
  );
}

// Assign agent to session
function assignAgent(sessionId, callback) {
  // Find available agent with least current chats
  db.get(
    'SELECT * FROM agents WHERE status = ? AND current_chats < max_chats ORDER BY current_chats ASC LIMIT 1',
    ['available'],
    (err, agent) => {
      if (err) {
        return callback(err, null);
      }
      
      if (!agent) {
        return callback(null, null); // No agents available
      }
      
      // Update session with agent
      db.run(
        'UPDATE chat_sessions SET agent_id = ?, agent_name = ? WHERE session_id = ?',
        [agent.agent_id, agent.name, sessionId],
        (err) => {
          if (err) {
            return callback(err, null);
          }
          
          // Increment agent's current chat count
          db.run(
            'UPDATE agents SET current_chats = current_chats + 1 WHERE agent_id = ?',
            [agent.agent_id],
            (err) => {
              if (err) console.error('Failed to update agent chat count:', err);
              callback(null, agent);
            }
          );
        }
      );
    }
  );
}

// Save message
function saveMessage(sessionId, senderType, senderId, senderName, message, messageType = 'text', callback) {
  db.run(
    `INSERT INTO messages (session_id, sender_type, sender_id, sender_name, message, message_type)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [sessionId, senderType, senderId, senderName, message, messageType],
    function(err) {
      if (err) {
        return callback(err, null);
      }
      
      db.get(
        'SELECT * FROM messages WHERE id = ?',
        [this.lastID],
        callback
      );
    }
  );
}

// Get chat history
function getChatHistory(sessionId, limit = 50, callback) {
  db.all(
    'SELECT * FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ?',
    [sessionId, limit],
    (err, messages) => {
      if (err) {
        return callback(err, null);
      }
      callback(null, messages.reverse());
    }
  );
}

// Mark messages as read
function markAsRead(sessionId, readerType, callback) {
  const column = readerType === 'agent' ? 'read_by_agent' : 'read_by_user';
  
  db.run(
    `UPDATE messages SET ${column} = 1 WHERE session_id = ? AND ${column} = 0`,
    [sessionId],
    function(err) {
      if (err) {
        return callback(err, null);
      }
      callback(null, { updated: this.changes });
    }
  );
}

// Close session
function closeSession(sessionId, callback) {
  db.get(
    'SELECT agent_id FROM chat_sessions WHERE session_id = ?',
    [sessionId],
    (err, session) => {
      if (err) {
        return callback(err, null);
      }
      
      db.run(
        'UPDATE chat_sessions SET status = ?, closed_at = CURRENT_TIMESTAMP WHERE session_id = ?',
        ['closed', sessionId],
        (err) => {
          if (err) {
            return callback(err, null);
          }
          
          // Decrement agent's current chat count
          if (session && session.agent_id) {
            db.run(
              'UPDATE agents SET current_chats = MAX(0, current_chats - 1) WHERE agent_id = ?',
              [session.agent_id],
              (err) => {
                if (err) console.error('Failed to update agent chat count:', err);
              }
            );
          }
          
          callback(null, { closed: true });
        }
      );
    }
  );
}

// Get session info
function getSession(sessionId, callback) {
  db.get(
    'SELECT * FROM chat_sessions WHERE session_id = ?',
    [sessionId],
    callback
  );
}

// Bot auto-response logic
function generateBotResponse(userMessage, userData) {
  const msg = userMessage.toLowerCase();
  
  if (msg.includes('bill') || msg.includes('payment')) {
    return `I can see your current bill is LKR ${userData.currentBill || '0.00'} due on ${new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toLocaleDateString()}. Would you like to make a payment now or need more details?`;
  }
  
  if (msg.includes('data') || msg.includes('internet')) {
    return `You currently have ${userData.dataRemaining || '0'} GB of data remaining. Would you like to top up or upgrade your data plan?`;
  }
  
  if (msg.includes('balance')) {
    return `Your account balance is LKR ${userData.accountBalance || '0.00'}. ${userData.accountType === 'prepaid' ? 'Would you like to recharge?' : ''}`;
  }
  
  if (msg.includes('hello') || msg.includes('hi')) {
    return 'Hello! How can I assist you today? Feel free to ask about your bills, services, data usage, or any other account-related questions.';
  }
  
  if (msg.includes('thank')) {
    return "You're welcome! Is there anything else I can help you with today?";
  }
  
  if (msg.includes('agent') || msg.includes('human') || msg.includes('representative')) {
    return 'agent_escalation'; // Special flag to assign an agent
  }
  
  return null; // No auto-response, escalate to agent
}

module.exports = {
  success,
  failure,
  getOrCreateSession,
  assignAgent,
  saveMessage,
  getChatHistory,
  markAsRead,
  closeSession,
  getSession,
  generateBotResponse
};
