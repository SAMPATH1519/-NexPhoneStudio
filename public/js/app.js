/**
 * NexPhone Studio - Storefront Frontend Controller
 * Manages product rendering, filtering, interactive Cart, SQLite Auth, Orders, and Firebase
 */
import * as fb from './firebase-service.js';

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Firebase (if configured)
  fb.initFirebase();
  // Application State
  const state = {
    searchQuery: '',
    selectedBrand: 'all',
    selectedPriceRange: 'all',
    selectedRam: 'all',
    products: typeof PRODUCTS_DATA !== 'undefined' ? PRODUCTS_DATA : [],
    cart: JSON.parse(localStorage.getItem('nex_cart') || '[]'),
    token: localStorage.getItem('nex_token') || null,
    user: null
  };

  // DOM Elements - Catalog & Filters
  const productGrid = document.getElementById('product-grid');
  const resultsCount = document.getElementById('results-count');
  const searchInput = document.getElementById('search-input');
  const brandChips = document.querySelectorAll('[data-brand-filter]');
  const priceChips = document.querySelectorAll('[data-price-filter]');
  const ramChips = document.querySelectorAll('[data-ram-filter]');
  const modalBackdrop = document.getElementById('specs-modal-backdrop');
  const modalContent = document.getElementById('modal-specs-content');
  const modalCloseBtn = document.getElementById('modal-close-btn');

  // DOM Elements - Cart Drawer
  const navCartBtn = document.getElementById('nav-cart-btn');
  const cartCountBadge = document.getElementById('cart-count-badge');
  const cartDrawerBackdrop = document.getElementById('cart-drawer-backdrop');
  const cartCloseBtn = document.getElementById('cart-close-btn');
  const cartItemsList = document.getElementById('cart-items-list');
  const cartEmptyState = document.getElementById('cart-empty-state');
  const cartDrawerFooter = document.getElementById('cart-drawer-footer');
  const cartDrawerBadge = document.getElementById('cart-drawer-badge');
  const cartTotalPrice = document.getElementById('cart-total-price');
  const cartCheckoutBtn = document.getElementById('cart-checkout-btn');

  // DOM Elements - Auth Modal
  const navAuthBtn = document.getElementById('nav-auth-btn');
  const navAuthLabel = document.getElementById('nav-auth-label');
  const userNavWrapper = document.getElementById('user-nav-wrapper');
  const userDropdownMenu = document.getElementById('user-dropdown-menu');
  const dropdownUserName = document.getElementById('dropdown-user-name');
  const dropdownUserEmail = document.getElementById('dropdown-user-email');
  const dropdownMyOrdersBtn = document.getElementById('dropdown-my-orders-btn');
  const dropdownLogoutBtn = document.getElementById('dropdown-logout-btn');
  const authModalBackdrop = document.getElementById('auth-modal-backdrop');
  const authCloseBtn = document.getElementById('auth-close-btn');
  const tabLoginBtn = document.getElementById('tab-login-btn');
  const tabSignupBtn = document.getElementById('tab-signup-btn');
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const authAlert = document.getElementById('auth-alert');

  // DOM Elements - Checkout Modal
  const checkoutModalBackdrop = document.getElementById('checkout-modal-backdrop');
  const checkoutCloseBtn = document.getElementById('checkout-close-btn');
  const checkoutForm = document.getElementById('checkout-form');
  const checkoutName = document.getElementById('checkout-name');
  const checkoutPhone = document.getElementById('checkout-phone');
  const checkoutEmail = document.getElementById('checkout-email');
  const checkoutAddress = document.getElementById('checkout-address');
  const checkoutItemsPreview = document.getElementById('checkout-items-preview');
  const checkoutSummarySubtotal = document.getElementById('checkout-summary-subtotal');
  const checkoutSummaryTotal = document.getElementById('checkout-summary-total');
  const checkoutBtnTotal = document.getElementById('checkout-btn-total');
  const checkoutAlert = document.getElementById('checkout-alert');

  // DOM Elements - Success & Orders Modals
  const successModalBackdrop = document.getElementById('success-modal-backdrop');
  const successCloseBtn = document.getElementById('success-close-btn');
  const successOrderNumber = document.getElementById('success-order-number');
  const successCustomerEmail = document.getElementById('success-customer-email');
  const successViewOrdersBtn = document.getElementById('success-view-orders-btn');
  const successContinueBtn = document.getElementById('success-continue-btn');
  const ordersModalBackdrop = document.getElementById('orders-modal-backdrop');
  const ordersCloseBtn = document.getElementById('orders-close-btn');
  const ordersListContainer = document.getElementById('orders-list-container');

  // =========================================================================
  // Initial Setup
  // =========================================================================
  renderProducts();
  renderCart();
  checkAuthSession();

  // =========================================================================
  // Filter & Search Handling
  // =========================================================================
  let debounceTimeout;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        state.searchQuery = e.target.value.trim().toLowerCase();
        renderProducts();
      }, 200);
    });
  }

  brandChips.forEach(chip => {
    chip.addEventListener('click', () => {
      brandChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.selectedBrand = chip.getAttribute('data-brand-filter');
      renderProducts();
    });
  });

  priceChips.forEach(chip => {
    chip.addEventListener('click', () => {
      priceChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.selectedPriceRange = chip.getAttribute('data-price-filter');
      renderProducts();
    });
  });

  ramChips.forEach(chip => {
    chip.addEventListener('click', () => {
      ramChips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.selectedRam = chip.getAttribute('data-ram-filter');
      renderProducts();
    });
  });

  function getFilteredProducts() {
    return state.products.filter(p => {
      if (state.searchQuery) {
        const query = state.searchQuery;
        const matchTitle = p.model.toLowerCase().includes(query);
        const matchBrand = p.brand.toLowerCase().includes(query);
        const matchProcessor = p.processor.toLowerCase().includes(query);
        const matchFeature = p.key_features.some(f => f.toLowerCase().includes(query));
        if (!matchTitle && !matchBrand && !matchProcessor && !matchFeature) return false;
      }

      if (state.selectedBrand !== 'all') {
        if (p.brand.toLowerCase() !== state.selectedBrand.toLowerCase()) return false;
      }

      if (state.selectedPriceRange !== 'all') {
        const price = p.price;
        if (state.selectedPriceRange === 'under-20k' && price >= 20000) return false;
        if (state.selectedPriceRange === '20k-25k' && (price < 20000 || price > 25000)) return false;
        if (state.selectedPriceRange === '25k-50k' && (price < 25000 || price > 50000)) return false;
        if (state.selectedPriceRange === 'above-50k' && price < 50000) return false;
      }

      if (state.selectedRam !== 'all') {
        const ramSize = parseInt(state.selectedRam, 10);
        if (p.ram_size_gb !== ramSize) return false;
      }

      return true;
    });
  }

  function renderProducts() {
    if (!productGrid) return;
    const filtered = getFilteredProducts();

    if (resultsCount) {
      resultsCount.textContent = `${filtered.length} phone${filtered.length === 1 ? '' : 's'} available`;
    }

    if (filtered.length === 0) {
      productGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem;">
          <div style="font-size: 3rem; margin-bottom: 1rem;">🔍</div>
          <h3 style="font-size: 1.25rem; margin-bottom: 0.5rem;">No phones match your current filters</h3>
          <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">Try adjusting your price range, RAM, or brand selection.</p>
          <button id="btn-reset-filters" class="btn-secondary" style="margin: 0 auto;">Reset All Filters</button>
        </div>
      `;
      const resetBtn = document.getElementById('btn-reset-filters');
      if (resetBtn) resetBtn.addEventListener('click', resetAllFilters);
      return;
    }

    productGrid.innerHTML = filtered.map(p => `
      <div class="product-card" data-product-id="${p.id}">
        <div class="card-top">
          <span class="card-brand">${p.brand}</span>
          <span class="card-badge">${p.badge || 'Official Stock'}</span>
        </div>

        <div class="card-img-preview">
          <img src="${p.image || `/images/${p.id}.jpg`}" alt="${p.model}" class="product-thumb-img" loading="lazy" onerror="this.onerror=null;this.src='/images/oneplus-nord-ce4.jpg';">
        </div>

        <h3 class="card-title" title="${p.model}">${p.model}</h3>

        <div class="card-price-row">
          <span class="card-price">₹${p.price.toLocaleString('en-IN')}</span>
          <span class="card-mrp">₹${p.mrp.toLocaleString('en-IN')}</span>
          <span class="card-discount">${p.discount}</span>
        </div>

        <div class="specs-compact-row">
          <span class="spec-pill" title="RAM & Storage">💾 ${p.ram.split(' ')[0]} / ${p.storage.split(' ')[0]}</span>
          <span class="spec-pill" title="Camera">📸 ${p.camera.split('+')[0].trim()}</span>
          <span class="spec-pill" title="Battery">🔋 ${p.battery.split('(')[0].trim()}</span>
          <span class="spec-pill" title="Processor">⚡ ${p.processor.split('(')[0].trim()}</span>
        </div>

        <div class="card-actions">
          <button class="btn-card-cart" data-cart-add="${p.id}" title="Add to Cart">
            <span>🛒</span> + Cart
          </button>
          <button class="btn-card-ask" data-ask-phone="${p.model}">
            <span>✨</span> Ask AI
          </button>
          <button class="btn-card-details" data-details-id="${p.id}">
            Specs
          </button>
        </div>
      </div>
    `).join('');

    attachCardActionHandlers();
  }

  function attachCardActionHandlers() {
    document.querySelectorAll('[data-ask-phone]').forEach(btn => {
      btn.addEventListener('click', () => {
        const phoneModel = btn.getAttribute('data-ask-phone');
        if (window.NexChat) {
          window.NexChat.open();
          window.NexChat.sendPredefinedMessage(`Tell me all about ${phoneModel}. What are its main pros, cons, and key reasons to buy it?`);
        }
      });
    });

    document.querySelectorAll('[data-cart-add]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-cart-add');
        addToCart(id);
      });
    });

    document.querySelectorAll('[data-details-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-details-id');
        openSpecsModal(id);
      });
    });
  }

  function resetAllFilters() {
    state.searchQuery = '';
    state.selectedBrand = 'all';
    state.selectedPriceRange = 'all';
    state.selectedRam = 'all';

    if (searchInput) searchInput.value = '';
    brandChips.forEach((c, idx) => c.classList.toggle('active', idx === 0));
    priceChips.forEach((c, idx) => c.classList.toggle('active', idx === 0));
    ramChips.forEach((c, idx) => c.classList.toggle('active', idx === 0));
    renderProducts();
  }

  // =========================================================================
  // Specs Modal
  // =========================================================================
  function openSpecsModal(productId) {
    const product = state.products.find(p => p.id === productId);
    if (!product || !modalBackdrop || !modalContent) return;

    modalContent.innerHTML = `
      <div style="display: flex; align-items: center; gap: 1.25rem; margin-bottom: 1.5rem;">
        <div style="width: 100px; height: 110px; flex-shrink: 0; background: var(--bg-tertiary); border-radius: var(--radius-md); padding: 0.5rem; display: flex; align-items: center; justify-content: center; border: 1px solid var(--card-border);">
          <img src="${product.image || `/images/${product.id}.jpg`}" alt="${product.model}" style="max-width: 100%; max-height: 100%; object-fit: contain;">
        </div>
        <div>
          <span style="font-size: 0.8rem; font-weight: 700; color: var(--accent); text-transform: uppercase;">${product.brand}</span>
          <h2 style="font-size: 1.35rem; margin-bottom: 0.25rem;">${product.model}</h2>
          <div style="display: flex; align-items: baseline; gap: 0.6rem;">
            <span style="font-size: 1.35rem; font-weight: 800; color: var(--price-color);">₹${product.price.toLocaleString('en-IN')}</span>
            <span style="font-size: 0.85rem; color: var(--text-muted); text-decoration: line-through;">₹${product.mrp.toLocaleString('en-IN')}</span>
            <span style="font-size: 0.75rem; color: var(--emerald); font-weight: 700; background: rgba(5, 150, 105, 0.1); padding: 0.2rem 0.5rem; border-radius: 4px;">${product.discount}</span>
          </div>
        </div>
      </div>

      <table style="width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; font-size: 0.875rem;">
        <tbody>
          <tr style="border-bottom: 1px solid var(--card-border);">
            <td style="padding: 0.6rem 0; color: var(--text-muted); width: 35%; font-weight: 600;">RAM & Storage</td>
            <td style="padding: 0.6rem 0; color: var(--text-primary); font-weight: 500;">${product.ram}, ${product.storage}</td>
          </tr>
          <tr style="border-bottom: 1px solid var(--card-border);">
            <td style="padding: 0.6rem 0; color: var(--text-muted); font-weight: 600;">Processor</td>
            <td style="padding: 0.6rem 0; color: var(--text-primary); font-weight: 500;">${product.processor}</td>
          </tr>
          <tr style="border-bottom: 1px solid var(--card-border);">
            <td style="padding: 0.6rem 0; color: var(--text-muted); font-weight: 600;">Display</td>
            <td style="padding: 0.6rem 0; color: var(--text-primary); font-weight: 500;">${product.display}</td>
          </tr>
          <tr style="border-bottom: 1px solid var(--card-border);">
            <td style="padding: 0.6rem 0; color: var(--text-muted); font-weight: 600;">Rear & Front Camera</td>
            <td style="padding: 0.6rem 0; color: var(--text-primary); font-weight: 500;">${product.camera}</td>
          </tr>
          <tr style="border-bottom: 1px solid var(--card-border);">
            <td style="padding: 0.6rem 0; color: var(--text-muted); font-weight: 600;">Battery & Charging</td>
            <td style="padding: 0.6rem 0; color: var(--text-primary); font-weight: 500;">${product.battery}</td>
          </tr>
          <tr style="border-bottom: 1px solid var(--card-border);">
            <td style="padding: 0.6rem 0; color: var(--text-muted); font-weight: 600;">Warranty</td>
            <td style="padding: 0.6rem 0; color: var(--text-primary); font-weight: 500;">1 Year Brand Warranty + 7-Day Replacement</td>
          </tr>
        </tbody>
      </table>

      <div style="margin-bottom: 1.5rem;">
        <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem; color: var(--text-primary);">Key Highlights:</h4>
        <ul style="padding-left: 1.25rem; color: var(--text-secondary); font-size: 0.85rem; line-height: 1.6;">
          ${product.key_features.map(f => `<li>${f}</li>`).join('')}
        </ul>
      </div>

      <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
        <button id="modal-add-cart-btn" class="btn-card-cart" style="flex: 1; justify-content: center; padding: 0.8rem;">
          <span>🛒</span> Add to Cart (₹${product.price.toLocaleString('en-IN')})
        </button>
        <button id="modal-ask-ai-btn" class="btn-primary" style="flex: 1; justify-content: center;">
          <span>✨</span> Ask AI About This Phone
        </button>
      </div>
    `;

    modalBackdrop.classList.add('open');

    document.getElementById('modal-add-cart-btn')?.addEventListener('click', () => {
      addToCart(product.id);
      modalBackdrop.classList.remove('open');
    });

    document.getElementById('modal-ask-ai-btn')?.addEventListener('click', () => {
      modalBackdrop.classList.remove('open');
      if (window.NexChat) {
        window.NexChat.open();
        window.NexChat.sendPredefinedMessage(`Tell me more about ${product.model} and how it compares with other phones in this budget.`);
      }
    });
  }

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', () => modalBackdrop.classList.remove('open'));
  }
  if (modalBackdrop) {
    modalBackdrop.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) modalBackdrop.classList.remove('open');
    });
  }

  // =========================================================================
  // Shopping Cart Controller
  // =========================================================================
  function saveCart() {
    localStorage.setItem('nex_cart', JSON.stringify(state.cart));
    renderCart();
  }

  function addToCart(productId, qty = 1) {
    const product = state.products.find(p => p.id === productId);
    if (!product) return;

    const existing = state.cart.find(item => item.id === productId);
    if (existing) {
      existing.quantity += qty;
    } else {
      state.cart.push({
        id: product.id,
        model: product.model,
        brand: product.brand,
        price: product.price,
        icon: product.icon || '📱',
        quantity: qty
      });
    }

    saveCart();
    openCart();
  }

  function updateCartQuantity(productId, delta) {
    const item = state.cart.find(i => i.id === productId);
    if (!item) return;

    item.quantity += delta;
    if (item.quantity <= 0) {
      state.cart = state.cart.filter(i => i.id !== productId);
    }
    saveCart();
  }

  function removeFromCart(productId) {
    state.cart = state.cart.filter(i => i.id !== productId);
    saveCart();
  }

  function getCartTotal() {
    return state.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  }

  function getCartItemsCount() {
    return state.cart.reduce((sum, item) => sum + item.quantity, 0);
  }

  function renderCart() {
    const totalCount = getCartItemsCount();
    const totalPrice = getCartTotal();

    if (cartCountBadge) cartCountBadge.textContent = totalCount;
    if (cartDrawerBadge) cartDrawerBadge.textContent = `${totalCount} item${totalCount === 1 ? '' : 's'}`;
    if (cartTotalPrice) cartTotalPrice.textContent = `₹${totalPrice.toLocaleString('en-IN')}`;

    if (!cartItemsList || !cartEmptyState || !cartDrawerFooter) return;

    if (state.cart.length === 0) {
      cartEmptyState.style.display = 'block';
      cartItemsList.innerHTML = '';
      cartDrawerFooter.style.display = 'none';
      return;
    }

    cartEmptyState.style.display = 'none';
    cartDrawerFooter.style.display = 'block';

    cartItemsList.innerHTML = state.cart.map(item => `
      <div class="cart-item-row" data-cart-item-id="${item.id}">
        <div class="cart-item-img-box">
          <img src="${item.image || `/images/${item.id}.jpg`}" alt="${item.model}" class="cart-thumb-img" onerror="this.onerror=null;this.src='/images/oneplus-nord-ce4.jpg';">
        </div>
        <div class="cart-item-info">
          <div class="cart-item-title" title="${item.model}">${item.model}</div>
          <div class="cart-item-price">₹${item.price.toLocaleString('en-IN')}</div>
        </div>
        <div class="cart-item-controls">
          <button class="cart-qty-btn" data-cart-minus="${item.id}">−</button>
          <span class="cart-qty-val">${item.quantity}</span>
          <button class="cart-qty-btn" data-cart-plus="${item.id}">+</button>
          <button class="cart-item-remove" data-cart-remove="${item.id}" title="Remove">✕</button>
        </div>
      </div>
    `).join('');

    // Attach cart row events
    cartItemsList.querySelectorAll('[data-cart-minus]').forEach(btn => {
      btn.addEventListener('click', () => updateCartQuantity(btn.getAttribute('data-cart-minus'), -1));
    });
    cartItemsList.querySelectorAll('[data-cart-plus]').forEach(btn => {
      btn.addEventListener('click', () => updateCartQuantity(btn.getAttribute('data-cart-plus'), 1));
    });
    cartItemsList.querySelectorAll('[data-cart-remove]').forEach(btn => {
      btn.addEventListener('click', () => removeFromCart(btn.getAttribute('data-cart-remove')));
    });
  }

  function openCart() {
    if (cartDrawerBackdrop) cartDrawerBackdrop.classList.add('open');
  }

  function closeCart() {
    if (cartDrawerBackdrop) cartDrawerBackdrop.classList.remove('open');
  }

  if (navCartBtn) navCartBtn.addEventListener('click', openCart);
  if (cartCloseBtn) cartCloseBtn.addEventListener('click', closeCart);
  if (cartDrawerBackdrop) {
    cartDrawerBackdrop.addEventListener('click', (e) => {
      if (e.target === cartDrawerBackdrop) closeCart();
    });
  }
  document.getElementById('cart-empty-browse-btn')?.addEventListener('click', () => closeCart());

  // =========================================================================
  // User Authentication & Dropdown Controller
  // =========================================================================
  async function checkAuthSession() {
    if (!state.token) {
      updateAuthUI(null);
      return;
    }

    // Check if user authenticated with Firebase client
    if (state.token.startsWith('fb_')) {
      const savedUser = localStorage.getItem('nex_user');
      if (savedUser) {
        try {
          state.user = JSON.parse(savedUser);
          updateAuthUI(state.user);
          return;
        } catch (e) {}
      }
    }

    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${state.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        state.user = data.user;
        updateAuthUI(state.user);
      } else {
        // Token invalid or expired
        state.token = null;
        state.user = null;
        localStorage.removeItem('nex_token');
        localStorage.removeItem('nex_user');
        updateAuthUI(null);
      }
    } catch (e) {
      console.warn('Session check failed:', e);
    }
  }

  function updateAuthUI(user) {
    if (user) {
      if (navAuthLabel) navAuthLabel.textContent = user.name.split(' ')[0];
      if (dropdownUserName) dropdownUserName.textContent = user.name;
      if (dropdownUserEmail) dropdownUserEmail.textContent = user.email;
    } else {
      if (navAuthLabel) navAuthLabel.textContent = 'Sign In';
      if (userDropdownMenu) userDropdownMenu.classList.remove('show');
    }
  }

  if (navAuthBtn) {
    navAuthBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.user) {
        userDropdownMenu?.classList.toggle('show');
      } else {
        openAuthModal();
      }
    });
  }

  document.addEventListener('click', () => {
    userDropdownMenu?.classList.remove('show');
  });

  function openAuthModal(defaultTab = 'login') {
    if (!authModalBackdrop) return;
    switchAuthTab(defaultTab);
    clearAuthAlert();
    authModalBackdrop.classList.add('open');
  }

  function closeAuthModal() {
    if (authModalBackdrop) authModalBackdrop.classList.remove('open');
  }

  if (authCloseBtn) authCloseBtn.addEventListener('click', closeAuthModal);
  if (authModalBackdrop) {
    authModalBackdrop.addEventListener('click', (e) => {
      if (e.target === authModalBackdrop) closeAuthModal();
    });
  }

  function switchAuthTab(tab) {
    if (tab === 'login') {
      tabLoginBtn?.classList.add('active');
      tabSignupBtn?.classList.remove('active');
      if (loginForm) loginForm.style.display = 'flex';
      if (signupForm) signupForm.style.display = 'none';
    } else {
      tabSignupBtn?.classList.add('active');
      tabLoginBtn?.classList.remove('active');
      if (signupForm) signupForm.style.display = 'flex';
      if (loginForm) loginForm.style.display = 'none';
    }
    clearAuthAlert();
  }

  if (tabLoginBtn) tabLoginBtn.addEventListener('click', () => switchAuthTab('login'));
  if (tabSignupBtn) tabSignupBtn.addEventListener('click', () => switchAuthTab('signup'));

  function showAuthAlert(msg, type = 'error') {
    if (!authAlert) return;
    authAlert.textContent = msg;
    authAlert.className = `auth-alert ${type}`;
    authAlert.style.display = 'block';
  }

  function clearAuthAlert() {
    if (authAlert) {
      authAlert.style.display = 'none';
      authAlert.textContent = '';
    }
  }

  // Handle Google Sign-In (Firebase)
  const btnGoogleAuth = document.getElementById('btn-google-auth');
  if (btnGoogleAuth) {
    btnGoogleAuth.addEventListener('click', async () => {
      try {
        clearAuthAlert();
        if (!fb.isFirebaseActive()) {
          showAuthAlert('Firebase credentials not added to .env yet. Add your Firebase keys to connect Google Sign-In.', 'error');
          return;
        }
        const user = await fb.signInWithGoogle();
        state.user = user;
        state.token = `fb_${user.id}`;
        localStorage.setItem('nex_token', state.token);
        localStorage.setItem('nex_user', JSON.stringify(user));
        updateAuthUI(state.user);
        closeAuthModal();
      } catch (err) {
        showAuthAlert(err.message || 'Google Sign-In failed', 'error');
      }
    });
  }

  // Handle Login Form Submission
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAuthAlert();
      const email = document.getElementById('login-email')?.value.trim();
      const password = document.getElementById('login-password')?.value;

      try {
        if (fb.isFirebaseActive()) {
          const user = await fb.loginWithEmail(email, password);
          state.user = user;
          state.token = `fb_${user.id}`;
          localStorage.setItem('nex_token', state.token);
          localStorage.setItem('nex_user', JSON.stringify(user));
          updateAuthUI(state.user);
          closeAuthModal();
          return;
        }

        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Login failed');

        state.token = data.token;
        state.user = data.user;
        localStorage.setItem('nex_token', data.token);
        updateAuthUI(state.user);
        closeAuthModal();
      } catch (err) {
        showAuthAlert(err.message, 'error');
      }
    });
  }

  // Handle Signup Form Submission
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearAuthAlert();
      const name = document.getElementById('signup-name')?.value.trim();
      const email = document.getElementById('signup-email')?.value.trim();
      const password = document.getElementById('signup-password')?.value;

      try {
        if (fb.isFirebaseActive()) {
          const user = await fb.signUpWithEmail(name, email, password);
          state.user = user;
          state.token = `fb_${user.id}`;
          localStorage.setItem('nex_token', state.token);
          localStorage.setItem('nex_user', JSON.stringify(user));
          updateAuthUI(state.user);
          closeAuthModal();
          return;
        }

        const res = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Signup failed');

        state.token = data.token;
        state.user = data.user;
        localStorage.setItem('nex_token', data.token);
        updateAuthUI(state.user);
        closeAuthModal();
      } catch (err) {
        showAuthAlert(err.message, 'error');
      }
    });
  }

  // Handle Logout
  if (dropdownLogoutBtn) {
    dropdownLogoutBtn.addEventListener('click', async () => {
      try {
        if (fb.isFirebaseActive()) {
          await fb.logoutFirebase();
        }
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${state.token}` }
        });
      } catch (e) {
        // ignore
      }
      state.token = null;
      state.user = null;
      localStorage.removeItem('nex_token');
      localStorage.removeItem('nex_user');
      updateAuthUI(null);
    });
  }

  // =========================================================================
  // Checkout & Order Placement Controller
  // =========================================================================
  if (cartCheckoutBtn) {
    cartCheckoutBtn.addEventListener('click', () => {
      if (state.cart.length === 0) return;
      closeCart();
      openCheckoutModal();
    });
  }

  function openCheckoutModal() {
    if (!checkoutModalBackdrop) return;

    // Pre-fill user data if logged in
    if (state.user) {
      if (checkoutName) checkoutName.value = state.user.name || '';
      if (checkoutEmail) checkoutEmail.value = state.user.email || '';
    }

    // Render summary
    const total = getCartTotal();
    if (checkoutSummarySubtotal) checkoutSummarySubtotal.textContent = `₹${total.toLocaleString('en-IN')}`;
    if (checkoutSummaryTotal) checkoutSummaryTotal.textContent = `₹${total.toLocaleString('en-IN')}`;
    if (checkoutBtnTotal) checkoutBtnTotal.textContent = `₹${total.toLocaleString('en-IN')}`;

    if (checkoutItemsPreview) {
      checkoutItemsPreview.innerHTML = state.cart.map(item => `
        <div class="checkout-item-mini">
          <span>${item.icon} ${item.model} <strong>× ${item.quantity}</strong></span>
          <span>₹${(item.price * item.quantity).toLocaleString('en-IN')}</span>
        </div>
      `).join('');
    }

    // Payment radio click active state
    document.querySelectorAll('.payment-radio-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.payment-radio-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
      });
    });

    if (checkoutAlert) checkoutAlert.style.display = 'none';
    checkoutModalBackdrop.classList.add('open');
  }

  function closeCheckoutModal() {
    if (checkoutModalBackdrop) checkoutModalBackdrop.classList.remove('open');
  }

  if (checkoutCloseBtn) checkoutCloseBtn.addEventListener('click', closeCheckoutModal);
  if (checkoutModalBackdrop) {
    checkoutModalBackdrop.addEventListener('click', (e) => {
      if (e.target === checkoutModalBackdrop) closeCheckoutModal();
    });
  }

  // Handle Checkout Form Submission (Save Order to SQLite)
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const placeBtn = document.getElementById('btn-place-order');
      if (placeBtn) {
        placeBtn.disabled = true;
        placeBtn.textContent = 'Processing Order in Database...';
      }

      const paymentMethodInput = document.querySelector('input[name="payment-method"]:checked');
      const orderPayload = {
        customerName: checkoutName?.value.trim(),
        customerPhone: checkoutPhone?.value.trim(),
        customerEmail: checkoutEmail?.value.trim(),
        shippingAddress: checkoutAddress?.value.trim(),
        paymentMethod: paymentMethodInput ? paymentMethodInput.value : 'Cash on Delivery',
        items: state.cart
      };

      try {
        const headers = { 'Content-Type': 'application/json' };
        if (state.token) headers['Authorization'] = `Bearer ${state.token}`;

        const res = await fetch('/api/orders', {
          method: 'POST',
          headers,
          body: JSON.stringify(orderPayload)
        });

        const data = await res.json();
        // Sync order to Firestore if Firebase is active
        if (fb.isFirebaseActive()) {
          fb.saveOrderToFirestore({
            ...orderPayload,
            orderNumber: data.order?.orderNumber,
            userId: state.user ? state.user.id : null,
            totalAmount: data.order?.totalAmount
          }).catch(err => console.warn('Firestore order sync:', err));
        }

        // Clear cart
        state.cart = [];
        saveCart();

        // Close checkout and show success
        closeCheckoutModal();
        openSuccessModal(data.order);

      } catch (err) {
        if (checkoutAlert) {
          checkoutAlert.textContent = err.message;
          checkoutAlert.className = 'checkout-alert error';
          checkoutAlert.style.display = 'block';
        }
      } finally {
        if (placeBtn) {
          placeBtn.disabled = false;
          placeBtn.innerHTML = `Confirm & Place Order (<span id="checkout-btn-total">₹${getCartTotal().toLocaleString('en-IN')}</span>)`;
        }
      }
    });
  }

  // =========================================================================
  // Order Success Modal
  // =========================================================================
  function openSuccessModal(order) {
    if (!successModalBackdrop || !order) return;
    if (successOrderNumber) successOrderNumber.textContent = order.orderNumber;
    if (successCustomerEmail) successCustomerEmail.textContent = order.customerEmail;
    successModalBackdrop.classList.add('open');
  }

  function closeSuccessModal() {
    if (successModalBackdrop) successModalBackdrop.classList.remove('open');
  }

  if (successCloseBtn) successCloseBtn.addEventListener('click', closeSuccessModal);
  if (successContinueBtn) successContinueBtn.addEventListener('click', closeSuccessModal);

  // =========================================================================
  // My Orders Modal (Queries SQLite database)
  // =========================================================================
  async function openOrdersModal() {
    if (!ordersModalBackdrop) return;
    ordersModalBackdrop.classList.add('open');

    if (!state.user) {
      if (ordersListContainer) {
        ordersListContainer.innerHTML = `
          <div style="text-align: center; padding: 3rem 1rem;">
            <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔒</div>
            <h4>Please sign in to view your orders</h4>
            <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">Create a free account or log in to track your device deliveries.</p>
            <button class="btn-primary" id="orders-open-auth-btn" style="margin: 0 auto;">Sign In / Register</button>
          </div>
        `;
        document.getElementById('orders-open-auth-btn')?.addEventListener('click', () => {
          ordersModalBackdrop.classList.remove('open');
          openAuthModal('login');
        });
      }
      return;
    }

    if (ordersListContainer) {
      ordersListContainer.innerHTML = '<div class="orders-loading">Fetching your orders from database...</div>';
    }

    try {
      const res = await fetch('/api/orders', {
        headers: { 'Authorization': `Bearer ${state.token}` }
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Unable to load orders');

      const orders = data.orders || [];
      if (orders.length === 0) {
        ordersListContainer.innerHTML = `
          <div style="text-align: center; padding: 3rem 1rem;">
            <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📦</div>
            <h4>No orders placed yet</h4>
            <p style="color: var(--text-secondary); margin-bottom: 1.5rem;">You haven't ordered any smartphones yet.</p>
            <button class="btn-primary btn-sm" id="orders-browse-now" style="margin: 0 auto;">Browse Smartphones</button>
          </div>
        `;
        document.getElementById('orders-browse-now')?.addEventListener('click', () => {
          ordersModalBackdrop.classList.remove('open');
        });
        return;
      }

      ordersListContainer.innerHTML = orders.map(ord => `
        <div class="order-history-card">
          <div class="order-card-header">
            <div>
              <span class="order-num">${ord.order_number}</span>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${ord.created_at}</div>
            </div>
            <span class="order-status-badge">${ord.status}</span>
          </div>

          <div class="order-card-items">
            ${(ord.items || []).map(item => `
              <div class="order-item-line">
                <span>${item.icon || '📱'} ${item.model} <strong>× ${item.quantity}</strong></span>
                <span>₹${((item.price || 0) * (item.quantity || 1)).toLocaleString('en-IN')}</span>
              </div>
            `).join('')}
          </div>

          <div class="order-card-footer">
            <span>Payment: <strong>${ord.payment_method}</strong></span>
            <span>Total: <span class="order-total-val">₹${Number(ord.total_amount).toLocaleString('en-IN')}</span></span>
          </div>
        </div>
      `).join('');

    } catch (err) {
      if (ordersListContainer) {
        ordersListContainer.innerHTML = `
          <div style="color: #ef4444; text-align: center; padding: 2rem;">
            ⚠️ Error loading orders: ${err.message}
          </div>
        `;
      }
    }
  }

  if (dropdownMyOrdersBtn) dropdownMyOrdersBtn.addEventListener('click', () => {
    userDropdownMenu?.classList.remove('show');
    openOrdersModal();
  });

  if (successViewOrdersBtn) successViewOrdersBtn.addEventListener('click', () => {
    closeSuccessModal();
    openOrdersModal();
  });

  if (ordersCloseBtn) ordersCloseBtn.addEventListener('click', () => {
    ordersModalBackdrop?.classList.remove('open');
  });

  if (ordersModalBackdrop) {
    ordersModalBackdrop.addEventListener('click', (e) => {
      if (e.target === ordersModalBackdrop) ordersModalBackdrop.classList.remove('open');
    });
  }

  // Global Escape key handler for all modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      modalBackdrop?.classList.remove('open');
      cartDrawerBackdrop?.classList.remove('open');
      authModalBackdrop?.classList.remove('open');
      checkoutModalBackdrop?.classList.remove('open');
      successModalBackdrop?.classList.remove('open');
      ordersModalBackdrop?.classList.remove('open');
    }
  });

  // Mobile menu toggle
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const navLinks = document.querySelector('.nav-links');
  if (mobileMenuBtn && navLinks) {
    mobileMenuBtn.addEventListener('click', () => {
      navLinks.classList.toggle('mobile-open');
    });
  }

  // Theme Controller
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const savedTheme = localStorage.getItem('nexphone_theme') || 'light';
  applyTheme(savedTheme);

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('nexphone_theme', theme);
    if (themeToggleBtn) {
      const icon = themeToggleBtn.querySelector('.theme-icon');
      const label = themeToggleBtn.querySelector('.theme-label');
      if (theme === 'dark') {
        if (icon) icon.textContent = '☀️';
        if (label) label.textContent = 'Light';
      } else {
        if (icon) icon.textContent = '🌙';
        if (label) label.textContent = 'Dark';
      }
    }
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      applyTheme(currentTheme === 'light' ? 'dark' : 'light');
    });
  }
});
