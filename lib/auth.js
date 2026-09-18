/**
 * Authentication and Cryptography Module for NexPhone Studio
 * Uses Node.js native `crypto` module (zero external dependencies)
 */
import crypto from 'crypto';
import { createSession, deleteSession, getSessionUser } from './db.js';

const SESSION_DURATION_DAYS = 7;

/**
 * Hash password with a unique cryptographic salt using scrypt
 */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

/**
 * Verify a plaintext password against stored hash & salt
 */
export function verifyPassword(password, storedHash, salt) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(storedHash, 'hex'));
}

/**
 * Generate a cryptographically secure session token
 */
export function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a new user session in SQLite
 */
export function createSessionToken(userId) {
  const token = generateToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);
  
  // ISO string format: YYYY-MM-DD HH:MM:SS
  const expiresAtStr = expiresAt.toISOString().replace('T', ' ').substring(0, 19);
  createSession(token, userId, expiresAtStr);
  
  return {
    token,
    expiresAt: expiresAtStr
  };
}

/**
 * Invalidate user session
 */
export function logoutSession(token) {
  if (token) {
    deleteSession(token);
  }
}

/**
 * Extract session token from HTTP Request headers or cookie
 */
export function extractToken(req) {
  // Check Authorization header: Bearer <token>
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  // Check Cookie header: session_token=<token>
  const cookieHeader = req.headers['cookie'];
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    for (const cookie of cookies) {
      if (cookie.startsWith('session_token=')) {
        return cookie.substring('session_token='.length).trim();
      }
    }
  }

  return null;
}

/**
 * Authenticate request and return user object if session valid
 */
export function authenticateRequest(req) {
  const token = extractToken(req);
  if (!token) return null;
  return getSessionUser(token);
}
