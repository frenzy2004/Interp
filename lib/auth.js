import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET is not defined in environment variables');
}

// Fallback only for development to avoid breaking local setup
const SECRET_KEY = JWT_SECRET || 'taskwind-dev-secret-key-do-not-use-in-prod';
const JWT_EXPIRES_IN = '30d';

// Hash a password
export async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

// Verify a password
export async function verifyPassword(password, hashedPassword) {
  return bcrypt.compare(password, hashedPassword);
}

// Generate JWT token
export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name
    },
    SECRET_KEY,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// Verify JWT token
export function verifyToken(token) {
  try {
    return jwt.verify(token, SECRET_KEY);
  } catch (error) {
    return null;
  }
}

// Extract token from request
export function getTokenFromRequest(req) {
  // Handle both Web API Headers and Node.js IncomingMessage headers
  const headers = req.headers;

  // Try Authorization header first
  // Node.js uses lowercase, Web API can be mixed case
  const authHeader = typeof headers.get === 'function'
    ? headers.get('authorization')
    : (headers.authorization || headers.Authorization);

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Try cookie
  const cookieHeader = typeof headers.get === 'function'
    ? headers.get('cookie')
    : (headers.cookie || headers.Cookie || '');
  const cookies = parseCookies(cookieHeader);
  return cookies.taskwind_token || null;
}

// Parse cookies from header
function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(';').forEach(cookie => {
    const [name, value] = cookie.trim().split('=');
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
  });

  return cookies;
}

// Authentication middleware for API routes
export async function authenticate(req) {
  const token = getTokenFromRequest(req);

  if (!token) {
    return { user: null, error: 'No authentication token provided' };
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return { user: null, error: 'Invalid or expired token' };
  }

  // Optionally verify user still exists in database
  try {
    const users = await query('SELECT id, email, name FROM users WHERE id = $1', [decoded.id]);
    if (users.length === 0) {
      return { user: null, error: 'User not found' };
    }
    return { user: users[0], error: null };
  } catch (error) {
    return { user: null, error: 'Database error' };
  }
}

// CORS headers for API responses
export function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json',
  };
}

// Create JSON response
export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(),
  });
}

// Create error response
export function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

// Parse request body - handles both Node.js and Web API request formats
export async function parseBody(req) {
  // If req.body exists and is already parsed (Vercel Node.js runtime)
  if (req.body && typeof req.body === 'object') {
    return req.body;
  }

  // If req.json exists (Web API Request)
  if (typeof req.json === 'function') {
    return req.json();
  }

  // If req is a Node.js IncomingMessage, read the body
  if (typeof req.on === 'function') {
    return new Promise((resolve, reject) => {
      let data = '';
      req.on('data', chunk => { data += chunk; });
      req.on('end', () => {
        try {
          resolve(data ? JSON.parse(data) : {});
        } catch (e) {
          reject(new Error('Invalid JSON body'));
        }
      });
      req.on('error', reject);
    });
  }

  return {};
}
