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

export interface ConfirmEmailPayload {
  userId: string;
  token: string;
}

export const registerUser = (data: RegisterPayload) =>
  axiosClient.post("/auth/register", data);

export const loginUser = (data: LoginPayload) =>
  axiosClient.post<AuthResponse>("/auth/login", data);

export const refreshTokenRequest = (refreshToken: string) =>
  axiosClient.post<AuthResponse>("/auth/refresh", { refreshToken });

export const confirmEmail = (data: ConfirmEmailPayload) =>
  axiosClient.post("/auth/confirm-email", data);

export const resendConfirmation = (email: string) =>
  axiosClient.post("/auth/resend-confirmation", { email });

export const googleSignIn = (idToken: string) =>
  axiosClient.post<AuthResponse>("/auth/google", { idToken });
