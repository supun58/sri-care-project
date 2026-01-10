import { useState } from 'react';
import axios from 'axios';
import { Smartphone, Lock, Mail, User as UserIcon, ArrowLeft, CheckCircle2 } from 'lucide-react';
import { api } from '../api/api';
import type { User } from '../App';

type RegisterProps = {
  onRegisterSuccess: () => void;
  onBackToLogin: () => void;
  onLogin: (user: User) => void;
};

export function Register({ onRegisterSuccess, onBackToLogin, onLogin }: RegisterProps) {
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [step, setStep] = useState<'verify' | 'details'>('verify');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [existingModalOpen, setExistingModalOpen] = useState(false);
  const [existingUser, setExistingUser] = useState<any>(null);
  const [existingPassword, setExistingPassword] = useState('');
  const [existingLoginError, setExistingLoginError] = useState('');
  const [successModalOpen, setSuccessModalOpen] = useState(false);


  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const validateVerification = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.mobile.match(/^07\d{8}$/)) {
      newErrors.mobile = 'Use Sri Lankan format 07XXXXXXXX';
    }
    // Account number no longer required; backend auto-generates
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateDetails = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      newErrors.email = 'Please enter a valid email address';
    }
    if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSendOTP = () => {
    if (validateVerification()) {
      setOtpSent(true);
      // Mock OTP sent
    }
  };

  const handleVerifyOTP = async () => {
    if (otp === '123456' || otp.length === 6) {
      try {
        const res = await api.checkUserExists(formData.mobile);
        const { success, exists, user } = res.data ?? {};
        if (success && exists && user) {
          setExistingUser(user);
          setExistingModalOpen(true);
        } else {
          setStep('details');
        }
      } catch (e) {
        // If check fails, continue to details step
        setStep('details');
      }
    } else {
      setErrors({ otp: 'Invalid OTP' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (!validateDetails()) return;

    setIsLoading(true);
    try {
      const payload = {
        phone: formData.mobile,
        password: formData.password,
        email: formData.email,
        name: formData.name,
      };
      const response = await api.register(payload);
      const { success, token, user, message } = response.data ?? {};

      if (!success) {
        setSubmitError(message ?? 'Registration failed.');
        return;
      }

      if (token) {
        localStorage.setItem('token', token);
      }

      // Send notification (best-effort)
      try {
        if (user?.id) {
          await api.sendNotification({ type: 'alert', message: 'Your Sri-Care account was created successfully.', userId: String(user.id) });
        }
      } catch {}

      // Show success modal and auto-login on confirmation
      setSuccessModalOpen(true);

    } catch (err) {
      if (axios.isAxiosError(err)) {
        const serverMessage = err.response?.data?.message;
        setSubmitError(serverMessage ?? 'Unable to register. Please try again.');
      } else {
        setSubmitError('Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-md">
        {/* Back Button */}
        <button
          onClick={onBackToLogin}
          className="flex items-center text-blue-700 hover:text-blue-900 mb-6"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Back to Login
        </button>

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-2xl mb-4 shadow-lg">
            <Smartphone className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-blue-900 mb-2">Create Account</h1>
          <p className="text-blue-700">Join Sri-Care today</p>
        </div>

        {/* Registration Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-blue-100">
          {existingModalOpen && existingUser && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 shadow-xl w-full max-w-md">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">Account Already Exists</h3>
                <p className="text-blue-700 mb-4">We found an existing Sri-Care account for {existingUser.phone}. Enter your password to auto-login.</p>
                {existingLoginError && (
                  <div className="mb-3 p-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
                    {existingLoginError}
                  </div>
                )}
                <input
                  type="password"
                  value={existingPassword}
                  onChange={(e) => setExistingPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none mb-4"
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => { setExistingModalOpen(false); setExistingPassword(''); }} className="px-4 py-2 rounded-lg bg-blue-50 text-blue-700">Cancel</button>
                  <button onClick={async () => {
                    setExistingLoginError('');
                    try {
                      const res = await api.login(formData.mobile, existingPassword);
                      const { success, token, user } = res.data ?? {};
                      if (!success || !user || !token) {
                        setExistingLoginError('Login failed. Check your password.');
                        return;
                      }
                      localStorage.setItem('token', token);
                      try {
                        await api.sendNotification({ type: 'alert', message: 'Successful login', userId: String(user.id) });
                      } catch {}
                      const mapped = {
                        id: String(user.id),
                        name: user.name ?? 'Customer',
                        mobile: user.phone ?? formData.mobile,
                        email: user.email ?? `${formData.mobile}@stl.lk`,
                        accountNumber: user.accountNumber ?? 'STL' + (user.phone ?? formData.mobile).slice(-6)
                      };
                      onLogin(mapped);
                    } catch (err) {
                      setExistingLoginError('Unable to login.');
                    }
                  }} className="px-4 py-2 rounded-lg bg-blue-600 text-white">Auto Login</button>
                </div>
              </div>
            </div>
          )}

          {successModalOpen && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl p-6 shadow-xl w-full max-w-md">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">Account Created</h3>
                <p className="text-blue-700 mb-4">Your Sri-Care account has been created successfully. Click OK to continue.</p>
                <div className="flex justify-end">
                  <button onClick={async () => {
                    setSuccessModalOpen(false);
                    // Auto-login using entered credentials
                    try {
                      const res = await api.login(formData.mobile, formData.password);
                      const { success, token, user } = res.data ?? {};
                      if (success && token && user) {
                        localStorage.setItem('token', token);
                        const mapped = {
                          id: String(user.id),
                          name: user.name ?? formData.name,
                          phone: user.phone ?? formData.mobile,
                          mobile: user.phone ?? formData.mobile,
                          email: user.email ?? formData.email,
                          accountNumber: user.accountNumber ?? 'STL' + (user.phone ?? formData.mobile).slice(-6),
                          accountType: user.accountType ?? 'prepaid',
                          accountBalance: user.accountBalance ?? 0,
                          currentBill: user.currentBill ?? 0,
                          dataRemaining: user.dataRemaining ?? 0,
                          minutesRemaining: user.minutesRemaining ?? 0
                        };
                        onLogin(mapped);
                      } else {
                        onRegisterSuccess();
                      }
                    } catch {
                      onRegisterSuccess();
                    }
                  }} className="px-4 py-2 rounded-lg bg-blue-600 text-white">OK</button>
                </div>
              </div>
            </div>
          )}

          {step === 'verify' ? (
            <div>
              <h2 className="text-xl font-semibold text-blue-900 mb-6">Verify Your Mobile</h2>
              
              <div className="space-y-4">
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
                      value={formData.mobile}
                      onChange={(e) => handleChange('mobile', e.target.value)}
                      placeholder="07XXXXXXXX"
                      className="w-full pl-10 pr-4 py-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                  {errors.mobile && <p className="mt-1 text-sm text-red-600">{errors.mobile}</p>}
                </div>

                

                {!otpSent ? (
                  <button
                    onClick={handleSendOTP}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors shadow-lg hover:shadow-xl"
                  >
                    Send OTP
                  </button>
                ) : (
                  <div className="space-y-4">
                    <div className="p-3 bg-green-50 border border-green-200 rounded-lg flex items-start">
                      <CheckCircle2 className="w-5 h-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-green-800">
                        OTP sent to {formData.mobile}
                        <p className="text-xs mt-1 text-green-600">For demo: use 123456</p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-blue-900 mb-2">
                        Enter OTP
                      </label>
                      <input
                        type="text"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value)}
                        placeholder="6-digit OTP"
                        maxLength={6}
                        className="w-full px-4 py-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-center text-2xl tracking-widest"
                      />
                      {errors.otp && <p className="mt-1 text-sm text-red-600">{errors.otp}</p>}
                    </div>

                    <button
                      onClick={handleVerifyOTP}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors shadow-lg hover:shadow-xl"
                    >
                      Verify OTP
                    </button>

                    <button
                      onClick={handleSendOTP}
                      className="w-full text-blue-600 hover:text-blue-800 font-medium text-sm"
                    >
                      Resend OTP
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <h2 className="text-xl font-semibold text-blue-900 mb-6">Complete Your Profile</h2>
              
              <div className="space-y-4">
                {submitError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                    {submitError}
                  </div>
                )}
                <div>
                  <label className="block text-sm font-medium text-blue-900 mb-2">
                    Full Name
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <UserIcon className="h-5 w-5 text-blue-400" />
                    </div>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => handleChange('name', e.target.value)}
                      placeholder="Enter your full name"
                      className="w-full pl-10 pr-4 py-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                  {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-blue-900 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-blue-400" />
                    </div>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      placeholder="you@example.com"
                      className="w-full pl-10 pr-4 py-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                  {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email}</p>}
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
                      value={formData.password}
                      onChange={(e) => handleChange('password', e.target.value)}
                      placeholder="Min. 8 characters"
                      className="w-full pl-10 pr-4 py-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                  {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-blue-900 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-blue-400" />
                    </div>
                    <input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => handleChange('confirmPassword', e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full pl-10 pr-4 py-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                  {errors.confirmPassword && <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors shadow-lg hover:shadow-xl mt-6"
                >
                  {isLoading ? 'Creating Account...' : 'Create Account'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
