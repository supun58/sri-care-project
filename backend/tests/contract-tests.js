const axios = require('axios');
const assert = require('assert');

// Test configuration
const API_BASE = process.env.API_BASE || 'http://localhost:8000/api';
const TEST_PHONE = '0771441117';
const TEST_PASSWORD = 'Test123!';

let authToken = null;
let userId = null;

async function runTests() {
  console.log('🧪 Starting API Contract Tests...\n');
  
  try {
    // Test 1: Auth - Register/Login
    console.log('📝 Test 1: Authentication');
    const loginRes = await axios.post(`${API_BASE}/auth/login`, {
      phone: TEST_PHONE,
      password: TEST_PASSWORD
    }).catch(async (err) => {
      if (err.response?.status === 404) {
        // Register first
        const regRes = await axios.post(`${API_BASE}/auth/register`, {
          phone: TEST_PHONE,
          password: TEST_PASSWORD,
          name: 'Test User'
        });
        return regRes;
      }
      throw err;
    });
    
    assert(loginRes.data.success, 'Login should succeed');
    assert(loginRes.data.token, 'Should return token');
    assert(loginRes.data.user, 'Should return user');
    authToken = loginRes.data.token;
    userId = loginRes.data.user.id;
    console.log('✅ Authentication passed\n');
    
    // Test 2: Services - List & Purchase (idempotency)
    console.log('📝 Test 2: Service Provisioning');
    const servicesRes = await axios.get(`${API_BASE}/services`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert(servicesRes.data.success, 'Should fetch services');
    assert(Array.isArray(servicesRes.data.services), 'Should return services array');
    
    if (servicesRes.data.services.length > 0) {
      const serviceId = servicesRes.data.services[0].id;
      const idempotencyKey = `test-${Date.now()}`;
      
      // First purchase
      const purchase1 = await axios.post(
        `${API_BASE}/services/purchase/${userId}/${serviceId}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Idempotency-Key': idempotencyKey
          }
        }
      );
      assert(purchase1.data.success, 'Purchase should succeed');
      
      // Replay with same key
      const purchase2 = await axios.post(
        `${API_BASE}/services/purchase/${userId}/${serviceId}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            'Idempotency-Key': idempotencyKey
          }
        }
      );
      assert(purchase2.data.success, 'Replay should succeed');
      assert(purchase2.data.idempotent === true, 'Should be marked idempotent');
      console.log('✅ Idempotency verified');
    }
    console.log('✅ Service provisioning passed\n');
    
    // Test 3: Payment - Idempotency
    console.log('📝 Test 3: Payment Processing');
    const paymentKey = `pay-test-${Date.now()}`;
    const payment1 = await axios.post(
      `${API_BASE}/payment/pay`,
      {
        amount: 100,
        cardNumber: '4111111111111111',
        billId: 1
      },
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Idempotency-Key': paymentKey
        }
      }
    );
    assert(payment1.data.success, 'Payment should succeed');
    assert(payment1.data.data.transactionId, 'Should return transaction ID');
    
    // Replay
    const payment2 = await axios.post(
      `${API_BASE}/payment/pay`,
      {
        amount: 100,
        cardNumber: '4111111111111111',
        billId: 1
      },
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          'Idempotency-Key': paymentKey
        }
      }
    );
    assert(payment2.data.success, 'Payment replay should succeed');
    assert(payment2.data.idempotent === true, 'Should be idempotent');
    assert(
      payment1.data.data.transactionId === payment2.data.data.transactionId,
      'Transaction IDs should match'
    );
    console.log('✅ Payment idempotency passed\n');
    
    // Test 4: Billing
    console.log('📝 Test 4: Billing');
    const billsRes = await axios.get(`${API_BASE}/billing/${userId}`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert(billsRes.data.success, 'Should fetch bills');
    assert(Array.isArray(billsRes.data.bills), 'Should return bills array');
    console.log('✅ Billing passed\n');
    
    // Test 5: Notifications
    console.log('📝 Test 5: Notifications');
    const notifRes = await axios.get(`${API_BASE}/notifications/poll/${userId}?drain=false`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert(notifRes.data.success, 'Should poll notifications');
    assert(notifRes.data.data.events !== undefined, 'Should return events');
    console.log('✅ Notifications passed\n');
    
    console.log('🎉 All contract tests passed!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

runTests();
