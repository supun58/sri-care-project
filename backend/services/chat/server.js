const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');
const http = require('http');
const chatService = require('./chatService');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3006;
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3001';

app.use(cors());
app.use(express.json());

// Store active WebSocket connections
const activeConnections = new Map(); // sessionId -> { ws, userId, agentWs }

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    service: 'chat', 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    connections: activeConnections.size
  });
});

// Get or create chat session
app.post('/session', (req, res) => {
  const { userId, userName } = req.body;
  
  if (!userId) {
    return res.status(400).json(chatService.failure('invalid_request', 'userId is required'));
  }
  
  chatService.getOrCreateSession(userId, userName, (err, session) => {
    if (err) {
      console.error('Session creation error:', err);
      return res.status(500).json(chatService.failure('db_error', 'Failed to create session'));
    }
    
    res.json(chatService.success('session_created', 'Session ready', { session }));
  });
});

// Get chat history
app.get('/history/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const limit = parseInt(req.query.limit) || 50;
  
  chatService.getChatHistory(sessionId, limit, (err, messages) => {
    if (err) {
      console.error('History fetch error:', err);
      return res.status(500).json(chatService.failure('db_error', 'Failed to fetch history'));
    }
    
    res.json(chatService.success('history_fetched', 'Chat history retrieved', { messages }));
  });
});

// Mark messages as read
app.post('/read/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const { readerType } = req.body; // 'user' or 'agent'
  
  chatService.markAsRead(sessionId, readerType, (err, result) => {
    if (err) {
      console.error('Mark as read error:', err);
      return res.status(500).json(chatService.failure('db_error', 'Failed to mark as read'));
    }
    
    res.json(chatService.success('marked_as_read', 'Messages marked as read', result));
  });
});

// Close session
app.post('/close/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  chatService.closeSession(sessionId, (err, result) => {
    if (err) {
      console.error('Close session error:', err);
      return res.status(500).json(chatService.failure('db_error', 'Failed to close session'));
    }
    
    // Notify connected clients
    const connection = activeConnections.get(sessionId);
    if (connection) {
      const closeMsg = JSON.stringify({
        type: 'session_closed',
        timestamp: new Date().toISOString()
      });
      
      if (connection.ws && connection.ws.readyState === WebSocket.OPEN) {
        connection.ws.send(closeMsg);
      }
      if (connection.agentWs && connection.agentWs.readyState === WebSocket.OPEN) {
        connection.agentWs.send(closeMsg);
      }
      
      activeConnections.delete(sessionId);
    }
    
    res.json(chatService.success('session_closed', 'Session closed', result));
  });
});

// WebSocket connection handler
wss.on('connection', (ws, req) => {
  console.log('🔌 New WebSocket connection');
  
  let sessionId = null;
  let userId = null;
  let userName = null;
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'init') {
        // Initialize connection
        sessionId = message.sessionId;
        userId = message.userId;
        userName = message.userName;
        
        // Store connection
        if (!activeConnections.has(sessionId)) {
          activeConnections.set(sessionId, { ws, userId });
        } else {
          activeConnections.get(sessionId).ws = ws;
        }
        
        ws.send(JSON.stringify({
          type: 'init_success',
          sessionId,
          timestamp: new Date().toISOString()
        }));
        
        console.log(`✅ Session ${sessionId} initialized for user ${userId}`);
        
      } else if (message.type === 'message') {
        // Save user message
        chatService.saveMessage(
          sessionId,
          'user',
          userId,
          userName,
          message.text,
          'text',
          (err, savedMessage) => {
            if (err) {
              console.error('Failed to save message:', err);
              return;
            }
            
            // Broadcast to user
            ws.send(JSON.stringify({
              type: 'message_sent',
              message: savedMessage,
              timestamp: new Date().toISOString()
            }));
            
            // Check if we need bot auto-response
            chatService.getSession(sessionId, (err, session) => {
              if (err) {
                console.error('Failed to get session:', err);
                return;
              }
              
              // If no agent assigned, try bot response
              if (!session.agent_id) {
                const fetchUserProfile = async () => {
                  try {
                    const res = await fetch(`${AUTH_SERVICE_URL}/profile/${userId}`);
                    const data = await res.json();
                    if (data && data.success && data.user) {
                      return {
                        currentBill: data.user.currentBill ?? data.user.current_bill ?? 0,
                        dataRemaining: data.user.dataRemaining ?? data.user.data_remaining ?? 0,
                        accountBalance: data.user.accountBalance ?? data.user.account_balance ?? 0,
                        accountType: data.user.accountType ?? data.user.account_type ?? 'prepaid'
                      };
                    }
                  } catch (e) {
                    console.error('Failed to fetch user profile:', e);
                  }
                  return {};
                };

                fetchUserProfile().then((userData) => {
                  const botResponse = chatService.generateBotResponse(message.text, userData || {});
                
                  if (botResponse === 'agent_escalation') {
                  // Assign agent
                  chatService.assignAgent(sessionId, (err, agent) => {
                    if (err) {
                      console.error('Failed to assign agent:', err);
                      return;
                    }
                    
                    if (agent) {
                      const agentMsg = `Connecting you with ${agent.name}...`;
                      chatService.saveMessage(sessionId, 'bot', 'bot', 'Bot', agentMsg, 'text', (err, botMsg) => {
                        if (!err) {
                          ws.send(JSON.stringify({
                            type: 'message_received',
                            message: botMsg,
                            timestamp: new Date().toISOString()
                          }));
                          
                          // Send agent joined message
                          setTimeout(() => {
                            const welcomeMsg = `Hello! I'm ${agent.name}. How can I assist you today?`;
                            chatService.saveMessage(sessionId, 'agent', agent.agent_id, agent.name, welcomeMsg, 'text', (err, agentWelcome) => {
                              if (!err) {
                                ws.send(JSON.stringify({
                                  type: 'message_received',
                                  message: agentWelcome,
                                  timestamp: new Date().toISOString()
                                }));
                              }
                            });
                          }, 1500);
                        }
                      });
                    } else {
                      // No agents available
                      const noAgentMsg = 'All our agents are currently busy. We\'ll respond as soon as possible.';
                      chatService.saveMessage(sessionId, 'bot', 'bot', 'Bot', noAgentMsg, 'text', (err, botMsg) => {
                        if (!err) {
                          ws.send(JSON.stringify({
                            type: 'message_received',
                            message: botMsg,
                            timestamp: new Date().toISOString()
                          }));
                        }
                      });
                    }
                  });
                  } else if (botResponse) {
                  // Send bot response
                  setTimeout(() => {
                    chatService.saveMessage(sessionId, 'bot', 'bot', 'Bot', botResponse, 'text', (err, botMsg) => {
                      if (!err) {
                        ws.send(JSON.stringify({
                          type: 'message_received',
                          message: botMsg,
                          timestamp: new Date().toISOString()
                        }));
                      }
                    });
                  }, 800 + Math.random() * 700);
                  } else {
                  // No bot response, escalate to agent
                  chatService.assignAgent(sessionId, (err, agent) => {
                    if (!err && agent) {
                      const welcomeMsg = `Hello! I'm ${agent.name}. I'll help you with that.`;
                      chatService.saveMessage(sessionId, 'agent', agent.agent_id, agent.name, welcomeMsg, 'text', (err, agentMsg) => {
                        if (!err) {
                          ws.send(JSON.stringify({
                            type: 'message_received',
                            message: agentMsg,
                            timestamp: new Date().toISOString()
                          }));
                        }
                      });
                    }
                  });
                  }
                });
              } else {
                // Agent is assigned, they'll respond (in production via agent dashboard)
                // For demo, simulate agent response after delay
                setTimeout(() => {
                  const agentResponses = [
                    "I understand your concern. Let me check that for you.",
                    "Thank you for that information. I'll assist you right away.",
                    "Let me look into your account details.",
                    "I can help you with that. One moment please."
                  ];
                  
                  const response = agentResponses[Math.floor(Math.random() * agentResponses.length)];
                  
                  chatService.saveMessage(
                    sessionId,
                    'agent',
                    session.agent_id,
                    session.agent_name,
                    response,
                    'text',
                    (err, agentMsg) => {
                      if (!err) {
                        ws.send(JSON.stringify({
                          type: 'message_received',
                          message: agentMsg,
                          timestamp: new Date().toISOString()
                        }));
                      }
                    }
                  );
                }, 2000 + Math.random() * 2000);
              }
            });
          }
        );
      } else if (message.type === 'typing') {
        // Broadcast typing indicator to agent (if connected)
        const connection = activeConnections.get(sessionId);
        if (connection && connection.agentWs && connection.agentWs.readyState === WebSocket.OPEN) {
          connection.agentWs.send(JSON.stringify({
            type: 'user_typing',
            userId,
            timestamp: new Date().toISOString()
          }));
        }
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

server.listen(PORT, () => {
  console.log(`✅ Chat Service (WebSocket + REST) running on port ${PORT}`);
  console.log(`   REST API: http://localhost:${PORT}`);
  console.log(`   WebSocket: ws://localhost:${PORT}`);
});
