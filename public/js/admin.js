/**
 * NexPhone Studio & Arudra Mobiles - Admin Dashboard Controller
 * Handles authentication, KPI metrics, order management, status updates, and inventory
 */

document.addEventListener('DOMContentLoaded', () => {
  // State
  let adminToken = sessionStorage.getItem('nex_admin_token');
  let currentOrders = [];
  let selectedOrder = null;
  let activeTab = 'overview';

  // Elements
  const lockscreen = document.getElementById('admin-lockscreen');
  const lockscreenForm = document.getElementById('lockscreen-form');
  const pinInput = document.getElementById('admin-pin-input');
  const lockscreenError = document.getElementById('lockscreen-error');
  const liveClock = document.getElementById('live-clock');
  const pageHeading = document.getElementById('page-heading');
  const cloudSyncText = document.getElementById('cloud-sync-text');
  const cloudSyncStatus = document.getElementById('cloud-sync-status');
  const btnRefresh = document.getElementById('btn-refresh-data');
  const btnLock = document.getElementById('btn-lock-admin');
  const btnExportCsv = document.getElementById('btn-export-csv');
  const btnViewAllOrders = document.getElementById('btn-view-all-orders');

  // KPI elements
  const kpiRevenue = document.getElementById('kpi-revenue');
  const kpiOrders = document.getElementById('kpi-orders');
  const kpiActive = document.getElementById('kpi-active');
  const kpiCustomers = document.getElementById('kpi-customers');
  const sidebarOrderBadge = document.getElementById('sidebar-order-badge');

  // Tables
  const recentOrdersTbody = document.getElementById('overview-recent-orders-tbody');
  const ordersTableTbody = document.getElementById('orders-table-tbody');
  const productsTableTbody = document.getElementById('products-table-tbody');
  const customersTableTbody = document.getElementById('customers-table-tbody');

  // Filters
  const orderSearchInput = document.getElementById('order-search-input');
  const orderStatusFilter = document.getElementById('order-status-filter');
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

  // Format INR currency
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

  // Live Clock
  function updateClock() {
    if (liveClock) {
      const now = new Date();
      liveClock.textContent = now.toLocaleTimeString('en-IN', { hour12: true });
    }
  }
  setInterval(updateClock, 1000);
  updateClock();

  // Authentication Check
  if (adminToken) {
    unlockDashboard();
  } else {
    lockDashboard();
  }

  // Form Submit: Unlock with PIN
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
        if (!res.ok) {
          throw new Error(data.message || 'Invalid passcode');
        }

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
    loadDashboardData();
    renderProducts();
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

  if (btnLock) {
    btnLock.addEventListener('click', lockDashboard);
  }

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
      throw new Error('Admin session expired. Please re-enter passcode.');
    }
    return res;
  }

  // Load All Dashboard Data
  async function loadDashboardData() {
    try {
      await Promise.all([
        fetchStats(),
        fetchOrders(),
        fetchCustomers()
      ]);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    }
  }

  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      btnRefresh.style.opacity = '0.5';
      loadDashboardData().finally(() => {
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
    btnViewAllOrders.addEventListener('click', () => {
      switchTab('orders');
    });
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
      overview: 'Store Overview',
      orders: 'Customer Orders',
      products: 'Inventory Catalog',
      customers: 'Customer Directory',
      system: 'Cloud & System Health'
    };
    if (pageHeading) pageHeading.textContent = titles[tabId] || 'Admin Dashboard';
  }

  // 1. Fetch KPI Statistics
  async function fetchStats() {
    try {
      const res = await adminFetch('/api/admin/stats');
      const data = await res.json();
      if (!res.ok) return;

      const { stats, system } = data;
      if (kpiRevenue) kpiRevenue.textContent = formatINR(stats.totalRevenue);
      if (kpiOrders) kpiOrders.textContent = stats.totalOrders || 0;
      if (kpiActive) kpiActive.textContent = stats.activeOrders || 0;
      if (kpiCustomers) kpiCustomers.textContent = stats.totalCustomers || 0;
      if (sidebarOrderBadge) sidebarOrderBadge.textContent = stats.totalOrders || 0;

      // Update System Health card & topbar
      if (cloudSyncText) {
        cloudSyncText.textContent = system.isFirebaseConfigured
          ? `Cloud Live: ${system.firebaseProject}`
          : 'Local SQLite Mode';
      }
      const sysFbProject = document.getElementById('sys-fb-project');
      if (sysFbProject) sysFbProject.textContent = system.firebaseProject || 'Not configured';

      // Render Overview Recent Orders
      renderRecentOrders(stats.recentOrders || []);
    } catch (err) {
      console.warn('Could not fetch stats:', err);
    }
  }

  function renderRecentOrders(recentOrders) {
    if (!recentOrdersTbody) return;
    if (recentOrders.length === 0) {
      recentOrdersTbody.innerHTML = `<tr><td colspan="6" class="table-empty-row">No orders recorded yet.</td></tr>`;
      return;
    }

    recentOrdersTbody.innerHTML = recentOrders.map(o => `
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

    // Attach status changer listeners
    recentOrdersTbody.querySelectorAll('.status-changer-select').forEach(sel => {
      sel.addEventListener('change', async (e) => {
        const orderNum = e.target.getAttribute('data-order-num');
        const newStatus = e.target.value;
        await handleStatusUpdate(orderNum, newStatus);
      });
    });
  }

  // 2. Fetch Orders
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
      console.warn('Could not fetch orders:', err);
    }
  }

  function renderOrdersTable(orders) {
    if (!ordersTableTbody) return;
    if (orders.length === 0) {
      ordersTableTbody.innerHTML = `<tr><td colspan="9" class="table-empty-row">No orders found matching filters.</td></tr>`;
      return;
    }

    ordersTableTbody.innerHTML = orders.map(o => {
      const itemsSummary = (o.items || []).map(i => `${i.quantity}x ${i.model || i.name}`).join(', ');
      return `
        <tr>
          <td><span class="order-num-pill">${o.order_number}</span></td>
          <td>${formatDate(o.created_at)}</td>
          <td class="customer-cell">
            <strong>${o.customer_name}</strong>
            <small>📞 ${o.customer_phone}</small>
          </td>
          <td><div class="item-summary-pill" title="${itemsSummary}">${itemsSummary}</div></td>
          <td class="amount-cell">${formatINR(o.total_amount)}</td>
          <td><small>${o.payment_method || 'COD'}</small></td>
          <td>
            <span class="status-badge ${getStatusBadgeClass(o.status)}">
              ${o.status}
            </span>
          </td>
          <td>
            <select class="status-changer-select" data-order-num="${o.order_number}">
              <option value="Confirmed" ${o.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
              <option value="Processing" ${o.status === 'Processing' ? 'selected' : ''}>Processing</option>
              <option value="Shipped" ${o.status === 'Shipped' ? 'selected' : ''}>Shipped</option>
              <option value="Out for Delivery" ${o.status === 'Out for Delivery' ? 'selected' : ''}>Out for Delivery</option>
              <option value="Delivered" ${o.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
              <option value="Cancelled" ${o.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
            </select>
          </td>
          <td>
            <button class="btn-table-action btn-view-details" data-order-num="${o.order_number}">
              Inspect 👁️
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach listeners
    ordersTableTbody.querySelectorAll('.status-changer-select').forEach(sel => {
      sel.addEventListener('change', async (e) => {
        const orderNum = e.target.getAttribute('data-order-num');
        const newStatus = e.target.value;
        await handleStatusUpdate(orderNum, newStatus);
      });
    });

    ordersTableTbody.querySelectorAll('.btn-view-details').forEach(btn => {
      btn.addEventListener('click', () => {
        const orderNum = btn.getAttribute('data-order-num');
        const order = currentOrders.find(o => o.order_number === orderNum);
        if (order) openOrderDetailModal(order);
      });
    });
  }

  function getStatusBadgeClass(status) {
    switch (status) {
      case 'Confirmed': return 'status-confirmed';
      case 'Processing': return 'status-processing';
      case 'Shipped': return 'status-shipped';
      case 'Out for Delivery': return 'status-processing';
      case 'Delivered': return 'status-delivered';
      case 'Cancelled': return 'status-cancelled';
      default: return 'status-confirmed';
    }
  }

  // Handle Order Status Update
  async function handleStatusUpdate(orderNumber, newStatus) {
    try {
      const res = await adminFetch('/api/admin/orders', {
        method: 'PATCH',
        body: JSON.stringify({ orderNumber, status: newStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Status update failed');

      // Refresh data
      await Promise.all([fetchStats(), fetchOrders()]);
    } catch (err) {
      alert(`Could not update order status: ${err.message}`);
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
      <div class="detail-item-card">
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
  if (orderDetailBackdrop) {
    orderDetailBackdrop.addEventListener('click', (e) => {
      if (e.target === orderDetailBackdrop) closeOrderDetailModal();
    });
  }

  if (modalBtnSaveStatus) {
    modalBtnSaveStatus.addEventListener('click', async () => {
      if (!selectedOrder) return;
      const newStatus = modalStatusSelect.value;
      await handleStatusUpdate(selectedOrder.order_number, newStatus);
      closeOrderDetailModal();
    });
  }

  // Filters for orders
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

  // 3. Render Inventory from PRODUCTS_DATA
  function renderProducts() {
    if (!productsTableTbody || typeof PRODUCTS_DATA === 'undefined') return;

    const search = productSearchInput ? productSearchInput.value.toLowerCase().trim() : '';
    const filtered = PRODUCTS_DATA.filter(p => {
      if (!search) return true;
      return p.model.toLowerCase().includes(search) || p.brand.toLowerCase().includes(search);
    });

    if (filtered.length === 0) {
      productsTableTbody.innerHTML = `<tr><td colspan="7" class="table-empty-row">No smartphones match search.</td></tr>`;
      return;
    }

    productsTableTbody.innerHTML = filtered.map(p => `
      <tr>
        <td style="display: flex; align-items: center; gap: 0.75rem;">
          <img src="${p.image}" alt="${p.model}" style="width: 40px; height: 44px; object-fit: contain; background: rgba(0,0,0,0.2); padding: 2px; border-radius: 4px; border: 1px solid var(--admin-border);">
          <div>
            <strong>${p.model}</strong>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${p.badge || ''}</div>
          </div>
        </td>
        <td><span style="font-weight: 600; color: var(--accent);">${p.brand}</span></td>
        <td><small>${p.ram} • ${p.storage}</small></td>
        <td class="amount-cell">${formatINR(p.price)}</td>
        <td><small>${formatINR(p.mrp)} <span style="color: var(--success);">(${p.discount})</span></small></td>
        <td>⭐ ${p.rating} <small>(${p.reviews})</small></td>
        <td>
          <span class="status-badge status-delivered">
            In Stock ✅
          </span>
        </td>
      </tr>
    `).join('');
  }

  if (productSearchInput) {
    productSearchInput.addEventListener('input', renderProducts);
  }

  // 4. Fetch Customers
  async function fetchCustomers() {
    try {
      const res = await adminFetch('/api/admin/customers');
      const data = await res.json();
      if (!res.ok) return;

      renderCustomersTable(data.customers || []);
    } catch (err) {
      console.warn('Could not fetch customers:', err);
    }
  }

  function renderCustomersTable(customers) {
    if (!customersTableTbody) return;
    if (customers.length === 0) {
      customersTableTbody.innerHTML = `<tr><td colspan="6" class="table-empty-row">No registered customers yet.</td></tr>`;
      return;
    }

    customersTableTbody.innerHTML = customers.map(c => `
      <tr>
        <td><code>#CUST-${c.id}</code></td>
        <td><strong>${c.name}</strong></td>
        <td>${c.email}</td>
        <td>${formatDate(c.created_at)}</td>
        <td style="font-weight: 600;">${c.order_count}</td>
        <td class="amount-cell">${formatINR(c.total_spent)}</td>
      </tr>
    `).join('');
  }

  // 5. Export Orders to CSV
  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
      if (currentOrders.length === 0) {
        alert('No orders to export.');
        return;
      }

      const headers = ['Order Number', 'Date', 'Customer Name', 'Customer Email', 'Customer Phone', 'Shipping Address', 'Items', 'Total Amount', 'Payment Method', 'Status'];
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

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `nexphone_orders_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  // Periodic polling every 30 seconds
  setInterval(() => {
    if (adminToken) {
      loadDashboardData();
    }
  }, 30000);
});
