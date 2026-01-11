import { useState, useEffect } from 'react';
import { CreditCard, Calendar, Lock, CheckCircle, AlertCircle, History, Wallet } from 'lucide-react';
import type { User } from '../App';
import { api } from '../api/api';

type PaymentHistory = {
  id: string;
  date: string;
  amount: number;
  method: string;
  status: 'success' | 'failed' | 'pending';
  reference: string;
};

type PaymentsProps = {
  user: User;
  initialAmount?: number;
  onPaymentSuccess?: () => Promise<void>;
};

export function Payments({ user, initialAmount = 0, onPaymentSuccess }: PaymentsProps) {
  const isPrepaid = user.accountType === 'prepaid';
  const [paymentAmount, setPaymentAmount] = useState(initialAmount > 0 ? initialAmount.toFixed(2) : '0.00');
  
  useEffect(() => {
    setPaymentAmount(initialAmount > 0 ? initialAmount.toFixed(2) : '0.00');
  }, [initialAmount]);
  
  const [cardNumber, setCardNumber] = useState('');
  const [cardName, setCardName] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [statusBanner, setStatusBanner] = useState<{ state: 'idle' | 'pending' | 'success' | 'retry' | 'error'; message: string; key?: string }>({ state: 'idle', message: '' });

  // Payment history - different for prepaid and postpaid
  const [paymentHistory, setPaymentHistory] = useState<PaymentHistory[]>([]);

  useEffect(() => {
    if (isPrepaid) {
      // Load top-up history for prepaid
      const stored = localStorage.getItem(`topups_${user.id}`);
      if (stored) {
        const topups = JSON.parse(stored);
        setPaymentHistory(topups.map((t: any) => ({
          id: t.id,
          date: t.date,
          amount: t.amount,
          method: t.method,
          status: 'success' as const,
          reference: t.reference
        })));
      }
    } else {
      // Mock postpaid payment history
      setPaymentHistory([
        {
          id: '1',
          date: '2025-12-10',
          amount: 1100.00,
          method: 'Visa ****4532',
          status: 'success',
          reference: 'PAY-2025-001234'
        },
        {
          id: '2',
          date: '2025-11-08',
          amount: 980.00,
          method: 'Mastercard ****7890',
          status: 'success',
          reference: 'PAY-2025-001198'
        },
        {
          id: '3',
          date: '2025-10-12',
          amount: 1350.00,
          method: 'Visa ****4532',
          status: 'success',
          reference: 'PAY-2025-001156'
        }
      ]);
    }
  }, [isPrepaid, user.id]);

  const generateIdempotencyKey = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'idem-' + Math.random().toString(16).slice(2) + Date.now();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(paymentAmount);
    
    if (amount <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    
    setProcessing(true);
        const idemKey = generateIdempotencyKey();
        setStatusBanner({ state: 'pending', message: 'Submitting secure payment...', key: idemKey });

    try {
          const paymentResponse = await api.makePayment({ billId: 0, amount, cardNumber }, idemKey);
          const payload = paymentResponse.data;
          const replay = Boolean(payload.idempotent);

          if (!payload.success) {
            const retry = payload.code === 'payment_downstream_unavailable' || payload.code === 'payment_circuit_open';
            setStatusBanner({ state: retry ? 'retry' : 'error', message: payload.message || 'Payment failed', key: idemKey });
            setProcessing(false);
            return;
          }

          if (!replay) {
            if (isPrepaid) {
              const newBalance = user.accountBalance + amount;
              await api.updateUserAccount(user.id, { accountBalance: newBalance });
              const topup = {
                id: `TOP${Date.now()}`,
                date: new Date().toISOString(),
                amount: amount,
                method: payload.data?.maskedCard || `Card ****${cardNumber.slice(-4)}`,
                reference: payload.data?.transactionId || `TOP-${Date.now()}`
              };
              const stored = localStorage.getItem(`topups_${user.id}`);
              const history = stored ? JSON.parse(stored) : [];
              history.unshift(topup);
              localStorage.setItem(`topups_${user.id}`, JSON.stringify(history));
              setPaymentHistory(history.map((t: any) => ({ ...t, status: 'success' as const })));
            } else {
              await api.updateUserAccount(user.id, { accountBalance: 0 });
            }
          }

          const statusMessage = replay
            ? 'Payment already processed (idempotent replay)'
            : 'Payment processed successfully';

          setStatusBanner({ state: replay ? 'success' : 'success', message: statusMessage, key: idemKey });
      
      // Refresh user data in parent
      if (onPaymentSuccess) {
        await onPaymentSuccess();
      }
      
      setProcessing(false);
      setShowSuccess(true);
      
      // Reset form
      setCardNumber('');
      setCardName('');
      setExpiryDate('');
      setCvv('');
      setPaymentAmount('0.00');
      
      // Hide success message after 5 seconds
      setTimeout(() => {
        setShowSuccess(false);
      }, 5000);
    } catch (error) {
      console.error('Payment error:', error);
      setProcessing(false);
      setStatusBanner({ state: 'error', message: 'Payment failed. Please try again.', key: idemKey });
      alert('Payment failed. Please try again.');
    }
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || '';
    const parts = [];

    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }

    if (parts.length) {
      return parts.join(' ');
    } else {
      return value;
    }
  };

  const formatExpiryDate = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.slice(0, 2) + '/' + v.slice(2, 4);
    }
    return v;
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-blue-900 mb-2">{isPrepaid ? 'Top Up Account' : 'Payments'}</h1>
        <p className="text-blue-600">{isPrepaid ? 'Add balance to your prepaid account' : 'Make a payment or view payment history'}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Form */}
        <div className="bg-white rounded-xl shadow-lg border border-blue-100 p-6">
          <div className="flex items-center gap-2 mb-6">
            {isPrepaid && <Wallet className="w-6 h-6 text-blue-600" />}
            <h2 className="text-xl font-semibold text-blue-900">{isPrepaid ? 'Top Up Balance' : 'Make a Payment'}</h2>
          </div>

          {showSuccess && (
            <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start">
              <CheckCircle className="w-5 h-5 text-green-600 mr-3 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-green-800 mb-1">{isPrepaid ? 'Top Up Successful!' : 'Payment Successful!'}</p>
                <p className="text-sm text-green-700">
                  {isPrepaid 
                    ? `Your account has been topped up with LKR ${parseFloat(paymentAmount || '0').toFixed(2)}`
                    : `Your payment of LKR ${parseFloat(paymentAmount || '0').toFixed(2)} has been processed successfully.`
                  }
                </p>
              </div>
            </div>
          )}

          {statusBanner.state !== 'idle' && (
            <div className={`mb-4 p-4 rounded-lg border ${
              statusBanner.state === 'success'
                ? 'bg-green-50 border-green-200 text-green-800'
                : statusBanner.state === 'pending'
                ? 'bg-blue-50 border-blue-200 text-blue-800'
                : statusBanner.state === 'retry'
                ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}>
              <div className="flex items-center justify-between">
                <span className="font-semibold">{statusBanner.message}</span>
                {statusBanner.key && (
                  <span className="text-xs font-mono text-blue-700">{statusBanner.key}</span>
                )}
              </div>
              {statusBanner.state === 'retry' && (
                <p className="text-sm mt-2">We kept your request. Retry after a moment to avoid double charging.</p>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-blue-900 mb-2">
                {isPrepaid ? 'Top Up Amount' : 'Payment Amount'}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-blue-600 font-semibold">
                  LKR
                </span>
                <input
                  type="text"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full pl-14 pr-4 py-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-lg font-semibold"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-900 mb-2">
                Card Number
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <CreditCard className="h-5 w-5 text-blue-400" />
                </div>
                <input
                  type="text"
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  placeholder="1234 5678 9012 3456"
                  maxLength={19}
                  className="w-full pl-10 pr-4 py-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-blue-900 mb-2">
                Cardholder Name
              </label>
              <input
                type="text"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                placeholder="John Doe"
                className="w-full px-4 py-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-blue-900 mb-2">
                  Expiry Date
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="h-5 w-5 text-blue-400" />
                  </div>
                  <input
                    type="text"
                    value={expiryDate}
                    onChange={(e) => setExpiryDate(formatExpiryDate(e.target.value))}
                    placeholder="MM/YY"
                    maxLength={5}
                    className="w-full pl-10 pr-4 py-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-blue-900 mb-2">
                  CVV
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-blue-400" />
                  </div>
                  <input
                    type="text"
                    value={cvv}
                    onChange={(e) => setCvv(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
                    placeholder="123"
                    maxLength={3}
                    className="w-full pl-10 pr-4 py-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    required
                  />
                </div>
              </div>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start">
              <Lock className="w-5 h-5 text-blue-600 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-700">
                Your payment information is encrypted and secure. We use industry-standard security protocols.
              </p>
            </div>

            <button
              type="submit"
              disabled={processing}
              className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 rounded-lg font-semibold hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {processing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Processing...
                </>
              ) : (
                <>
                  {isPrepaid ? <Wallet className="w-5 h-5 mr-2" /> : <Lock className="w-5 h-5 mr-2" />}
                  {isPrepaid ? 'Top Up Now' : 'Pay Securely'}
                </>
              )}
            </button>
          </form>

          <p className="mt-4 text-xs text-center text-blue-600">
            This is a demo payment gateway. No actual charges will be made.
          </p>
        </div>

        {/* Payment History */}
        <div className="bg-white rounded-xl shadow-lg border border-blue-100 p-6">
          <div className="flex items-center gap-2 mb-6">
            {isPrepaid ? <Wallet className="w-6 h-6 text-blue-600 mr-2" /> : <History className="w-6 h-6 text-blue-600 mr-2" />}
            <h2 className="text-xl font-semibold text-blue-900">{isPrepaid ? 'Top Up History' : 'Payment History'}</h2>
          </div>

          <div className="space-y-4">
            {paymentHistory.map(payment => (
              <div key={payment.id} className="p-4 bg-blue-50 border border-blue-100 rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-semibold text-blue-900 mb-1">
                      LKR {payment.amount.toFixed(2)}
                    </p>
                    <p className="text-sm text-blue-600">
                      {new Date(payment.date).toLocaleDateString('en-US', { 
                        month: 'long', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </p>
                  </div>
                  <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                    payment.status === 'success' 
                      ? 'bg-green-100 text-green-700 border border-green-200' 
                      : payment.status === 'failed'
                      ? 'bg-red-100 text-red-700 border border-red-200'
                      : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                  }`}>
                    {payment.status === 'success' ? (
                      <CheckCircle className="w-3 h-3" />
                    ) : (
                      <AlertCircle className="w-3 h-3" />
                    )}
                    {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                  </div>
                </div>
                <div className="text-sm space-y-1">
                  <p className="text-blue-700">
                    <span className="font-medium">Method:</span> {payment.method}
                  </p>
                  <p className="text-blue-600">
                    <span className="font-medium">Ref:</span> {payment.reference}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {paymentHistory.length === 0 && (
            <div className="text-center py-8">
              <History className="w-12 h-12 text-blue-300 mx-auto mb-3" />
              <p className="text-blue-600">No payment history available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
