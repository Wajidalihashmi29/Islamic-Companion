import axios from "axios";

interface FriendlyErrorOptions {
  offlineMessage?: string;
  online?: boolean;
}

export function getFriendlyErrorMessage(error: unknown, fallback: string, options: FriendlyErrorOptions = {}) {
  const online = options.online ?? (typeof navigator === "undefined" || navigator.onLine);
  if (!online) {
    return `You're offline. ${options.offlineMessage ?? "Reconnect to the internet and try again."}`;
  }

  if (axios.isAxiosError(error)) {
    if (!error.response || error.code === "ERR_NETWORK")
      return "We couldn't connect to the service. Check your internet connection and try again.";
    if (error.code === "ECONNABORTED" || error.response.status === 408)
      return "The request took too long. Please try again.";
    if (error.response.status === 429)
      return "Too many attempts. Please wait a minute and try again.";
    if (error.response.status >= 500)
      return "The service is temporarily unavailable. Please try again shortly.";
  }

  if (error instanceof DOMException && error.name === "AbortError")
    return "The request took too long. Please try again.";
  if (error instanceof TypeError && /fetch|network|load failed/i.test(error.message))
    return "We couldn't connect to the service. Check your internet connection and try again.";

  return fallback;
}
