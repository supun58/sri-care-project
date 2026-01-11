import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User as UserIcon, Clock, CheckCheck, AlertCircle } from 'lucide-react';
import type { User } from '../App';
import { api } from '../api/api';

type Message = {
  id: string;
  sender: 'user' | 'agent' | 'bot';
  text: string;
  timestamp: Date;
  read?: boolean;
  senderName?: string;
};

type ChatProps = {
  user: User;
};

export function Chat({ user }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [agentName, setAgentName] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize chat session and WebSocket
  useEffect(() => {
    let ws: WebSocket | null = null;
    
    const initChat = async () => {
      try {
        // Create/get session
        const response = await api.createChatSession(user.id, user.name);
        
        if (response.data.success && response.data.data) {
          const session = response.data.data;
          setSessionId(session.session_id);
          
          // Load chat history
          const historyResponse = await api.getChatHistory(session.session_id);
          if (historyResponse.data.success && Array.isArray(historyResponse.data.data)) {
            const loadedMessages = historyResponse.data.data.map((msg: any) => ({
              id: msg.id.toString(),
              sender: msg.sender_type,
              text: msg.message,
              timestamp: new Date(msg.created_at),
              read: msg.sender_type === 'user' ? msg.read_by_agent : msg.read_by_user,
              senderName: msg.sender_name
            }));
            setMessages(loadedMessages);
          }
          
          // Connect WebSocket to backend server (Vite env)
          const wsEnv = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_WS_URL) ? import.meta.env.VITE_WS_URL : undefined;
          const wsUrl = wsEnv || 'ws://localhost:5001';
          ws = new WebSocket(wsUrl);
          wsRef.current = ws;
          
          ws.onopen = () => {
            console.log('✅ WebSocket connected');
            setIsConnected(true);
            setConnectionError(null);
            
            // Send init message
            ws?.send(JSON.stringify({
              type: 'init',
              sessionId: session.session_id,
              userId: user.id,
              userName: user.name
            }));
          };
          
          ws.onmessage = (event) => {
            try {
              const data = JSON.parse(event.data);
              
              if (data.type === 'message_received') {
                const msg = data.message;
                setMessages(prev => [...prev, {
                  id: msg.id.toString(),
                  sender: msg.sender_type,
                  text: msg.message,
                  timestamp: new Date(msg.created_at),
                  read: false,
                  senderName: msg.sender_name
                }]);
                setIsTyping(false);
                
                // Extract agent name
                if (msg.sender_type === 'agent' && msg.sender_name) {
                  setAgentName(msg.sender_name);
                }
              } else if (data.type === 'message_sent') {
                // Message successfully sent, update UI if needed
                setIsTyping(true);
              } else if (data.type === 'session_closed') {
                setIsConnected(false);
              }
            } catch (error) {
              console.error('WebSocket message parse error:', error);
            }
          };
          
          ws.onclose = () => {
            console.log('❌ WebSocket disconnected');
            setIsConnected(false);
          };
          
          ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            setConnectionError('Connection error. Messages may be delayed.');
            setIsConnected(false);
          };
        }
      } catch (error) {
        console.error('Failed to initialize chat:', error);
        setConnectionError('Failed to connect to chat service');
      }
    };
    
    initChat();
    
    // Cleanup on unmount
    return () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [user.id, user.name]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    // Send message via WebSocket
    wsRef.current.send(JSON.stringify({
      type: 'message',
      message: inputMessage,
      userName: user.name,
      timestamp: new Date().toISOString()
    }));

    // Add user message to UI immediately
    const userMessage: Message = {
      id: `temp_${Date.now()}`,
      sender: 'user',
      text: inputMessage,
      timestamp: new Date(),
      read: false
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    
    // Send typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'typing',
          timestamp: new Date().toISOString()
        }));
      }
    }, 300);
  };

  const isPrepaid = user.accountType === 'prepaid';
  const quickActions = isPrepaid ? [
    'Check my balance',
    'Data usage',
    'Activate roaming',
    'Top up account',
    'Talk to agent'
  ] : [
    'Check my bill',
    'Data usage',
    'Activate roaming',
    'Payment help',
    'Talk to agent'
  ];

  return (
    <div className="h-[calc(100vh-12rem)] flex flex-col">
      <div className="mb-4">
        <h1 className="text-3xl font-bold text-blue-900 mb-2">Customer Support Chat</h1>
        <p className="text-blue-600">Real-time chat with our support team</p>
        {connectionError && (
          <div className="mt-2 flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="w-4 h-4" />
            <span>{connectionError}</span>
          </div>
        )}
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-lg border border-blue-100 flex flex-col overflow-hidden">
        {/* Chat Header */}
        <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              {agentName ? <UserIcon className="w-6 h-6" /> : <Bot className="w-6 h-6" />}
            </div>
            <div>
              <h3 className="font-semibold">{agentName || 'Sri Tel Support Bot'}</h3>
              <p className="text-xs text-blue-100 flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-gray-400'}`} />
                {isConnected ? 'Connected' : 'Connecting...'}
              </p>
            </div>
          </div>
          <Clock className="w-5 h-5 text-blue-200" />
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-blue-50/30">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex items-start gap-3 ${
                message.sender === 'user' ? 'flex-row-reverse' : ''
              }`}
            >
              {/* Avatar */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                message.sender === 'user' 
                  ? 'bg-blue-600' 
                  : message.sender === 'agent'
                  ? 'bg-green-600'
                  : 'bg-gray-600'
              }`}>
                {message.sender === 'user' ? (
                  <UserIcon className="w-5 h-5 text-white" />
                ) : (
                  <Bot className="w-5 h-5 text-white" />
                )}
              </div>

              {/* Message Bubble */}
              <div className={`flex flex-col max-w-[70%] ${
                message.sender === 'user' ? 'items-end' : 'items-start'
              }`}>
                <div className={`rounded-2xl px-4 py-3 ${
                  message.sender === 'user'
                    ? 'bg-blue-600 text-white rounded-tr-sm'
                    : message.sender === 'agent'
                    ? 'bg-white border border-green-200 text-blue-900 rounded-tl-sm'
                    : 'bg-white border border-blue-200 text-blue-900 rounded-tl-sm'
                }`}>
                  {message.sender === 'agent' && message.senderName && (
                    <p className="text-xs font-semibold text-green-600 mb-1">{message.senderName}</p>
                  )}
                  <p className="text-sm whitespace-pre-line">{message.text}</p>
                </div>
                <div className={`flex items-center gap-1 mt-1 text-xs text-blue-600 ${
                  message.sender === 'user' ? 'flex-row-reverse' : ''
                }`}>
                  <span>
                    {message.timestamp.toLocaleTimeString('en-US', { 
                      hour: 'numeric', 
                      minute: '2-digit' 
                    })}
                  </span>
                  {message.sender === 'user' && (
                    <CheckCheck className={`w-4 h-4 ${message.read ? 'text-blue-600' : 'text-blue-400'}`} />
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Typing Indicator */}
          {isTyping && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center flex-shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="bg-white border border-blue-200 rounded-2xl rounded-tl-sm px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Actions */}
        <div className="p-3 bg-blue-50 border-t border-blue-100">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={() => setInputMessage(action)}
                className="px-3 py-1.5 bg-white text-blue-700 text-sm rounded-full border border-blue-200 hover:bg-blue-100 transition-colors whitespace-nowrap"
              >
                {action}
              </button>
            ))}
          </div>
        </div>

        {/* Input Area */}
        <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-blue-100">
          <div className="flex gap-2">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-4 py-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            <button
              type="submit"
              disabled={!inputMessage.trim()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
