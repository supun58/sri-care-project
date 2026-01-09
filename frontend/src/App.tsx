import { useState } from 'react';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { Dashboard } from './components/Dashboard';
import { ForgotPassword } from './components/ForgotPassword';

export type User = {
  id: string;
  name: string;
  mobile: string;
  email: string;
  accountNumber: string;
};

export default function App() {
  const [currentView, setCurrentView] = useState<'login' | 'register' | 'dashboard' | 'forgot-password'>('login');
  const [user, setUser] = useState<User | null>(null);

  const handleLogin = (userData: User) => {
    setUser(userData);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentView('login');
  };

  const handleRegisterSuccess = () => {
    setCurrentView('login');
  };

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
