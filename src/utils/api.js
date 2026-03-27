import { clearClientData } from './clientData';

// API base URL
// In Next.js, frontend and backend share the same origin in both dev and prod
const API_BASE = '';

// Token storage key
const TOKEN_KEY = 'interp_auth_token';
const USER_KEY = 'interp_user';

// Get stored token
export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

// Set token
export function setToken(token) {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

// Get stored user
export function getStoredUser() {
  if (typeof window === 'undefined') return null;
  try {
    const user = localStorage.getItem(USER_KEY);
    return user ? JSON.parse(user) : null;
  } catch {
    return null;
  }
}

// Set user
export function setStoredUser(user) {
  if (typeof window === 'undefined') return;
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(USER_KEY);
  }
}

// Make authenticated API request
async function apiRequest(endpoint, options = {}) {
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/api${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    // Handle 401 Unauthorized - token expired or invalid
    if (response.status === 401) {
      // Clear invalid token and user data
      setToken(null);
      setStoredUser(null);

      // Clear all client-side data to avoid lingering account data
      await clearClientData();

      // Only throw error for non-auth endpoints (auth endpoints handle 401 themselves)
      if (!endpoint.startsWith('/auth/')) {
        // Dispatch a custom event to notify auth context
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:logout', { detail: { reason: 'token_expired' } }));
        }
      }
    }

    throw new Error(data.error || 'Request failed');
  }

  return data;
}

// Auth API functions
export async function register(email, password, name) {
  const data = await apiRequest('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });

  if (data.token) {
    setToken(data.token);
    setStoredUser(data.user);
  }

  return data;
}

export async function verifyCredentials(email, password) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  // Does NOT persist token
}

export function persistSession(token, user) {
  setToken(token);
  setStoredUser(user);
}

export async function login(email, password) {
  const data = await verifyCredentials(email, password);

  if (data.token) {
    persistSession(data.token, data.user);
  }

  return data;
}

export async function logout() {
  setToken(null);
  setStoredUser(null);

  await clearClientData();
}

export async function checkAuth() {
  const token = getToken();
  if (!token) {
    return { authenticated: false };
  }

  try {
    const data = await apiRequest('/auth/me');
    setStoredUser(data.user);
    return { authenticated: true, user: data.user };
  } catch {
    // Token is invalid
    setToken(null);
    setStoredUser(null);
    return { authenticated: false };
  }
}

// Tasks API functions
export async function fetchTasks() {
  return apiRequest('/tasks');
}

export async function createTask(title, isQuickWin = false) {
  return apiRequest('/tasks', {
    method: 'POST',
    body: JSON.stringify({ title, isQuickWin }),
  });
}

export async function updateTaskAPI(taskId, updates) {
  return apiRequest(`/tasks/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function deleteTaskAPI(taskId) {
  console.log('[API Client] deleteTaskAPI called for:', taskId);
  return apiRequest(`/tasks/${taskId}`, {
    method: 'DELETE',
  });
}

// Sync API
export async function syncTasks(localTasks, dailyFocus, userTags, lastSyncAt) {
  return apiRequest('/tasks/sync', {
    method: 'POST',
    body: JSON.stringify({ tasks: localTasks, dailyFocus, userTags, lastSyncAt }),
  });
}

// Check if user is logged in
export function isLoggedIn() {
  return !!getToken();
}

export default {
  register,
  login,
  verifyCredentials,
  logout,
  checkAuth,
  isLoggedIn,
  fetchTasks,
  createTask,
  updateTaskAPI,
  deleteTaskAPI,
  syncTasks,
  getToken,
  getStoredUser,
};
