import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { User, Document as AppDocument, AuthResult } from '../types';
import { authApi, documentApi } from '../services/api';
import { useAppState } from './AppStateContext';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (email: string, username: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  logoutAllDevices: () => Promise<AuthResult>;
  startGuestMode: () => void;
  exitGuestMode: () => void;
  clearError: () => void;
  documentList: AppDocument[];
  currentDocumentId: number | 'template' | null;
  saveDocument: (title: string, data: Record<string, unknown>, extraFields?: Record<string, unknown>) => Promise<AppDocument | null>;
  loadDocument: (id: number | string) => Promise<AppDocument | null>;
  createNewDocument: () => void;
  deleteDocument: (id: number | string) => Promise<boolean>;
  refreshDocumentList: () => Promise<void>;
  renameDocument: (id: number | string, newTitle: string) => Promise<AppDocument | null>;
  setCurrentDocumentId: React.Dispatch<React.SetStateAction<number | 'template' | null>>;
  updatePreferences: (preferences: Record<string, unknown>) => Promise<User | null>;
  deleteAccount: () => Promise<AuthResult>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documentList, setDocumentList] = useState<AppDocument[]>([]);
  const [currentDocumentId, setCurrentDocumentId] = useState<number | 'template' | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  
  const { resetToInitial } = useAppState();

  useEffect(() => {
    let cancelled = false;

    const checkAuth = async () => {
      try {
        const guestFlag = window.sessionStorage.getItem('isGuest');
        if (guestFlag === 'true') setIsGuest(true);
      } catch (err) {
      }

      // If we have an access token, try to use it directly
      if (authApi.isAuthenticated()) {
        try {
          const userData = await authApi.getCurrentUser();
          if (cancelled) return;
          setUser(userData);
          try {
            const docs = await documentApi.list();
            if (!cancelled) setDocumentList(docs);
          } catch (_listErr) {
            // document list failure is non-fatal; user stays logged in
          }
          setLoading(false);
          return;
        } catch (err) {
          // Access token exists but /me failed — try refreshing below
        }
      }

      // No valid access token, or it was rejected — try silent refresh
      try {
        await authApi.refreshToken();
      } catch (_err) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const userData = await authApi.getCurrentUser();
        if (cancelled) return;
        setUser(userData);
        try {
          const docs = await documentApi.list();
          if (!cancelled) setDocumentList(docs);
        } catch (_listErr) {
          // non-fatal
        }
      } catch (err) {
        // Refresh succeeded but /me still fails — clear tokens
        await authApi.logout();
        if (!cancelled) setUser(null);
      }
      if (!cancelled) setLoading(false);
    };
    checkAuth();

    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    setError(null);
    try {
      await authApi.login(email, password);
      const userData = await authApi.getCurrentUser();
      setUser(userData);
      const docs = await documentApi.list();
      setDocumentList(docs);
      return { success: true };
    } catch (err) {
      setError((err as Error).message);
      return { success: false, error: (err as Error).message };
    }
  }, []);

  const register = useCallback(async (email: string, username: string, password: string): Promise<AuthResult> => {
    setError(null);
    try {
      await authApi.register(email, username, password);
      return login(email, password);
    } catch (err) {
      setError((err as Error).message);
      return { success: false, error: (err as Error).message };
    }
  }, [login]);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
    setDocumentList([]);
    setCurrentDocumentId(null);
    setError(null);
    setIsGuest(false);
    window.sessionStorage.removeItem('isGuest');
    // Clear document data to prevent data leakage
    resetToInitial();
    window.sessionStorage.removeItem('isTemplate');
    window.sessionStorage.removeItem('selectedTemplateId');
  }, [resetToInitial]);
  
  const logoutAllDevices = useCallback(async () => {
    try {
      await authApi.logoutAllDevices();
      setUser(null);
      setDocumentList([]);
      setCurrentDocumentId(null);
      setError(null);
      setIsGuest(false);
      window.sessionStorage.removeItem('isGuest');
      // Clear document data to prevent data leakage
      resetToInitial();
      window.sessionStorage.removeItem('isTemplate');
      window.sessionStorage.removeItem('selectedTemplateId');
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  }, [resetToInitial]);

  const startGuestMode = useCallback(() => {
    setIsGuest(true);
    setUser(null);
    setDocumentList([]);
    setCurrentDocumentId(null);
    // Clear document data to prevent data leakage
    resetToInitial();
    window.sessionStorage.removeItem('isTemplate');
    window.sessionStorage.removeItem('selectedTemplateId');
    try {
      window.sessionStorage.setItem('isGuest', 'true');
    } catch (err) {
    }
  }, [resetToInitial]);

  const exitGuestMode = useCallback(() => {
    setIsGuest(false);
    try { window.sessionStorage.removeItem('isGuest'); } catch (err) {}
  }, []);

  const refreshDocumentList = useCallback(async () => {
    if (!user) return;
    try {
      const docs = await documentApi.list();
      setDocumentList(docs);
    } catch (err) {
      console.error('Failed to refresh document list:', err);
    }
  }, [user]);

  const saveDocument = useCallback(async (title: string, data: Record<string, unknown>, extraFields?: Record<string, unknown>): Promise<AppDocument | null> => {
    if (!user) return null;
    const payload = { title, data, ...extraFields };
    if (currentDocumentId && currentDocumentId !== 'template') {
      const updated = await documentApi.update(String(currentDocumentId), payload);
      await refreshDocumentList();
      return updated;
    } else {
      const created = await documentApi.create(title, data);
      setCurrentDocumentId(created.id);
      window.sessionStorage.removeItem('isTemplate');
      window.sessionStorage.removeItem('selectedTemplateId');
      await refreshDocumentList();
      return created;
    }
  }, [user, currentDocumentId, refreshDocumentList]);

  const loadDocument = useCallback(async (id: number | string): Promise<AppDocument | null> => {
    if (!user) return null;
    try {
      const doc = await documentApi.get(String(id));
      setCurrentDocumentId(doc.id);
      return doc;
    } catch (err) {
      setError((err as Error).message);
      return null;
    }
  }, [user]);

  const createNewDocument = useCallback(() => {
    setCurrentDocumentId(null);
    window.sessionStorage.removeItem('isTemplate');
    window.sessionStorage.removeItem('selectedTemplateId');
  }, []);

  const deleteDocument = useCallback(async (id: number | string): Promise<boolean> => {
    if (!user) return false;
    try {
      await documentApi.delete(String(id));
      if (currentDocumentId === id) {
        setCurrentDocumentId(null);
      }
      await refreshDocumentList();
      return true;
    } catch (err) {
      setError((err as Error).message);
      return false;
    }
  }, [user, currentDocumentId, refreshDocumentList]);

  const renameDocument = useCallback(async (id: number | string, newTitle: string): Promise<AppDocument | null> => {
    if (!user) return null;
    try {
      const updated = await documentApi.update(String(id), { title: newTitle });
      setDocumentList(prev => prev.map(doc => (doc.id === id ? { ...doc, title: newTitle } : doc)));
      return updated;
    } catch (err) {
      setError((err as Error).message);
      console.error('Failed to rename document:', err);
      return null;
    }
  }, [user]);

  const updatePreferences = useCallback(async (preferences: Record<string, unknown>): Promise<User | null> => {
    if (!user) return null;
    try {
      const updatedUser = await authApi.updatePreferences(preferences);
      setUser(updatedUser);
      return updatedUser;
    } catch (err) {
      console.error('Failed to update preferences:', err);
      return null;
    }
  }, [user]);

  const deleteAccount = useCallback(async (): Promise<AuthResult> => {
    try {
      await authApi.deleteAccount();
      setUser(null);
      setDocumentList([]);
      setCurrentDocumentId(null);
      setError(null);
      setIsGuest(false);
      window.sessionStorage.clear();
      resetToInitial();
      return { success: true };
    } catch (err) {
      setError((err as Error).message);
      return { success: false, error: (err as Error).message };
    }
  }, [resetToInitial]);

  const value: AuthContextValue = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    isGuest,
    login,
    register,
    logout,
    logoutAllDevices,
    startGuestMode,
    exitGuestMode,
    clearError: () => setError(null),
    // Document management
    documentList,
    currentDocumentId,
    saveDocument,
    loadDocument,
    createNewDocument,
    deleteDocument,
    refreshDocumentList,
    renameDocument,
    setCurrentDocumentId,
    // Preferences
    updatePreferences,
    deleteAccount,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
