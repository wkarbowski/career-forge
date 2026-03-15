/**
 * services/api.js — API client
 *
 * API client
 * ──────────────────
 * This file covers all endpoints: auth, document CRUD, profile image upload.
 *
 * from this file to share the same base URL config.
 */

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// ============== Token Management ==============
// Refresh tokens are stored in HttpOnly cookies; only access tokens in localStorage

const TOKEN_KEYS = {
  ACCESS: 'cv_auth_token',
  EXPIRES: 'cv_token_expires',
};

const getAccessToken = () => localStorage.getItem(TOKEN_KEYS.ACCESS);
const getTokenExpiry = () => {
  const exp = localStorage.getItem(TOKEN_KEYS.EXPIRES);
  return exp ? parseInt(exp, 10) : null;
};

const getToken = getAccessToken;

const setTokens = (accessToken, refreshToken, expiresIn) => {
  localStorage.setItem(TOKEN_KEYS.ACCESS, accessToken);
  if (expiresIn) {
    const expiryTime = Date.now() + (expiresIn * 1000) - 30000;
    localStorage.setItem(TOKEN_KEYS.EXPIRES, expiryTime.toString());
  }
};

const setToken = (token) => setTokens(token, null, null);

const removeTokens = () => {
  localStorage.removeItem(TOKEN_KEYS.ACCESS);
  localStorage.removeItem(TOKEN_KEYS.EXPIRES);
};

const removeToken = removeTokens;

const getRefreshToken = () => null;

const isTokenExpired = () => {
  const expiry = getTokenExpiry();
  if (!expiry) return true;
  return Date.now() >= expiry;
};

const hasSession = () => !!getAccessToken();

let isRefreshing = false;
let refreshPromise = null;

const refreshAccessToken = async () => {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }
  
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      
      if (!response.ok) {
        removeTokens();
        throw new Error('Session expired. Please log in again.');
      }
      
      const data = await response.json();
      setTokens(data.access_token, null, data.expires_in);
      return data.access_token;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  
  return refreshPromise;
};

const authHeaders = () => {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Fetch wrapper with automatic token refresh
const authenticatedFetch = async (url, options = {}) => {
  if (isTokenExpired() && hasSession()) {
    try {
      await refreshAccessToken();
    } catch (error) {
      console.warn('Token refresh failed:', error.message);
    }
  }
  
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...options.headers,
      ...authHeaders(),
    },
  });
  
  if (response.status === 401 && hasSession()) {
    try {
      await refreshAccessToken();
      return fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
          ...options.headers,
          ...authHeaders(),
        },
      });
    } catch (error) {
      return response;
    }
  }
  
  return response;
};

const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'An error occurred' }));
    if (error.detail && Array.isArray(error.detail)) {
      const messages = error.detail.map(e => `${e.loc?.join('.')}: ${e.msg}`).join(', ');
      throw new Error(messages);
    }
    throw new Error(error.detail || JSON.stringify(error) || 'Request failed');
  }
  return response.json();
};

export const authApi = {
  async register(email, username, password) {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, username, password }),
    });
    return handleResponse(response);
  },

  async login(email, password) {
    const response = await fetch(`${API_BASE}/auth/login/json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    const data = await handleResponse(response);
    setTokens(data.access_token, null, data.expires_in);
    return data;
  },

  async getCurrentUser() {
    const response = await authenticatedFetch(`${API_BASE}/auth/me`);
    return handleResponse(response);
  },

  async updatePreferences(preferences) {
    const response = await authenticatedFetch(`${API_BASE}/auth/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preferences),
    });
    return handleResponse(response);
  },

  async logout() {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
    } catch (error) {
      console.warn('Failed to revoke token on server:', error);
    }
    removeTokens();
  },
  
  async logoutAllDevices() {
    const response = await authenticatedFetch(`${API_BASE}/auth/logout/all`, {
      method: 'POST',
      credentials: 'include',
    });
    const result = await handleResponse(response);
    removeTokens();
    return result;
  },

  async deleteAccount() {
    // Permanently delete the authenticated user's account and all associated data.
    // Implements GDPR Art. 17 right to erasure.
    const response = await authenticatedFetch(`${API_BASE}/auth/me`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok && response.status !== 204) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.detail || 'Failed to delete account');
    }
    removeTokens();
  },

  isAuthenticated() {
    // User is authenticated if we have an access token
    // Token expiry is handled automatically by authenticatedFetch
    return !!getAccessToken();
  },
  
  // Manual token refresh (usually handled automatically)
  async refreshToken() {
    return refreshAccessToken();
  },
};

// ============== Document API ==============

export const documentApi = {
    async uploadProfileImage(documentId, file) {
      const formData = new FormData();
      formData.append('file', file);
      const response = await authenticatedFetch(`${API_BASE}/documents/${documentId}/upload-image`, {
        method: 'POST',
        body: formData,
      });
      return handleResponse(response);
    },
  async list() {
    const response = await authenticatedFetch(`${API_BASE}/documents/`);
    return handleResponse(response);
  },

  async get(id) {
    const response = await authenticatedFetch(`${API_BASE}/documents/${id}`);
    return handleResponse(response);
  },

  async create(title, data) {
    const response = await authenticatedFetch(`${API_BASE}/documents/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, data }),
    });
    return handleResponse(response);
  },

  async update(id, updates) {
    const response = await authenticatedFetch(`${API_BASE}/documents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    return handleResponse(response);
  },

  async delete(id) {
    const response = await authenticatedFetch(`${API_BASE}/documents/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Delete failed' }));
      throw new Error(error.detail);
    }
    return true;
  },

  async getDefault() {
    const response = await authenticatedFetch(`${API_BASE}/documents/default/current`);
    return handleResponse(response);
  },

  async setDefault(id) {
    return this.update(id, { is_default: true });
  },

  async duplicate(id) {
    const response = await authenticatedFetch(`${API_BASE}/documents/${id}/duplicate`, {
      method: 'POST',
    });
    return handleResponse(response);
  },

  async exportDocument(id) {
    const response = await authenticatedFetch(`${API_BASE}/documents/${id}/export`);
    return handleResponse(response);
  },

  async importDocument(title, data, documentType = 'resume') {
    const response = await authenticatedFetch(`${API_BASE}/documents/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, data, document_type: documentType }),
    });
    return handleResponse(response);
  },
};

export { getToken, setToken, removeToken, getAccessToken, getRefreshToken, setTokens, removeTokens };
