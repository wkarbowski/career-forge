import { useCallback, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import GlobalHeader from "../components/GlobalHeader";
import GdprBanner from "../components/GdprBanner";
import PrivacyPolicyPage from "../components/PrivacyPolicyPage";
import AccountSettings from "../components/AccountSettings";
import { FEATURES } from "../config/features";
import { useAppState } from "../contexts/AppStateContext";
import { useAuth } from "../contexts/AuthContext";
import { usePages } from "../contexts/PageContext";
import CVEditor from "../features/editor/CVEditor";
import DashboardWrapper from "../pages/DashboardWrapper";
import HomePageWrapper from "../pages/HomePageWrapper";
import PasswordResetPage from "../pages/PasswordResetPage";
import SharedDocumentViewer from "../pages/SharedDocumentViewer";
import TemplatesGalleryWrapper from "../pages/TemplatesGalleryWrapper";
import { EditorRoute, ProtectedRoute } from "./routeGuards";

export default function AppRoutes() {
  const [saveStatus, setSaveStatus] = useState<
    "saving" | "saved" | "error" | ""
  >("");
  const { resetToInitial } = useAppState();
  const { resetPages } = usePages();
  const { setCurrentDocumentId } = useAuth();
  const navigate = useNavigate();

  const handleLoadDocument = useCallback(
    (docId: number | string | null) => {
      if (!docId) {
        resetToInitial();
        resetPages();
        setCurrentDocumentId("template");
        sessionStorage.setItem("isTemplate", "true");
        navigate("/editor");
        return;
      }
      navigate(`/editor/${docId}`);
    },
    [resetToInitial, resetPages, setCurrentDocumentId, navigate],
  );

  return (
    <>
      <a href="#main-content" className="skip-to-content">
        Skip to content
      </a>
      <GlobalHeader
        onLoadDocument={handleLoadDocument}
        saveStatus={saveStatus || null}
      />
      <main className="app-main" id="main-content">
        <Routes>
          <Route path="/" element={<HomePageWrapper />} />
          <Route path="/templates" element={<TemplatesGalleryWrapper />} />
          <Route path="/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/reset-password" element={<PasswordResetPage />} />
          <Route
            path="/shared/:shareToken"
            element={<SharedDocumentViewer />}
          />
          <Route
            path="/account"
            element={
              <ProtectedRoute>
                <AccountSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardWrapper />
              </ProtectedRoute>
            }
          />
          <Route
            path="/editor"
            element={
              <EditorRoute>
                <CVEditor onSaveStatusChange={setSaveStatus} />
              </EditorRoute>
            }
          />
          <Route
            path="/editor/:cvId"
            element={
              <ProtectedRoute>
                <CVEditor onSaveStatusChange={setSaveStatus} />
              </ProtectedRoute>
            }
          />
          {/* Redirect unknown routes */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {/* GDPR banner: opt-in via VITE_GDPR=true */}
      {FEATURES.GDPR_BANNER && <GdprBanner />}
    </>
  );
}
