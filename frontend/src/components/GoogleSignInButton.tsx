import { useEffect, useRef, useState } from "react";

const GSI_SRC = "https://accounts.google.com/gsi/client";
let gsiLoader: Promise<void> | null = null;

/** Loads the Google Identity Services script once per page. */
function loadGsi(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gsiLoader) return gsiLoader;

  gsiLoader = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GSI_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gsiLoader = null;
      reject(new Error("Failed to load Google Identity Services"));
    };
    document.head.appendChild(script);
  });
  return gsiLoader;
}

interface GoogleSignInButtonProps {
  onCredential: (idToken: string) => void;
  /** Label variant shown on Google's button. */
  text?: "signin_with" | "signup_with" | "continue_with";
  disabled?: boolean;
}

export const isGoogleSignInConfigured = Boolean(import.meta.env.VITE_GOOGLE_CLIENT_ID);

/**
 * Renders Google's official "Sign in with Google" button (required by Google's
 * branding guidelines) and returns the ID token through `onCredential`.
 * The token is verified server-side at POST /api/auth/google.
 */
export default function GoogleSignInButton({
  onCredential,
  text = "continue_with",
  disabled = false,
}: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  // Keep the latest callback without re-initialising Google on every render.
  useEffect(() => {
    callbackRef.current = onCredential;
  }, [onCredential]);

  useEffect(() => {
    if (!clientId) return;
    let cancelled = false;

    loadGsi()
      .then(() => {
        const el = containerRef.current;
        if (cancelled || !el || !window.google) return;

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (response.credential) callbackRef.current(response.credential);
          },
          ux_mode: "popup",
          itp_support: true,
        });

        el.innerHTML = "";
        // Google allows 200–400px; match our container so it lines up with the form.
        const width = Math.max(200, Math.min(400, Math.floor(el.getBoundingClientRect().width)));
        window.google.accounts.id.renderButton(el, {
          type: "standard",
          theme: "outline",
          size: "large",
          shape: "pill",
          text,
          logo_alignment: "center",
          width,
        });
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [clientId, text]);

  if (!clientId) return null;

  return (
    <div className={`google-signin ${disabled ? "is-disabled" : ""}`} aria-busy={status === "loading"}>
      {status === "loading" && <div className="google-signin-skeleton" aria-hidden="true" />}
      {status === "error" && (
        <p className="google-signin-error">Google sign-in is unavailable right now.</p>
      )}
      <div ref={containerRef} className="google-signin-slot" />
    </div>
  );
}
