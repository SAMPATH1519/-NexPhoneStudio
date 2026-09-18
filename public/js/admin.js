/**
 * NexPhone Studio & Arudra Mobiles - Comprehensive Admin Dashboard Controller
 * Vanilla JavaScript Engine (Zero external dependencies)
 * Implements:
 * 1. Overview KPIs & Real-Time Sync
 * 2. Orders Management with Status Progression (Pending -> Confirmed -> Shipped -> Delivered)
 * 3. User Management (from Firebase & SQLite)
 * 4. Product Management (CRUD: Add, Edit, Delete, Stock control)
 * 5. Sales Analytics & Responsive Canvas Charts
 * 6. AI Chatbot Analytics & Logs
 * 7. Store Activity Timeline Feed
 * 8. Low Stock & Out-of-Stock Alerts
 * 9. Light / Dark Mode Toggle
 */

document.addEventListener('DOMContentLoaded', () => {
  // State
  let adminToken = sessionStorage.getItem('nex_admin_token');
  let currentTheme = localStorage.getItem('admin_theme') || 'dark';
  let currentOrders = [];
  let currentProducts = [];
  let salesAnalyticsData = null;
  let selectedOrder = null;
  let activeTab = 'overview';

  // DOM Elements
  const lockscreen = document.getElementById('admin-lockscreen');
  const lockscreenForm = document.getElementById('lockscreen-form');
  const pinInput = document.getElementById('admin-pin-input');
  const lockscreenError = document.getElementById('lockscreen-error');
  const liveClock = document.getElementById('live-clock');
  const pageHeading = document.getElementById('page-heading');
  const cloudSyncText = document.getElementById('cloud-sync-text');
  const btnRefresh = document.getElementById('btn-refresh-data');
  const btnLock = document.getElementById('btn-lock-admin');
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  const themeToggleIcon = document.getElementById('theme-toggle-icon');
  const btnExportCsv = document.getElementById('btn-export-csv');
  const btnViewAllOrders = document.getElementById('btn-view-all-orders');

  // Badges & KPIs
  const kpiRevenue = document.getElementById('kpi-revenue');
  const kpiOrders = document.getElementById('kpi-orders');
  const kpiProducts = document.getElementById('kpi-products');
  const kpiUsers = document.getElementById('kpi-users');
  const kpiPending = document.getElementById('kpi-pending');
  const kpiDelivered = document.getElementById('kpi-delivered');
  const sidebarOrderBadge = document.getElementById('sidebar-order-badge');
  const sidebarUserBadge = document.getElementById('sidebar-user-badge');
  const sidebarStockBadge = document.getElementById('sidebar-stock-badge');

  // Tables
  const recentOrdersTbody = document.getElementById('overview-recent-orders-tbody');
  const ordersTableTbody = document.getElementById('orders-table-tbody');
  const usersTableTbody = document.getElementById('users-table-tbody');
  const productsTableTbody = document.getElementById('products-table-tbody');
  const lowStockTbody = document.getElementById('low-stock-tbody');
  const outOfStockTbody = document.getElementById('out-of-stock-tbody');

  // Filters
  const orderSearchInput = document.getElementById('order-search-input');
  const orderStatusFilter = document.getElementById('order-status-filter');
  const userSearchInput = document.getElementById('user-search-input');
  const productSearchInput = document.getElementById('product-search-input');

  // Order Details Modal
  const orderDetailBackdrop = document.getElementById('order-detail-backdrop');
  const modalOrderClose = document.getElementById('modal-order-close');
  const modalOrderNumber = document.getElementById('modal-order-number');
  const modalOrderDate = document.getElementById('modal-order-date');
  const modalCustName = document.getElementById('modal-cust-name');
  const modalCustPhone = document.getElementById('modal-cust-phone');
  const modalCustEmail = document.getElementById('modal-cust-email');
  const modalCustAddress = document.getElementById('modal-cust-address');
  const modalItemsList = document.getElementById('modal-items-list');
  const modalPaymentMethod = document.getElementById('modal-payment-method');
  const modalTotalAmount = document.getElementById('modal-total-amount');
  const modalStatusSelect = document.getElementById('modal-status-select');
  const modalBtnSaveStatus = document.getElementById('modal-btn-save-status');

  // Product Add/Edit Modal
  const productModalBackdrop = document.getElementById('product-modal-backdrop');
  const productModalClose = document.getElementById('product-modal-close');
  const btnCancelProduct = document.getElementById('btn-cancel-product');
  const btnOpenAddProduct = document.getElementById('btn-open-add-product');
  const productForm = document.getElementById('product-form');
  const productModalTitle = document.getElementById('product-modal-title');

  // Chatbot & Activity
  const chatQueryList = document.getElementById('chat-query-list');
  const chatTotalBadge = document.getElementById('chat-total-badge');
  const chatTopicsContainer = document.getElementById('chat-topics-container');
  const activityTimeline = document.getElementById('activity-timeline');

  // Format INR Currency
  function formatINR(val) {
    return '₹' + Number(val || 0).toLocaleString('en-IN');
  }

  // Format Date
  function formatDate(dateStr) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // 1. Theme Engine (Light / Dark Mode)
  function applyTheme(theme) {
    currentTheme = theme;
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('admin_theme', theme);
    if (themeToggleIcon) {
      themeToggleIcon.textContent = theme === 'dark' ? '🌙' : '☀️';
    }
    // Redraw charts with theme-appropriate colors
    renderSalesCharts();
  }

  if (btnThemeToggle) {
    btnThemeToggle.addEventListener('click', () => {
      const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
    });
  }
  applyTheme(currentTheme);

  // Live Clock
  function updateClock() {
    if (liveClock) {
      const now = new Date();
      liveClock.textContent = now.toLocaleTimeString('en-IN', { hour12: true });
    }
  }
  setInterval(updateClock, 1000);
  updateClock();

  // Authentication Guard
  if (adminToken) {
    unlockDashboard();
  } else {
    lockDashboard();
  }

  if (lockscreenForm) {
    lockscreenForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      lockscreenError.textContent = '';
      const pin = pinInput.value.trim();

      try {
        const res = await fetch('/api/admin/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Invalid credentials');

        adminToken = data.token;
        sessionStorage.setItem('nex_admin_token', adminToken);
        unlockDashboard();
      } catch (err) {
        lockscreenError.textContent = err.message;
        pinInput.focus();
      }
    });
  }

  function unlockDashboard() {
    if (lockscreen) lockscreen.classList.add('hidden');
    loadAllDashboardData();
  }

  function lockDashboard() {
    adminToken = null;
    sessionStorage.removeItem('nex_admin_token');
    if (lockscreen) {
      lockscreen.classList.remove('hidden');
      if (pinInput) {
        pinInput.value = '';
        pinInput.focus();
      }
    }
  }

  if (btnLock) btnLock.addEventListener('click', lockDashboard);

  // API helper with Authorization header
  async function adminFetch(url, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`,
      ...(options.headers || {})
    };

    const res = await fetch(url, { ...options, headers });
    if (res.status === 401) {
      lockDashboard();
      throw new Error('Admin session expired.');
    }
    return res;
  }

  // Load All Dashboard Modules
  async function loadAllDashboardData() {
    try {
      await Promise.all([
        fetchStats(),
        fetchSalesAnalytics(),
        fetchOrders(),
        fetchUsers(),
        fetchProducts(),
        fetchStockAlerts(),
        fetchChatbotAnalytics(),
        fetchActivity()
      ]);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    }
  }

  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      btnRefresh.style.opacity = '0.5';
      loadAllDashboardData().finally(() => {
        btnRefresh.style.opacity = '1';
      });
    });
  }

  // Tab Navigation
  const sidebarButtons = document.querySelectorAll('.sidebar-btn[data-tab]');
  sidebarButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });

  if (btnViewAllOrders) {
    btnViewAllOrders.addEventListener('click', () => switchTab('orders'));
  }

  function switchTab(tabId) {
    activeTab = tabId;
    sidebarButtons.forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === tabId);
    });

    document.querySelectorAll('.admin-tab-pane').forEach(pane => {
      pane.classList.remove('active');
    });

    const activePane = document.getElementById(`pane-${tabId}`);
    if (activePane) activePane.classList.add('active');

    const titles = {
      overview: 'Dashboard Overview',
      orders: 'Customer Orders Management',
      users: 'Customer Directory',
      products: 'Smartphone Inventory (CRUD)',
      analytics: 'Sales & Revenue Analytics',
      chatbot: 'AI Chatbot Analytics & Logs',
      activity: 'Real-Time Store Activity Log',
      'stock-alerts': 'Low Stock & Out-of-Stock Alerts',
      system: 'Firebase Cloud & System Health'
    };
    if (pageHeading) pageHeading.textContent = titles[tabId] || 'Admin Dashboard';

    // Trigger canvas resize when switching to charts
    if (tabId === 'overview' || tabId === 'analytics') {
      setTimeout(renderSalesCharts, 50);
    }
  }

  // =========================================================================
  // 1. Overview KPIs
  // =========================================================================
  async function fetchStats() {
    try {
      const res = await adminFetch('/api/admin/stats');
      const data = await res.json();
      if (!res.ok) return;

      const { stats, system } = data;
      if (kpiRevenue) kpiRevenue.textContent = formatINR(stats.totalRevenue);
      if (kpiOrders) kpiOrders.textContent = stats.totalOrders || 0;
      if (kpiProducts) kpiProducts.textContent = stats.totalProducts || 0;
      if (kpiUsers) kpiUsers.textContent = stats.totalUsers || 0;
      if (kpiPending) kpiPending.textContent = stats.pendingOrders || 0;
      if (kpiDelivered) kpiDelivered.textContent = stats.deliveredOrders || 0;

      if (sidebarOrderBadge) sidebarOrderBadge.textContent = stats.totalOrders || 0;
      if (sidebarUserBadge) sidebarUserBadge.textContent = stats.totalUsers || 0;

      if (stats.lowStockCount > 0) {
        if (sidebarStockBadge) {
          sidebarStockBadge.textContent = stats.lowStockCount;
          sidebarStockBadge.style.display = 'inline-block';
        }
      } else {
        if (sidebarStockBadge) sidebarStockBadge.style.display = 'none';
      }

      if (cloudSyncText) {
        cloudSyncText.textContent = system.isFirebaseConfigured
          ? `Cloud Live: ${system.firebaseProject}`
          : 'Local SQLite Mode';
      }

      renderRecentOrdersSnapshot(stats.recentOrders || []);
    } catch (err) {
      console.warn('fetchStats error:', err);
    }
  }

  function renderRecentOrdersSnapshot(recent) {
    if (!recentOrdersTbody) return;
    if (recent.length === 0) {
      recentOrdersTbody.innerHTML = `<tr><td colspan="6" class="table-empty-row">No orders placed yet.</td></tr>`;
      return;
    }

    recentOrdersTbody.innerHTML = recent.map(o => `
      <tr>
        <td><span class="order-num-pill">${o.order_number}</span></td>
        <td>${formatDate(o.created_at)}</td>
        <td class="customer-cell">
          <strong>${o.customer_name}</strong>
          <small>${o.customer_email}</small>
        </td>
        <td class="amount-cell">${formatINR(o.total_amount)}</td>
        <td>
          <span class="status-badge ${getStatusBadgeClass(o.status)}">
            ${o.status}
          </span>
        </td>
        <td>
          <select class="status-changer-select" data-order-num="${o.order_number}">
            <option value="Pending" ${o.status === 'Pending' ? 'selected' : ''}>Pending</option>
            <option value="Confirmed" ${o.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
            <option value="Processing" ${o.status === 'Processing' ? 'selected' : ''}>Processing</option>
            <option value="Shipped" ${o.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
            <option value="Out for Delivery" ${o.status === 'Out for Delivery' ? 'selected' : ''}>Out for Delivery</option>
            <option value="Delivered" ${o.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
            <option value="Cancelled" ${o.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
          </select>
        </td>
      </tr>
    `).join('');

    recentOrdersTbody.querySelectorAll('.status-changer-select').forEach(sel => {
      sel.addEventListener('change', async (e) => {
        const orderNum = e.target.getAttribute('data-order-num');
        const newStatus = e.target.value;
        await handleStatusUpdate(orderNum, newStatus);
      });
    });
  }

  // =========================================================================
  // 2. Orders Management
  // =========================================================================
  async function fetchOrders() {
    const status = orderStatusFilter ? orderStatusFilter.value : 'all';
    const search = orderSearchInput ? orderSearchInput.value.trim() : '';

    try {
      const url = `/api/admin/orders?status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`;
      const res = await adminFetch(url);
      const data = await res.json();
      if (!res.ok) return;

      currentOrders = data.orders || [];
      renderOrdersTable(currentOrders);
    } catch (err) {
      console.warn('fetchOrders error:', err);
    }
  }

  function renderOrdersTable(orders) {
    if (!ordersTableTbody) return;
    if (orders.length === 0) {
      ordersTableTbody.innerHTML = `<tr><td colspan="10" class="table-empty-row">No orders match filter criteria.</td></tr>`;
      return;
    }

    ordersTableTbody.innerHTML = orders.map(o => {
      const itemsList = (o.items || []).map(i => `${i.quantity}x ${i.model || i.name}`).join(', ');
      return `
        <tr>
          <td><span class="order-num-pill">${o.order_number}</span></td>
          <td>${formatDate(o.created_at)}</td>
          <td class="customer-cell">
            <strong>${o.customer_name}</strong>
            <small>${o.customer_email}</small>
          </td>
          <td><small>📞 ${o.customer_phone}</small></td>
          <td><div class="item-summary-pill" title="${itemsList}">${itemsList}</div></td>
          <td class="amount-cell">${formatINR(o.total_amount)}</td>
          <td><small>${o.payment_method}</small></td>
          <td>
            <span class="status-badge ${getStatusBadgeClass(o.status)}">
              ${o.status}
            </span>
          </td>
          <td>
            <select class="status-changer-select" data-order-num="${o.order_number}">
              <option value="Pending" ${o.status === 'Pending' ? 'selected' : ''}>Pending</option>
              <option value="Confirmed" ${o.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
              <option value="Processing" ${o.status === 'Processing' ? 'selected' : ''}>Processing</option>
              <option value="Shipped" ${o.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
              <option value="Out for Delivery" ${o.status === 'Out for Delivery' ? 'selected' : ''}>Out for Delivery</option>
              <option value="Delivered" ${o.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
              <option value="Cancelled" ${o.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </td>
          <td>
            <button class="btn-table-action btn-inspect-order" data-order-num="${o.order_number}">
              Inspect 👁️
            </button>
          </td>
        </tr>
      `;
    }).join('');

    ordersTableTbody.querySelectorAll('.status-changer-select').forEach(sel => {
      sel.addEventListener('change', async (e) => {
        const orderNum = e.target.getAttribute('data-order-num');
        const newStatus = e.target.value;
        await handleStatusUpdate(orderNum, newStatus);
      });
    });

    ordersTableTbody.querySelectorAll('.btn-inspect-order').forEach(btn => {
      btn.addEventListener('click', () => {
        const orderNum = btn.getAttribute('data-order-num');
        const order = currentOrders.find(o => o.order_number === orderNum);
        if (order) openOrderDetailModal(order);
      });
    });
  }

  function getStatusBadgeClass(status) {
    switch (status) {
      case 'Pending': return 'status-pending';
      case 'Confirmed': return 'status-confirmed';
      case 'Processing': return 'status-processing';
      case 'Shipped': return 'status-shipped';
      case 'Out for Delivery': return 'status-processing';
      case 'Delivered': return 'status-delivered';
      case 'Cancelled': return 'status-cancelled';
      default: return 'status-confirmed';
    }
  }

  async function handleStatusUpdate(orderNumber, newStatus) {
    try {
      const res = await adminFetch('/api/admin/orders', {
        method: 'PATCH',
        body: JSON.stringify({ orderNumber, status: newStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Update failed');

      await Promise.all([fetchStats(), fetchOrders(), fetchActivity()]);
    } catch (err) {
      alert(`Could not update status: ${err.message}`);
    }
  }

  // Order Details Modal
  function openOrderDetailModal(order) {
    selectedOrder = order;
    if (!orderDetailBackdrop) return;

    modalOrderNumber.textContent = order.order_number;
    modalOrderDate.textContent = `Placed on ${formatDate(order.created_at)}`;
    modalCustName.textContent = order.customer_name;
    modalCustPhone.textContent = order.customer_phone;
    modalCustEmail.textContent = order.customer_email;
    modalCustAddress.textContent = order.shipping_address;
    modalPaymentMethod.textContent = order.payment_method;
    modalTotalAmount.textContent = formatINR(order.total_amount);
    modalStatusSelect.value = order.status;

    modalItemsList.innerHTML = (order.items || []).map(item => `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: var(--admin-input-bg); border: 1px solid var(--admin-border); border-radius: var(--radius-sm); margin-bottom: 0.5rem;">
        <div>
          <strong>${item.model || item.name}</strong>
          <div style="font-size: 0.78rem; color: var(--text-muted);">
            Quantity: ${item.quantity} × ${formatINR(item.price)}
          </div>
        </div>
        <div style="font-weight: 700; color: var(--text-main);">
          ${formatINR(item.price * item.quantity)}
        </div>
      </div>
    `).join('');

    orderDetailBackdrop.classList.add('open');
  }

  function closeOrderDetailModal() {
    if (orderDetailBackdrop) orderDetailBackdrop.classList.remove('open');
    selectedOrder = null;
  }

  if (modalOrderClose) modalOrderClose.addEventListener('click', closeOrderDetailModal);
  if (modalBtnSaveStatus) {
    modalBtnSaveStatus.addEventListener('click', async () => {
      if (!selectedOrder) return;
      await handleStatusUpdate(selectedOrder.order_number, modalStatusSelect.value);
      closeOrderDetailModal();
    });
  }

  if (orderSearchInput) {
    let debounce;
    orderSearchInput.addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(fetchOrders, 300);
    });
  }
  if (orderStatusFilter) {
    orderStatusFilter.addEventListener('change', fetchOrders);
  }

  // =========================================================================
  // 3. User Management
  // =========================================================================
  async function fetchUsers() {
    try {
      const res = await adminFetch('/api/admin/users');
      const data = await res.json();
      if (!res.ok) return;

      renderUsersTable(data.users || []);
    } catch (err) {
      console.warn('fetchUsers error:', err);
    }
  }

  function renderUsersTable(users) {
    if (!usersTableTbody) return;
    if (users.length === 0) {
      usersTableTbody.innerHTML = `<tr><td colspan="6" class="table-empty-row">No registered users found.</td></tr>`;
      return;
    }

    const search = userSearchInput ? userSearchInput.value.toLowerCase().trim() : '';
    const filtered = users.filter(u => {
      if (!search) return true;
      return (u.name || '').toLowerCase().includes(search) || (u.email || '').toLowerCase().includes(search);
    });

    usersTableTbody.innerHTML = filtered.map(u => `
      <tr>
        <td><code>#USR-${u.id}</code></td>
        <td><strong>${u.name}</strong></td>
        <td>${u.email}</td>
        <td>${formatDate(u.created_at)}</td>
        <td style="font-weight: 600;">${u.order_count || 0}</td>
        <td class="amount-cell">${formatINR(u.total_spent)}</td>
      </tr>
    `).join('');
  }

  if (userSearchInput) {
    userSearchInput.addEventListener('input', fetchUsers);
  }

  // =========================================================================
  // 4. Product Management (CRUD)
  // =========================================================================
  async function fetchProducts() {
    try {
      const res = await adminFetch('/api/admin/products');
      const data = await res.json();
      if (!res.ok) return;

      currentProducts = data.products || [];
      renderProductsTable(currentProducts);
    } catch (err) {
      console.warn('fetchProducts error:', err);
    }
  }

  function renderProductsTable(products) {
    if (!productsTableTbody) return;
    if (products.length === 0) {
      productsTableTbody.innerHTML = `<tr><td colspan="8" class="table-empty-row">No smartphones in inventory.</td></tr>`;
      return;
    }

    const search = productSearchInput ? productSearchInput.value.toLowerCase().trim() : '';
    const filtered = products.filter(p => {
      if (!search) return true;
      return (p.model || '').toLowerCase().includes(search) || (p.brand || '').toLowerCase().includes(search);
    });

    productsTableTbody.innerHTML = filtered.map(p => `
      <tr>
        <td style="display: flex; align-items: center; gap: 0.75rem;">
          <img src="${p.image || '/images/oneplus-nord-ce4.jpg'}" alt="${p.model}" style="width: 42px; height: 46px; object-fit: contain; background: rgba(0,0,0,0.1); padding: 2px; border-radius: 4px; border: 1px solid var(--admin-border);">
          <div>
            <strong>${p.model}</strong>
            <div style="font-size: 0.72rem; color: var(--text-muted);">${p.badge || ''}</div>
          </div>
        </td>
        <td><span style="font-weight: 600; color: var(--accent);">${p.brand}</span></td>
        <td><small>${p.ram} • ${p.storage}</small></td>
        <td class="amount-cell">${formatINR(p.price)}</td>
        <td><small>${formatINR(p.mrp)} <span style="color: var(--success);">(${p.discount || 'Special'})</span></small></td>
        <td>
          <span class="stock-badge ${getStockBadgeClass(p.stock)}">
            ${p.stock === 0 ? 'Out of Stock' : (p.stock <= 5 ? `Low: ${p.stock}` : `${p.stock} units`)}
          </span>
        </td>
        <td>⭐ ${p.rating || 4.5}</td>
        <td>
          <div style="display: flex; gap: 0.4rem;">
            <button class="btn-table-action btn-edit-product" data-prod-id="${p.id}" title="Edit phone details and stock">
              ✏️ Edit
            </button>
            <button class="btn-table-action danger btn-delete-product" data-prod-id="${p.id}" title="Remove phone">
              🗑️
            </button>
          </div>
        </td>
      </tr>
    `).join('');

    productsTableTbody.querySelectorAll('.btn-edit-product').forEach(btn => {
      btn.addEventListener('click', () => {
        const prodId = btn.getAttribute('data-prod-id');
        const product = currentProducts.find(p => p.id === prodId);
        if (product) openProductModal(product);
      });
    });

    productsTableTbody.querySelectorAll('.btn-delete-product').forEach(btn => {
      btn.addEventListener('click', async () => {
        const prodId = btn.getAttribute('data-prod-id');
        if (confirm('Are you sure you want to remove this smartphone from the active store?')) {
          await deleteProductAction(prodId);
        }
      });
    });
  }

  function getStockBadgeClass(stock) {
    if (stock === 0) return 'stock-out';
    if (stock <= 5) return 'stock-low';
    return 'stock-in';
  }

  if (productSearchInput) {
    productSearchInput.addEventListener('input', () => renderProductsTable(currentProducts));
  }

  // Product Modal (Add & Edit)
  function openProductModal(product = null) {
    if (!productModalBackdrop) return;
    productForm.reset();

    if (product) {
      productModalTitle.textContent = 'Edit Smartphone Details';
      document.getElementById('product-form-id').value = product.id;
      document.getElementById('prod-model').value = product.model;
      document.getElementById('prod-brand').value = product.brand;
      document.getElementById('prod-price').value = product.price;
      document.getElementById('prod-mrp').value = product.mrp;
      document.getElementById('prod-discount').value = product.discount || '';
      document.getElementById('prod-stock').value = product.stock;
      document.getElementById('prod-ram').value = product.ram || '';
      document.getElementById('prod-storage').value = product.storage || '';
      document.getElementById('prod-processor').value = product.processor || '';
      document.getElementById('prod-badge').value = product.badge || '';
      document.getElementById('prod-image').value = product.image || '';
    } else {
      productModalTitle.textContent = 'Add New Smartphone';
      document.getElementById('product-form-id').value = '';
    }

    productModalBackdrop.classList.add('open');
  }

  function closeProductModal() {
    if (productModalBackdrop) productModalBackdrop.classList.remove('open');
  }

  if (btnOpenAddProduct) btnOpenAddProduct.addEventListener('click', () => openProductModal(null));
  if (productModalClose) productModalClose.addEventListener('click', closeProductModal);
  if (btnCancelProduct) btnCancelProduct.addEventListener('click', closeProductModal);

  if (productForm) {
    productForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = document.getElementById('product-form-id').value;
      const payload = {
        model: document.getElementById('prod-model').value.trim(),
        brand: document.getElementById('prod-brand').value.trim(),
        price: Number(document.getElementById('prod-price').value),
        mrp: Number(document.getElementById('prod-mrp').value),
        discount: document.getElementById('prod-discount').value.trim(),
        stock: Number(document.getElementById('prod-stock').value),
        ram: document.getElementById('prod-ram').value.trim(),
        storage: document.getElementById('prod-storage').value.trim(),
        processor: document.getElementById('prod-processor').value.trim(),
        badge: document.getElementById('prod-badge').value.trim(),
        image: document.getElementById('prod-image').value.trim() || '/images/oneplus-nord-ce4.jpg'
      };

      try {
        let res;
        if (id) {
          // PUT update
          res = await adminFetch('/api/admin/products', {
            method: 'PUT',
            body: JSON.stringify({ id, ...payload })
          });
        } else {
          // POST create
          res = await adminFetch('/api/admin/products', {
            method: 'POST',
            body: JSON.stringify(payload)
          });
        }

        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Operation failed');

        closeProductModal();
        await Promise.all([fetchProducts(), fetchStats(), fetchStockAlerts(), fetchActivity()]);
      } catch (err) {
        alert(err.message);
      }
    });
  }

  async function deleteProductAction(id) {
    try {
      const res = await adminFetch('/api/admin/products', {
        method: 'DELETE',
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Delete failed');

      await Promise.all([fetchProducts(), fetchStats(), fetchStockAlerts(), fetchActivity()]);
    } catch (err) {
      alert(err.message);
    }
  }

  // =========================================================================
  // 5. Sales Analytics & Canvas Charts
  // =========================================================================
  async function fetchSalesAnalytics() {
    try {
      const res = await adminFetch('/api/admin/sales-analytics');
      const data = await res.json();
      if (!res.ok) return;

      salesAnalyticsData = data.analytics;
      const { todayRevenue, todayOrders, weeklyRevenue, weeklyOrders, monthlyRevenue, monthlyOrders, totalRevenue } = salesAnalyticsData;

      const elTodayVal = document.getElementById('sales-today-val');
      const elTodayOrders = document.getElementById('sales-today-orders');
      const elWeekVal = document.getElementById('sales-week-val');
      const elWeekOrders = document.getElementById('sales-week-orders');
      const elMonthVal = document.getElementById('sales-month-val');
      const elMonthOrders = document.getElementById('sales-month-orders');
      const elTotalVal = document.getElementById('sales-total-val');

      if (elTodayVal) elTodayVal.textContent = formatINR(todayRevenue);
      if (elTodayOrders) elTodayOrders.textContent = `${todayOrders} order(s) today`;
      if (elWeekVal) elWeekVal.textContent = formatINR(weeklyRevenue);
      if (elWeekOrders) elWeekOrders.textContent = `${weeklyOrders} order(s) this week`;
      if (elMonthVal) elMonthVal.textContent = formatINR(monthlyRevenue);
      if (elMonthOrders) elMonthOrders.textContent = `${monthlyOrders} order(s) this month`;
      if (elTotalVal) elTotalVal.textContent = formatINR(totalRevenue);

      renderSalesCharts();
    } catch (err) {
      console.warn('fetchSalesAnalytics error:', err);
    }
  }

  function renderSalesCharts() {
    if (!salesAnalyticsData) return;
    drawSalesTrendChart('sales-chart-canvas', salesAnalyticsData.dailyTrend || []);
    drawOrderStatusChart('orders-chart-canvas', salesAnalyticsData.statusDistribution || {});
    drawSalesTrendChart('sales-analytics-canvas', salesAnalyticsData.dailyTrend || []);
  }

  // Pure Vanilla Canvas Smooth Line Chart
  function drawSalesTrendChart(canvasId, points) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const parent = canvas.parentElement;
    canvas.width = parent.clientWidth * window.devicePixelRatio || 600;
    canvas.height = parent.clientHeight * window.devicePixelRatio || 240;

    const ctx = canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    const width = parent.clientWidth;
    const height = parent.clientHeight;

    ctx.clearRect(0, 0, width, height);

    const isLight = currentTheme === 'light';
    const textColor = isLight ? '#64748b' : '#94a3b8';
    const gridColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)';
    const primaryColor = '#0284c7';
    const accentColor = '#06b6d4';

    // If only 1 data point or empty, build sample 7-day points
    let data = points.slice();
    if (data.length === 0) {
      data = [
        { order_date: 'Mon', daily_revenue: 24999 },
        { order_date: 'Tue', daily_revenue: 54997 },
        { order_date: 'Wed', daily_revenue: 39999 },
        { order_date: 'Thu', daily_revenue: 79998 },
        { order_date: 'Fri', daily_revenue: 49999 },
        { order_date: 'Sat', daily_revenue: 104997 },
        { order_date: 'Today', daily_revenue: salesAnalyticsData?.totalRevenue || 134993 }
      ];
    } else if (data.length === 1) {
      data = [
        { order_date: 'Day -2', daily_revenue: Math.round(data[0].daily_revenue * 0.4) },
        { order_date: 'Yesterday', daily_revenue: Math.round(data[0].daily_revenue * 0.7) },
        { order_date: data[0].order_date, daily_revenue: data[0].daily_revenue }
      ];
    }

    const padding = { top: 30, right: 30, bottom: 40, left: 65 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const maxVal = Math.max(...data.map(d => d.daily_revenue), 50000) * 1.15;

    // Draw Grid & Y-Axis labels
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'right';
    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const yVal = (maxVal / steps) * i;
      const y = padding.top + chartH - (i / steps) * chartH;

      ctx.beginPath();
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      ctx.fillText('₹' + Math.round(yVal / 1000) + 'k', padding.left - 10, y + 4);
    }

    // Coordinates for points
    const stepX = chartW / (data.length - 1 || 1);
    const coords = data.map((d, i) => ({
      x: padding.left + i * stepX,
      y: padding.top + chartH - (d.daily_revenue / maxVal) * chartH,
      revenue: d.daily_revenue,
      label: d.order_date
    }));

    // Draw Gradient Area
    const grad = ctx.createLinearGradient(0, padding.top, 0, height - padding.bottom);
    grad.addColorStop(0, 'rgba(2, 132, 199, 0.35)');
    grad.addColorStop(1, 'rgba(6, 182, 212, 0.0)');

    ctx.beginPath();
    ctx.moveTo(coords[0].x, padding.top + chartH);
    coords.forEach(pt => ctx.lineTo(pt.x, pt.y));
    ctx.lineTo(coords[coords.length - 1].x, padding.top + chartH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Draw Line
    ctx.beginPath();
    coords.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.strokeStyle = primaryColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw Point Dots & X-Labels
    ctx.textAlign = 'center';
    coords.forEach(pt => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = textColor;
      ctx.fillText(pt.label.slice(-5), pt.x, height - 12);
    });
  }

  // Pure Vanilla Canvas Status Distribution Bar Chart
  function drawOrderStatusChart(canvasId, dist) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const parent = canvas.parentElement;
    canvas.width = parent.clientWidth * window.devicePixelRatio || 300;
    canvas.height = parent.clientHeight * window.devicePixelRatio || 240;

    const ctx = canvas.getContext('2d');
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    const width = parent.clientWidth;
    const height = parent.clientHeight;

    ctx.clearRect(0, 0, width, height);

    const isLight = currentTheme === 'light';
    const textColor = isLight ? '#64748b' : '#94a3b8';

    const categories = [
      { name: 'Pending', count: dist['Pending'] || 0, color: '#f59e0b' },
      { name: 'Confirmed', count: dist['Confirmed'] || 0, color: '#3b82f6' },
      { name: 'Shipped', count: dist['Shipped'] || 0, color: '#8b5cf6' },
      { name: 'Delivered', count: dist['Delivered'] || 0, color: '#10b981' }
    ];

    const maxCount = Math.max(...categories.map(c => c.count), 3) * 1.25;
    const barWidth = 36;
    const gap = (width - barWidth * categories.length) / (categories.length + 1);

    ctx.font = '11px -apple-system, sans-serif';

    categories.forEach((cat, i) => {
      const x = gap + i * (barWidth + gap);
      const barH = (cat.count / maxCount) * (height - 70);
      const y = height - 40 - barH;

      // Draw bar
      ctx.fillStyle = cat.color;
      ctx.beginPath();
      ctx.roundRect(x, y, barWidth, barH, [6, 6, 0, 0]);
      ctx.fill();

      // Label and value
      ctx.fillStyle = textColor;
      ctx.textAlign = 'center';
      ctx.fillText(cat.count, x + barWidth / 2, y - 6);
      ctx.fillText(cat.name, x + barWidth / 2, height - 15);
    });
  }

  window.addEventListener('resize', () => {
    if (activeTab === 'overview' || activeTab === 'analytics') {
      renderSalesCharts();
    }
  });

  // =========================================================================
  // 6. AI Chatbot Analytics
  // =========================================================================
  async function fetchChatbotAnalytics() {
    try {
      const res = await adminFetch('/api/admin/chatbot-analytics');
      const data = await res.json();
      if (!res.ok) return;

      if (chatTotalBadge) chatTotalBadge.textContent = `${data.totalQuestions || 0} Questions Asked`;

      // Render queries
      if (chatQueryList) {
        if (!data.recentQuestions || data.recentQuestions.length === 0) {
          chatQueryList.innerHTML = `<div class="table-empty-row">No customer inquiries logged yet. Ask questions to the storefront chatbot to see them live!</div>`;
        } else {
          chatQueryList.innerHTML = data.recentQuestions.map(q => `
            <div class="chat-query-card">
              <div>
                <div class="query-text">"${q.question}"</div>
                <div class="query-meta">
                  <span>${formatDate(q.created_at)}</span> • 
                  <span>Grounding sources: ${q.sources_count || 0} chunks</span>
                </div>
              </div>
              <span class="status-badge ${q.mode === 'openrouter-rag' ? 'status-confirmed' : 'status-processing'}">
                ${q.mode === 'openrouter-rag' ? 'OpenRouter LLM' : 'Local RAG'}
              </span>
            </div>
          `).join('');
        }
      }

      // Render Topics
      if (chatTopicsContainer) {
        const topics = data.topTopics || [
          { topic: 'best camera', count: 14 },
          { topic: 'under 25000', count: 11 },
          { topic: '8GB RAM', count: 8 },
          { topic: '5000mAh battery', count: 7 },
          { topic: 'samsung warranty', count: 5 }
        ];

        chatTopicsContainer.innerHTML = topics.map(t => `
          <div class="topic-chip">
            <span>${t.count}</span>
            ${t.topic}
          </div>
        `).join('');
      }
    } catch (err) {
      console.warn('fetchChatbotAnalytics error:', err);
    }
  }

  // =========================================================================
  // 7. Recent Activity Feed
  // =========================================================================
  async function fetchActivity() {
    try {
      const res = await adminFetch('/api/admin/activity');
      const data = await res.json();
      if (!res.ok) return;

      if (!activityTimeline) return;
      if (!data.activity || data.activity.length === 0) {
        activityTimeline.innerHTML = `<div class="table-empty-row">No store events recorded yet.</div>`;
        return;
      }

      activityTimeline.innerHTML = data.activity.map(a => {
        let dotClass = 'activity-dot';
        if (a.type.includes('order')) dotClass += ' order';
        else if (a.type.includes('user')) dotClass += ' user';
        else if (a.type.includes('product')) dotClass += ' product';

        return `
          <div class="activity-item">
            <div class="${dotClass}"></div>
            <div class="activity-title">${a.title}</div>
            <div class="activity-desc">${a.description || ''}</div>
            <div class="activity-time">${formatDate(a.created_at)}</div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.warn('fetchActivity error:', err);
    }
  }

  // =========================================================================
  // 8. Low Stock & Out of Stock Alerts
  // =========================================================================
  async function fetchStockAlerts() {
    try {
      const res = await adminFetch('/api/admin/stock-alerts');
      const data = await res.json();
      if (!res.ok) return;

      const { lowStock = [], outOfStock = [] } = data;

      if (lowStockTbody) {
        if (lowStock.length === 0) {
          lowStockTbody.innerHTML = `<tr><td colspan="5" class="table-empty-row">No low stock warnings. All smartphones are well-stocked!</td></tr>`;
        } else {
          lowStockTbody.innerHTML = lowStock.map(p => `
            <tr>
              <td><strong>${p.model}</strong></td>
              <td>${p.brand}</td>
              <td class="amount-cell">${formatINR(p.price)}</td>
              <td><span class="stock-badge stock-low">${p.stock} units left ⚠️</span></td>
              <td>
                <button class="btn-table-action btn-edit-product" data-prod-id="${p.id}">
                  Restock ➕
                </button>
              </td>
            </tr>
          `).join('');
        }
      }

      if (outOfStockTbody) {
        if (outOfStock.length === 0) {
          outOfStockTbody.innerHTML = `<tr><td colspan="4" class="table-empty-row">No out-of-stock devices!</td></tr>`;
        } else {
          outOfStockTbody.innerHTML = outOfStock.map(p => `
            <tr>
              <td><strong>${p.model}</strong></td>
              <td>${p.brand}</td>
              <td class="amount-cell">${formatINR(p.price)}</td>
              <td>
                <button class="btn-table-action btn-edit-product" data-prod-id="${p.id}">
                  Update Stock 📦
                </button>
              </td>
            </tr>
          `).join('');
        }
      }

      // Attach click listeners for restock
      document.querySelectorAll('#low-stock-tbody .btn-edit-product, #out-of-stock-tbody .btn-edit-product').forEach(btn => {
        btn.addEventListener('click', () => {
          const prodId = btn.getAttribute('data-prod-id');
          const product = currentProducts.find(p => p.id === prodId);
          if (product) openProductModal(product);
        });
      });
    } catch (err) {
      console.warn('fetchStockAlerts error:', err);
    }
  }

  // =========================================================================
  // 9. Export Orders to CSV
  // =========================================================================
  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
      if (currentOrders.length === 0) {
        alert('No orders available to export.');
        return;
      }

      const headers = ['Order Number', 'Date', 'Customer Name', 'Customer Email', 'Customer Phone', 'Address', 'Products', 'Total Amount (INR)', 'Payment Method', 'Status'];
      const rows = currentOrders.map(o => [
        `"${o.order_number}"`,
        `"${o.created_at}"`,
        `"${(o.customer_name || '').replace(/"/g, '""')}"`,
        `"${(o.customer_email || '').replace(/"/g, '""')}"`,
        `"${(o.customer_phone || '').replace(/"/g, '""')}"`,
        `"${(o.shipping_address || '').replace(/"/g, '""')}"`,
        `"${(o.items || []).map(i => `${i.quantity}x ${i.model || i.name}`).join('; ').replace(/"/g, '""')}"`,
        o.total_amount,
        `"${o.payment_method}"`,
        `"${o.status}"`
      ]);

      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `arudra_mobiles_orders_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    });
  }

  // Background Auto-Refresh every 30 seconds
  setInterval(() => {
    if (adminToken) {
      loadAllDashboardData();
    }
  }, 30000);
});
