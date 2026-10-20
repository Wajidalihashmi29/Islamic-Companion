import { jwtDecode } from "jwt-decode";

export function getTokenExpiryMs(token: string): number | null {
  try {
    const decoded = jwtDecode<{ exp: number }>(token);
    return typeof decoded.exp === "number" && Number.isFinite(decoded.exp) ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function getRotatedSessionToken(
  previousRefreshToken: string,
  currentRefreshToken: string | null,
  currentToken: string | null,
  now = Date.now(),
): string | null {
  if (!currentRefreshToken || currentRefreshToken === previousRefreshToken || !currentToken) return null;
  const expiry = getTokenExpiryMs(currentToken);
  return expiry !== null && expiry > now ? currentToken : null;
}