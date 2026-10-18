import axios from "axios";
import { refreshSessionToken } from "./session";
import { getTokenExpiryMs } from "../utils/tokenUtils";

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach JWT token to every request if it exists
axiosClient.interceptors.request.use(async (config) => {
  let token = localStorage.getItem("token");
  if (!config.url?.startsWith("/auth/") && !config.url?.startsWith("/quran/") && localStorage.getItem("refreshToken") &&
    (!token || (getTokenExpiryMs(token) ?? 0) <= Date.now() + 60_000)) {
    token = await refreshSessionToken();
  }
  if (token && config.headers && !config.url?.startsWith("/quran/")) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosClient.interceptors.response.use(response => response, async error => {
  if (!axios.isAxiosError(error) || error.response?.status !== 401 || !error.config ||
    error.config.url?.startsWith("/auth/") || !localStorage.getItem("refreshToken") ||
    error.config.headers["X-Session-Retry"]) throw error;
  const config = error.config;
  const authorization = config.headers.Authorization;
  const rejectedToken = typeof authorization === "string" ? authorization.replace(/^Bearer /, "") : undefined;
  const token = await refreshSessionToken(rejectedToken);
  if (!token) throw error;
  config.headers["X-Session-Retry"] = "1";
  config.headers.Authorization = `Bearer ${token}`;
  return axiosClient.request(config);
});

export default axiosClient;