import { useState, useEffect } from 'react';
import { Smartphone, Globe, Music, Zap, AlertCircle, TrendingUp, CreditCard } from 'lucide-react';
import type { User } from '../App';
import { api } from '../api/api';

type OverviewProps = {
  user: User;
  onNavigateToServices?: (tab: string, filter?: string) => void;
  onRefreshUser?: () => Promise<void>;
};

type UserService = {
  id: number;
  service_id: number;
  user_id: number;
  status: string;
  service_name: string;
  price: number;
  activated_at?: string;
};

export function Overview({ user, onNavigateToServices, onRefreshUser }: OverviewProps) {
  const [userServices, setUserServices] = useState<UserService[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [selectedService, setSelectedService] = useState<UserService | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [deactivateError, setDeactivateError] = useState('');

  useEffect(() => {
    const fetchUserServices = async () => {
      try {
        const response = await api.getUserServices(user.id);
        if (response.data.success) {
          setUserServices(response.data.services || []);
        }
      } catch (error) {
        console.error('Error fetching services:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user.id) {
      fetchUserServices();
    }
  }, [user.id, user.accountBalance, user.dataRemaining, user.minutesRemaining]);

  const handleDeactivateClick = (service: UserService) => {
    setSelectedService(service);
    setShowDeactivateModal(true);
    setDeactivateError('');
  };

  const confirmDeactivate = async () => {
    if (!selectedService) return;

    setDeactivating(true);
    setDeactivateError('');

    try {
      const response = await api.deactivateService(user.id, selectedService.service_id);
      
      if (response.data.success) {
        // Refresh user services
        const userRes = await api.getUserServices(user.id);
        if (userRes.data.success) {
          setUserServices(userRes.data.services || []);
        }
        
        // Refresh user data to update balance/bill
        if (onRefreshUser) {
          await onRefreshUser();
        }
        
        setShowDeactivateModal(false);
        setSelectedService(null);
      } else {
        setDeactivateError(response.data.message || 'Deactivation failed');
      }
    } catch (error: any) {
      setDeactivateError(error.response?.data?.message || 'An error occurred');
      console.error('Error:', error);
    } finally {
      setDeactivating(false);
    }
  };

  const accountBalance = user.accountBalance || 0;
  const currentBill = user.currentBill || 0;
  const dataRemaining = user.dataRemaining || 0;
  const minutesRemaining = user.minutesRemaining || 0;
  const isPrepaid = user.accountType === 'prepaid';

  const activeServices = userServices
    .filter(s => s.status === 'active')
    .map(s => ({
      id: s.id,
      name: s.service_name,
      status: 'Active',
      icon: getServiceIcon(s.service_name),
      color: getServiceColor(s.service_name),
      price: s.price
    }));

  function getServiceIcon(serviceName: string) {
    if (serviceName.includes('Roaming')) return Globe;
    if (serviceName.includes('Tone') || serviceName.includes('Ring')) return Music;
    if (serviceName.includes('Data')) return Zap;
    return Smartphone;
  }

  function getServiceColor(serviceName: string) {
    if (serviceName.includes('Roaming')) return 'text-green-600';
    if (serviceName.includes('Tone') || serviceName.includes('Ring')) return 'text-blue-600';
    if (serviceName.includes('Data')) return 'text-purple-600';
    return 'text-blue-600';
  }

  // Generate alerts including recent service activations
  const recentServiceActivations = userServices
    .filter(s => s.status === 'active')
    .slice(0, 2)
    .map(s => ({
      id: `service-${s.id}`,
      message: `Service activated: ${s.service_name}`,
      time: 'Recently',
      type: 'success' as const
    }));

  const recentAlerts = [
    ...recentServiceActivations,
    { 
      id: 'balance', 
      message: isPrepaid 
        ? (accountBalance > 0 ? `Account Balance: LKR ${accountBalance.toFixed(2)}` : 'Account balance is zero') 
        : `Current Bill: LKR ${currentBill.toFixed(2)}`, 
      time: 'Now',
      type: ((isPrepaid && accountBalance === 0) || (!isPrepaid && currentBill > 0) ? 'warning' : 'info') as const
    },
    { 
      id: 'data', 
      message: `You have ${dataRemaining} GB of data remaining`, 
      time: 'Now',
      type: (dataRemaining < 5 ? 'warning' : 'info') as const
    },
  ].slice(0, 3);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-8 text-white shadow-xl">
        <h1 className="text-3xl font-bold mb-2">Welcome back, {user.name.split(' ')[0]}!</h1>
        <p className="text-blue-100">Here's your account overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Account Balance or Current Bill */}
        <div className={`bg-white rounded-xl p-6 shadow-lg border ${isPrepaid ? 'border-blue-100' : 'border-orange-100'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              isPrepaid ? 'bg-blue-100' : 'bg-orange-100'
            }`}>
              {isPrepaid ? (
                <Smartphone className={`w-6 h-6 ${isPrepaid ? 'text-blue-600' : 'text-orange-600'}`} />
              ) : (
                <CreditCard className="w-6 h-6 text-orange-600" />
              )}
            </div>
            <span className={`text-xs font-medium px-3 py-1 rounded-full ${
              isPrepaid 
                ? 'text-blue-600 bg-blue-50' 
                : 'text-orange-600 bg-orange-50'
            }`}>
              {isPrepaid ? 'Prepaid' : 'Postpaid'}
            </span>
          </div>
          <h3 className={`text-sm font-medium mb-1 ${isPrepaid ? 'text-blue-700' : 'text-orange-700'}`}>
            {isPrepaid ? 'Account Balance' : 'Current Bill'}
          </h3>
          <p className={`text-2xl font-bold ${isPrepaid ? 'text-blue-900' : 'text-orange-900'}`}>
            LKR {isPrepaid ? accountBalance.toFixed(2) : currentBill.toFixed(2)}
          </p>
          <p className={`text-xs mt-2 ${isPrepaid ? 'text-blue-600' : 'text-orange-600'}`}>
            {isPrepaid 
              ? accountBalance === 0 ? 'New account - no balance yet' : 'Deducted when you add services'
              : currentBill === 0 ? 'No charges yet' : 'Charges added when you add services'
            }
          </p>
        </div>

        {/* Data Remaining */}
        <div className="bg-white rounded-xl p-6 shadow-lg border border-blue-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-purple-600 bg-purple-50 px-3 py-1 rounded-full">
              {dataRemaining === 0 ? 'New' : Math.round((dataRemaining / 25) * 100) + '%'}
            </span>
          </div>
          <h3 className="text-sm font-medium text-blue-700 mb-1">Data Remaining</h3>
          <p className="text-2xl font-bold text-blue-900">{dataRemaining} GB</p>
          <p className="text-xs text-blue-600 mt-2">{dataRemaining === 0 ? 'No active data package' : 'of 25 GB package'}</p>
        </div>

        {/* Minutes Remaining */}
        <div className="bg-white rounded-xl p-6 shadow-lg border border-blue-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-xs font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full">
              Active
            </span>
          </div>
          <h3 className="text-sm font-medium text-blue-700 mb-1">Voice Minutes</h3>
          <p className="text-2xl font-bold text-blue-900">{minutesRemaining} mins</p>
          <p className="text-xs text-blue-600 mt-2">{minutesRemaining === 0 ? 'Add a voice plan to get minutes' : 'Unlimited local calls'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Services */}
        <div className="bg-white rounded-xl p-6 shadow-lg border border-blue-100">
          <h2 className="text-xl font-semibold text-blue-900 mb-4">Active Services</h2>
          <div className="space-y-3">
            {activeServices.length === 0 ? (
              <p className="text-blue-600 text-center py-4">No active services</p>
            ) : (
              activeServices.map((service, index) => {
                const Icon = service.icon;
                const userService = userServices.find(us => us.service_name === service.name);
                return (
                  <button
                    key={index}
                    onClick={() => userService && handleDeactivateClick(userService)}
                    className="w-full flex items-center justify-between p-4 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-100 transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center">
                      <div className={`w-10 h-10 ${service.color.replace('text-', 'bg-').replace('600', '100')} rounded-lg flex items-center justify-center mr-3`}>
                        <Icon className={`w-5 h-5 ${service.color}`} />
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-blue-900">{service.name}</p>
                        <p className="text-sm text-blue-600">{service.status} • Click to deactivate</p>
                      </div>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${service.color.replace('text-', 'bg-')} group-hover:w-3 group-hover:h-3 transition-all`} />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="bg-white rounded-xl p-6 shadow-lg border border-blue-100">
          <h2 className="text-xl font-semibold text-blue-900 mb-4">Recent Alerts</h2>
          <div className="space-y-3">
            {recentAlerts.map((alert) => (
              <div key={alert.id} className="flex items-start p-4 bg-blue-50 rounded-lg border border-blue-100">
                <AlertCircle className={`w-5 h-5 mr-3 flex-shrink-0 mt-0.5 ${
                  alert.type === 'info' ? 'text-blue-600' :
                  alert.type === 'warning' ? 'text-yellow-600' :
                  'text-green-600'
                }`} />
                <div className="flex-1">
                  <p className="text-sm text-blue-900">{alert.message}</p>
                  <p className="text-xs text-blue-600 mt-1">{alert.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl p-6 shadow-lg border border-blue-100">
        <h2 className="text-xl font-semibold text-blue-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button 
            onClick={() => onNavigateToServices?.('services', 'data')}
            className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
          >
            <Zap className="w-8 h-8 text-blue-600 mb-2 mx-auto" />
            <p className="text-sm font-medium text-blue-900">Top Up Data</p>
          </button>
          <button 
            onClick={() => onNavigateToServices?.('services', 'vas')}
            className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
          >
            <Globe className="w-8 h-8 text-blue-600 mb-2 mx-auto" />
            <p className="text-sm font-medium text-blue-900">Roaming</p>
          </button>
          <button 
            onClick={() => onNavigateToServices?.('payments')}
            className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
          >
            <Smartphone className="w-8 h-8 text-blue-600 mb-2 mx-auto" />
            <p className="text-sm font-medium text-blue-900">Pay Bill</p>
          </button>
          <button 
            onClick={() => onNavigateToServices?.('services', 'vas')}
            className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors"
          >
            <Music className="w-8 h-8 text-blue-600 mb-2 mx-auto" />
            <p className="text-sm font-medium text-blue-900">Ring Tone</p>
          </button>
        </div>
      </div>

      {/* Deactivate Service Modal */}
      {showDeactivateModal && selectedService && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-xl font-bold text-blue-900 mb-4">Deactivate Service</h3>
            <p className="text-blue-700 mb-4">
              Are you sure you want to deactivate <span className="font-semibold">{selectedService.service_name}</span>?
            </p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-yellow-800">
                <span className="font-semibold">Note:</span> Service will be deactivated immediately. No refunds will be provided.
              </p>
            </div>
            {deactivateError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                <p className="text-sm text-red-800">{deactivateError}</p>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeactivateModal(false);
                  setSelectedService(null);
                  setDeactivateError('');
                }}
                disabled={deactivating}
                className="flex-1 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeactivate}
                disabled={deactivating}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                {deactivating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Deactivating...
                  </>
                ) : (
                  'Deactivate'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
