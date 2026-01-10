// frontend/src/api/api.ts
import axios from 'axios';

const API_BASE = 'http://localhost:5001/api';

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
  makePayment: (data: { billId: number; amount: number; cardNumber: string }) => 
    apiClient.post('/payment/pay', data),
  
  // Service endpoints
  getServices: (userId: number | string) => 
    apiClient.get(`/services/${userId}`),
  
  getUserServices: (userId: number | string) =>
    apiClient.get(`/services/user/${userId}`),
  
  purchaseService: (userId: number | string, serviceId: number | string, data?: any) =>
    apiClient.post(`/services/purchase/${userId}/${serviceId}`, data || {}),
    
  deactivateService: (userId: number | string, serviceId: number | string) =>
    apiClient.post(`/services/deactivate/${userId}/${serviceId}`),
  
  // Notification endpoints
  sendNotification: (data: { type: string; message: string; userId: string }) => 
    apiClient.post('/notifications/send', data),
};