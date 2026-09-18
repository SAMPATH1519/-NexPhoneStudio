/**
 * Public Products API for NexPhone Studio Storefront
 * Exposes live SQLite catalog to customer website
 * Handles GET /api/products and GET /api/products?id=...
 */
import { getAllProducts, getProductById } from '../lib/db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const id = parsedUrl.searchParams.get('id');

    if (id) {
      const product = getProductById(id);
      if (!product || product.is_active === 0) {
        return res.status(404).json({ error: 'Not Found', message: 'Product not found' });
      }
      return res.status(200).json({ success: true, product: formatProduct(product) });
    }

    const search = parsedUrl.searchParams.get('search') || '';
    const rawProducts = getAllProducts({ search });
    const products = rawProducts.map(formatProduct);

    return res.status(200).json({
      success: true,
      count: products.length,
      products
    });
  } catch (err) {
    console.error('Products API error:', err);
    return res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
}

function formatProduct(p) {
  // If user pasted a Bing image search URL, extract direct mediaurl
  let image = p.image || '/images/oneplus-nord-ce4.jpg';
  if (image.includes('bing.com/images/search') && image.includes('mediaurl=')) {
    try {
      const match = image.match(/mediaurl=([^&]+)/);
      if (match && match[1]) {
        image = decodeURIComponent(match[1]);
      }
    } catch (e) {}
  }

  const ramNum = p.ram_size_gb || parseInt(p.ram, 10) || 8;
  const ramStr = p.ram ? (p.ram.toLowerCase().includes('gb') ? p.ram : `${p.ram}GB`) : '8GB';
  const storageStr = p.storage ? (p.storage.toLowerCase().includes('gb') || p.storage.toLowerCase().includes('tb') ? p.storage : `${p.storage}GB`) : '128GB';
  const discountStr = p.discount ? (p.discount.includes('OFF') || p.discount.includes('%') ? p.discount : `${p.discount}% OFF`) : '';

  let keyFeatures = [];
  if (p.key_features) {
    try {
      keyFeatures = typeof p.key_features === 'string' ? JSON.parse(p.key_features) : p.key_features;
    } catch (e) {
      keyFeatures = [String(p.key_features)];
    }
  }
  if (!Array.isArray(keyFeatures) || keyFeatures.length === 0) {
    keyFeatures = [
      `${p.processor || 'Octa-Core 5G'} Processor`,
      `${p.camera || '50MP OIS'} Camera`,
      `${p.battery || '5000 mAh'} Battery`,
      `${p.display || '6.7" AMOLED'} Display`
    ];
  }

  return {
    ...p,
    image,
    price: Number(p.price),
    mrp: Number(p.mrp || p.price),
    ram: ramStr,
    ram_size_gb: ramNum,
    storage: storageStr,
    discount: discountStr,
    key_features: keyFeatures,
    pros: p.pros ? (typeof p.pros === 'string' ? JSON.parse(p.pros) : p.pros) : [`Premium ${p.brand} build quality`, `High-performance ${p.processor || '5G'} chipset`],
    cons: p.cons ? (typeof p.cons === 'string' ? JSON.parse(p.cons) : p.cons) : ['Accessories and charger may vary by retailer']
  };
}
