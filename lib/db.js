/**
 * SQLite Database Manager for NexPhone Studio
 * Uses Node.js native built-in `node:sqlite` (DatabaseSync)
 */
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../data/store.db');

// Ensure data folder exists
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new DatabaseSync(dbPath);

// Enable WAL mode & foreign keys for speed and integrity
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

// Initialize Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number TEXT UNIQUE NOT NULL,
    user_id INTEGER,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    shipping_address TEXT NOT NULL,
    items_json TEXT NOT NULL,
    total_amount INTEGER NOT NULL,
    payment_method TEXT NOT NULL,
    status TEXT DEFAULT 'Confirmed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
`);

/**
 * User Helpers
 */
export function createUser(name, email, passwordHash, salt) {
  const stmt = db.prepare(`
    INSERT INTO users (name, email, password_hash, salt)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(name, email.toLowerCase().trim(), passwordHash, salt);
  return {
    id: Number(result.lastInsertRowid),
    name,
    email: email.toLowerCase().trim()
  };
}

export function getUserByEmail(email) {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  return stmt.get(email.toLowerCase().trim());
}

export function getUserById(id) {
  const stmt = db.prepare('SELECT id, name, email, created_at FROM users WHERE id = ?');
  return stmt.get(id);
}

/**
 * Session Helpers
 */
export function createSession(token, userId, expiresAt) {
  const stmt = db.prepare(`
    INSERT INTO sessions (token, user_id, expires_at)
    VALUES (?, ?, ?)
  `);
  stmt.run(token, userId, expiresAt);
}

export function getSessionUser(token) {
  if (!token) return null;
  const stmt = db.prepare(`
    SELECT u.id, u.name, u.email, u.created_at, s.expires_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ? AND datetime(s.expires_at) > datetime('now')
  `);
  return stmt.get(token);
}

export function deleteSession(token) {
  if (!token) return;
  const stmt = db.prepare('DELETE FROM sessions WHERE token = ?');
  stmt.run(token);
}

/**
 * Order Helpers
 */
export function createOrder({
  orderNumber,
  userId = null,
  customerName,
  customerEmail,
  customerPhone,
  shippingAddress,
  items,
  totalAmount,
  paymentMethod = 'Cash on Delivery'
}) {
  const stmt = db.prepare(`
    INSERT INTO orders (
      order_number, user_id, customer_name, customer_email,
      customer_phone, shipping_address, items_json, total_amount, payment_method, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Confirmed')
  `);
  const result = stmt.run(
    orderNumber,
    userId,
    customerName,
    customerEmail,
    customerPhone,
    shippingAddress,
    JSON.stringify(items),
    totalAmount,
    paymentMethod
  );

  return {
    id: Number(result.lastInsertRowid),
    orderNumber,
    userId,
    customerName,
    customerEmail,
    customerPhone,
    shippingAddress,
    items,
    totalAmount,
    paymentMethod,
    status: 'Confirmed'
  };
}

export function getUserOrders(userId) {
  const stmt = db.prepare(`
    SELECT id, order_number, user_id, customer_name, customer_email,
           customer_phone, shipping_address, items_json, total_amount,
           payment_method, status, created_at
    FROM orders
    WHERE user_id = ?
    ORDER BY created_at DESC
  `);
  const rows = stmt.all(userId);
  return rows.map(r => ({
    ...r,
    items: JSON.parse(r.items_json)
  }));
}

export function getOrderByNumber(orderNumber) {
  const stmt = db.prepare(`
    SELECT id, order_number, user_id, customer_name, customer_email,
           customer_phone, shipping_address, items_json, total_amount,
           payment_method, status, created_at
    FROM orders
    WHERE order_number = ?
  `);
  const row = stmt.get(orderNumber);
  if (!row) return null;
  return {
    ...row,
    items: JSON.parse(row.items_json)
  };
}

/**
 * Admin: Get All Orders with optional filter and search
 */
export function getAllOrders({ status, search, limit = 100, offset = 0 } = {}) {
  let query = `
    SELECT id, order_number, user_id, customer_name, customer_email,
           customer_phone, shipping_address, items_json, total_amount,
           payment_method, status, created_at
    FROM orders
    WHERE 1=1
  `;
  const params = [];

  if (status && status !== 'all') {
    query += ' AND status = ?';
    params.push(status);
  }

  if (search && search.trim()) {
    const s = `%${search.trim().toLowerCase()}%`;
    query += ' AND (LOWER(order_number) LIKE ? OR LOWER(customer_name) LIKE ? OR LOWER(customer_email) LIKE ? OR customer_phone LIKE ?)';
    params.push(s, s, s, s);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const stmt = db.prepare(query);
  const rows = stmt.all(...params);
  return rows.map(r => ({
    ...r,
    items: JSON.parse(r.items_json)
  }));
}

/**
 * Admin: Update Order Status
 */
export function updateOrderStatus(orderNumber, newStatus) {
  const validStatuses = ['Confirmed', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'];
  if (!validStatuses.includes(newStatus)) {
    throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
  }

  const stmt = db.prepare(`
    UPDATE orders
    SET status = ?
    WHERE order_number = ?
  `);
  const result = stmt.run(newStatus, orderNumber);
  if (result.changes === 0) return null;

  return getOrderByNumber(orderNumber);
}

/**
 * Admin: Aggregated KPI Statistics
 */
export function getAdminStats() {
  const statsStmt = db.prepare(`
    SELECT
      COUNT(*) as total_orders,
      COALESCE(SUM(total_amount), 0) as total_revenue,
      COALESCE(AVG(total_amount), 0) as average_order_value,
      SUM(CASE WHEN status = 'Delivered' THEN 1 ELSE 0 END) as delivered_orders,
      SUM(CASE WHEN status IN ('Confirmed', 'Processing', 'Shipped', 'Out for Delivery') THEN 1 ELSE 0 END) as active_orders,
      SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled_orders
    FROM orders
  `);
  const stats = statsStmt.get();

  const userStmt = db.prepare('SELECT COUNT(*) as total_customers FROM users');
  const userCount = userStmt.get().total_customers;

  const recentStmt = db.prepare(`
    SELECT order_number, customer_name, customer_email, total_amount, status, created_at
    FROM orders
    ORDER BY created_at DESC
    LIMIT 5
  `);
  const recentOrders = recentStmt.all();

  return {
    totalRevenue: stats.total_revenue,
    totalOrders: stats.total_orders,
    averageOrderValue: Math.round(stats.average_order_value),
    activeOrders: stats.active_orders,
    deliveredOrders: stats.delivered_orders,
    cancelledOrders: stats.cancelled_orders,
    totalCustomers: userCount,
    recentOrders
  };
}

/**
 * Admin: Get All Customers with lifetime statistics
 */
export function getAllCustomers() {
  const stmt = db.prepare(`
    SELECT u.id, u.name, u.email, u.created_at,
           COUNT(o.id) as order_count,
           COALESCE(SUM(o.total_amount), 0) as total_spent
    FROM users u
    LEFT JOIN orders o ON u.id = o.user_id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `);
  return stmt.all();
}

