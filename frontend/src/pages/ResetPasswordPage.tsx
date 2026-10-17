import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Check,
  CircleAlert,
  CircleCheck,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  RefreshCw,
  X,
} from "lucide-react";
import { forgotPassword, parseApiError, resetPassword } from "../api/authApi";
import AuthLayout from "../components/AuthLayout";
import "./AuthPage.css";

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const emailParam = searchParams.get("email") || "";
  const userId = searchParams.get("userId");
  const token = searchParams.get("token");

  const [email, setEmail] = useState(emailParam);
  const [showEmailInput, setShowEmailInput] = useState(!emailParam && !userId);
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [notice, setNotice] = useState(
    emailParam ? `We sent a 6-digit verification code to ${emailParam}.` : ""
  );
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  // Handle countdown for resend cooldown
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const hasLength = password.length >= 8;
  const hasDigit = /\d/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const newPwRulesMet = hasLength && hasDigit && hasUpper;

  const hasConfirmValue = confirmPassword.length > 0;
  const passwordsMatch = Boolean(password && hasConfirmValue && password === confirmPassword);

  const isLinkMode = Boolean(userId && token);
  const isOtpMode = !isLinkMode;
  const isOtpValid = otp.trim().length === 6;
  const hasEmail = Boolean(email.trim());

  const isValid =
    newPwRulesMet &&
    passwordsMatch &&
    (isLinkMode || (isOtpValid && hasEmail));

  const handleResendCode = async () => {
    if (!email.trim() || resending || resendCooldown > 0) return;
    setError("");
    setNotice("");
    setResending(true);
    try {
      const res = await forgotPassword(email.trim());
      setNotice(res.data?.message || `A new 6-digit code has been sent to ${email.trim()}.`);
      setResendCooldown(30);
    } catch (err) {
      setError(parseApiError(err, "Unable to resend code. Please try again.").message);
    } finally {
      setResending(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isOtpMode && (!email.trim() || !isOtpValid)) {
      setError("Please enter your registered email address and 6-digit verification code.");
      return;
    }

    if (!isValid) {
      if (!passwordsMatch) setError("Passwords do not match.");
      else setError("Password does not meet the security requirements.");
      return;
    }

    setError("");
    setNotice("");
    setLoading(true);

    try {
      await resetPassword({
        email: isOtpMode ? email.trim() : undefined,
        otp: isOtpMode ? otp.trim() : undefined,
        userId: userId || undefined,
        token: token || undefined,
        newPassword: password,
      });
      setSuccess(true);
    } catch (err) {
      setError(
        parseApiError(err, "Invalid or expired verification code. Please request a new code.").message
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="auth-flip-container">
        <div className="auth-flip-card">
          <div className="auth-card-face auth-card-front" style={{ transform: "none" }}>
            {success ? (
              <div className="auth-check-email-body">
                <div className="auth-status-icon auth-status-icon--gold">
                  <CircleCheck size={36} />
                </div>
                <h2 className="auth-title">Password Reset Complete</h2>
                <p className="auth-subtitle">
                  Your password has been successfully updated. You can now sign in with your new password.
                </p>
                <div className="auth-stack" style={{ marginTop: 24 }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-block"
                    onClick={() => navigate("/login")}
                  >
                    Sign In to Islamic Companion <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <header className="auth-header">
                  <div className="auth-header-pill">
                    <KeyRound size={13} />
                    <span>Choose New Password</span>
                  </div>
                  <h2 className="auth-title">Reset Your Password</h2>
                  <p className="auth-subtitle">
                    {emailParam
                      ? `Enter the 6-digit code sent to ${emailParam} and your new password.`
                      : "Enter your 6-digit code and choose a new secure password."}
                  </p>
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

                <form className="auth-form" onSubmit={handleSubmit}>
                  {/* Email row when in OTP mode */}
                  {isOtpMode && (
                    <>
                      {showEmailInput ? (
                        <label className="field">
                          <div className="field-header-row">
                            <span className="field-label">Email Address</span>
                            {emailParam && (
                              <button
                                type="button"
                                className="auth-link-forgot"
                                onClick={() => setShowEmailInput(false)}
                              >
                                Hide
                              </button>
                            )}
                          </div>
                          <span className="field-control">
                            <span className="field-icon" aria-hidden="true"><Mail /></span>
                            <input
                              type="email"
                              value={email}
                              onChange={(e) => {
                                setEmail(e.target.value);
                                if (error) setError("");
                              }}
                              placeholder="name@example.com"
                              autoComplete="email"
                              required
                              disabled={loading}
                            />
                          </span>
                        </label>
                      ) : (
                        <div className="auth-email-banner">
                          <div className="auth-email-banner-info">
                            <Mail size={14} />
                            <span>Code sent to <strong>{email}</strong></span>
                          </div>
                          <button
                            type="button"
                            className="btn-edit-email"
                            onClick={() => setShowEmailInput(true)}
                          >
                            Change
                          </button>
                        </div>
                      )}

                      {/* 6-Digit OTP field */}
                      <label className="field">
                        <div className="field-header-row">
                          <span className="field-label">6-Digit Verification Code</span>
                          {isOtpValid && (
                            <span className="field-badge is-match">
                              <Check size={11} /> 6 Digits
                            </span>
                          )}
                        </div>
                        <span className={`field-control ${isOtpValid ? "is-valid" : ""}`}>
                          <span className="field-icon" aria-hidden="true"><KeyRound /></span>
                          <input
                            type="text"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            pattern="[0-9]*"
                            maxLength={6}
                            value={otp}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                              setOtp(val);
                              if (error) setError("");
                            }}
                            placeholder="123456"
                            className="otp-field-input"
                            required
                            disabled={loading}
                          />
                          {isOtpValid && (
                            <span className="field-status-icon is-match" title="Code complete">
                              <Check size={14} />
                            </span>
                          )}
                        </span>
                      </label>
                    </>
                  )}

                  {/* New Password */}
                  <label className="field">
                    <div className="field-header-row">
                      <span className="field-label">New Password</span>
                      {password.length > 0 && newPwRulesMet && (
                        <span className="field-badge is-match">
                          <Check size={11} /> Valid
                        </span>
                      )}
                    </div>
                    <span className={`field-control ${password.length > 0 && newPwRulesMet ? "is-valid" : ""}`}>
                      <span className="field-icon" aria-hidden="true"><Lock /></span>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          if (error) setError("");
                        }}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        required
                        disabled={loading}
                      />
                      {password.length > 0 && newPwRulesMet && (
                        <span className="field-status-icon is-match" title="Requirements met">
                          <Check size={14} />
                        </span>
                      )}
                      <button
                        type="button"
                        className="field-trailing"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </span>
                  </label>

                  {/* Confirm New Password */}
                  <label className="field">
                    <div className="field-header-row">
                      <span className="field-label">Confirm New Password</span>
                      {hasConfirmValue && (
                        <span className={`field-badge ${passwordsMatch ? "is-match" : "is-mismatch"}`}>
                          {passwordsMatch ? <Check size={11} /> : <X size={11} />}
                          {passwordsMatch ? "Matches" : "Mismatch"}
                        </span>
                      )}
                    </div>
                    <span className={`field-control ${hasConfirmValue ? (passwordsMatch ? "is-valid" : "is-invalid") : ""}`}>
                      <span className="field-icon" aria-hidden="true"><Lock /></span>
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          if (error) setError("");
                        }}
                        placeholder="••••••••"
                        autoComplete="new-password"
                        required
                        disabled={loading}
                      />
                      {hasConfirmValue && (
                        <span
                          className={`field-status-icon ${passwordsMatch ? "is-match" : "is-mismatch"}`}
                          title={passwordsMatch ? "Passwords match" : "Passwords do not match"}
                        >
                          {passwordsMatch ? <Check size={14} /> : <X size={14} />}
                        </span>
                      )}
                      <button
                        type="button"
                        className="field-trailing"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </span>
                    {hasConfirmValue && (
                      <div className={`realtime-feedback ${passwordsMatch ? "is-match" : "is-mismatch"}`}>
                        {passwordsMatch ? (
                          <>
                            <Check size={12} />
                            <span>Passwords match</span>
                          </>
                        ) : (
                          <>
                            <X size={12} />
                            <span>Passwords do not match yet</span>
                          </>
                        )}
                      </div>
                    )}
                  </label>

                  {/* Password rules indicator */}
                  <div className="auth-rules">
                    <span className={`rule ${hasLength ? "met" : ""}`}>
                      <Check size={12} /> At least 8 characters
                    </span>
                    <span className={`rule ${hasDigit ? "met" : ""}`}>
                      <Check size={12} /> At least 1 number
                    </span>
                    <span className={`rule ${hasUpper ? "met" : ""}`}>
                      <Check size={12} /> At least 1 uppercase letter
                    </span>
                    {hasConfirmValue && (
                      <span className={`rule ${passwordsMatch ? "met" : "unmet-mismatch"}`}>
                        {passwordsMatch ? <Check size={12} /> : <X size={12} />}
                        {passwordsMatch ? "Passwords match" : "Passwords do not match"}
                      </span>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary btn-block auth-submit-btn"
                    disabled={loading || !isValid}
                  >
                    {loading ? <span className="spinner" /> : null}
                    {loading ? "Updating password…" : "Reset Password"}
                    {!loading && <ArrowRight size={16} />}
                  </button>

                  <div className="auth-reset-footer">
                    {isOtpMode && (
                      <button
                        type="button"
                        className="btn-resend-otp"
                        onClick={handleResendCode}
                        disabled={resending || resendCooldown > 0 || !email.trim()}
                      >
                        <RefreshCw size={13} className={resending ? "spin" : ""} />
                        <span>
                          {resendCooldown > 0
                            ? `Resend code in ${resendCooldown}s`
                            : "Didn't get code? Resend"}
                        </span>
                      </button>
                    )}
                    <Link to="/login" className="auth-back-link">
                      Back to Sign In
                    </Link>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </AuthLayout>
  );
}
