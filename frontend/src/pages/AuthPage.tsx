import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import {
  ArrowRight,
  Check,
  CircleAlert,
  CircleCheck,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MailCheck,
  RefreshCw,
  User,
  Sparkles,
} from "lucide-react";
import {
  googleSignIn,
  loginUser,
  parseApiError,
  registerUser,
  resendConfirmation,
  type AuthResponse,
} from "../api/authApi";
import AuthLayout from "../components/AuthLayout";
import GoogleSignInButton, { isGoogleSignInConfigured } from "../components/GoogleSignInButton";
import { useAuth } from "../context/AuthContext";
import "./AuthPage.css";

const RESEND_COOLDOWN_SECONDS = 34;

function Field({
  label,
  icon,
  children,
  trailing,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-control">
        <span className="field-icon" aria-hidden="true">{icon}</span>
        {children}
        {trailing}
      </span>
    </label>
  );
}

function PasswordToggle({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="field-trailing"
      onClick={onToggle}
      aria-label={visible ? "Hide password" : "Show password"}
      tabIndex={-1}
    >
      {visible ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  );
}

function useCooldown() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (seconds <= 0) return;
    const t = window.setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => window.clearTimeout(t);
  }, [seconds]);
  return [seconds, () => setSeconds(RESEND_COOLDOWN_SECONDS)] as const;
}

export default function AuthPage() {
  const location = useLocation();
  const initialIsRegister = location.pathname === "/register";

  const [isFlipped, setIsFlipped] = useState(initialIsRegister);
  const [isCheckEmailView, setIsCheckEmailView] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [cooldown, startCooldown] = useCooldown();

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const frontRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLDivElement>(null);
  const prevFlipped = useRef(isFlipped);

  // The face that is turned away becomes `inert`: it can't be clicked, tabbed
  // to, or read by screen readers. After a flip, focus the visible face's first input.
  useEffect(() => {
    frontRef.current?.toggleAttribute("inert", isFlipped);
    backRef.current?.toggleAttribute("inert", !isFlipped);

    if (prevFlipped.current === isFlipped) return;
    prevFlipped.current = isFlipped;

    const t = window.setTimeout(() => {
      const active = isFlipped ? backRef.current : frontRef.current;
      active?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
    }, 420);
    return () => window.clearTimeout(t);
  }, [isFlipped]);

  useEffect(() => {
    document.documentElement.classList.add("auth-no-scroll");
    return () => document.documentElement.classList.remove("auth-no-scroll");
  }, []);

  const requirements = [
    { label: "8+ chars", met: password.length >= 8 },
    { label: "Uppercase", met: /[A-Z]/.test(password) },
    { label: "Lowercase", met: /[a-z]/.test(password) },
    { label: "Number", met: /[0-9]/.test(password) },
  ];
  const strength = requirements.filter((r) => r.met).length;
  const isPasswordValid = strength === requirements.length;
  const strengthLabel = ["Weak", "Fair", "Good", "Strong"][Math.max(0, strength - 1)] || "Weak";

  const toggleFlip = (toRegister: boolean) => {
    // Directly toggle the single boolean state to avoid multi-step flips
    setIsFlipped(toRegister);
    // clear transient UI state
    setIsCheckEmailView(false);
    setError("");
    setNotice("");
    setUnverifiedEmail("");
    setShowPassword(false);
  };

  const completeLogin = useCallback(
    (response: AuthResponse, fallbackEmail?: string) => {
      let decoded: { name?: string; unique_name?: string; email?: string } = {};
      try {
        decoded = jwtDecode(response.token);
      } catch {
        /* token valid */
      }
      let userName = response.fullName || decoded.name || decoded.unique_name;
      const sourceEmail = fallbackEmail || decoded.email;
      if (!userName && sourceEmail) {
        const local = sourceEmail.split("@")[0];
        userName = local.charAt(0).toUpperCase() + local.slice(1);
      }
      login(response.token, response.refreshToken, userName || "Friend");
      navigate("/dashboard", { replace: true });
    },
    [login, navigate]
  );

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setUnverifiedEmail("");
    setLoading(true);
    try {
      const response = await loginUser({ email, password });
      completeLogin(response.data, email);
    } catch (err) {
      const parsed = parseApiError(err, "That email or password doesn't match our records.");
      if (parsed.code === "email_not_confirmed") {
        setUnverifiedEmail(email);
        setError("Please verify your email before signing in. Check your inbox.");
      } else if (parsed.message === "Invalid credentials") {
        setError("That email or password doesn't match our records.");
      } else {
        setError(parsed.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) return;
    setError("");
    setLoading(true);
    try {
      await registerUser({ email: email.trim(), password, fullName: fullName.trim() });
      setUnverifiedEmail(email.trim());
      setPassword("");
      setIsCheckEmailView(true);
      startCooldown();
    } catch (err) {
      setError(parseApiError(err, "We couldn't create that account. Please try again.").message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!unverifiedEmail || cooldown > 0) return;
    setError("");
    setLoading(true);
    try {
      await resendConfirmation(unverifiedEmail);
      setNotice("A new confirmation link has been sent to your email.");
      startCooldown();
    } catch (err) {
      setError(parseApiError(err, "We couldn't resend the email right now. Try again shortly.").message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = useCallback(
    async (idToken: string) => {
      setError("");
      setNotice("");
      setLoading(true);
      try {
        const response = await googleSignIn(idToken);
        completeLogin(response.data);
      } catch (err) {
        setError(parseApiError(err, "Google sign-in couldn't be completed. Try again.").message);
        setLoading(false);
      }
    },
    [completeLogin]
  );

  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  return (
    <AuthLayout>
      <div className="auth-flip-container">
                <div className={`auth-flip-card ${isFlipped ? "is-flipped" : ""}`}>
          
          {/* FRONT FACE: LOGIN */}
          <div ref={frontRef} className="auth-card-face auth-card-front">

            <header className="auth-header">
              <div className="auth-header-pill">
                <Sparkles size={13} />
                <span>Welcome Back</span>
              </div>
              <h2 className="auth-title">Sign in to Companion</h2>
              <p className="auth-subtitle">Enter your details to access your dashboard.</p>
            </header>

            {notice && (
              <div className="alert alert-success" role="status">
                <CircleCheck /> <span>{notice}</span>
              </div>
            )}

            {error && (
              <div className="alert alert-error" role="alert">
                <CircleAlert />
                <div className="alert-body">
                  <span>{error}</span>
                  {unverifiedEmail && (
                    <button
                      type="button"
                      className="btn-link"
                      onClick={handleResend}
                      disabled={loading || cooldown > 0}
                    >
                      {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend verification email"}
                    </button>
                  )}
                </div>
              </div>
            )}

            <form className="auth-form" onSubmit={handleLogin}>
              <Field label="Email Address" icon={<Mail />}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                  required
                  disabled={loading}
                />
              </Field>

              <Field
                label="Password"
                icon={<Lock />}
                trailing={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
              >
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                  disabled={loading}
                />
              </Field>

              <button
                type="submit"
                className="btn btn-primary btn-block auth-submit-btn"
                disabled={loading}
              >
                {loading ? <span className="spinner" /> : null}
                {loading ? "Signing in…" : "Sign In"}
                {!loading && <ArrowRight size={16} />}
              </button>
            </form>

            {isGoogleSignInConfigured && (
              <>
                <div className="auth-divider">
                  <span>or continue with</span>
                </div>
                <div className="auth-google">
<GoogleSignInButton
                  onCredential={handleGoogle}
                  text="signin_with"
                  disabled={loading}
                />
</div>
              </>
            )}

            <div className="auth-flip-footer">
              <span>Don't have an account?</span>
              <button
                type="button"
                className="auth-flip-trigger"
                onClick={() => toggleFlip(true)}
              >
                Create Account <RefreshCw size={14} className="flip-icon" />
              </button>
            </div>
          </div>

          {/* BACK FACE: REGISTER OR CHECK EMAIL */}
          <div ref={backRef} className="auth-card-face auth-card-back">

            {isCheckEmailView ? (
              <div className="auth-check-email-body">
                <div className="auth-status-icon auth-status-icon--gold">
                  <MailCheck size={32} />
                </div>
                <h2 className="auth-title">Verify your email</h2>
                <p className="auth-subtitle">
                  We've sent a link to <strong className="auth-email-pill">{unverifiedEmail}</strong>
                </p>
                <p className="auth-help">
                  Click the link in your email to activate your account. Check your spam folder if you don't see it.
                </p>

                {notice && (
                  <div className="alert alert-success" role="status">
                    <CircleCheck /> <span>{notice}</span>
                  </div>
                )}
                {error && (
                  <div className="alert alert-error" role="alert">
                    <CircleAlert /> <span>{error}</span>
                  </div>
                )}

                <div className="auth-stack">
                  <button
                    type="button"
                    className="btn btn-gold btn-block"
                    onClick={() => toggleFlip(false)}
                  >
                    Back to Sign In <ArrowRight size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-block"
                    onClick={handleResend}
                    disabled={loading || cooldown > 0}
                  >
                    {loading ? <span className="spinner" /> : null}
                    {cooldown > 0 ? `Resend email in ${cooldown}s` : "Resend email"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <header className="auth-header">
                  <div className="auth-header-pill">
                    <Sparkles size={13} />
                    <span>Join Us Today</span>
                  </div>
                  <h2 className="auth-title">Create Account</h2>
                  <p className="auth-subtitle">Begin your journey with Islamic Companion.</p>
                </header>

                {notice && (
                  <div className="alert alert-success" role="status">
                    <CircleCheck /> <span>{notice}</span>
                  </div>
                )}

                {error && (
                  <div className="alert alert-error" role="alert">
                    <CircleAlert /> <span>{error}</span>
                  </div>
                )}

                <form className="auth-form" onSubmit={handleRegister}>
                  <Field label="Full Name" icon={<User />}>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Your full name"
                      autoComplete="name"
                      required
                      disabled={loading}
                    />
                  </Field>

                  <Field label="Email Address" icon={<Mail />}>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      autoComplete="email"
                      required
                      disabled={loading}
                    />
                  </Field>

                  <Field
                    label="Password"
                    icon={<Lock />}
                    trailing={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
                  >
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a strong password"
                      autoComplete="new-password"
                      required
                      disabled={loading}
                    />
                  </Field>

                  <div className="pw-strength" aria-live="polite">
                    <div className="pw-row">
                      <div className="pw-meter" data-strength={password ? strength : 0}>
                        {requirements.map((r) => (
                          <span key={r.label} />
                        ))}
                      </div>
                      <span className="pw-label">{password ? strengthLabel : "—"}</span>
                    </div>
                    <ul className="pw-checks">
                      {requirements.map((r) => (
                        <li key={r.label} className={r.met ? "met" : ""}>
                          <Check size={12} />
                          {r.label}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    type="submit"
                    className="btn btn-gold btn-block auth-submit-btn"
                    disabled={loading || !isPasswordValid}
                  >
                    {loading ? <span className="spinner" /> : null}
                    {loading ? "Creating Account…" : "Create Account"}
                    {!loading && <ArrowRight size={16} />}
                  </button>
                </form>

                {isGoogleSignInConfigured && (
                  <>
                    <div className="auth-divider">
                      <span>or continue with</span>
                    </div>
                    <div className="auth-google">
<GoogleSignInButton
                      onCredential={handleGoogle}
                      text="signup_with"
                      disabled={loading}
                    />
</div>
                  </>
                )}

                <div className="auth-flip-footer">
                  <span>Already have an account?</span>
                  <button
                    type="button"
                    className="auth-flip-trigger"
                    onClick={() => toggleFlip(false)}
                  >
                    Sign In <RefreshCw size={14} className="flip-icon" />
                  </button>
                </div>
              </>
            )}
          </div>

        </div>
      </div>
    </AuthLayout>
  );
}