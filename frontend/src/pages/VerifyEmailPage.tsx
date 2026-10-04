import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CircleAlert, CircleCheck } from "lucide-react";
import { confirmEmail, parseApiError } from "../api/authApi";
import AuthLayout from "../components/AuthLayout";
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
      ? "Verifying your email address..."
      : "This verification link is incomplete or missing parameters."
  );

  useEffect(() => {
    if (!userId || !token) return;

    let cancelled = false;

    confirmEmail({ userId, token })
      .then((response) => {
        if (cancelled) return;
        setStatus("success");
        setMessage(response.data?.message || "Email verified successfully! You can now sign in.");
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus("error");
        setMessage(
          parseApiError(err, "This verification link is invalid or has expired.").message
        );
      });

    return () => {
      cancelled = true;
    };
  }, [userId, token]);

  return (
    <AuthLayout>
      <div className="auth-flip-container">
        <div className="auth-flip-card">
        <div className="auth-card-face auth-card--center">
        {status === "pending" && (
          <>
            <span className="auth-status-icon auth-status-icon--teal">
              <span className="spinner" style={{ width: 28, height: 28 }} />
            </span>
            <h2 className="auth-title">Verifying email</h2>
            <p className="auth-subtitle">{message}</p>
          </>
        )}

        {status === "success" && (
          <>
            <span className="auth-status-icon auth-status-icon--gold">
              <CircleCheck size={36} aria-hidden="true" />
            </span>
            <h2 className="auth-title">Email Verified</h2>
            <p className="auth-subtitle">{message}</p>
            <div className="auth-stack">
              <Link to="/" className="btn btn-gold btn-block">
                Sign in to your account
              </Link>
            </div>
          </>
        )}

        {status === "error" && (
          <>
            <span className="auth-status-icon auth-status-icon--error">
              <CircleAlert size={36} aria-hidden="true" />
            </span>
            <h2 className="auth-title">Verification Failed</h2>
            <p className="auth-subtitle">{message}</p>
            <div className="auth-stack">
              <Link to="/" className="btn btn-primary btn-block">
                Return to sign in
              </Link>
            </div>
          </>
        )}
        </div>
        </div>
      </div>
    </AuthLayout>
  );
}
