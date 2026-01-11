// frontend/src/api/api.ts
import axios from 'axios';

const API_BASE = 'http://localhost:5001/api';

const createIdempotencyKey = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'idem-' + Math.random().toString(16).slice(2) + Date.now();
};

// Create axios instance with defaults
const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const api = {
  // Auth endpoints
  login: (mobile: string, password: string) => 
    apiClient.post('/auth/login', { phone: mobile, password }),
  
  register: (data: { phone: string; password: string; email?: string; name?: string }) => 
    apiClient.post('/auth/register', data),
  
  checkUserExists: (phone: string) =>
    apiClient.get(`/auth/exists/${phone}`),

  forgotPassword: (phone: string) =>
    apiClient.post('/auth/forgot', { phone }),

  resetPassword: (phone: string, otp: string, newPassword: string) =>
    apiClient.post('/auth/reset', { phone, otp, newPassword }),
  
  getProfile: (userId: string | number) =>
    apiClient.get(`/auth/profile/${userId}`),
  
  updateUserAccount: (userId: string | number, data: { accountBalance?: number; dataRemaining?: number; minutesRemaining?: number }) =>
    apiClient.put(`/auth/update/${userId}`, data),
  
  // Billing endpoints
  getBills: (userId: number | string) => 
    apiClient.get(`/billing/${userId}`),
  
  getBillDetails: (billId: number | string) => 
    apiClient.get(`/billing/details/${billId}`),
  
  // Payment endpoints
  makePayment: (data: { billId?: number; amount: number; cardNumber: string }, idempotencyKey?: string) => 
    apiClient.post('/payment/pay', data, {
      headers: { 'Idempotency-Key': idempotencyKey || createIdempotencyKey() }
    }),
  
  // Service endpoints
  getServices: (userId: number | string) => 
    apiClient.get(`/services/${userId}`),
  
  getUserServices: (userId: number | string) =>
    apiClient.get(`/services/user/${userId}`),
  
  purchaseService: (userId: number | string, serviceId: number | string, data?: any, idempotencyKey?: string) =>
    apiClient.post(`/services/purchase/${userId}/${serviceId}`, data || {}, {
      headers: { 'Idempotency-Key': idempotencyKey || createIdempotencyKey() }
    }),
    
  deactivateService: (userId: number | string, serviceId: number | string) =>
    apiClient.post(`/services/deactivate/${userId}/${serviceId}`),
  
  // Notification endpoints
  sendNotification: (data: { type: string; message: string; userId: string }) => 
    apiClient.post('/notifications/send', data),
  
  pollNotifications: (userId: string | number, drain: boolean = true) =>
    apiClient.get(`/notifications/poll/${userId}?drain=${drain}`),
  
  publishNotification: (data: { userId: string | number; event: string; payload: any }) =>
    apiClient.post('/notifications/publish', data),
  
  // Chat endpoints (uses same backend server with WebSocket support)
  createChatSession: (userId: string | number, userName: string) =>
    apiClient.post('/chat/session', { userId, userName }),
  
  getChatHistory: (sessionId: string, limit: number = 50) =>
    apiClient.get(`/chat/history/${sessionId}?limit=${limit}`),
  
  markChatAsRead: (sessionId: string, readerType: 'user' | 'agent') =>
    apiClient.post(`/chat/read/${sessionId}`, { readerType }),
  
  closeChatSession: (sessionId: string) =>
    apiClient.post(`/chat/close/${sessionId}`),
};