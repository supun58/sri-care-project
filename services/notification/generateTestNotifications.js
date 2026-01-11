// Test script to generate notifications for testing high volume
const axios = require('axios');

const API_BASE = process.env.API_BASE || 'http://localhost:3005';

const notificationTemplates = [
  {
    event: 'bill.generated',
    payload: {
      type: 'generated',
      period: 'January 2026',
      amount: 1250.00,
      dueDate: '2026-02-15'
    }
  },
  {
    event: 'bill.reminder',
    payload: {
      type: 'reminder',
      amount: 1250.00,
      daysLeft: 3
    }
  },
  {
    event: 'bill.overdue',
    payload: {
      type: 'overdue',
      amount: 1250.00,
      daysPastDue: 5
    }
  },
  {
    event: 'payment.events',
    payload: {
      action: 'completed',
      amount: 1250.00,
      billId: 'BILL_123456'
    }
  },
  {
    event: 'provisioning.events',
    payload: {
      action: 'activated',
      serviceName: 'International Roaming',
      status: 'active'
    }
  },
  {
    event: 'provisioning.events',
    payload: {
      action: 'deactivated',
      serviceName: '5G Data Pack',
      status: 'inactive'
    }
  },
  {
    event: 'service.disconnected',
    payload: {
      action: 'disconnected',
      serviceName: 'Mobile Service',
      reason: 'overdue payment'
    }
  },
  {
    event: 'service.issue',
    payload: {
      type: 'network',
      message: 'Network maintenance scheduled for tonight 2AM-4AM'
    }
  }
];

async function generateNotifications(userId, count = 10) {
  console.log(`\n🔔 Generating ${count} test notifications for user ${userId}...`);
  
  for (let i = 0; i < count; i++) {
    const template = notificationTemplates[Math.floor(Math.random() * notificationTemplates.length)];
    
    try {
      await axios.post(`${API_BASE}/publish`, {
        userId: String(userId),
        event: template.event,
        payload: template.payload
      });
      console.log(`✅ ${i + 1}/${count}: ${template.event}`);
    } catch (error) {
      console.error(`❌ ${i + 1}/${count}: Failed -`, error.message);
    }
    
    // Small delay to simulate realistic timing (best effort delivery)
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\n✅ Completed generating ${count} notifications`);
}

// Generate notifications for user 1 (default test user)
const userId = process.argv[2] || '1';
const count = parseInt(process.argv[3] || '10');

generateNotifications(userId, count)
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
