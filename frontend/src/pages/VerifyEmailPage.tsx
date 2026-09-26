import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { confirmEmail } from "../api/authApi";
import "./AuthPage.css";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const userId = searchParams.get("userId");
  const token = searchParams.get("token");
  const linkValid = Boolean(userId && token);
  const [status, setStatus] = useState<"pending" | "success" | "error">(
    linkValid ? "pending" : "error"
  );
  const [message, setMessage] = useState(
    linkValid
      ? "Verifying your email…"
      : "This verification link is missing required details."
  );

  useEffect(() => {
    if (!userId || !token) return;

    let cancelled = false;

    confirmEmail({ userId, token })
      .then((response) => {
        if (cancelled) return;
        setStatus("success");
        setMessage(response.data?.message || "Email verified. You can now sign in.");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const data = err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data
          : undefined;
        setStatus("error");
        setMessage(data?.message || "This verification link is invalid or has expired.");
      });

    return () => {
      cancelled = true;
    };
  }, [userId, token]);

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <div className="auth-brand-pattern" aria-hidden="true" />
        <div className="auth-brand-content">
          <h1>Islamic Companion</h1>
          <p>Confirm your email to finish setting up your account.</p>
        </div>
      </div>
      <div className="auth-panel">
        <div className="auth-card">
          <h2 className="auth-heading">Email verification</h2>
          <p className={status === "error" ? "auth-error" : "auth-notice"}>{message}</p>
          {status !== "pending" && (
            <Link to="/" className="auth-submit auth-link-button">
              Return to sign in
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
