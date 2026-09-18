/**
 * Orders API Endpoint for NexPhone Studio
 * Handles /api/orders (creating orders and retrieving user order history)
 */
import { createOrder, getUserOrders, getOrderByNumber } from '../lib/db.js';
import { authenticateRequest } from '../lib/auth.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const currentUser = authenticateRequest(req);

  try {
    // 1. GET /api/orders -> retrieve order history
    if (req.method === 'GET') {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      const orderNumber = url.searchParams.get('order_number');

      if (orderNumber) {
        const order = getOrderByNumber(orderNumber);
        if (!order) {
          return res.status(404).json({ error: 'Not Found', message: 'Order not found' });
        }
        return res.status(200).json({ order });
      }

      if (!currentUser) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Please log in to view your orders.' });
      }

      const orders = getUserOrders(currentUser.id);
      return res.status(200).json({ orders });
    }

    // 2. POST /api/orders -> place a new order
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
      const {
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress,
        items,
        paymentMethod = 'Cash on Delivery'
      } = body;

      // Validations
      if (!customerName || String(customerName).trim().length < 2) {
        return res.status(400).json({ error: 'Validation Error', message: 'Customer name is required.' });
      }
      if (!customerEmail || !String(customerEmail).includes('@')) {
        return res.status(400).json({ error: 'Validation Error', message: 'Valid email address is required.' });
      }
      if (!customerPhone || String(customerPhone).trim().length < 10) {
        return res.status(400).json({ error: 'Validation Error', message: 'Valid 10-digit phone number is required.' });
      }
      if (!shippingAddress || String(shippingAddress).trim().length < 10) {
        return res.status(400).json({ error: 'Validation Error', message: 'Please enter a complete shipping address.' });
      }
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Validation Error', message: 'Cart cannot be empty.' });
      }

      // Calculate total
      let calculatedTotal = 0;
      const sanitizedItems = items.map(item => {
        const price = Number(item.price) || 0;
        const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
        calculatedTotal += price * qty;
        return {
          id: item.id || '',
          model: String(item.model || item.title || 'Smartphone'),
          brand: item.brand || '',
          price: price,
          quantity: qty,
          icon: item.icon || '📱'
        };
      });

      const orderNumber = `NEX-${Math.floor(100000 + Math.random() * 900000)}`;

      const order = createOrder({
        orderNumber,
        userId: currentUser ? currentUser.id : null,
        customerName: String(customerName).trim(),
        customerEmail: String(customerEmail).toLowerCase().trim(),
        customerPhone: String(customerPhone).trim(),
        shippingAddress: String(shippingAddress).trim(),
        items: sanitizedItems,
        totalAmount: calculatedTotal,
        paymentMethod: String(paymentMethod)
      });

      return res.status(201).json({
        message: 'Order placed successfully!',
        order
      });
    }

    return res.status(405).json({ error: 'Method Not Allowed' });
  } catch (error) {
    console.error('Orders API error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message || 'Failed to process order' });
  }
}
