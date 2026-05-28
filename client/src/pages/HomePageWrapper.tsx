import { useState } from "react";
import { useNavigate } from "react-router-dom";
import HomePage from "../components/HomePage";
import AuthModal from "../components/AuthModal";
import { useAuth } from "../contexts/AuthContext";

export default function HomePageWrapper() {
  const navigate = useNavigate();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { isAuthenticated, isGuest, startGuestMode } = useAuth();

  const handleGuestStart = () => {
    startGuestMode();
    navigate("/templates");
  };

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    navigate("/dashboard");
  };

  if (isAuthenticated || isGuest) {
    return (
      <HomePage
        onLogin={() => setShowAuthModal(true)}
        onGuestStart={() => navigate("/templates")}
        onBrowseTemplates={() => navigate("/templates")}
        isLoggedIn={isAuthenticated}
        isGuest={isGuest}
      />
    );
  }

  return (
    <>
      <HomePage
        onLogin={() => setShowAuthModal(true)}
        onGuestStart={handleGuestStart}
        onBrowseTemplates={() => navigate("/templates")}
        isLoggedIn={false}
        isGuest={false}
      />
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />
    </>
  );
}
