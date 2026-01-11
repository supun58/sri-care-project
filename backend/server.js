const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());

// Basic route
app.get('/', (req, res) => {
  res.json({ message: 'Sri-Care Backend API' });
});

// Mock routes
app.use('/api/auth', require('./mock-services/authService'));
app.use('/api/services', require('./mock-services/mock-services'));
app.use('/api/payment', require('./mock-services/mock-payment'));
app.use('/api/notifications', require('./mock-services/notification-broker'));

// Chat routes
const chatService = require('./controllers/chatService');
const activeConnections = new Map(); // sessionId -> { ws, userId, agentWs }

// Get or create chat session
app.post('/api/chat/session', (req, res) => {
  const { userId, userName } = req.body;
  
  if (!userId) {
    return res.status(400).json(chatService.failure('invalid_request', 'userId is required'));
  }
  
  chatService.getOrCreateSession(userId, userName, (err, session) => {
    if (err) {
      console.error('Session creation error:', err);
      return res.status(500).json(chatService.failure('server_error', 'Failed to create session'));
    }
    res.json(chatService.success(session));
  });
});

// Get chat history
app.get('/api/chat/history/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const limit = parseInt(req.query.limit) || 50;
  
  chatService.getChatHistory(sessionId, limit, (err, messages) => {
    if (err) {
      return res.status(500).json(chatService.failure('server_error', 'Failed to fetch history'));
    }
    res.json(chatService.success(messages));
  });
});

// Mark messages as read
app.post('/api/chat/read/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const { readerType } = req.body;
  
  chatService.markAsRead(sessionId, readerType, (err) => {
    if (err) {
      return res.status(500).json(chatService.failure('server_error', 'Failed to mark as read'));
    }
    res.json(chatService.success({ marked: true }));
  });
});

// Close chat session
app.post('/api/chat/close/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  chatService.closeSession(sessionId, (err) => {
    if (err) {
      return res.status(500).json(chatService.failure('server_error', 'Failed to close session'));
    }
    
    // Close WebSocket connection if exists
    if (activeConnections.has(sessionId)) {
      const connection = activeConnections.get(sessionId);
      connection.ws.send(JSON.stringify({ type: 'session_closed' }));
      connection.ws.close();
      activeConnections.delete(sessionId);
    }
    
    res.json(chatService.success({ closed: true }));
  });
});

// WebSocket connection handling
wss.on('connection', (ws) => {
  let sessionId = null;
  let userId = null;
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'init':
          sessionId = data.sessionId;
          userId = data.userId;
          activeConnections.set(sessionId, { ws, userId });
          console.log(`✅ WebSocket connected for session ${sessionId}`);
              // Send connection confirmation
              ws.send(JSON.stringify({
                type: 'connected',
                sessionId: sessionId
              }));
              break;
          
        case 'message': {
          const text = data.message || data.text;
          if (!text) {
            console.warn('⚠️ Received empty message payload');
            return;
          }
          const senderName = data.userName || 'Guest';
          handleUserMessage(sessionId, userId, senderName, text, ws);
          break;
        }
          
        case 'typing':
          broadcastTyping(sessionId, data.userName, data.isTyping);
          break;
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });
  
  ws.on('close', () => {
    console.log(`❌ WebSocket connection closed for session ${sessionId}`);
    if (sessionId && activeConnections.has(sessionId)) {
      const connection = activeConnections.get(sessionId);
      if (connection.ws === ws) {
        activeConnections.delete(sessionId);
      }
    }
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Handle user message
function handleUserMessage(sessionId, userId, userName, message, ws) {
  if (!message) {
    console.warn('⚠️ Skipping empty message');
    return;
  }
  // Save user message
  chatService.saveMessage(sessionId, 'user', userId, userName, message, 'text', (err, savedMessage) => {
    if (err) {
      console.error('Failed to save message:', err);
      return;
    }

    // Acknowledge receipt to client
    ws.send(JSON.stringify({
      type: 'message_sent',
      message: savedMessage
    }));
    
    // Check if user wants to talk to an agent
    const needsAgent = message.toLowerCase().includes('agent') || 
                      message.toLowerCase().includes('human') ||
                      message.toLowerCase().includes('person') ||
                      message.toLowerCase().includes('representative');
    
    if (needsAgent) {
      // Assign agent
      chatService.assignAgent(sessionId, (err, agent) => {
        if (err) {
          console.error('Failed to assign agent:', err);
          const fallbackResponse = "I apologize, but all our agents are currently busy. Please try again in a few moments.";
          sendBotResponse(sessionId, fallbackResponse, ws);
          return;
        }
        
        // Notify user that agent is assigned
        const agentMessage = `You've been connected to ${agent.name}. They'll be with you shortly.`;
        sendBotResponse(sessionId, agentMessage, ws);
        
        // Send agent joined notification
        ws.send(JSON.stringify({
          type: 'agent_joined',
          agentName: agent.name,
          agentId: agent.agent_id
        }));
      });
    } else {
      // Generate and send bot response (uses live user data)
      chatService.generateBotResponse(userId, message, (err, botResponse) => {
        if (err) {
          console.error('Bot response error:', err);
          return;
        }
        console.log('🤖 Bot responding:', botResponse);
        sendBotResponse(sessionId, botResponse, ws);
      });
    }
  });
}

// Send bot response
function sendBotResponse(sessionId, message, ws) {
  chatService.saveMessage(sessionId, 'bot', 'bot-001', 'Sri-Care Bot', message, 'text', (err, savedMessage) => {
    if (err) {
      console.error('Failed to save bot message:', err);
      return;
    }
    
      ws.send(JSON.stringify({
        type: 'message_received',
        message: savedMessage
      }));
  });
}

// Broadcast typing indicator
function broadcastTyping(sessionId, userName, isTyping) {
  const connection = activeConnections.get(sessionId);
  if (connection && connection.ws) {
    connection.ws.send(JSON.stringify({
      type: 'typing',
      userName,
      isTyping
    }));
  }
}

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ message: 'API is working!', timestamp: new Date() });
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`✅ Sri-Care Backend running on port ${PORT}`);
  console.log(`   REST API: http://localhost:${PORT}`);
  console.log(`   WebSocket: ws://localhost:${PORT}`);
  console.log(`   Chat service integrated`);
});


