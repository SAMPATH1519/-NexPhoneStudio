/**
 * Local Development Server for NexPhone Studio
 * Serves static frontend assets and executes /api/chat serverless handler
 * Zero external dependencies required!
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import chatHandler from './api/chat.js';
import authHandler from './api/auth.js';
import ordersHandler from './api/orders.js';
import configHandler from './api/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple .env parser to avoid requiring external 'dotenv' dependency
function loadEnv() {
  const envPath = path.resolve(__dirname, '.env');
  const fallbackEnv = path.resolve(__dirname, '.env.example');
  const target = fs.existsSync(envPath) ? envPath : (fs.existsSync(fallbackEnv) ? fallbackEnv : null);
  if (target) {
    const lines = fs.readFileSync(target, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.substring(0, eqIdx).trim();
        const val = trimmed.substring(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
    console.log(`Loaded environment variables from ${path.basename(target)}`);
  }
}

loadEnv();

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.resolve(__dirname, 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // 1. API Routes
  if (pathname.startsWith('/api/')) {
    let bodyData = '';
    req.on('data', chunk => {
      bodyData += chunk;
    });

    req.on('end', async () => {
      try {
        req.body = bodyData ? JSON.parse(bodyData) : {};
      } catch (e) {
        req.body = bodyData;
      }

      // Mock response helper methods
      res.status = function(code) {
        this.statusCode = code;
        return this;
      };
      res.json = function(data) {
        this.setHeader('Content-Type', 'application/json');
        this.end(JSON.stringify(data));
        return this;
      };

      try {
        if (pathname === '/api/chat' || pathname === '/api/chat.js') {
          await chatHandler(req, res);
        } else if (pathname.startsWith('/api/auth')) {
          await authHandler(req, res);
        } else if (pathname.startsWith('/api/orders')) {
          await ordersHandler(req, res);
        } else if (pathname === '/api/config' || pathname === '/api/config.js') {
          await configHandler(req, res);
        } else {
          res.status(404).json({ error: 'Not Found', message: `Endpoint ${pathname} not found` });
        }
      } catch (err) {
        console.error('API Error:', err);
        if (!res.writableEnded) {
          res.status(500).json({ error: 'Internal Server Error', message: err.message });
        }
      }
    });
    return;
  }

  // 2. Static File Serving from /public
  let relativePath = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  let filePath = path.join(PUBLIC_DIR, relativePath);

  // Security: prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  // Check if file exists
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  } else {
    // If route doesn't match a file, fallback to index.html for SPA-like experience
    const fallbackPath = path.join(PUBLIC_DIR, 'index.html');
    if (fs.existsSync(fallbackPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
      fs.createReadStream(fallbackPath).pipe(res);
    } else {
      res.statusCode = 404;
      res.end('Not Found');
    }
  }
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 NexPhone Studio Server is running!`);
  console.log(`📍 Local URL: http://localhost:${PORT}`);
  console.log(`💬 AI RAG Chat Endpoint: http://localhost:${PORT}/api/chat`);
  console.log(`🧠 Local RAG responder: active ✅`);
  console.log(`======================================================\n`);
});
