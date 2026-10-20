import { jwtDecode } from "jwt-decode";

export function getTokenExpiryMs(token: string): number | null {
  try {
    const decoded = jwtDecode<{ exp: number }>(token);
    return typeof decoded.exp === "number" && Number.isFinite(decoded.exp) ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}