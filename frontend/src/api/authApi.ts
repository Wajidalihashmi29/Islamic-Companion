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

export const registerUser = (data: RegisterPayload) =>
  axiosClient.post("/auth/register", data);

export const loginUser = (data: LoginPayload) =>
  axiosClient.post<AuthResponse>("/auth/login", data);

export const refreshTokenRequest = (refreshToken: string) =>
  axiosClient.post<AuthResponse>("/auth/refresh", { refreshToken });