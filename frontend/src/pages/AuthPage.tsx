import { useCallback, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { CheckCircle2, XCircle } from "lucide-react";
import { googleSignIn, loginUser, registerUser, resendConfirmation, type AuthResponse } from "../api/authApi";
import GoogleSignInButton from "../components/GoogleSignInButton";
import { useAuth } from "../context/AuthContext";
import "./AuthPage.css";

type Tab = "login" | "register";

function axiosMessage(err: unknown, fallback: string): { message: string; code?: string } {
  if (err && typeof err === "object" && "response" in err) {
    const response = (err as { response?: { data?: unknown } }).response;
    const data = response?.data as { message?: string; code?: string; description?: string }[] | { message?: string; code?: string } | undefined;
    if (Array.isArray(data)) {
      const errorDetails = data.map((e) => e.description || e.code).join("; ");
      if (errorDetails.includes("is already taken")) {
        return { message: "Specified Email is already registered. Try logging in or use a different email." };
      }
      return { message: errorDetails || fallback };
    }
    if (data && typeof data === "object") {
      return { message: data.message || fallback, code: data.code };
    }
  }
  return { message: fallback };
}

export default function AuthPage() {
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState("");

  const { login } = useAuth();
  const navigate = useNavigate();

  const passwordRequirements = {
    minLength: password.length >= 8,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  };

  const isPasswordValid = Object.values(passwordRequirements).every((req) => req);

  const switchTab = (next: Tab) => {
    setTab(next);
    setError("");
    setNotice("");
    setUnverifiedEmail("");
  };

  const completeLogin = useCallback((response: AuthResponse, fallbackEmail?: string) => {
    const decoded = jwtDecode<{ name?: string; fullName?: string; email?: string }>(response.token);
    let userName = response.fullName || decoded.name || decoded.fullName;
    const sourceEmail = fallbackEmail || decoded.email;
    if (!userName && sourceEmail) {
      userName = sourceEmail.split("@")[0].charAt(0).toUpperCase() + sourceEmail.split("@")[0].slice(1);
    }
    login(response.token, response.refreshToken, userName || "User");
    navigate("/dashboard");
  }, [login, navigate]);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setUnverifiedEmail("");
    setLoading(true);
    try {
      const response = await loginUser({ email, password });
      completeLogin(response.data, email);
    } catch (err: unknown) {
      const parsed = axiosMessage(err, "That email or password doesn't match our records.");
      if (parsed.code === "email_not_confirmed") {
        setUnverifiedEmail(email);
        setError(parsed.message);
      } else {
        setError(parsed.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await registerUser({ email, password, fullName });
      setNotice("Account created. Check your email to verify your address, then sign in.");
      setTab("login");
      setPassword("");
      setUnverifiedEmail(email);
    } catch (err: unknown) {
      setError(axiosMessage(err, "We couldn't create that account. Try a different email.").message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!unverifiedEmail) return;
    setLoading(true);
    setError("");
    try {
      await resendConfirmation(unverifiedEmail);
      setNotice("If an unverified account exists for that email, a new confirmation link has been sent.");
    } catch {
      setError("We couldn't resend the confirmation email right now.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = useCallback(async (idToken: string) => {
    setError("");
    setNotice("");
    setLoading(true);
    try {
      const response = await googleSignIn(idToken);
      completeLogin(response.data);
    } catch (err: unknown) {
      setError(axiosMessage(err, "Google sign-in could not be completed.").message);
    } finally {
      setLoading(false);
    }
  }, [completeLogin]);

  return (
    <div className="auth-page">
      <div className="auth-brand">
        <div className="auth-brand-pattern" aria-hidden="true" />
        <div className="auth-brand-content">
          <div className="auth-emblem">
            <svg viewBox="0 0 100 100" width="56" height="56">
              <path
                fill="currentColor"
                d="M50 2 61 30 90 30 66 48 76 78 50 60 24 78 34 48 10 30 39 30Z"
                opacity="0"
              />
              <g fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M50 8 L50 92 M8 50 L92 50 M17 17 L83 83 M83 17 L17 83" opacity="0.5" />
                <rect x="30" y="30" width="40" height="40" transform="rotate(45 50 50)" />
                <rect x="30" y="30" width="40" height="40" />
              </g>
            </svg>
          </div>
          <h1>Islamic Companion</h1>
          <p>Prayer times, Qur'an, and daily reflection — held in one place.</p>
        </div>
      </div>

      <div className="auth-panel">
        <div className="auth-card">
          <div className="auth-tabs" role="tablist">
            <span
              className="auth-tabs-indicator"
              style={{ transform: tab === "login" ? "translateX(0%)" : "translateX(100%)" }}
            />
            <button
              type="button"
              role="tab"
              aria-selected={tab === "login"}
              className={`auth-tab ${tab === "login" ? "active" : ""}`}
              onClick={() => switchTab("login")}
            >
              Log in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "register"}
              className={`auth-tab ${tab === "register" ? "active" : ""}`}
              onClick={() => switchTab("register")}
            >
              Register
            </button>
          </div>

          {notice && <p className="auth-notice">{notice}</p>}
          {error && <p className="auth-error">{error}</p>}
          {unverifiedEmail && (
            <button type="button" className="auth-resend" onClick={handleResend} disabled={loading}>
              Resend verification email
            </button>
          )}

          {tab === "login" ? (
            <form className="auth-form" onSubmit={handleLogin}>
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                />
              </label>
              <button type="submit" className="auth-submit" disabled={loading}>
                {loading ? "Signing in…" : "Log in"}
              </button>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleRegister}>
              <label>
                Full name
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                  required
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </label>
              <label>
                Password
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create a strong password"
                  required
                />
              </label>

              {password && (
                <div className="password-requirements">
                  <div className={`requirement ${passwordRequirements.minLength ? "met" : ""}`}>
                    {passwordRequirements.minLength ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                    <span>At least 8 characters</span>
                  </div>
                  <div className={`requirement ${passwordRequirements.hasUpperCase ? "met" : ""}`}>
                    {passwordRequirements.hasUpperCase ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                    <span>One uppercase letter</span>
                  </div>
                  <div className={`requirement ${passwordRequirements.hasLowerCase ? "met" : ""}`}>
                    {passwordRequirements.hasLowerCase ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                    <span>One lowercase letter</span>
                  </div>
                  <div className={`requirement ${passwordRequirements.hasNumber ? "met" : ""}`}>
                    {passwordRequirements.hasNumber ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                    <span>One number</span>
                  </div>
                </div>
              )}

              <button type="submit" className="auth-submit" disabled={loading || !isPasswordValid}>
                {loading ? "Creating account…" : "Create account"}
              </button>
            </form>
          )}

          <div className="auth-divider">
            <span>or</span>
          </div>
          <GoogleSignInButton onCredential={handleGoogle} disabled={loading} />
        </div>
      </div>
    </div>
  );
}
