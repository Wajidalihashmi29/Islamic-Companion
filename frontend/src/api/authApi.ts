import axiosClient from "./axiosClient";
import { getFriendlyErrorMessage } from "../utils/friendlyError";

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

export const confirmEmail = (data: { userId: string; token: string }) =>
  axiosClient.post<MessageResponse>("/auth/confirm-email", data);

export const resendConfirmation = (email: string) =>
  axiosClient.post<MessageResponse>("/auth/resend-confirmation", { email });

export const googleSignIn = (idToken: string) =>
  axiosClient.post<AuthResponse>("/auth/google", { idToken });

export const forgotPassword = (email: string) =>
  axiosClient.post<MessageResponse>("/auth/forgot-password", { email });

export const resetPassword = (data: {
  email?: string;
  otp?: string;
  userId?: string;
  token?: string;
  newPassword: string;
}) => axiosClient.post<MessageResponse>("/auth/reset-password", data);

export const changePassword = (data: { currentPassword: string; newPassword: string }) =>
  axiosClient.post<MessageResponse>("/auth/change-password", data);

/** Normalises the API's error shapes (Identity error arrays, { message, code }, 429s) into one message. */
export function parseApiError(err: unknown, fallback: string): { message: string; code?: string } {
  const connectionMessage = getFriendlyErrorMessage(err, "");
  if (connectionMessage) return { message: connectionMessage };

  if (err && typeof err === "object" && "response" in err) {
    const response = (err as { response?: { status?: number; data?: unknown } }).response;

    if (response?.status === 429) {
      return { message: "Too many attempts. Please wait a minute and try again.", code: "rate_limited" };
    }

    const data = response?.data;
    if (Array.isArray(data)) {
      const codes = (data as { code?: string }[]).map(error => error.code ?? "");
      if (codes.some(code => /duplicateemail|duplicateusername/i.test(code))) {
        return { message: "That email is already registered. Try signing in instead.", code: "duplicate_email" };
      }
      if (codes.some(code => /passwordmismatch/i.test(code))) {
        return { message: "Your current password is incorrect. Please try again.", code: "password_mismatch" };
      }
      if (codes.some(code => /^password/i.test(code))) {
        return { message: "Choose a stronger password that meets all the listed requirements.", code: "weak_password" };
      }
      if (codes.some(code => /invalidtoken/i.test(code))) {
        return { message: "This link or verification code is invalid or has expired.", code: "invalid_token" };
      }
      return { message: fallback };
    }

    if (data && typeof data === "object" && "message" in data) {
      const { message, code } = data as { message?: string; code?: string };
      if (code === "email_not_confirmed") {
        return { message: "Please verify your email before signing in. Check your inbox.", code };
      }
      const safeMessage = [
        /verification link is incomplete/i,
        /verification link is invalid or has expired/i,
        /email is already verified/i,
        /verification code has expired/i,
        /invalid verification code/i,
        /please enter your email and the 6-digit verification code/i,
        /google sign-in/i,
        /google account email isn't verified/i,
        /session expired/i,
      ].some(pattern => pattern.test(message ?? "")) ? message : fallback;
      return { message: safeMessage || fallback, code };
    }
  }

  return { message: fallback };
}