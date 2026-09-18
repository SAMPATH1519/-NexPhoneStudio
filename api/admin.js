/**
 * Admin API Controller for NexPhone Studio / Arudra Mobiles
 * Handles admin authentication, store metrics, order status updates, and customer directory
 */
import {
  getAllOrders,
  updateOrderStatus,
  getAdminStats,
  getAllCustomers,
  getOrderByNumber
} from '../lib/db.js';
import crypto from 'crypto';

// In-memory admin session cache for fast validation
const adminTokens = new Set();

function getAdminPin() {
  return (process.env.ADMIN_PIN || 'admin1234').trim();
}

function verifyAdminToken(req) {
  const authHeader = req.headers['authorization'] || '';
  const customHeader = req.headers['x-admin-pin'] || '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();

  // Allow direct PIN header or valid session token
  if (customHeader === getAdminPin()) return true;
  if (token && (adminTokens.has(token) || token === getAdminPin())) return true;
  return false;
}

export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Admin-PIN');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const subpath = parsedUrl.pathname.replace(/^\/api\/admin\/?/, '');

  // 1. Admin Authentication: POST /api/admin/auth
  if (subpath === 'auth' || subpath === 'login') {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const { pin } = req.body || {};
    if (!pin || pin.toString().trim() !== getAdminPin()) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid Admin PIN. Please check your passcode.' });
    }

    const token = 'adm_' + crypto.randomBytes(24).toString('hex');
    adminTokens.add(token);

    return res.status(200).json({
      success: true,
      token,
      storeName: process.env.STORE_NAME || 'NexPhone Studio',
      expiresIn: 86400
    });
  }

  // Guard all subsequent admin routes with authentication check
  if (!verifyAdminToken(req)) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Admin authentication required' });
  }

  try {
    // 2. Dashboard Statistics: GET /api/admin/stats
    if (subpath === 'stats') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
      const stats = getAdminStats();
      return res.status(200).json({
        success: true,
        stats,
        system: {
          storeName: process.env.STORE_NAME || 'NexPhone Studio',
          firebaseProject: process.env.FIREBASE_PROJECT_ID || 'Local SQLite Only',
          isFirebaseConfigured: Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_API_KEY)
        }
      });
    }

    // 3. Orders Management: GET /api/admin/orders
    if (subpath === 'orders') {
      if (req.method === 'GET') {
        const status = parsedUrl.searchParams.get('status') || 'all';
        const search = parsedUrl.searchParams.get('search') || '';
        const limit = parseInt(parsedUrl.searchParams.get('limit') || '100', 10);
        const offset = parseInt(parsedUrl.searchParams.get('offset') || '0', 10);

        const orders = getAllOrders({ status, search, limit, offset });
        return res.status(200).json({
          success: true,
          count: orders.length,
          orders
        });
      }

      // 4. Update Order Status: PATCH /api/admin/orders
      if (req.method === 'PATCH' || req.method === 'POST') {
        const { orderNumber, status } = req.body || {};
        if (!orderNumber || !status) {
          return res.status(400).json({ error: 'Bad Request', message: 'Missing orderNumber or status' });
        }

        const updatedOrder = updateOrderStatus(orderNumber, status);
        if (!updatedOrder) {
          return res.status(404).json({ error: 'Not Found', message: `Order ${orderNumber} not found` });
        }

        return res.status(200).json({
          success: true,
          message: `Order ${orderNumber} status updated to '${status}'`,
          order: updatedOrder
        });
      }

      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 5. Customer Directory: GET /api/admin/customers
    if (subpath === 'customers') {
      if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
      const customers = getAllCustomers();
      return res.status(200).json({
        success: true,
        count: customers.length,
        customers
      });
    }

    return res.status(404).json({ error: 'Not Found', message: `Admin endpoint /api/admin/${subpath} not found` });
  } catch (err) {
    console.error('Admin API error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
}
