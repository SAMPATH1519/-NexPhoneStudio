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

  CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    price INTEGER NOT NULL,
    mrp INTEGER NOT NULL,
    discount TEXT,
    ram TEXT,
    storage TEXT,
    display TEXT,
    camera TEXT,
    battery TEXT,
    processor TEXT,
    stock INTEGER DEFAULT 12,
    rating REAL DEFAULT 4.5,
    reviews INTEGER DEFAULT 100,
    badge TEXT,
    image TEXT,
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS chatbot_queries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question TEXT NOT NULL,
    mode TEXT,
    sources_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
  CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
  CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand);
  CREATE INDEX IF NOT EXISTS idx_chatbot_created ON chatbot_queries(created_at);
  CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);
`);

// Seed default products if products table is empty
function seedProductsIfEmpty() {
  const countRow = db.prepare('SELECT COUNT(*) as count FROM products').get();
  if (countRow && countRow.count > 0) return;

  const defaultProducts = [
    {
      id: "oneplus-nord-ce4",
      brand: "OnePlus",
      model: "OnePlus Nord CE4 5G",
      price: 24999,
      mrp: 26999,
      discount: "7% OFF",
      ram: "8GB LPDDR4X",
      storage: "128GB UFS 3.1",
      display: "6.7\" 120Hz Fluid AMOLED",
      camera: "50MP Sony LYT-600 OIS + 8MP UW",
      battery: "5500 mAh (100W SuperVOOC)",
      processor: "Snapdragon 7 Gen 3",
      stock: 14,
      rating: 4.6,
      reviews: 1420,
      badge: "Best Value Under ₹25k",
      image: "/images/oneplus-nord-ce4.jpg"
    },
    {
      id: "redmi-note-13-pro",
      brand: "Xiaomi",
      model: "Redmi Note 13 Pro 5G",
      price: 23999,
      mrp: 28999,
      discount: "17% OFF",
      ram: "8GB LPDDR4X",
      storage: "128GB / 256GB UFS 2.2",
      display: "6.67\" 1.5K 120Hz AMOLED (Victus)",
      camera: "200MP Samsung HP3 OIS + 8MP UW",
      battery: "5100 mAh (67W Turbo Charge)",
      processor: "Snapdragon 7s Gen 2",
      stock: 9,
      rating: 4.5,
      reviews: 2180,
      badge: "200MP Champion",
      image: "/images/redmi-note-13-pro.jpg"
    },
    {
      id: "samsung-galaxy-a35",
      brand: "Samsung",
      model: "Samsung Galaxy A35 5G",
      price: 27999,
      mrp: 33999,
      discount: "18% OFF",
      ram: "8GB RAM",
      storage: "128GB (Expandable 1TB)",
      display: "6.6\" FHD+ 120Hz Super AMOLED",
      camera: "50MP OIS + 8MP UW + 5MP Macro",
      battery: "5000 mAh (25W Fast Charge)",
      processor: "Exynos 1380 (5nm)",
      stock: 4, // low stock for alert
      rating: 4.4,
      reviews: 950,
      badge: "IP67 Waterproof",
      image: "/images/samsung-galaxy-a35.jpg"
    },
    {
      id: "samsung-galaxy-a55",
      brand: "Samsung",
      model: "Samsung Galaxy A55 5G",
      price: 39999,
      mrp: 45999,
      discount: "13% OFF",
      ram: "8GB / 12GB RAM",
      storage: "128GB / 256GB UFS 3.1",
      display: "6.6\" 120Hz Super AMOLED Victus+",
      camera: "50MP Sony IMX906 OIS + 12MP UW + 5MP",
      battery: "5000 mAh (25W Charging)",
      processor: "Exynos 1480 (AMD Xclipse GPU)",
      stock: 12,
      rating: 4.6,
      reviews: 830,
      badge: "Premium Metal Frame",
      image: "/images/samsung-galaxy-a55.jpg"
    },
    {
      id: "google-pixel-8a",
      brand: "Google",
      model: "Google Pixel 8a",
      price: 49999,
      mrp: 52999,
      discount: "6% OFF",
      ram: "8GB LPDDR5x",
      storage: "128GB / 256GB UFS 3.1",
      display: "6.1\" 120Hz Actua OLED (2000 nits)",
      camera: "64MP Quad PD OIS + 13MP UW",
      battery: "4492 mAh (18W + Qi Wireless)",
      processor: "Google Tensor G3 + Titan M2",
      stock: 7,
      rating: 4.7,
      reviews: 640,
      badge: "Best Camera & 7yr OS",
      image: "/images/google-pixel-8a.jpg"
    },
    {
      id: "iqoo-z9-5g",
      brand: "iQOO",
      model: "iQOO Z9 5G",
      price: 19999,
      mrp: 24999,
      discount: "20% OFF",
      ram: "8GB LPDDR4X",
      storage: "128GB / 256GB UFS 2.2",
      display: "6.67\" 120Hz AMOLED (1800 nits)",
      camera: "50MP Sony IMX882 OIS + 2MP Bokeh",
      battery: "5000 mAh (44W FlashCharge)",
      processor: "Dimensity 7200 (4nm)",
      stock: 15,
      rating: 4.5,
      reviews: 1890,
      badge: "Fastest Under ₹20k",
      image: "/images/iqoo-z9-5g.jpg"
    },
    {
      id: "realme-12-pro-plus",
      brand: "Realme",
      model: "Realme 12 Pro+ 5G",
      price: 29999,
      mrp: 34999,
      discount: "14% OFF",
      ram: "8GB / 12GB",
      storage: "128GB / 256GB",
      display: "6.7\" 120Hz Curved OLED",
      camera: "64MP Periscope OIS (3x) + 50MP Sony IMX890",
      battery: "5000 mAh (67W SuperVOOC)",
      processor: "Snapdragon 7s Gen 2",
      stock: 2, // low stock
      rating: 4.4,
      reviews: 1120,
      badge: "Periscope Zoom Champion",
      image: "/images/realme-12-pro-plus.jpg"
    },
    {
      id: "moto-g64-5g",
      brand: "Motorola",
      model: "Motorola G64 5G",
      price: 14999,
      mrp: 17999,
      discount: "17% OFF",
      ram: "8GB / 12GB RAM",
      storage: "128GB / 256GB (Exp 1TB)",
      display: "6.5\" FHD+ 120Hz IPS LCD",
      camera: "50MP OIS Quad Pixel + 8MP Macro/Depth",
      battery: "6000 mAh (33W TurboPower)",
      processor: "Dimensity 7025 (World 1st)",
      stock: 0, // out of stock for alert
      rating: 4.3,
      reviews: 870,
      badge: "6000mAh Battery Monster",
      image: "/images/moto-g64-5g.jpg"
    },
    {
      id: "vivo-t3-5g",
      brand: "Vivo",
      model: "Vivo T3 5G",
      price: 19999,
      mrp: 22999,
      discount: "13% OFF",
      ram: "8GB LPDDR4X",
      storage: "128GB / 256GB UFS 2.2",
      display: "6.67\" 120Hz AMOLED (1800 nits)",
      camera: "50MP Sony IMX882 OIS + 2MP Bokeh",
      battery: "5000 mAh (44W FlashCharge)",
      processor: "Dimensity 7200 (4nm)",
      stock: 11,
      rating: 4.5,
      reviews: 1350,
      badge: "Sony OIS Flagship Sensor",
      image: "/images/vivo-t3-5g.jpg"
    },
    {
      id: "poco-x6-pro",
      brand: "POCO",
      model: "POCO X6 Pro 5G",
      price: 26999,
      mrp: 30999,
      discount: "13% OFF",
      ram: "8GB / 12GB LPDDR5X",
      storage: "256GB / 512GB UFS 4.0",
      display: "6.67\" 1.5K 120Hz Flow AMOLED",
      camera: "64MP OIS + 8MP UW + 2MP Macro",
      battery: "5000 mAh (67W SonicCharge)",
      processor: "Dimensity 8300 Ultra (4nm)",
      stock: 8,
      rating: 4.6,
      reviews: 2450,
      badge: "Gaming Beast (1.4M Antutu)",
      image: "/images/poco-x6-pro.jpg"
    },
    {
      id: "nothing-phone-2a",
      brand: "Nothing",
      model: "Nothing Phone (2a) 5G",
      price: 23999,
      mrp: 25999,
      discount: "8% OFF",
      ram: "8GB / 12GB RAM",
      storage: "128GB / 256GB",
      display: "6.7\" 120Hz Flexible AMOLED (1300 nits)",
      camera: "50MP Main OIS + 50MP Ultra-Wide",
      battery: "5000 mAh (45W Fast Charging)",
      processor: "Dimensity 7200 Pro (4nm)",
      stock: 6,
      rating: 4.6,
      reviews: 3100,
      badge: "Iconic Glyph Interface",
      image: "/images/nothing-phone-2a.jpg"
    },
    {
      id: "iqoo-neo-9-pro",
      brand: "iQOO",
      model: "iQOO Neo 9 Pro 5G",
      price: 36999,
      mrp: 41999,
      discount: "12% OFF",
      ram: "8GB / 12GB LPDDR5X",
      storage: "128GB / 256GB UFS 4.0",
      display: "6.78\" 144Hz 1.5K LTPO AMOLED",
      camera: "50MP Sony IMX920 VCS OIS + 8MP UW",
      battery: "5160 mAh (120W FlashCharge)",
      processor: "Snapdragon 8 Gen 2 + Supercomputing Q1",
      stock: 5, // low stock
      rating: 4.7,
      reviews: 1780,
      badge: "Flagship Snapdragon 8 Gen 2",
      image: "/images/iqoo-neo-9-pro.jpg"
    }
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO products (
      id, brand, model, price, mrp, discount, ram, storage, display,
      camera, battery, processor, stock, rating, reviews, badge, image, is_active
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  for (const p of defaultProducts) {
    stmt.run(
      p.id, p.brand, p.model, p.price, p.mrp, p.discount, p.ram, p.storage,
      p.display, p.camera, p.battery, p.processor, p.stock, p.rating, p.reviews,
      p.badge, p.image
    );
  }
  console.log('Seeded initial products catalog into SQLite database.');
}

seedProductsIfEmpty();


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
  const validStatuses = ['Pending', 'Confirmed', 'Processing', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'];
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

  // Log activity
  logActivity(
    'order_status_updated',
    `Order ${orderNumber} updated to ${newStatus}`,
    `Order status transitioned to ${newStatus}`
  );

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
      SUM(CASE WHEN status IN ('Pending', 'Confirmed', 'Processing', 'Shipped', 'Out for Delivery') THEN 1 ELSE 0 END) as pending_orders,
      SUM(CASE WHEN status = 'Cancelled' THEN 1 ELSE 0 END) as cancelled_orders
    FROM orders
  `);
  const stats = statsStmt.get();

  const userStmt = db.prepare('SELECT COUNT(*) as total_users FROM users');
  const userCount = userStmt.get().total_users;

  const prodStmt = db.prepare(`
    SELECT 
      COUNT(*) as total_products,
      SUM(CASE WHEN stock <= 5 AND stock > 0 THEN 1 ELSE 0 END) as low_stock_count,
      SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END) as out_of_stock_count
    FROM products 
    WHERE is_active = 1
  `);
  const prodStats = prodStmt.get();

  const recentStmt = db.prepare(`
    SELECT order_number, customer_name, customer_email, total_amount, status, created_at
    FROM orders
    ORDER BY created_at DESC
    LIMIT 6
  `);
  const recentOrders = recentStmt.all();

  return {
    totalUsers: userCount,
    totalOrders: stats.total_orders,
    totalProducts: prodStats.total_products || 0,
    totalRevenue: stats.total_revenue,
    pendingOrders: stats.pending_orders,
    deliveredOrders: stats.delivered_orders,
    cancelledOrders: stats.cancelled_orders,
    averageOrderValue: Math.round(stats.average_order_value),
    lowStockCount: (prodStats.low_stock_count || 0) + (prodStats.out_of_stock_count || 0),
    recentOrders
  };
}

/**
 * Admin: Detailed Sales Analytics & Chart Data Points
 */
export function getSalesAnalytics() {
  // Today's Sales
  const todayStmt = db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as orders
    FROM orders
    WHERE date(created_at) = date('now')
  `);
  const today = todayStmt.get();

  // Weekly Sales (last 7 days)
  const weekStmt = db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as orders
    FROM orders
    WHERE created_at >= datetime('now', '-7 days')
  `);
  const week = weekStmt.get();

  // Monthly Sales (last 30 days)
  const monthStmt = db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) as revenue, COUNT(*) as orders
    FROM orders
    WHERE created_at >= datetime('now', '-30 days')
  `);
  const month = monthStmt.get();

  // All-time totals
  const totalStmt = db.prepare(`
    SELECT COALESCE(SUM(total_amount), 0) as total_revenue, COUNT(*) as total_orders
    FROM orders
  `);
  const totals = totalStmt.get();

  // Daily Trend (Last 7 Days for Charts)
  const dailyStmt = db.prepare(`
    SELECT 
      date(created_at) as order_date,
      COALESCE(SUM(total_amount), 0) as daily_revenue,
      COUNT(*) as daily_orders
    FROM orders
    WHERE created_at >= datetime('now', '-7 days')
    GROUP BY date(created_at)
    ORDER BY order_date ASC
  `);
  const dailyRows = dailyStmt.all();

  // Status Distribution
  const statusStmt = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM orders
    GROUP BY status
  `);
  const statusRows = statusStmt.all();
  const statusDistribution = {};
  for (const s of statusRows) {
    statusDistribution[s.status] = s.count;
  }

  return {
    todayRevenue: today.revenue,
    todayOrders: today.orders,
    weeklyRevenue: week.revenue,
    weeklyOrders: week.orders,
    monthlyRevenue: month.revenue,
    monthlyOrders: month.orders,
    totalRevenue: totals.total_revenue,
    totalOrders: totals.total_orders,
    dailyTrend: dailyRows,
    statusDistribution
  };
}

/**
 * Admin: Product Management (CRUD)
 */
export function getAllProducts({ search = '', lowStockOnly = false } = {}) {
  let query = 'SELECT * FROM products WHERE is_active = 1';
  const params = [];

  if (lowStockOnly) {
    query += ' AND stock <= 5';
  }

  if (search && search.trim()) {
    const s = `%${search.trim().toLowerCase()}%`;
    query += ' AND (LOWER(model) LIKE ? OR LOWER(brand) LIKE ? OR LOWER(processor) LIKE ?)';
    params.push(s, s, s);
  }

  query += ' ORDER BY created_at DESC';
  const stmt = db.prepare(query);
  return stmt.all(...params);
}

export function getProductById(id) {
  const stmt = db.prepare('SELECT * FROM products WHERE id = ?');
  return stmt.get(id);
}

export function createProduct(productData) {
  const {
    id,
    brand,
    model,
    price,
    mrp,
    discount = '10% OFF',
    ram = '8GB',
    storage = '128GB',
    display = '6.7" AMOLED',
    camera = '50MP OIS',
    battery = '5000 mAh',
    processor = 'Octa-Core 5G',
    stock = 10,
    rating = 4.5,
    badge = 'New Arrival',
    image = '/images/oneplus-nord-ce4.jpg'
  } = productData;

  const generatedId = id || model.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  const stmt = db.prepare(`
    INSERT INTO products (
      id, brand, model, price, mrp, discount, ram, storage, display,
      camera, battery, processor, stock, rating, badge, image, is_active, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
  `);

  stmt.run(
    generatedId, brand, model, Number(price), Number(mrp || price),
    discount, ram, storage, display, camera, battery, processor,
    Number(stock), Number(rating), badge, image
  );

  logActivity('product_added', `New Phone Added: ${model}`, `Brand: ${brand}, Price: ₹${price}, Stock: ${stock}`);

  return getProductById(generatedId);
}

export function updateProduct(id, updates) {
  const existing = getProductById(id);
  if (!existing) return null;

  const fields = [];
  const values = [];

  const allowed = [
    'brand', 'model', 'price', 'mrp', 'discount', 'ram', 'storage',
    'display', 'camera', 'battery', 'processor', 'stock', 'rating', 'badge', 'image'
  ];

  for (const key of allowed) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }

  if (fields.length === 0) return existing;

  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(id);

  const query = `UPDATE products SET ${fields.join(', ')} WHERE id = ?`;
  const stmt = db.prepare(query);
  stmt.run(...values);

  logActivity(
    'product_updated',
    `Product Updated: ${updates.model || existing.model}`,
    `Stock: ${updates.stock !== undefined ? updates.stock : existing.stock}, Price: ₹${updates.price !== undefined ? updates.price : existing.price}`
  );

  return getProductById(id);
}

export function deleteProduct(id) {
  const existing = getProductById(id);
  if (!existing) return false;

  const stmt = db.prepare('UPDATE products SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  stmt.run(id);

  logActivity('product_deleted', `Product Deleted: ${existing.model}`, `Removed from active storefront.`);
  return true;
}

export function getLowStockProducts(threshold = 5) {
  const lowStmt = db.prepare('SELECT * FROM products WHERE is_active = 1 AND stock <= ? AND stock > 0 ORDER BY stock ASC');
  const outStmt = db.prepare('SELECT * FROM products WHERE is_active = 1 AND stock = 0 ORDER BY updated_at DESC');

  return {
    lowStock: lowStmt.all(threshold),
    outOfStock: outStmt.all()
  };
}

/**
 * AI Chatbot Analytics & Logging
 */
export function logChatbotQuery(question, mode = 'local-rag', sourcesCount = 0) {
  try {
    const stmt = db.prepare(`
      INSERT INTO chatbot_queries (question, mode, sources_count)
      VALUES (?, ?, ?)
    `);
    stmt.run(question.trim(), mode, sourcesCount);
  } catch (e) {
    console.warn('Could not log chatbot query:', e.message);
  }
}

export function getChatbotAnalytics() {
  const totalStmt = db.prepare('SELECT COUNT(*) as total FROM chatbot_queries');
  const totalQuestions = totalStmt.get().total;

  const recentStmt = db.prepare(`
    SELECT question, mode, sources_count, created_at
    FROM chatbot_queries
    ORDER BY created_at DESC
    LIMIT 10
  `);
  const recentQuestions = recentStmt.all();

  // Extract frequent topics/keywords
  const queriesStmt = db.prepare('SELECT question FROM chatbot_queries ORDER BY created_at DESC LIMIT 100');
  const allQueries = queriesStmt.all().map(r => r.question.toLowerCase());

  const keywords = ['camera', 'battery', 'under 25000', 'under 20000', 'ram', 'samsung', 'oneplus', 'redmi', 'iphone', 'pixel', 'offer', 'warranty', 'emi'];
  const topicCounts = keywords.map(kw => ({
    topic: kw,
    count: allQueries.filter(q => q.includes(kw)).length
  })).filter(t => t.count > 0).sort((a, b) => b.count - a.count);

  return {
    totalQuestions,
    recentQuestions,
    topTopics: topicCounts
  };
}

/**
 * Store Activity Log
 */
export function logActivity(type, title, description = '') {
  try {
    const stmt = db.prepare(`
      INSERT INTO activity_log (type, title, description)
      VALUES (?, ?, ?)
    `);
    stmt.run(type, title, description);
  } catch (e) {
    console.warn('Could not log activity:', e.message);
  }
}

export function getRecentActivity(limit = 20) {
  const stmt = db.prepare(`
    SELECT id, type, title, description, created_at
    FROM activity_log
    ORDER BY created_at DESC
    LIMIT ?
  `);
  return stmt.all(limit);
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


