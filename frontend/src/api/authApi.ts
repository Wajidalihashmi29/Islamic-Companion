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

export const registerUser = (data: RegisterPayload) =>
  axiosClient.post("/auth/register", data);

export const loginUser = (data: LoginPayload) =>
  axiosClient.post<{ token: string }>("/auth/login", data);