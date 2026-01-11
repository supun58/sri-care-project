import { useState, useEffect } from 'react';
import { Globe, Music, Wifi, Phone, Zap, Shield, MessageSquare, Radio } from 'lucide-react';
import { api } from '../api/api';
import type { User } from '../App';

type Service = {
  id: number;
  name: string;
  description: string;
  icon: typeof Globe;
  price: number;
  category: 'data' | 'voice' | 'vas';
};

type UserService = {
  id: number;
  service_id: number;
  user_id: number;
  status: string;
  service_name: string;
  price: number;
};

type ServicesProps = {
  user: User;
  onRefreshUser?: () => Promise<void>;
  initialFilter?: string | null;
};

export function Services({ user, onRefreshUser, initialFilter }: ServicesProps) {
  const [allServices, setAllServices] = useState<Service[]>([]);
  const [userServices, setUserServices] = useState<UserService[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'data' | 'voice' | 'vas'>('all');
  const [showModal, setShowModal] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [actionType, setActionType] = useState<'activate' | 'deactivate'>('activate');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionStatus, setActionStatus] = useState<{ state: 'idle' | 'pending' | 'success' | 'retry' | 'error'; message: string; key?: string }>({ state: 'idle', message: '' });

  // Set initial filter if provided
  useEffect(() => {
    if (initialFilter && (initialFilter === 'data' || initialFilter === 'voice' || initialFilter === 'vas')) {
      setSelectedCategory(initialFilter);
    }
  }, [initialFilter]);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const [allRes, userRes] = await Promise.all([
          api.getServices(''),
          api.getUserServices(user.id)
        ]);
        
        if (allRes.data.success) {
          const servicesWithIcons = (allRes.data.services || []).map((s: any) => ({
            ...s,
            icon: getServiceIcon(s.name),
            category: getServiceCategory(s.name),
            description: s.description || 'Premium service'
          }));
          setAllServices(servicesWithIcons);
        }

        if (userRes.data.success) {
          setUserServices(userRes.data.services || []);
        }
      } catch (error) {
        console.error('Error fetching services:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user.id) {
      fetchServices();
    }
  }, [user.id]);

  function getServiceIcon(serviceName: string) {
    const name = serviceName.toLowerCase();
    if (name.includes('roaming') || name.includes('international')) return Globe;
    if (name.includes('tone') || name.includes('ring') || name.includes('music')) return Music;
    if (name.includes('data') || name.includes('wifi') || name.includes('5gb') || name.includes('10gb')) return Wifi;
    if (name.includes('call') || name.includes('voice') || name.includes('minute')) return Phone;
    if (name.includes('speed') || name.includes('turbo')) return Zap;
    if (name.includes('security') || name.includes('shield')) return Shield;
    if (name.includes('sms') || name.includes('message')) return MessageSquare;
    if (name.includes('voicemail') || name.includes('radio')) return Radio;
    return Globe;
  }

  function getServiceCategory(serviceName: string): 'data' | 'voice' | 'vas' {
    const name = serviceName.toLowerCase();
    if (name.includes('data') || name.includes('5gb') || name.includes('10gb') || name.includes('wifi')) return 'data';
    if (name.includes('call') || name.includes('voice') || name.includes('roaming') || name.includes('minute')) return 'voice';
    return 'vas';
  }

  const isServiceActive = (serviceId: number) => {
    return userServices.some(us => us.service_id === serviceId && us.status === 'active');
  };

  const handleToggleService = (service: Service) => {
    setSelectedService(service);
    setActionType(isServiceActive(service.id) ? 'deactivate' : 'activate');
    setShowModal(true);
    setActionError('');
    setActionStatus({ state: 'idle', message: '' });
  };

  const confirmAction = async () => {
    if (!selectedService) return;

    setActionLoading(true);
    setActionError('');
    const idemKey = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'idem-' + Math.random().toString(16).slice(2) + Date.now();
    setActionStatus({ state: 'pending', message: 'Submitting provisioning request...', key: idemKey });

    try {
      let response;
      if (actionType === 'activate') {
        response = await api.purchaseService(user.id, selectedService.id, {}, idemKey);
      } else {
        response = await api.deactivateService(user.id, selectedService.id);
      }

      if (response.data.success) {
        const replay = Boolean(response.data.idempotent);
        const message = replay ? 'Request already applied (idempotent replay)' : 'Request applied successfully';
        setActionStatus({ state: 'success', message, key: idemKey });
        // Refresh user services
        const userRes = await api.getUserServices(user.id);
        if (userRes.data.success) {
          setUserServices(userRes.data.services || []);
        }
        
        // Refresh user data in parent to update balance/data/minutes
        if (onRefreshUser) {
          await onRefreshUser();
        }
        
        setShowModal(false);
        setSelectedService(null);
      } else {
        const retry = response.data.code === 'provisioning_unavailable' || response.data.code === 'provisioning_circuit_open';
        setActionStatus({ state: retry ? 'retry' : 'error', message: response.data.message || 'Action failed', key: idemKey });
        setActionError(response.data.message || 'Action failed');
      }
    } catch (error: any) {
      setActionStatus({ state: 'error', message: error.response?.data?.message || 'An error occurred', key: idemKey });
      setActionError(error.response?.data?.message || 'An error occurred');
      console.error('Error:', error);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredServices = selectedCategory === 'all' 
    ? allServices
    : allServices.filter(s => s.category === selectedCategory);

  const categories = [
    { id: 'all' as const, label: 'All Services' },
    { id: 'data' as const, label: 'Data Services' },
    { id: 'voice' as const, label: 'Voice Services' },
    { id: 'vas' as const, label: 'Value Added' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-blue-600">Loading services...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-blue-900 mb-2">Manage Services</h1>
        <p className="text-blue-600">Activate or deactivate your telecommunication services</p>
      </div>

      {/* Category Filter */}
      <div className="mb-6 flex flex-wrap gap-2">
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedCategory === cat.id
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-blue-700 border border-blue-200 hover:bg-blue-50'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredServices.map(service => {
          const Icon = service.icon;
          const isActive = isServiceActive(service.id);
          return (
            <div
              key={service.id}
              className={`bg-white rounded-xl p-6 shadow-lg border-2 transition-all ${
                isActive
                  ? 'border-green-400 bg-green-50/50'
                  : 'border-blue-100 hover:border-blue-300'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  isActive
                    ? 'bg-green-100'
                    : 'bg-blue-100'
                }`}>
                  <Icon className={`w-6 h-6 ${
                    isActive
                      ? 'text-green-600'
                      : 'text-blue-600'
                  }`} />
                </div>
                {isActive && (
                  <span className="bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Active
                  </span>
                )}
              </div>

              <h3 className="font-semibold text-blue-900 mb-2">{service.name}</h3>
              <p className="text-sm text-blue-600 mb-3">{service.description}</p>

              {/* Service Benefits */}
              {service.category === 'data' && (
                <div className="text-xs bg-purple-50 p-2 rounded mb-3 text-purple-700">
                  📊 Adds data to your account
                </div>
              )}
              {service.category === 'voice' && (
                <div className="text-xs bg-green-50 p-2 rounded mb-3 text-green-700">
                  ☎️ Adds voice minutes to your account
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-blue-900">
                  LKR {service.price}/mo
                </span>
                <button
                  onClick={() => handleToggleService(service)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    isActive
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {isActive ? 'Deactivate' : 'Activate'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal */}
      {showModal && selectedService && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <h2 className="text-2xl font-bold text-blue-900 mb-4">
              {actionType === 'activate' ? 'Activate Service' : 'Deactivate Service'}
            </h2>
            <p className="text-blue-700 mb-6">
              Are you sure you want to {actionType} <strong>{selectedService.name}</strong>?
              {actionType === 'activate' && (
                <div className="block mt-3 space-y-2 text-sm bg-blue-50 p-3 rounded-lg">
                  <p>Monthly charge: LKR {selectedService.price}</p>
                  {user.accountType === 'prepaid' && (
                    <p className="text-blue-600">
                      This amount will be <strong>deducted</strong> from your account balance
                    </p>
                  )}
                  {user.accountType === 'postpaid' && (
                    <p className="text-orange-600">
                      This amount will be <strong>added</strong> to your current bill
                    </p>
                  )}
                </div>
              )}
              {actionType === 'deactivate' && (
                <div className="block mt-3 text-sm bg-yellow-50 p-3 rounded-lg text-yellow-800 border border-yellow-200">
                  Service charges will <strong>not be refunded</strong> if deactivated
                </div>
              )}
            </p>
            {actionError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                {actionError}
              </div>
            )}
            {actionStatus.state !== 'idle' && (
              <div className={`mb-4 p-3 rounded-lg border text-sm ${
                actionStatus.state === 'success'
                  ? 'bg-green-50 border-green-200 text-green-800'
                  : actionStatus.state === 'pending'
                  ? 'bg-blue-50 border-blue-200 text-blue-800'
                  : actionStatus.state === 'retry'
                  ? 'bg-yellow-50 border-yellow-200 text-yellow-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{actionStatus.message}</span>
                  {actionStatus.key && (
                    <span className="text-[11px] font-mono text-blue-700">{actionStatus.key}</span>
                  )}
                </div>
                {actionStatus.state === 'retry' && (
                  <p className="mt-2">Provisioning temporarily unavailable. Retry with the same key to avoid duplicate activation.</p>
                )}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={confirmAction}
                disabled={actionLoading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 rounded-lg transition-colors"
              >
                {actionLoading ? 'Processing...' : 'Confirm'}
              </button>
              <button
                onClick={() => setShowModal(false)}
                disabled={actionLoading}
                className="flex-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-400 text-gray-800 font-semibold py-3 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
