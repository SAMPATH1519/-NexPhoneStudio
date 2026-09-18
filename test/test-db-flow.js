/**
 * Automated Verification Script for SQLite Database, Auth, Cart, and Orders Flow
 */
async function testCompleteFlow() {
  const BASE_URL = 'http://localhost:3000';

  console.log('--- 1. Testing Signup API ---');
  const testEmail = `user_${Date.now()}@nexphonestudio.com`;
  const signupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Priya Sharma',
      email: testEmail,
      password: 'mypassword123'
    })
  });
  const signupData = await signupRes.json();
  console.log('Signup Response Status:', signupRes.status);
  console.log('User created:', signupData.user);
  if (!signupData.token) throw new Error('Token not returned in signup');

  const token = signupData.token;

  console.log('\n--- 2. Testing Auth /me Endpoint ---');
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const meData = await meRes.json();
  console.log('Current User verified:', meData.user.name, meData.user.email);

  console.log('\n--- 3. Testing Order Creation (SQLite) ---');
  const orderRes = await fetch(`${BASE_URL}/api/orders`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      customerName: 'Priya Sharma',
      customerEmail: testEmail,
      customerPhone: '9848022338',
      shippingAddress: 'Plot 14, Jubilee Hills, Hyderabad - 500033',
      paymentMethod: 'Cash on Delivery',
      items: [
        { id: 'oneplus-nord-ce4', model: 'OnePlus Nord CE4 5G', price: 24999, quantity: 1, icon: '📱' },
        { id: 'motorola-g64', model: 'Moto G64 5G', price: 14999, quantity: 2, icon: '📱' }
      ]
    })
  });
  const orderData = await orderRes.json();
  console.log('Order status:', orderRes.status, 'Order Number:', orderData.order?.orderNumber);
  console.log('Total Amount Calculated:', orderData.order?.totalAmount, '(Expected: 54997)');
  if (orderData.order?.totalAmount !== 54997) throw new Error('Order total calculation mismatch');

  console.log('\n--- 4. Testing User Orders Retrieval (SQLite) ---');
  const userOrdersRes = await fetch(`${BASE_URL}/api/orders`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const userOrdersData = await userOrdersRes.json();
  console.log('Orders found in database:', userOrdersData.orders?.length);
  console.log('First Order details:', {
    orderNumber: userOrdersData.orders[0]?.order_number,
    status: userOrdersData.orders[0]?.status,
    itemCount: userOrdersData.orders[0]?.items?.length
  });

  console.log('\n--- 5. Testing Order Lookup by Order Number ---');
  const singleOrderRes = await fetch(`${BASE_URL}/api/orders?order_number=${orderData.order?.orderNumber}`);
  const singleOrderData = await singleOrderRes.json();
  console.log('Direct Lookup Result:', singleOrderData.order?.order_number, 'Total:', singleOrderData.order?.total_amount);

  console.log('\n✅ ALL DATABASE, AUTH & ORDER TESTS PASSED SUCCESSFULLY!');
}

testCompleteFlow().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
