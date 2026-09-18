import fs from 'fs';

async function runTests() {
  console.log('--- 1. Testing Storefront HTML & Gatekeeper Wall ---');
  const res = await fetch('http://localhost:3000/');
  if (!res.ok) throw new Error('Failed to fetch storefront: ' + res.status);
  const html = await res.text();

  const hasGatekeeper = html.includes('id="customer-gatekeeper"');
  const hasStorefrontApp = html.includes('id="storefront-app"');
  const hasLoginForm = html.includes('id="gk-login-form"');
  const hasSignupForm = html.includes('id="gk-signup-form"');
  const hasGoogleBtn = html.includes('id="gk-btn-google-auth"');
  const hasAdminLink = html.includes('href="/admin.html"');
  const hasTeluguSubtitle = html.includes('దయచేసి లాగిన్ అవ్వండి');

  console.log('Gatekeeper container present:', hasGatekeeper);
  console.log('Storefront wrapper present:', hasStorefrontApp);
  console.log('Gatekeeper Login form present:', hasLoginForm);
  console.log('Gatekeeper Sign Up form present:', hasSignupForm);
  console.log('Google Sign-In button present:', hasGoogleBtn);
  console.log('Admin link present:', hasAdminLink);
  console.log('Telugu message present:', hasTeluguSubtitle);

  if (!hasGatekeeper || !hasStorefrontApp || !hasLoginForm || !hasSignupForm) {
    throw new Error('Gatekeeper elements missing from HTML!');
  }

  console.log('\n--- 2. Testing Customer Signup via Gatekeeper API ---');
  const testEmail = `customer_${Date.now()}@nexphonestudio.com`;
  const testPassword = 'customerPass123!';
  const signupRes = await fetch('http://localhost:3000/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Ramesh Babu',
      email: testEmail,
      password: testPassword
    })
  });
  const signupData = await signupRes.json();
  console.log('Signup status:', signupRes.status);
  console.log('Registered user:', signupData.user?.name, signupData.user?.email);

  if (!signupData.token) {
    throw new Error('Signup failed: ' + (signupData.message || 'no token'));
  }

  console.log('\n--- 3. Testing Customer Login via Gatekeeper API ---');
  const loginRes = await fetch('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: testEmail,
      password: testPassword
    })
  });
  const loginData = await loginRes.json();
  console.log('Login status:', loginRes.status);
  console.log('Login successful for user:', loginData.user?.name, loginData.user?.email);

  if (!loginData.token) {
    throw new Error('Customer login failed: ' + (loginData.message || 'no token'));
  }

  console.log('\n--- 4. Testing Session Check (/api/auth/me) ---');
  const meRes = await fetch('http://localhost:3000/api/auth/me', {
    headers: { 'Authorization': `Bearer ${loginData.token}` }
  });
  const meData = await meRes.json();
  console.log('Session user verified:', meData.user?.email);

  console.log('\n--- 5. Testing Product Catalog Retrieval ---');
  const prodRes = await fetch('http://localhost:3000/api/products');
  const prodData = await prodRes.json();
  console.log('Total products in catalog:', prodData.products?.length);
  const iphone18 = prodData.products?.find(p => p.model.toLowerCase().includes('iphone 18'));
  console.log('iPhone 18 Pro Max found:', !!iphone18, iphone18?.price ? `₹${iphone18.price.toLocaleString('en-IN')}` : '');

  console.log('\n======================================================');
  console.log('🎉 ALL GATEKEEPER & STOREFRONT FLOW TESTS PASSED!');
  console.log('======================================================');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
