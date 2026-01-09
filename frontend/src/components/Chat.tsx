import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User as UserIcon, Clock, CheckCheck } from 'lucide-react';
import type { User } from '../App';

type Message = {
  id: string;
  sender: 'user' | 'agent' | 'bot';
  text: string;
  timestamp: Date;
  read?: boolean;
};

type ChatProps = {
  user: User;
};

export function Chat({ user }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      sender: 'bot',
      text: `Hello ${user.name.split(' ')[0]}! 👋 Welcome to Sri Tel Customer Support. How can I help you today?`,
      timestamp: new Date(Date.now() - 60000),
      read: true
    },
    {
      id: '2',
      sender: 'bot',
      text: 'I can help you with:\n• Bill inquiries\n• Service activation/deactivation\n• Payment issues\n• Technical support\n\nOr type your question and I\'ll connect you with an agent if needed.',
      timestamp: new Date(Date.now() - 55000),
      read: true
    }
  ]);

  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [agentOnline, setAgentOnline] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputMessage.trim()) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: inputMessage,
      timestamp: new Date(),
      read: false
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsTyping(true);

    // Simulate bot/agent response
    setTimeout(() => {
      const response = generateResponse(inputMessage);
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: response.isAgent ? 'agent' : 'bot',
        text: response.text,
        timestamp: new Date(),
        read: false
      };
      
      setMessages(prev => [...prev, botMessage]);
      setIsTyping(false);
    }, 1500 + Math.random() * 1000);
  };

  const generateResponse = (userMsg: string): { text: string; isAgent: boolean } => {
    const msg = userMsg.toLowerCase();
    
    if (msg.includes('bill') || msg.includes('payment')) {
      return {
        text: 'I can see your current bill is LKR 1,250.00 due on January 15, 2026. Would you like to make a payment now or need more details about your bill?',
        isAgent: false
      };
    }
    
    if (msg.includes('data') || msg.includes('internet')) {
      return {
        text: 'You currently have 15.5 GB of data remaining from your 25 GB package. Would you like to top up or upgrade your data plan?',
        isAgent: false
      };
    }
    
    if (msg.includes('roaming')) {
      return {
        text: 'International Roaming is currently active on your account. The service costs LKR 500/month. Would you like to deactivate it or need information about roaming rates?',
        isAgent: false
      };
    }
    
    if (msg.includes('agent') || msg.includes('human') || msg.includes('representative')) {
      return {
        text: 'Connecting you with a customer service agent. Please hold...\n\nAgent Priya has joined the chat. Hello! How may I assist you today?',
        isAgent: true
      };
    }

    if (msg.includes('hello') || msg.includes('hi')) {
      return {
        text: 'Hello! How can I assist you today? Feel free to ask about your bills, services, data usage, or any other account-related questions.',
        isAgent: false
      };
    }

    if (msg.includes('thank')) {
      return {
        text: 'You\'re welcome! Is there anything else I can help you with today?',
        isAgent: false
      };
    }
    
    return {
      text: 'I understand you need help with that. Let me connect you with one of our customer service agents who can better assist you.\n\nAgent Kasun has joined the chat. Hello! I\'ll be happy to help you with your inquiry.',
      isAgent: true
    };
  };

  const quickActions = [
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
        <p className="text-blue-600">Chat with our support team for instant assistance</p>
      </div>

      <div className="flex-1 bg-white rounded-xl shadow-lg border border-blue-100 flex flex-col overflow-hidden">
        {/* Chat Header */}
        <div className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold">Sri Tel Support</h3>
              <p className="text-xs text-blue-100 flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${agentOnline ? 'bg-green-400' : 'bg-gray-400'}`} />
                {agentOnline ? 'Online' : 'Offline'}
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
                  {message.sender === 'agent' && (
                    <p className="text-xs font-semibold text-green-600 mb-1">Agent Priya</p>
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
