import { useState, useEffect } from 'react';
import { FileText, Download, Calendar, DollarSign, CheckCircle, AlertCircle, Wallet } from 'lucide-react';
import type { User } from '../App';

type Bill = {
  id: string;
  month: string;
  year: number;
  amount: number;
  dueDate: string;
  status: 'paid' | 'pending' | 'overdue';
  paidDate?: string;
};

type TopUpHistory = {
  id: string;
  date: string;
  amount: number;
  method: string;
  reference: string;
};

type BillsProps = {
  user: User;
  onNavigateToPayments?: (amount: number) => void;
};

export function Bills({ user, onNavigateToPayments }: BillsProps) {
  const isPrepaid = user.accountType === 'prepaid';
  const [bills] = useState<Bill[]>([
    {
      id: '1',
      month: 'December',
      year: 2025,
      amount: 1250.00,
      dueDate: '2026-01-15',
      status: 'pending'
    },
    {
      id: '2',
      month: 'November',
      year: 2025,
      amount: 1100.00,
      dueDate: '2025-12-15',
      status: 'paid',
      paidDate: '2025-12-10'
    },
    {
      id: '3',
      month: 'October',
      year: 2025,
      amount: 980.00,
      dueDate: '2025-11-15',
      status: 'paid',
      paidDate: '2025-11-08'
    },
    {
      id: '4',
      month: 'September',
      year: 2025,
      amount: 1350.00,
      dueDate: '2025-10-15',
      status: 'paid',
      paidDate: '2025-10-12'
    },
    {
      id: '5',
      month: 'August',
      year: 2025,
      amount: 1200.00,
      dueDate: '2025-09-15',
      status: 'paid',
      paidDate: '2025-09-09'
    },
    {
      id: '6',
      month: 'July',
      year: 2025,
      amount: 1150.00,
      dueDate: '2025-08-15',
      status: 'paid',
      paidDate: '2025-08-11'
    }
  ]);

  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  const handleViewDetails = (bill: Bill) => {
    setSelectedBill(bill);
    setShowDetails(true);
  };

  const handleDownload = (bill: Bill) => {
    // Mock download functionality
    alert(`Downloading bill for ${bill.month} ${bill.year}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'overdue':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="w-5 h-5" />;
      case 'pending':
      case 'overdue':
        return <AlertCircle className="w-5 h-5" />;
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-blue-900 mb-2">{isPrepaid ? 'Account Balance' : 'Bills'}</h1>
        <p className="text-blue-600">{isPrepaid ? 'View your balance and reload history' : 'View and manage your billing history'}</p>
      </div>

      {/* Current Balance/Bill Highlight */}
      <div className={`bg-gradient-to-r ${isPrepaid ? 'from-blue-600 to-blue-700' : 'from-orange-600 to-orange-700'} rounded-2xl p-6 text-white mb-6 shadow-xl`}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-2">{isPrepaid ? 'Current Balance' : 'Current Bill'}</h2>
            {!isPrepaid && (
              <p className="text-blue-100 mb-4">December 2025</p>
            )}
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">
                LKR {isPrepaid ? user.accountBalance.toFixed(2) : user.currentBill.toFixed(2)}
              </span>
            </div>
            {!isPrepaid && (
              <p className="text-orange-100 mt-2">
                Due: {new Date('2026-01-15').toLocaleDateString('en-US', { 
                  month: 'long', 
                  day: 'numeric', 
                  year: 'numeric' 
                })}
              </p>
            )}
            {isPrepaid && user.accountBalance === 0 && (
              <p className="text-blue-100 mt-2">Top up your account to continue using services</p>
            )}
          </div>
          <button 
            onClick={() => onNavigateToPayments?.(isPrepaid ? 0 : user.currentBill)}
            className="bg-white hover:bg-blue-50 px-6 py-3 rounded-lg font-semibold transition-colors flex items-center gap-2"
            style={{ color: isPrepaid ? '#2563eb' : '#ea580c' }}
          >
            {isPrepaid ? (
              <>
                <Wallet className="w-5 h-5" />
                Top Up
              </>
            ) : (
              'Pay Now'
            )}
          </button>
        </div>
      </div>

      {/* History List */}
      <div className="bg-white rounded-xl shadow-lg border border-blue-100 overflow-hidden">
        <div className="p-6 border-b border-blue-100">
          <h2 className="text-xl font-semibold text-blue-900">{isPrepaid ? 'Reload History' : 'Billing History'}</h2>
        </div>

        <div className="divide-y divide-blue-100">
          {bills.map(bill => (
            <div key={bill.id} className="p-6 hover:bg-blue-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="font-semibold text-blue-900 mb-1">
                      {bill.month} {bill.year}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-blue-600">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Due: {new Date(bill.dueDate).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric' 
                        })}
                      </span>
                      {bill.paidDate && (
                        <span className="flex items-center gap-1">
                          <CheckCircle className="w-4 h-4" />
                          Paid: {new Date(bill.paidDate).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xl font-bold text-blue-900 mb-1">
                      LKR {bill.amount.toFixed(2)}
                    </p>
                    <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(bill.status)}`}>
                      {getStatusIcon(bill.status)}
                      {bill.status.charAt(0).toUpperCase() + bill.status.slice(1)}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 ml-6">
                  <button
                    onClick={() => handleViewDetails(bill)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
                  >
                    View
                  </button>
                  <button
                    onClick={() => handleDownload(bill)}
                    className="p-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg transition-colors"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bill Details Modal */}
      {showDetails && selectedBill && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-blue-900 mb-1">
                  Bill Details
                </h2>
                <p className="text-blue-600">
                  {selectedBill.month} {selectedBill.year}
                </p>
              </div>
              <button
                onClick={() => setShowDetails(false)}
                className="text-blue-600 hover:text-blue-800 font-semibold"
              >
                Close
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-blue-700">Bill Period</span>
                  <span className="font-semibold text-blue-900">
                    {selectedBill.month} 1 - {selectedBill.month} 30, {selectedBill.year}
                  </span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-blue-700">Due Date</span>
                  <span className="font-semibold text-blue-900">
                    {new Date(selectedBill.dueDate).toLocaleDateString('en-US', { 
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </span>
                </div>
                {selectedBill.paidDate && (
                  <div className="flex justify-between items-center">
                    <span className="text-blue-700">Payment Date</span>
                    <span className="font-semibold text-blue-900">
                      {new Date(selectedBill.paidDate).toLocaleDateString('en-US', { 
                        month: 'long', 
                        day: 'numeric', 
                        year: 'numeric' 
                      })}
                    </span>
                  </div>
                )}
              </div>

              <div className="border border-blue-100 rounded-lg divide-y divide-blue-100">
                <div className="p-4 flex justify-between">
                  <span className="text-blue-700">Monthly Subscription</span>
                  <span className="font-semibold text-blue-900">LKR 800.00</span>
                </div>
                <div className="p-4 flex justify-between">
                  <span className="text-blue-700">Voice Calls</span>
                  <span className="font-semibold text-blue-900">LKR 150.00</span>
                </div>
                <div className="p-4 flex justify-between">
                  <span className="text-blue-700">Data Usage</span>
                  <span className="font-semibold text-blue-900">LKR 200.00</span>
                </div>
                <div className="p-4 flex justify-between">
                  <span className="text-blue-700">Value Added Services</span>
                  <span className="font-semibold text-blue-900">LKR 100.00</span>
                </div>
                <div className="p-4 bg-blue-50 flex justify-between">
                  <span className="font-semibold text-blue-900">Total Amount</span>
                  <span className="text-xl font-bold text-blue-900">LKR {selectedBill.amount.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleDownload(selectedBill)}
                className="flex-1 bg-blue-100 hover:bg-blue-200 text-blue-700 font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Download className="w-5 h-5" />
                Download PDF
              </button>
              {selectedBill.status === 'pending' && (
                <button className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Pay Now
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
