/**
 * User Authentication API Endpoint
 * Handles /api/auth/signup, /api/auth/login, /api/auth/logout, and /api/auth/me
 */
import { createUser, getUserByEmail, logActivity } from '../lib/db.js';
import { hashPassword, verifyPassword, createSessionToken, logoutSession, extractToken, authenticateRequest } from '../lib/auth.js';

export default async function handler(req, res) {
  // CORS & Security headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Parse path action
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const action = url.pathname.split('/').pop(); // e.g. 'signup', 'login', 'logout', 'me'

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

    // 1. GET /api/auth/me
    if (action === 'me' && req.method === 'GET') {
      const user = authenticateRequest(req);
      if (!user) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Not logged in' });
      }
      return res.status(200).json({ user });
    }

    // 2. POST /api/auth/signup
    if (action === 'signup' && req.method === 'POST') {
      const name = String(body.name || '').trim();
      const email = String(body.email || '').toLowerCase().trim();
      const password = String(body.password || '');

      if (!name || name.length < 2) {
        return res.status(400).json({ error: 'Validation Error', message: 'Name must be at least 2 characters long.' });
      }
      if (!email || !email.includes('@') || !email.includes('.')) {
        return res.status(400).json({ error: 'Validation Error', message: 'Please enter a valid email address.' });
      }
      if (!password || password.length < 6) {
        return res.status(400).json({ error: 'Validation Error', message: 'Password must be at least 6 characters long.' });
      }

      // Check if email already registered
      const existing = getUserByEmail(email);
      if (existing) {
        return res.status(409).json({ error: 'Conflict', message: 'An account with this email already exists. Please log in.' });
      }

      // Hash password & store
      const { hash, salt } = hashPassword(password);
      const newUser = createUser(name, email, hash, salt);

      // Create session
      const { token, expiresAt } = createSessionToken(newUser.id);

      // Set cookie
      res.setHeader('Set-Cookie', `session_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`);

      logActivity('user_registered', `New Customer: ${newUser.name}`, `Email: ${newUser.email}`);

      return res.status(201).json({
        message: 'Account created successfully!',
        user: { id: newUser.id, name: newUser.name, email: newUser.email },
        token,
        expiresAt
      });
    }

    // 3. POST /api/auth/login
    if (action === 'login' && req.method === 'POST') {
      const email = String(body.email || '').toLowerCase().trim();
      const password = String(body.password || '');

      if (!email || !password) {
        return res.status(400).json({ error: 'Validation Error', message: 'Email and password are required.' });
      }

      const userRecord = getUserByEmail(email);
      if (!userRecord) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password.' });
      }

      const isValid = verifyPassword(password, userRecord.password_hash, userRecord.salt);
      if (!isValid) {
        return res.status(401).json({ error: 'Unauthorized', message: 'Invalid email or password.' });
      }

      // Create session
      const { token, expiresAt } = createSessionToken(userRecord.id);

      // Set cookie
      res.setHeader('Set-Cookie', `session_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7 * 24 * 60 * 60}`);

      return res.status(200).json({
        message: 'Login successful!',
        user: { id: userRecord.id, name: userRecord.name, email: userRecord.email },
        token,
        expiresAt
      });
    }

    // 4. POST /api/auth/logout
    if (action === 'logout' && req.method === 'POST') {
      const token = extractToken(req);
      if (token) {
        logoutSession(token);
      }
      res.setHeader('Set-Cookie', `session_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
      return res.status(200).json({ message: 'Logged out successfully' });
    }

    return res.status(404).json({ error: 'Not Found', message: `Unknown auth action: ${action}` });

  } catch (error) {
    console.error('Auth API error:', error);
    return res.status(500).json({ error: 'Internal Server Error', message: error.message || 'Authentication failed' });
  }
}
