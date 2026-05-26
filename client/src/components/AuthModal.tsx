import React, { useState, useEffect, useRef, type ReactNode } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTranslation } from "../i18n";
import { authApi } from "../services/api";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  extraProviders?: ReactNode;
}

const AuthModal = ({
  isOpen,
  onClose,
  onSuccess,
  extraProviders = null,
}: AuthModalProps) => {
  const [mode, setMode] = useState<"login" | "register" | "forgot" | "reset">(
    "login",
  );
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [gdprConsent, setGdprConsent] = useState(false);
  const [localError, setLocalError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);

  const { login, register, error, clearError } = useAuth();
  const { t } = useTranslation();

  // Focus trap + Escape key handling
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !modalRef.current) return;
      const focusable = modalRef.current.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    // Focus first input on open
    const timer = setTimeout(() => {
      const firstInput = modalRef.current?.querySelector(
        "input",
      ) as HTMLElement | null;
      if (firstInput) firstInput.focus();
    }, 50);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      clearTimeout(timer);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError("");
    setSuccessMessage("");
    clearError();

    if (mode === "forgot") {
      setIsSubmitting(true);
      try {
        const result = (await authApi.forgotPassword(email)) as {
          reset_token?: string;
          message?: string;
        };
        if (result.reset_token) {
          setResetToken(result.reset_token);
          setMode("reset");
          setSuccessMessage(t("auth.resetTokenGenerated"));
        } else {
          setSuccessMessage(result.message || t("auth.resetEmailSent"));
        }
      } catch (err) {
        setLocalError((err as Error).message || t("auth.resetRequestFailed"));
      }
      setIsSubmitting(false);
      return;
    }

    if (mode === "reset") {
      if (password !== confirmPassword) {
        setLocalError(t("auth.passwordsNoMatch"));
        return;
      }
      if (password.length < 8) {
        setLocalError(t("auth.passwordTooShort"));
        return;
      }
      setIsSubmitting(true);
      try {
        await authApi.resetPassword(resetToken, password);
        setSuccessMessage(t("auth.passwordResetSuccess"));
        setTimeout(() => {
          setMode("login");
          setSuccessMessage("");
          resetForm();
        }, 2000);
      } catch (err) {
        setLocalError((err as Error).message || t("auth.resetFailed"));
      }
      setIsSubmitting(false);
      return;
    }

    if (mode === "register") {
      if (password !== confirmPassword) {
        setLocalError(t("auth.passwordsNoMatch"));
        return;
      }
      if (password.length < 6) {
        setLocalError(t("auth.passwordTooShort"));
        return;
      }
      if (username.length < 3) {
        setLocalError(t("auth.usernameTooShort"));
        return;
      }
      if (!gdprConsent) {
        setLocalError(t("auth.consentRequired"));
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const result =
        mode === "login"
          ? await login(email, password)
          : await register(email, username, password);

      setIsSubmitting(false);

      if (result?.success) {
        resetForm();
        if (onSuccess) {
          onSuccess();
        } else {
          onClose();
        }
      }
    } catch (err) {
      setIsSubmitting(false);
      setLocalError((err as Error).message || t("auth.unknownError"));
    }
  };

  const resetForm = () => {
    setEmail("");
    setUsername("");
    setPassword("");
    setConfirmPassword("");
    setGdprConsent(false);
    setLocalError("");
    setSuccessMessage("");
    setResetToken("");
    clearError();
  };

  const switchMode = () => {
    setMode(mode === "login" ? "register" : "login");
    resetForm();
  };

  const switchToForgot = () => {
    setMode("forgot");
    resetForm();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const displayError = localError || error;

  const modeTitle: Record<string, string> = {
    login: t("auth.login"),
    register: t("auth.register"),
    forgot: t("auth.forgotPassword"),
    reset: t("auth.resetPassword"),
  };

  return (
    <div
      className="auth-modal-overlay"
      onClick={handleClose}
      role="presentation"
    >
      <div
        className="auth-modal"
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
      >
        <button
          className="auth-modal-close"
          onClick={handleClose}
          aria-label={t("common.cancel") || "Close"}
        >
          ×
        </button>

        <h2 id="auth-modal-title">{modeTitle[mode]}</h2>

        {displayError && <div className="auth-error">{displayError}</div>}

        {successMessage && <div className="auth-success">{successMessage}</div>}

        <form onSubmit={handleSubmit}>
          {(mode === "login" || mode === "register" || mode === "forgot") && (
            <div className="auth-field">
              <label htmlFor="email">{t("auth.email")}</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          )}

          {mode === "register" && (
            <div className="auth-field">
              <label htmlFor="username">{t("auth.username")}</label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                minLength={3}
                autoComplete="username"
              />
            </div>
          )}

          {(mode === "login" || mode === "register" || mode === "reset") && (
            <div className="auth-field">
              <label htmlFor="password">
                {mode === "reset" ? t("auth.newPassword") : t("auth.password")}
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === "reset" ? 8 : 6}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
              />
            </div>
          )}

          {(mode === "register" || mode === "reset") && (
            <div className="auth-field">
              <label htmlFor="confirmPassword">
                {t("auth.confirmPassword")}
              </label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
          )}

          {mode === "reset" && (
            <div className="auth-field">
              <label htmlFor="resetToken">{t("auth.resetToken")}</label>
              <input
                type="text"
                id="resetToken"
                value={resetToken}
                onChange={(e) => setResetToken(e.target.value)}
                required
                placeholder={t("auth.resetTokenPlaceholder")}
              />
            </div>
          )}

          {mode === "register" && (
            <div className="auth-field auth-consent">
              <label className="auth-consent-label">
                <input
                  type="checkbox"
                  checked={gdprConsent}
                  onChange={(e) => setGdprConsent(e.target.checked)}
                />
                <span>
                  {t("auth.consentText")}{" "}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer">
                    {t("auth.privacyPolicy")}
                  </a>
                  {t("auth.consentTextEnd")}
                </span>
              </label>
            </div>
          )}

          <button type="submit" className="auth-submit" disabled={isSubmitting}>
            {isSubmitting ? t("auth.pleaseWait") : modeTitle[mode]}
          </button>
        </form>

        {mode === "login" && (
          <div className="auth-forgot">
            <button type="button" onClick={switchToForgot}>
              {t("auth.forgotPasswordLink")}
            </button>
          </div>
        )}

        {(mode === "forgot" || mode === "reset") && (
          <div className="auth-forgot">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                resetForm();
              }}
            >
              {t("auth.backToLogin")}
            </button>
          </div>
        )}

        {extraProviders && (
          <div className="auth-extra-providers">
            <div className="auth-divider">
              <span>or</span>
            </div>
            {extraProviders}
          </div>
        )}

        <div className="auth-switch">
          {mode === "login" && (
            <p>
              {t("auth.noAccount")}{" "}
              <button type="button" onClick={switchMode}>
                {t("auth.signUp")}
              </button>
            </p>
          )}
          {mode === "register" && (
            <p>
              {t("auth.hasAccount")}{" "}
              <button type="button" onClick={switchMode}>
                {t("auth.login")}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthModal;
