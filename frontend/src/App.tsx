import { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { Dashboard } from './components/Dashboard';
import { ForgotPassword } from './components/ForgotPassword';
import { api } from './api/api';

export type User = {
  id: string;
  name: string;
  phone?: string;
  mobile?: string;
  email: string;
  accountNumber: string;
  accountType: 'prepaid' | 'postpaid';
  accountBalance: number;
  currentBill: number;
  dataRemaining: number;
  minutesRemaining: number;
};

export default function App() {
  const [currentView, setCurrentView] = useState<'login' | 'register' | 'dashboard' | 'forgot-password'>('login');
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on app load
  useEffect(() => {
    const restoreSession = async () => {
      const token = localStorage.getItem('token');
      const savedUser = localStorage.getItem('user');
      
      if (token && savedUser) {
        try {
          const userData = JSON.parse(savedUser);
          // Fetch fresh user data from API
          const response = await api.getProfile(userData.id);
          if (response.data.success && response.data.user) {
            const freshUser = response.data.user;
            const restoredUser: User = {
              id: String(freshUser.id),
              name: freshUser.name,
              phone: freshUser.phone,
              mobile: freshUser.phone,
              email: freshUser.email,
              accountNumber: freshUser.accountNumber,
              accountType: freshUser.accountType || 'prepaid',
              accountBalance: freshUser.accountBalance || 0,
              currentBill: freshUser.currentBill || 0,
              dataRemaining: freshUser.dataRemaining || 0,
              minutesRemaining: freshUser.minutesRemaining || 0
            };
            setUser(restoredUser);
            localStorage.setItem('user', JSON.stringify(restoredUser));
            setCurrentView('dashboard');
          }
        } catch (error) {
          console.error('Failed to restore session:', error);
          // Clear invalid session
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
      setIsLoading(false);
    };

    restoreSession();
  }, []);

  const handleLogin = (userData: User) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentView('login');
  };

  const handleRegisterSuccess = () => {
    setCurrentView('login');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-blue-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      {currentView === 'login' && (
        <Login 
          onLogin={handleLogin}
          onRegister={() => setCurrentView('register')}
          onForgotPassword={() => setCurrentView('forgot-password')}
        />
      )}
      {currentView === 'register' && (
        <Register 
          onRegisterSuccess={handleRegisterSuccess}
          onBackToLogin={() => setCurrentView('login')}
          onLogin={handleLogin}
        />
      )}
      {currentView === 'forgot-password' && (
        <ForgotPassword 
          onBackToLogin={() => setCurrentView('login')}
        />
      )}
      {currentView === 'dashboard' && user && (
        <Dashboard user={user} onLogout={handleLogout} />
      )}
    </div>
  );
}
