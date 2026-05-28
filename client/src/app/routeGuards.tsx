import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const LoadingScreen = () => (
  <div className="loading-screen" role="status" aria-live="polite">
    <div className="loading-spinner" aria-hidden="true" />
    <span className="loading-text">Loading...</span>
  </div>
);

export const ProtectedRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingScreen />;

  if (!isAuthenticated) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  return children;
};

export const EditorRoute = ({ children }: { children: ReactNode }) => {
  const { isAuthenticated, isGuest, loading } = useAuth();

  if (loading) return <LoadingScreen />;

  if (!isAuthenticated && !isGuest) {
    return <Navigate to="/" replace />;
  }

  return children;
};
