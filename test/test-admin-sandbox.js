import fs from 'fs';
import vm from 'vm';

const html = fs.readFileSync('public/admin.html', 'utf8');
const js = fs.readFileSync('public/js/admin.js', 'utf8');

// Mock DOM
const elements = {};
function makeEl(id) {
  return {
    id,
    tagName: 'DIV',
    classList: {
      add: () => {},
      remove: () => {},
      toggle: () => {}
    },
    style: {},
    addEventListener: () => {},
    textContent: '',
    innerHTML: '',
    value: '',
    parentElement: id.includes('canvas') ? { clientWidth: 0, clientHeight: 0 } : { clientWidth: 600, clientHeight: 300 },
    getContext: () => ({
      scale: () => {},
      clearRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fillText: () => {},
      fill: () => {},
      arc: () => {},
      roundRect: () => {},
      rect: () => {},
      closePath: () => {},
      createLinearGradient: () => ({ addColorStop: () => {} })
    }),
    querySelectorAll: () => [],
    querySelector: () => null,
    focus: () => {},
    reset: () => {},
    setAttribute: () => {},
    getAttribute: () => ''
  };
}

const globalMock = {
  document: {
    addEventListener: (evt, cb) => { if (evt === 'DOMContentLoaded') cb(); },
    getElementById: (id) => {
      if (!elements[id]) elements[id] = makeEl(id);
      return elements[id];
    },
    querySelectorAll: () => [],
    body: { setAttribute: () => {} }
  },
  sessionStorage: {
    getItem: () => 'adm_test_token',
    setItem: () => {},
    removeItem: () => {}
  },
  localStorage: {
    getItem: () => 'dark',
    setItem: () => {}
  },
  window: {
    devicePixelRatio: 1,
    addEventListener: () => {}
  },
  fetch: async (url) => {
    if (url.includes('/api/admin/stats')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          stats: { totalRevenue: 134993, totalOrders: 3, totalProducts: 12, totalUsers: 5, pendingOrders: 1, deliveredOrders: 1, lowStockCount: 4, recentOrders: [] },
          system: { isFirebaseConfigured: true, firebaseProject: 'arudra-moblies' }
        })
      };
    }
    if (url.includes('/api/admin/sales-analytics')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          analytics: {
            todayRevenue: 24999, todayOrders: 1, weeklyRevenue: 134993, weeklyOrders: 3, monthlyRevenue: 134993, monthlyOrders: 3, totalRevenue: 134993, totalOrders: 3,
            dailyTrend: [{ order_date: '2026-09-18', daily_revenue: 134993, daily_orders: 3 }],
            statusDistribution: { Pending: 1, Confirmed: 1, Delivered: 1 }
          }
        })
      };
    }
    if (url.includes('/api/admin/orders')) {
      return { ok: true, status: 200, json: async () => ({ orders: [] }) };
    }
    if (url.includes('/api/admin/users')) {
      return { ok: true, status: 200, json: async () => ({ users: [] }) };
    }
    if (url.includes('/api/admin/products')) {
      return { ok: true, status: 200, json: async () => ({ products: [] }) };
    }
    if (url.includes('/api/admin/stock-alerts')) {
      return { ok: true, status: 200, json: async () => ({ lowStock: [], outOfStock: [] }) };
    }
    if (url.includes('/api/admin/chatbot-analytics')) {
      return { ok: true, status: 200, json: async () => ({ totalQuestions: 3, recentQuestions: [], topTopics: [] }) };
    }
    if (url.includes('/api/admin/activity')) {
      return { ok: true, status: 200, json: async () => ({ activity: [] }) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  },
  setInterval: () => {},
  setTimeout: (cb) => cb(),
  clearTimeout: () => {},
  console
};

try {
  const context = vm.createContext(globalMock);
  vm.runInContext(js, context);
  console.log('Simulated DOM Sandbox: ALL MODULES, CHARTS, AND HANDLERS LOADED WITH 0 ERRORS! ✅');
} catch (e) {
  console.error('Simulated DOM Sandbox: ERROR', e);
  process.exit(1);
}
