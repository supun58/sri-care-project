import { useState } from 'react';
import axios from 'axios';
import { Smartphone, Lock } from 'lucide-react';
import type { User } from '../App';
import { api } from '../api/api';

type LoginProps = {
  onLogin: (user: User) => void;
  onRegister: () => void;
  onForgotPassword: () => void;
};

export function Login({ onLogin, onRegister, onForgotPassword }: LoginProps) {
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!mobile || !password) {
      setError('Please enter both mobile number and password');
      return;
    }

    const mobileRegex = /^07\d{8}$/;
    if (!mobileRegex.test(mobile)) {
      setError('Invalid mobile number format. Use 07XXXXXXXX');
      return;
    }

    setIsLoading(true);
    try {
      const response = await api.login(mobile, password);
      const { success, user, token, message } = response.data ?? {};

      if (!success || !user || !token) {
        setError(message ?? 'Login failed. Please try again.');
        return;
      }

      localStorage.setItem('token', token);

      const phone = user.phone ?? mobile;
      onLogin({
        id: String(user.id ?? phone),
        name: user.name ?? 'Customer',
        phone: phone,
        mobile: phone,
        email: user.email ?? `${phone}@stl.lk`,
        accountNumber: user.accountNumber ?? 'STL' + phone.slice(-6),
        accountType: user.accountType ?? 'prepaid',
        accountBalance: user.accountBalance ?? 0,
        currentBill: user.currentBill ?? 0,
        dataRemaining: user.dataRemaining ?? 0,
        minutesRemaining: user.minutesRemaining ?? 0
      });
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const serverMessage = err.response?.data?.message;
        setError(serverMessage ?? 'Unable to login. Please try again.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <Smartphone className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-blue-900 mb-2">Sri-Care</h1>
          <p className="text-blue-700">Sri Tel Customer Care Portal</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-blue-100">
          <h2 className="text-2xl font-semibold text-blue-900 mb-6">Login to Your Account</h2>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-blue-900 mb-2">
                Mobile Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Smartphone className="h-5 w-5 text-blue-400" />
                </div>
                <input
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="07XXXXXXXX"
                  className="w-full pl-10 pr-4 py-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-900 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-blue-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-4 py-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center">
                <input type="checkbox" className="w-4 h-4 text-blue-600 border-blue-300 rounded focus:ring-blue-500" />
                <span className="ml-2 text-sm text-blue-700">Remember me</span>
              </label>
              <button
                type="button"
                onClick={onForgotPassword}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors shadow-lg hover:shadow-xl"
            >
              {isLoading ? 'Logging in...' : 'Login'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <span className="text-blue-700">Don't have an account? </span>
            <button
              onClick={onRegister}
              className="text-blue-600 hover:text-blue-800 font-semibold"
            >
              Register Now
            </button>
          </div>
        </div>

        <p className="text-center text-sm text-blue-600 mt-6">
          © 2025 Sri Tel Ltd. All rights reserved.
        </p>
      </div>
    </div>
  );
}
