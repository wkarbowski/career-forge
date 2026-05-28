import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "../i18n";
import { authApi } from "../services/api";

export default function PasswordResetPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!token) {
      setError(t("auth.resetTokenMissing"));
      return;
    }
    if (password !== confirmPassword) {
      setError(t("auth.passwordsNoMatch"));
      return;
    }
    if (password.length < 8) {
      setError(t("account.passwordTooShort"));
      return;
    }

    setIsSubmitting(true);
    try {
      await authApi.resetPassword(token, password);
      setSuccess(t("auth.passwordResetSuccess"));
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError((err as Error).message || t("auth.passwordResetFailed"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-modal auth-page-card" role="region" aria-labelledby="password-reset-title">
        <h2 id="password-reset-title">{t("auth.resetPassword")}</h2>
        {error && <div className="auth-error">{error}</div>}
        {success && <div className="auth-success">{success}</div>}
        {!success ? (
          <form onSubmit={handleSubmit}>
            <div className="auth-field">
              <label htmlFor="new-password">{t("account.newPassword")}</label>
              <input
                type="password"
                id="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className="auth-field">
              <label htmlFor="confirm-new-password">{t("account.confirmPassword")}</label>
              <input
                type="password"
                id="confirm-new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <button type="submit" className="auth-submit" disabled={isSubmitting}>
              {isSubmitting ? t("auth.pleaseWait") : t("auth.resetPassword")}
            </button>
          </form>
        ) : (
          <button type="button" className="auth-submit" onClick={() => navigate("/")}>
            {t("auth.backToLogin")}
          </button>
        )}
      </div>
    </div>
  );
}
