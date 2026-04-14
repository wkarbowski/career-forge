/**
 * services/api.ts — API client
 *
 * API client
 * ──────────────────
 * This file covers all endpoints: auth, document CRUD, profile image upload.
 *
 * Extended endpoints (PDF export, sharing, billing, admin) are handled
 * in the extension modules (career-forge), which imports API_BASE
 * from this file to share the same base URL config.
 */

import type {
  User,
  LoginResponse,
  Document,
  DocumentData,
  DocumentVersion,
  ImageUploadResponse,
} from '../types';

const API_BASE: string = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// ============== Token Management ==============
// Refresh tokens are stored in HttpOnly cookies; only access tokens in localStorage

const TOKEN_KEYS = {
  ACCESS: 'cv_auth_token',
  EXPIRES: 'cv_token_expires',
} as const;

const getAccessToken = (): string | null => localStorage.getItem(TOKEN_KEYS.ACCESS);
const getTokenExpiry = (): number | null => {
  const exp = localStorage.getItem(TOKEN_KEYS.EXPIRES);
  return exp ? parseInt(exp, 10) : null;
};

const getToken = getAccessToken;

const setTokens = (accessToken: string, _refreshToken: string | null, expiresIn: number | null): void => {
  localStorage.setItem(TOKEN_KEYS.ACCESS, accessToken);
  if (expiresIn) {
    const expiryTime = Date.now() + (expiresIn * 1000) - 30000;
    localStorage.setItem(TOKEN_KEYS.EXPIRES, expiryTime.toString());
  }
};

const setToken = (token: string): void => setTokens(token, null, null);

const removeTokens = (): void => {
  localStorage.removeItem(TOKEN_KEYS.ACCESS);
  localStorage.removeItem(TOKEN_KEYS.EXPIRES);
};

const removeToken = removeTokens;

const getRefreshToken = (): null => null;

const isTokenExpired = (): boolean => {
  const expiry = getTokenExpiry();
  if (!expiry) return true;
  return Date.now() >= expiry;
};

const hasSession = (): boolean => !!getAccessToken();

let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;

const refreshAccessToken = async (): Promise<string> => {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }
  
  isRefreshing = true;
  refreshPromise = (async (): Promise<string> => {
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
      
      const data: LoginResponse = await response.json();
      setTokens(data.access_token, null, data.expires_in ?? null);
      return data.access_token;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  
  return refreshPromise;
};

const authHeaders = (): Record<string, string> => {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const buildAuthenticatedHeaders = (options: RequestInit = {}): Headers => {
  const method = (options.method || 'GET').toUpperCase();
  const isFormData = options.body && typeof FormData !== 'undefined' && options.body instanceof FormData;
  const headers = new Headers(options.headers as HeadersInit || {});

  Object.entries(authHeaders()).forEach(([key, value]) => {
    headers.set(key, value);
  });

  if (!isFormData && ['POST', 'PUT', 'PATCH'].includes(method) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return headers;
};

// Fetch wrapper with automatic token refresh
const authenticatedFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  if (isTokenExpired() && hasSession()) {
    try {
      await refreshAccessToken();
    } catch (error) {
      console.warn('Token refresh failed:', (error as Error).message);
    }
  }

  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: buildAuthenticatedHeaders(options),
  });

  if (response.status === 401 && hasSession()) {
    try {
      await refreshAccessToken();
      return fetch(url, {
        ...options,
        credentials: 'include',
        headers: buildAuthenticatedHeaders(options),
      });
    } catch (error) {
      return response;
    }
  }

  return response;
};

interface ApiError {
  detail?: string | Array<{ loc?: string[]; msg: string }>;
}

const handleResponse = async <T = unknown>(response: Response): Promise<T> => {
  if (!response.ok) {
    const error: ApiError = await response.json().catch(() => ({ detail: 'An error occurred' }));
    if (error.detail && Array.isArray(error.detail)) {
      const messages = error.detail.map((e: { loc?: string[]; msg: string }) => `${e.loc?.join('.')}: ${e.msg}`).join(', ');
      throw new Error(messages);
    }
    throw new Error((typeof error.detail === 'string' ? error.detail : null) || JSON.stringify(error) || 'Request failed');
  }
  return response.json();
};

export const authApi = {
  async register(email: string, username: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, username, password }),
    });
    return handleResponse(response);
  },

  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE}/auth/login/json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    const data = await handleResponse<LoginResponse>(response);
    setTokens(data.access_token, null, data.expires_in ?? null);
    return data;
  },

  async getCurrentUser(): Promise<User> {
    const response = await authenticatedFetch(`${API_BASE}/auth/me`);
    return handleResponse<User>(response);
  },

  async updatePreferences(preferences: Record<string, unknown>): Promise<User> {
    const response = await authenticatedFetch(`${API_BASE}/auth/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(preferences),
    });
    return handleResponse<User>(response);
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
  
  async logoutAllDevices(): Promise<unknown> {
    const response = await authenticatedFetch(`${API_BASE}/auth/logout/all`, {
      method: 'POST',
      credentials: 'include',
    });
    const result = await handleResponse(response);
    removeTokens();
    return result;
  },

  async deleteAccount(): Promise<void> {
    // Permanently delete the authenticated user's account and all associated data.
    // Implements GDPR Art. 17 right to erasure.
    const response = await authenticatedFetch(`${API_BASE}/auth/me`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!response.ok && response.status !== 204) {
      const err: ApiError = await response.json().catch(() => ({}));
      throw new Error((typeof err.detail === 'string' ? err.detail : null) || 'Failed to delete account');
    }
    removeTokens();
  },

  async logout(): Promise<void> {
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

  async changePassword(currentPassword: string, newPassword: string): Promise<unknown> {
    const response = await authenticatedFetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
    return handleResponse(response);
  },

  async forgotPassword(email: string): Promise<unknown> {
    const response = await fetch(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return handleResponse(response);
  },

  async resetPassword(token: string, newPassword: string): Promise<unknown> {
    const response = await fetch(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password: newPassword }),
    });
    return handleResponse(response);
  },

  isAuthenticated(): boolean {
    // User is authenticated if we have an access token
    // Token expiry is handled automatically by authenticatedFetch
    return !!getAccessToken();
  },
  
  // Manual token refresh (usually handled automatically)
  async refreshToken(): Promise<string> {
    return refreshAccessToken();
  },
};

// ============== Document API ==============

export interface DocumentUpdatePayload {
  title?: string;
  data?: DocumentData;
  document_type?: string;
  is_default?: boolean;
  linked_resume_id?: string | null;
  [key: string]: unknown;
}

export const documentApi = {
  async uploadProfileImage(documentId: string, file: File): Promise<ImageUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await authenticatedFetch(`${API_BASE}/documents/${documentId}/upload-image`, {
      method: 'POST',
      body: formData,
    });
    return handleResponse<ImageUploadResponse>(response);
  },

  async removeProfileImage(documentId: string): Promise<true> {
    const response = await authenticatedFetch(`${API_BASE}/documents/${documentId}/profile-image`, {
      method: 'DELETE',
    });
    if (!response.ok && response.status !== 204) {
      const error: ApiError = await response.json().catch(() => ({ detail: 'Remove failed' }));
      throw new Error((typeof error.detail === 'string' ? error.detail : null) || 'Remove failed');
    }
    return true;
  },

  async list(): Promise<Document[]> {
    const response = await authenticatedFetch(`${API_BASE}/documents/`);
    return handleResponse<Document[]>(response);
  },

  async get(id: string): Promise<Document> {
    const response = await authenticatedFetch(`${API_BASE}/documents/${id}`);
    return handleResponse<Document>(response);
  },

  async create(title: string, data: DocumentData): Promise<Document> {
    // Derive document_type from the data blob (client uses 'cover-letter', server uses 'cover_letter')
    const document_type = data?.documentType === 'cover-letter' ? 'cover_letter' : 'resume';
    const response = await authenticatedFetch(`${API_BASE}/documents/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, data, document_type }),
    });
    return handleResponse<Document>(response);
  },

  async update(id: string, updates: DocumentUpdatePayload): Promise<Document> {
    const payload: DocumentUpdatePayload = { ...updates };
    if (updates.data?.documentType) {
      payload.document_type = updates.data.documentType === 'cover-letter' ? 'cover_letter' : 'resume';
    }
    const response = await authenticatedFetch(`${API_BASE}/documents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return handleResponse<Document>(response);
  },

  async delete(id: string): Promise<true> {
    const response = await authenticatedFetch(`${API_BASE}/documents/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({ detail: 'Delete failed' }));
      throw new Error((typeof error.detail === 'string' ? error.detail : null) || 'Delete failed');
    }
    return true;
  },

  async getDefault(): Promise<Document> {
    const response = await authenticatedFetch(`${API_BASE}/documents/default/current`);
    return handleResponse<Document>(response);
  },

  async setDefault(id: string): Promise<Document> {
    return this.update(id, { is_default: true });
  },

  async duplicate(id: string): Promise<Document> {
    const response = await authenticatedFetch(`${API_BASE}/documents/${id}/duplicate`, {
      method: 'POST',
    });
    return handleResponse<Document>(response);
  },

  async exportDocument(id: string): Promise<unknown> {
    const response = await authenticatedFetch(`${API_BASE}/documents/${id}/export`);
    return handleResponse(response);
  },

  async importDocument(title: string, data: DocumentData, documentType: string = 'resume'): Promise<Document> {
    const response = await authenticatedFetch(`${API_BASE}/documents/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, data, document_type: documentType }),
    });
    return handleResponse<Document>(response);
  },

  // ============== Version History ==============

  async createVersion(documentId: string, versionName: string): Promise<DocumentVersion> {
    const response = await authenticatedFetch(`${API_BASE}/documents/${documentId}/versions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ version_name: versionName }),
    });
    return handleResponse<DocumentVersion>(response);
  },

  async listVersions(documentId: string): Promise<DocumentVersion[]> {
    const response = await authenticatedFetch(`${API_BASE}/documents/${documentId}/versions`);
    return handleResponse<DocumentVersion[]>(response);
  },

  async getVersion(documentId: string, versionId: string): Promise<DocumentVersion> {
    const response = await authenticatedFetch(`${API_BASE}/documents/${documentId}/versions/${versionId}`);
    return handleResponse<DocumentVersion>(response);
  },

  async restoreVersion(documentId: string, versionId: string): Promise<Document> {
    const response = await authenticatedFetch(`${API_BASE}/documents/${documentId}/versions/${versionId}/restore`, {
      method: 'POST',
    });
    return handleResponse<Document>(response);
  },

  async deleteVersion(documentId: string, versionId: string): Promise<void> {
    const response = await authenticatedFetch(`${API_BASE}/documents/${documentId}/versions/${versionId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const err: ApiError = await response.json().catch(() => ({}));
      throw new Error((typeof err.detail === 'string' ? err.detail : null) || 'Failed to delete version');
    }
  },

  // ============== Share Links ==============

  async createShareLink(documentId: string): Promise<unknown> {
    const response = await authenticatedFetch(`${API_BASE}/documents/${documentId}/share`, {
      method: 'POST',
    });
    return handleResponse(response);
  },

  async revokeShareLink(documentId: string): Promise<void> {
    const response = await authenticatedFetch(`${API_BASE}/documents/${documentId}/share`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const err: ApiError = await response.json().catch(() => ({}));
      throw new Error((typeof err.detail === 'string' ? err.detail : null) || 'Failed to revoke share link');
    }
  },

  // ============== Document Linking ==============

  async linkToResume(coverLetterId: string, resumeId: string): Promise<Document> {
    return this.update(coverLetterId, { linked_resume_id: resumeId });
  },

  async unlinkFromResume(coverLetterId: string): Promise<Document> {
    return this.update(coverLetterId, { linked_resume_id: null });
  },
};

// ============== Public (No Auth) ==============

const publicApi = {
  async getSharedDocument(shareToken: string): Promise<Document> {
    const response = await fetch(`${API_BASE}/shared/${encodeURIComponent(shareToken)}`);
    return handleResponse<Document>(response);
  },
};

export { getToken, setToken, removeToken, getAccessToken, getRefreshToken, setTokens, removeTokens, publicApi };
