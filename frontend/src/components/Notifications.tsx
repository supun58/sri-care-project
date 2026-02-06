import { useState, useEffect } from 'react';
import { Bell, Mail, MessageSquare, AlertCircle, CheckCircle, Info, XCircle, RefreshCw } from 'lucide-react';
import type { User } from '../App';
import { api } from '../api/api';

type RawNotificationEvent = {
  id: string;
  event: string;
  payload: any;
  createdAt: string;
};

type Notification = {
  id: string;
  type: 'bill' | 'service' | 'payment' | 'alert';
  priority: 'high' | 'medium' | 'low';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  actionLink?: 'bills' | 'payments' | 'services' | 'overview';
  actionLabel?: string;
};

type NotificationsProps = {
  user: User;
  onNavigate?: (tab: 'bills' | 'payments' | 'services' | 'overview') => void;
};

export function Notifications({ user, onNavigate }: NotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastPoll, setLastPoll] = useState<Date | null>(null);

  const [filter, setFilter] = useState<'all' | 'unread' | 'bill' | 'service' | 'payment' | 'alert'>('all');
  const [notificationPreferences, setNotificationPreferences] = useState({
    email: true,
    sms: true,
    push: true,
    billReminders: true,
    serviceUpdates: true,
    promotions: false
  });

  // Parse raw notification event into UI notification
  const parseNotificationEvent = (rawEvent: RawNotificationEvent): Notification => {
    const payload = rawEvent.payload || {};
    let type: Notification['type'] = 'alert';
    let priority: Notification['priority'] = 'medium';
    let title = 'Notification';
    let message = payload.message || 'You have a new notification';
    let actionLink: Notification['actionLink'] | undefined;
    let actionLabel: string | undefined;

    // Parse based on event type
    if (rawEvent.event === 'payment.completed' || rawEvent.event === 'payment.events' || rawEvent.event.includes('payment')) {
      type = 'payment';
      priority = 'low';
      title = 'Payment Successful';
      message = `Payment of LKR ${payload.amount || '0.00'} has been processed successfully.`;
      if (payload.billId) {
        message += ` Bill ID: ${payload.billId}.`;
      }
      actionLink = 'bills';
      actionLabel = 'View Bills';
    } else if (rawEvent.event === 'service.activated' || rawEvent.event === 'provisioning.events' || rawEvent.event.includes('service')) {
      type = 'service';
      priority = 'medium';
      title = 'Service Update';
      if (payload.action === 'activated' || payload.status === 'active') {
        message = `Service "${payload.serviceName || 'service'}" has been activated on your account.`;
        actionLink = 'services';
        actionLabel = 'Manage Services';
      } else if (payload.action === 'deactivated') {
        message = `Service "${payload.serviceName || 'service'}" has been deactivated.`;
        actionLink = 'services';
        actionLabel = 'Manage Services';
      } else if (payload.action === 'disconnected') {
        type = 'alert';
        priority = 'high';
        title = 'Service Disconnected';
        message = `Service "${payload.serviceName || 'service'}" has been disconnected due to ${payload.reason || 'overdue payment'}.`;
        actionLink = 'payments';
        actionLabel = 'Make Payment';
      } else {
        message = payload.message || 'Your service status has been updated.';
        actionLink = 'services';
        actionLabel = 'View Services';
      }
    } else if (rawEvent.event.includes('bill')) {
      type = 'bill';
      priority = 'high';
      title = 'Bill Notification';
      if (payload.type === 'generated') {
        message = `Your bill for ${payload.period || 'this month'} is now available. Amount: LKR ${payload.amount || '0.00'}.`;
      } else if (payload.type === 'overdue') {
        priority = 'high';
        title = 'Overdue Bill Payment';
        message = `Your bill payment of LKR ${payload.amount || '0.00'} is overdue. Please pay to avoid service disconnection.`;
        actionLink = 'payments';
        actionLabel = 'Pay Now';
      } else if (payload.type === 'reminder') {
        message = `Payment reminder: Your bill of LKR ${payload.amount || '0.00'} is due in ${payload.daysLeft || '3'} days.`;
        actionLink = 'payments';
        actionLabel = 'Pay Bill';
      } else {
        message = payload.message || 'You have a new bill available.';
      }
      if (!actionLink) {
        actionLink = 'bills';
        actionLabel = 'View Bills';
      }
    }

    return {
      id: rawEvent.id,
      type,
      priority,
      title,
      message,
      timestamp: rawEvent.createdAt,
      read: false,
      actionLink,
      actionLabel
    };
  };

  // Fetch notifications from backend
  const fetchNotifications = async (showRefreshing = false) => {
    try {
      if (showRefreshing) setIsRefreshing(true);
      const response = await api.pollNotifications(user.id, false); // Don't drain, just peek
      if (response.data.success && response.data.data.events) {
        const rawEvents: RawNotificationEvent[] = response.data.data.events;
        
        // Parse raw events into UI notifications
        const parsedNotifications = rawEvents.map(parseNotificationEvent);
        
        // Merge with existing notifications from localStorage
        const storedNotifications = getStoredNotifications();
        const allNotificationIds = new Set(storedNotifications.map(n => n.id));
        
        // Add only new notifications
        const newNotifications = parsedNotifications.filter(n => !allNotificationIds.has(n.id));
        const merged = [...newNotifications, ...storedNotifications];
        
        // Sort by timestamp (newest first)
        merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        setNotifications(merged);
        saveNotifications(merged);
      }
      setLastPoll(new Date());
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setIsLoading(false);
      if (showRefreshing) setIsRefreshing(false);
    }
  };

  // Load notifications from localStorage
  const getStoredNotifications = (): Notification[] => {
    try {
      const stored = localStorage.getItem(`notifications_${user.id}`);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  // Save notifications to localStorage
  const saveNotifications = (notifs: Notification[]) => {
    try {
      localStorage.setItem(`notifications_${user.id}`, JSON.stringify(notifs));
    } catch (error) {
      console.error('Failed to save notifications:', error);
    }
  };

  // Initial load
  useEffect(() => {
    const stored = getStoredNotifications();
    setNotifications(stored);
    fetchNotifications();
  }, [user.id]);

  // Auto-poll every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchNotifications();
    }, 5000);

    return () => clearInterval(interval);
  }, [user.id]);

  const handleRefresh = () => {
    fetchNotifications(true);
  };

  const markAsRead = (id: string) => {
    const updated = notifications.map(n => 
      n.id === id ? { ...n, read: true } : n
    );
    setNotifications(updated);
    saveNotifications(updated);
  };

  const markAllAsRead = () => {
    const updated = notifications.map(n => ({ ...n, read: true }));
    setNotifications(updated);
    saveNotifications(updated);
  };

  const deleteNotification = (id: string) => {
    const updated = notifications.filter(n => n.id !== id);
    setNotifications(updated);
    saveNotifications(updated);
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
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-blue-900 mb-2">Notifications</h1>
          <p className="text-blue-600">
            Stay updated with your account activity {unreadCount > 0 && `(${unreadCount} unread)`}
          </p>
          {lastPoll && (
            <p className="text-xs text-blue-400 mt-1">
              Last updated: {lastPoll.toLocaleTimeString()}
            </p>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg font-medium transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
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
            {isLoading ? (
              <div className="bg-white rounded-xl shadow-lg border border-blue-100 p-12 text-center">
                <RefreshCw className="w-12 h-12 text-blue-400 mx-auto mb-3 animate-spin" />
                <p className="text-blue-600">Loading notifications...</p>
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="bg-white rounded-xl shadow-lg border border-blue-100 p-12 text-center">
                <Bell className="w-12 h-12 text-blue-300 mx-auto mb-3" />
                <p className="text-blue-600">No notifications found</p>
                <p className="text-sm text-blue-400 mt-2">New notifications will appear here</p>
              </div>
            ) : (
              filteredNotifications.map(notification => (
                <div
                  key={notification.id}
                  className={`bg-white rounded-xl shadow-lg border-2 p-5 transition-all ${
                    notification.read 
                      ? 'border-blue-100 opacity-75' 
                      : getPriorityColor(notification.priority)
                  } ${notification.actionLink ? 'cursor-pointer hover:shadow-xl hover:border-blue-300' : ''}`}
                  onClick={() => {
                    if (notification.actionLink && onNavigate) {
                      markAsRead(notification.id);
                      onNavigate(notification.actionLink);
                    }
                  }}
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
                        <div className="flex items-center gap-3">
                          <p className="text-xs text-blue-500">
                            {new Date(notification.timestamp).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit'
                            })}
                          </p>
                          {notification.actionLabel && onNavigate && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (notification.actionLink) {
                                  markAsRead(notification.id);
                                  onNavigate(notification.actionLink);
                                }
                              }}
                              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-full font-medium transition-colors"
                            >
                              {notification.actionLabel}
                            </button>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {!notification.read && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                markAsRead(notification.id);
                              }}
                              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                            >
                              Mark as read
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(notification.id);
                            }}
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
