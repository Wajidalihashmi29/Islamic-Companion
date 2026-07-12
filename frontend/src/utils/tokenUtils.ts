import { jwtDecode } from "jwt-decode";

export function getTokenExpiryMs(token: string): number | null {
  try {
    const decoded = jwtDecode<{ exp: number }>(token);
    return decoded.exp * 1000;
  } catch {
    return null;
  }
}