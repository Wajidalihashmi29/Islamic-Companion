import axiosClient from "./axiosClient";

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  fullName: string;
  refreshToken: string;
  expiresAt: string;
}

export interface MessageResponse {
  message: string;
}

export const registerUser = (data: RegisterPayload) =>
  axiosClient.post<MessageResponse & { requiresEmailConfirmation?: boolean }>("/auth/register", data);

export const loginUser = (data: LoginPayload) =>
  axiosClient.post<AuthResponse>("/auth/login", data);

export const refreshTokenRequest = (refreshToken: string) =>
  axiosClient.post<AuthResponse>("/auth/refresh", { refreshToken });

export const confirmEmail = (data: { userId: string; token: string }) =>
  axiosClient.post<MessageResponse>("/auth/confirm-email", data);

export const resendConfirmation = (email: string) =>
  axiosClient.post<MessageResponse>("/auth/resend-confirmation", { email });

export const googleSignIn = (idToken: string) =>
  axiosClient.post<AuthResponse>("/auth/google", { idToken });

/** Normalises the API's error shapes (Identity error arrays, { message, code }, 429s) into one message. */
export function parseApiError(err: unknown, fallback: string): { message: string; code?: string } {
  if (err && typeof err === "object" && "response" in err) {
    const response = (err as { response?: { status?: number; data?: unknown } }).response;

    if (response?.status === 429) {
      return { message: "Too many attempts. Please wait a minute and try again.", code: "rate_limited" };
    }

    const data = response?.data;
    if (Array.isArray(data)) {
      const details = (data as { code?: string; description?: string }[])
        .map((e) => e.description || e.code)
        .filter(Boolean)
        .join(" ");
      if (/already taken/i.test(details)) {
        return { message: "That email is already registered. Try signing in instead.", code: "duplicate_email" };
      }
      return { message: details || fallback };
    }

    if (data && typeof data === "object" && "message" in data) {
      const { message, code } = data as { message?: string; code?: string };
      return { message: message || fallback, code };
    }
  } else if (err && typeof err === "object" && "request" in err) {
    return { message: "We can't reach the server right now. Check your connection and try again." };
  }

  return { message: fallback };
}