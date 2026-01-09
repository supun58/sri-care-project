import { useState } from 'react';
import { 
  LayoutDashboard, 
  Settings, 
  FileText, 
  CreditCard, 
  Bell, 
  MessageCircle,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import type { User } from '../App';
import { Overview } from './Overview';
import { Services } from './Services';
import { Bills } from './Bills';
import { Payments } from './Payments';
import { Notifications } from './Notifications';
import { Chat } from './Chat';

type DashboardProps = {
  user: User;
  onLogout: () => void;
};

type Tab = 'overview' | 'services' | 'bills' | 'payments' | 'notifications' | 'chat';

export function Dashboard({ user, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const menuItems = [
    { id: 'overview' as Tab, label: 'Overview', icon: LayoutDashboard },
    { id: 'services' as Tab, label: 'Services', icon: Settings },
    { id: 'bills' as Tab, label: 'Bills', icon: FileText },
    { id: 'payments' as Tab, label: 'Payments', icon: CreditCard },
    { id: 'notifications' as Tab, label: 'Notifications', icon: Bell },
    { id: 'chat' as Tab, label: 'Support Chat', icon: MessageCircle },
  ];

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-blue-50 to-blue-100">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-72 bg-white border-r border-blue-100 shadow-xl
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="h-full flex flex-col">
          {/* Logo and Close Button */}
          <div className="p-6 border-b border-blue-100 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-blue-900">Sri-Care</h1>
              <p className="text-sm text-blue-600">Customer Portal</p>
            </div>
            <button 
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-blue-600 hover:text-blue-800"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* User Info */}
          <div className="p-6 bg-gradient-to-r from-blue-600 to-blue-700 text-white">
            <h2 className="font-semibold mb-1">{user.name}</h2>
            <p className="text-sm text-blue-100">{user.mobile}</p>
            <p className="text-xs text-blue-200 mt-2">Account: {user.accountNumber}</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={`
                    w-full flex items-center px-4 py-3 rounded-lg mb-2 transition-colors
                    ${isActive 
                      ? 'bg-blue-600 text-white shadow-lg' 
                      : 'text-blue-700 hover:bg-blue-50'
                    }
                  `}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-blue-100">
            <button
              onClick={onLogout}
              className="w-full flex items-center px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            >
              <LogOut className="w-5 h-5 mr-3" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        {/* Mobile Header */}
        <div className="lg:hidden bg-white border-b border-blue-100 p-4 flex items-center justify-between sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-blue-600 hover:text-blue-800"
          >
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="font-semibold text-blue-900">Sri-Care</h1>
          <div className="w-6" /> {/* Spacer */}
        </div>

        {/* Content Area */}
        <div className="p-4 lg:p-8">
          {activeTab === 'overview' && <Overview user={user} />}
          {activeTab === 'services' && <Services />}
          {activeTab === 'bills' && <Bills />}
          {activeTab === 'payments' && <Payments />}
          {activeTab === 'notifications' && <Notifications />}
          {activeTab === 'chat' && <Chat user={user} />}
        </div>
      </main>
    </div>
  );
}
