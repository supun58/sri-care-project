import { useState } from 'react';
import { Globe, Music, Wifi, Phone, Zap, Shield, MessageSquare, Radio } from 'lucide-react';

type Service = {
  id: string;
  name: string;
  description: string;
  icon: typeof Globe;
  price: number;
  active: boolean;
  category: 'data' | 'voice' | 'vas';
};

export function Services() {
  const [services, setServices] = useState<Service[]>([
    {
      id: '1',
      name: 'International Roaming',
      description: 'Use your mobile services while traveling abroad',
      icon: Globe,
      price: 500,
      active: true,
      category: 'voice'
    },
    {
      id: '2',
      name: 'Ring-in Tone',
      description: 'Personalize your caller tune',
      icon: Music,
      price: 50,
      active: true,
      category: 'vas'
    },
    {
      id: '3',
      name: 'Data Top-up 5GB',
      description: 'Additional 5GB data for 30 days',
      icon: Wifi,
      price: 250,
      active: false,
      category: 'data'
    },
    {
      id: '4',
      name: 'Data Top-up 10GB',
      description: 'Additional 10GB data for 30 days',
      icon: Wifi,
      price: 450,
      active: false,
      category: 'data'
    },
    {
      id: '5',
      name: 'Unlimited Calls Package',
      description: 'Unlimited local calls for 30 days',
      icon: Phone,
      price: 350,
      active: false,
      category: 'voice'
    },
    {
      id: '6',
      name: 'Call Waiting',
      description: 'Never miss a call while on another call',
      icon: Phone,
      price: 25,
      active: false,
      category: 'voice'
    },
    {
      id: '7',
      name: 'SMS Package 1000',
      description: '1000 SMS for 30 days',
      icon: MessageSquare,
      price: 100,
      active: false,
      category: 'vas'
    },
    {
      id: '8',
      name: 'Voicemail',
      description: 'Record messages when you are unavailable',
      icon: Radio,
      price: 30,
      active: false,
      category: 'vas'
    },
    {
      id: '9',
      name: 'Data Security Shield',
      description: 'Protect your mobile data with advanced security',
      icon: Shield,
      price: 150,
      active: false,
      category: 'vas'
    },
    {
      id: '10',
      name: '4G Turbo Boost',
      description: 'Enhanced 4G speeds for better streaming',
      icon: Zap,
      price: 200,
      active: false,
      category: 'data'
    }
  ]);

  const [selectedCategory, setSelectedCategory] = useState<'all' | 'data' | 'voice' | 'vas'>('all');
  const [showModal, setShowModal] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [actionType, setActionType] = useState<'activate' | 'deactivate'>('activate');

  const handleToggleService = (service: Service) => {
    setSelectedService(service);
    setActionType(service.active ? 'deactivate' : 'activate');
    setShowModal(true);
  };

  const confirmAction = () => {
    if (selectedService) {
      setServices(services.map(s => 
        s.id === selectedService.id 
          ? { ...s, active: !s.active }
          : s
      ));
      setShowModal(false);
      setSelectedService(null);
    }
  };

  const filteredServices = selectedCategory === 'all' 
    ? services 
    : services.filter(s => s.category === selectedCategory);

  const categories = [
    { id: 'all' as const, label: 'All Services' },
    { id: 'data' as const, label: 'Data Services' },
    { id: 'voice' as const, label: 'Voice Services' },
    { id: 'vas' as const, label: 'Value Added' }
  ];

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
          return (
            <div
              key={service.id}
              className={`bg-white rounded-xl p-6 shadow-lg border-2 transition-all ${
                service.active 
                  ? 'border-green-400 bg-green-50/50' 
                  : 'border-blue-100 hover:border-blue-300'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                  service.active 
                    ? 'bg-green-100' 
                    : 'bg-blue-100'
                }`}>
                  <Icon className={`w-6 h-6 ${
                    service.active 
                      ? 'text-green-600' 
                      : 'text-blue-600'
                  }`} />
                </div>
                {service.active && (
                  <span className="bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Active
                  </span>
                )}
              </div>

              <h3 className="font-semibold text-blue-900 mb-2">{service.name}</h3>
              <p className="text-sm text-blue-600 mb-4">{service.description}</p>
              
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-blue-900">
                  LKR {service.price}/mo
                </span>
                <button
                  onClick={() => handleToggleService(service)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    service.active
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {service.active ? 'Deactivate' : 'Activate'}
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
                <span className="block mt-2 text-sm">
                  Monthly charge: LKR {selectedService.price}
                </span>
              )}
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmAction}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-3 rounded-lg transition-colors"
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
