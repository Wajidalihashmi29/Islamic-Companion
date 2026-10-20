const REGION_KEY = "ic.region";

const regionCurrencies: Record<string, string> = {
  AE: "AED",
  AU: "AUD",
  BD: "BDT",
  CA: "CAD",
  DE: "EUR",
  ES: "EUR",
  FR: "EUR",
  GB: "GBP",
  IE: "EUR",
  IN: "INR",
  IT: "EUR",
  NL: "EUR",
  PK: "PKR",
  SA: "SAR",
  US: "USD",
};

const currencyLocales: Record<string, string> = {
  AED: "en-AE",
  AUD: "en-AU",
  BDT: "bn-BD",
  CAD: "en-CA",
  EUR: "en-IE",
  GBP: "en-GB",
  INR: "en-IN",
  PKR: "en-PK",
  SAR: "ar-SA",
  USD: "en-US",
};

const countryNames: Record<string, string> = {
  australia: "AU",
  bangladesh: "BD",
  canada: "CA",
  france: "FR",
  germany: "DE",
  india: "IN",
  ireland: "IE",
  italy: "IT",
  netherlands: "NL",
  pakistan: "PK",
  "saudi arabia": "SA",
  "united arab emirates": "AE",
  "united kingdom": "GB",
  uk: "GB",
  "united states": "US",
  usa: "US",
};

const timeZoneRegions: Record<string, string> = {
  "Asia/Dhaka": "BD",
  "Asia/Dubai": "AE",
  "Asia/Karachi": "PK",
  "Asia/Kolkata": "IN",
  "Asia/Riyadh": "SA",
  "Australia/Sydney": "AU",
  "America/New_York": "US",
  "America/Toronto": "CA",
  "Europe/London": "GB",
};

export function normalizeRegion(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim();
  if (/^[a-z]{2}$/i.test(normalized)) return normalized.toUpperCase();
  return countryNames[normalized.toLowerCase()] ?? null;
}

export function saveRegion(value?: string | null): void {
  const region = normalizeRegion(value);
  if (!region) return;
  try {
    localStorage.setItem(REGION_KEY, region);
    window.dispatchEvent(new CustomEvent("ic:regionUpdated", { detail: region }));
  } catch {
    // Regional formatting still falls back to the browser locale.
  }
}

export function getPreferredCurrency(): string {
  let region: string | null = null;
  try {
    region = normalizeRegion(localStorage.getItem(REGION_KEY));
  } catch {
    // Browser locale remains available when storage is blocked.
  }
  if (!region) {
    region = timeZoneRegions[Intl.DateTimeFormat().resolvedOptions().timeZone] ?? null;
  }
  if (!region) {
    try {
      region = new Intl.Locale(navigator.language).region ?? null;
    } catch {
      region = null;
    }
  }
  return regionCurrencies[region ?? ""] ?? "USD";
}

export function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat(currencyLocales[currency] ?? navigator.language, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}
