export async function fetchJson<T>(url: string, timeout = 12000): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Request failed with status ${response.status}.`);
    return await response.json() as T;
  } finally {
    window.clearTimeout(timer);
  }
}
