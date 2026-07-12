import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { CheckCircle2, XCircle } from "lucide-react";
import { loginUser, registerUser } from "../api/authApi";
import { useAuth } from "../context/AuthContext";
import "./AuthPage.css";

type Tab = "login" | "register";

export default function AuthPage() {
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  // Password validation
  const passwordRequirements = {
    minLength: password.length >= 8,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  };

  const isPasswordValid = Object.values(passwordRequirements).every(req => req);

  const switchTab = (next: Tab) => {
    setTab(next);
    setError("");
    setNotice("");
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await loginUser({ email, password });
      // Decode token to extract user name
      const decoded = jwtDecode<{ name?: string; fullName?: string; sub?: string; email?: string }>(response.data.token);
      // Use first name, full name, or email (first part before @) as fallback
      let userName = response.data.fullName || decoded.name || decoded.fullName;
      if (!userName && email) {
        userName = email.split("@")[0].charAt(0).toUpperCase() + email.split("@")[0].slice(1);
      }
      userName = userName || "User";
      login(response.data.token, response.data.refreshToken, userName);
      navigate("/dashboard");
    } catch {
      setError("That email or password doesn't match our records.");
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
      setNotice("Account created. Sign in to continue.");
      setTab("login");
      setPassword("");
    } catch (err: unknown) {
      // Extract error details from API response
      if (err && typeof err === "object" && "response" in err) {
        const response = (err as any).response;
        if (response?.data && Array.isArray(response.data)) {
          const errorDetails = response.data
            .map((e: any) => e.description || e.code)
            .join("; ");
          
          if(errorDetails.includes("is already taken")) {
            setError("Specified Email is already registered. Try logging in or use a different email.");
            return;
          }
          setError(errorDetails || "We couldn't create that account.");
        } else if (response?.data?.message) {
          setError(response.data.message);
        } else {
          setError("We couldn't create that account. Try a different emailxyz.");
        }
      } else {
        setError("We couldn't create that account. Try a different emailabc.");
      }
    } finally {
      setLoading(false);
    }
  };

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
              
              {tab === "register" && password && (
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
              
              <button type="submit" className="auth-submit" disabled={loading || (tab === "register" && !isPasswordValid)}>
                {loading ? "Creating account…" : "Create account"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}