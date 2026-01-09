import { Smartphone, Globe, Music, Zap, AlertCircle, TrendingUp } from 'lucide-react';
import type { User } from '../App';

type OverviewProps = {
  user: User;
};

export function Overview({ user }: OverviewProps) {
  const accountBalance = 1250.00;
  const dataRemaining = 15.5;
  const minutesRemaining = 450;

  const activeServices = [
    { name: 'International Roaming', status: 'Active', icon: Globe, color: 'text-green-600' },
    { name: 'Ring-in Tone', status: 'Active', icon: Music, color: 'text-blue-600' },
    { name: 'Data Package - 25GB', status: 'Active', icon: Zap, color: 'text-purple-600' },
  ];

  const recentAlerts = [
    { 
      id: 1, 
      message: 'Bill for December 2025 is now available', 
      time: '2 hours ago',
      type: 'info'
    },
    { 
      id: 2, 
      message: 'Your data usage is at 62% for this cycle', 
      time: '1 day ago',
      type: 'warning'
    },
    { 
      id: 3, 
      message: 'Payment of LKR 850.00 received successfully', 
      time: '3 days ago',
      type: 'success'
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-8 text-white shadow-xl">
        <h1 className="text-3xl font-bold mb-2">Welcome back, {user.name.split(' ')[0]}!</h1>
        <p className="text-blue-100">Here's your account overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Account Balance */}
        <div className="bg-white rounded-xl p-6 shadow-lg border border-blue-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <Smartphone className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
              Current
            </span>
          </div>
          <h3 className="text-sm font-medium text-blue-700 mb-1">Account Balance</h3>
          <p className="text-2xl font-bold text-blue-900">LKR {accountBalance.toFixed(2)}</p>
          <p className="text-xs text-blue-600 mt-2">Due on Jan 15, 2026</p>
        </div>

        {/* Data Remaining */}
        <div className="bg-white rounded-xl p-6 shadow-lg border border-blue-100">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-xs font-medium text-purple-600 bg-purple-50 px-3 py-1 rounded-full">
              62%
            </span>
          </div>
          <h3 className="text-sm font-medium text-blue-700 mb-1">Data Remaining</h3>
          <p className="text-2xl font-bold text-blue-900">{dataRemaining} GB</p>
          <p className="text-xs text-blue-600 mt-2">of 25 GB package</p>
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
          <p className="text-xs text-blue-600 mt-2">Unlimited local calls</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Services */}
        <div className="bg-white rounded-xl p-6 shadow-lg border border-blue-100">
          <h2 className="text-xl font-semibold text-blue-900 mb-4">Active Services</h2>
          <div className="space-y-3">
            {activeServices.map((service, index) => {
              const Icon = service.icon;
              return (
                <div key={index} className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="flex items-center">
                    <div className={`w-10 h-10 ${service.color.replace('text-', 'bg-').replace('600', '100')} rounded-lg flex items-center justify-center mr-3`}>
                      <Icon className={`w-5 h-5 ${service.color}`} />
                    </div>
                    <div>
                      <p className="font-medium text-blue-900">{service.name}</p>
                      <p className="text-sm text-blue-600">{service.status}</p>
                    </div>
                  </div>
                  <div className={`w-2 h-2 rounded-full ${service.color.replace('text-', 'bg-')}`} />
                </div>
              );
            })}
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
          <button className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors">
            <Zap className="w-8 h-8 text-blue-600 mb-2 mx-auto" />
            <p className="text-sm font-medium text-blue-900">Top Up Data</p>
          </button>
          <button className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors">
            <Globe className="w-8 h-8 text-blue-600 mb-2 mx-auto" />
            <p className="text-sm font-medium text-blue-900">Roaming</p>
          </button>
          <button className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors">
            <Smartphone className="w-8 h-8 text-blue-600 mb-2 mx-auto" />
            <p className="text-sm font-medium text-blue-900">Pay Bill</p>
          </button>
          <button className="p-4 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200 transition-colors">
            <Music className="w-8 h-8 text-blue-600 mb-2 mx-auto" />
            <p className="text-sm font-medium text-blue-900">Ring Tone</p>
          </button>
        </div>
      </div>
    </div>
  );
}
