import { useState } from 'react';
import { Bell, Mail, MessageSquare, AlertCircle, CheckCircle, Info, XCircle } from 'lucide-react';

type Notification = {
  id: string;
  type: 'bill' | 'service' | 'payment' | 'alert';
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
};

export function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: '1',
      type: 'bill',
      priority: 'high',
      title: 'New Bill Available',
      message: 'Your bill for December 2025 is now available. Amount due: LKR 1,250.00. Due date: January 15, 2026.',
      timestamp: '2026-01-06T10:30:00',
      read: false
    },
    {
      id: '2',
      type: 'alert',
      priority: 'medium',
      title: 'Data Usage Alert',
      message: 'You have used 62% of your monthly data allowance (15.5 GB of 25 GB remaining).',
      timestamp: '2026-01-07T14:20:00',
      read: false
    },
    {
      id: '3',
      type: 'payment',
      priority: 'low',
      title: 'Payment Received',
      message: 'Payment of LKR 1,100.00 has been successfully processed for your November 2025 bill.',
      timestamp: '2025-12-10T09:15:00',
      read: true
    },
    {
      id: '4',
      type: 'service',
      priority: 'medium',
      title: 'Service Activated',
      message: 'International Roaming service has been successfully activated on your account.',
      timestamp: '2025-12-05T16:45:00',
      read: true
    },
    {
      id: '5',
      type: 'bill',
      priority: 'high',
      title: 'Payment Reminder',
      message: 'Your bill payment is due in 3 days. Please make the payment to avoid service disconnection.',
      timestamp: '2026-01-05T08:00:00',
      read: false
    },
    {
      id: '6',
      type: 'alert',
      priority: 'low',
      title: 'Network Maintenance',
      message: 'Scheduled network maintenance on January 10, 2026 from 2:00 AM to 4:00 AM. Some services may be temporarily unavailable.',
      timestamp: '2026-01-04T12:00:00',
      read: true
    },
    {
      id: '7',
      type: 'service',
      priority: 'low',
      title: 'New Feature Available',
      message: 'Check out our new 5G data packages! Get faster speeds and better coverage.',
      timestamp: '2026-01-03T11:30:00',
      read: true
    }
  ]);

  const [filter, setFilter] = useState<'all' | 'unread' | 'bill' | 'service' | 'payment' | 'alert'>('all');
  const [notificationPreferences, setNotificationPreferences] = useState({
    email: true,
    sms: true,
    push: true,
    billReminders: true,
    serviceUpdates: true,
    promotions: false
  });

  const markAsRead = (id: string) => {
    setNotifications(notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    ));
  };

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (id: string) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  const getFilteredNotifications = () => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter(n => !n.read);
    return notifications.filter(n => n.type === filter);
  };

  const getNotificationIcon = (type: string, priority: string) => {
    if (type === 'bill') return <AlertCircle className="w-5 h-5 text-yellow-600" />;
    if (type === 'payment') return <CheckCircle className="w-5 h-5 text-green-600" />;
    if (type === 'service') return <Info className="w-5 h-5 text-blue-600" />;
    if (type === 'alert' && priority === 'high') return <XCircle className="w-5 h-5 text-red-600" />;
    return <Bell className="w-5 h-5 text-blue-600" />;
  };

  const getPriorityColor = (priority: string) => {
    if (priority === 'high') return 'border-red-200 bg-red-50';
    if (priority === 'medium') return 'border-yellow-200 bg-yellow-50';
    return 'border-blue-200 bg-blue-50';
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const filteredNotifications = getFilteredNotifications();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-blue-900 mb-2">Notifications</h1>
        <p className="text-blue-600">
          Stay updated with your account activity {unreadCount > 0 && `(${unreadCount} unread)`}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Notifications List */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filter Tabs */}
          <div className="bg-white rounded-xl shadow-lg border border-blue-100 p-4">
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                { id: 'all', label: 'All' },
                { id: 'unread', label: 'Unread', count: unreadCount },
                { id: 'bill', label: 'Bills' },
                { id: 'payment', label: 'Payments' },
                { id: 'service', label: 'Services' },
                { id: 'alert', label: 'Alerts' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id as any)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    filter === tab.id
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined && tab.count > 0 && (
                    <span className="ml-2 bg-white text-blue-600 px-2 py-0.5 rounded-full text-xs font-semibold">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notifications */}
          <div className="space-y-3">
            {filteredNotifications.length === 0 ? (
              <div className="bg-white rounded-xl shadow-lg border border-blue-100 p-12 text-center">
                <Bell className="w-12 h-12 text-blue-300 mx-auto mb-3" />
                <p className="text-blue-600">No notifications found</p>
              </div>
            ) : (
              filteredNotifications.map(notification => (
                <div
                  key={notification.id}
                  className={`bg-white rounded-xl shadow-lg border-2 p-5 transition-all ${
                    notification.read 
                      ? 'border-blue-100 opacity-75' 
                      : getPriorityColor(notification.priority)
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      notification.read ? 'bg-blue-100' : 'bg-white'
                    }`}>
                      {getNotificationIcon(notification.type, notification.priority)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className={`font-semibold ${
                          notification.read ? 'text-blue-700' : 'text-blue-900'
                        }`}>
                          {notification.title}
                        </h3>
                        {!notification.read && (
                          <span className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-2" />
                        )}
                      </div>
                      <p className={`text-sm mb-3 ${
                        notification.read ? 'text-blue-600' : 'text-blue-800'
                      }`}>
                        {notification.message}
                      </p>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-blue-500">
                          {new Date(notification.timestamp).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </p>
                        <div className="flex gap-2">
                          {!notification.read && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Mark as read
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotification(notification.id)}
                            className="text-xs text-red-600 hover:text-red-800 font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Notification Preferences */}
        <div className="bg-white rounded-xl shadow-lg border border-blue-100 p-6 h-fit">
          <h2 className="text-xl font-semibold text-blue-900 mb-6">Notification Settings</h2>
          
          <div className="space-y-6">
            <div>
              <h3 className="font-medium text-blue-900 mb-4">Delivery Channels</h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors">
                  <div className="flex items-center">
                    <Mail className="w-5 h-5 text-blue-600 mr-3" />
                    <span className="text-blue-900">Email</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notificationPreferences.email}
                    onChange={(e) => setNotificationPreferences({
                      ...notificationPreferences,
                      email: e.target.checked
                    })}
                    className="w-5 h-5 text-blue-600 border-blue-300 rounded focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors">
                  <div className="flex items-center">
                    <MessageSquare className="w-5 h-5 text-blue-600 mr-3" />
                    <span className="text-blue-900">SMS</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notificationPreferences.sms}
                    onChange={(e) => setNotificationPreferences({
                      ...notificationPreferences,
                      sms: e.target.checked
                    })}
                    className="w-5 h-5 text-blue-600 border-blue-300 rounded focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors">
                  <div className="flex items-center">
                    <Bell className="w-5 h-5 text-blue-600 mr-3" />
                    <span className="text-blue-900">Push Notifications</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={notificationPreferences.push}
                    onChange={(e) => setNotificationPreferences({
                      ...notificationPreferences,
                      push: e.target.checked
                    })}
                    className="w-5 h-5 text-blue-600 border-blue-300 rounded focus:ring-blue-500"
                  />
                </label>
              </div>
            </div>

            <div>
              <h3 className="font-medium text-blue-900 mb-4">Notification Types</h3>
              <div className="space-y-3">
                <label className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors">
                  <span className="text-blue-900">Bill Reminders</span>
                  <input
                    type="checkbox"
                    checked={notificationPreferences.billReminders}
                    onChange={(e) => setNotificationPreferences({
                      ...notificationPreferences,
                      billReminders: e.target.checked
                    })}
                    className="w-5 h-5 text-blue-600 border-blue-300 rounded focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors">
                  <span className="text-blue-900">Service Updates</span>
                  <input
                    type="checkbox"
                    checked={notificationPreferences.serviceUpdates}
                    onChange={(e) => setNotificationPreferences({
                      ...notificationPreferences,
                      serviceUpdates: e.target.checked
                    })}
                    className="w-5 h-5 text-blue-600 border-blue-300 rounded focus:ring-blue-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100 cursor-pointer hover:bg-blue-100 transition-colors">
                  <span className="text-blue-900">Promotions & Offers</span>
                  <input
                    type="checkbox"
                    checked={notificationPreferences.promotions}
                    onChange={(e) => setNotificationPreferences({
                      ...notificationPreferences,
                      promotions: e.target.checked
                    })}
                    className="w-5 h-5 text-blue-600 border-blue-300 rounded focus:ring-blue-500"
                  />
                </label>
              </div>
            </div>

            <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors">
              Save Preferences
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
