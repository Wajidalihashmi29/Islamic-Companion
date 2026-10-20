import axiosClient from "./axiosClient";
import type { PrayerAlertName } from "../utils/prayerAlerts";

export interface PrayerPushLocation {
  latitude: number;
  longitude: number;
  calculationMethod: number;
  school: number;
  timeZoneId?: string;
  prayerNames: PrayerAlertName[];
}

function toApplicationServerKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, character => character.charCodeAt(0));
}

export async function enableClosedAppPrayerAlerts(location: PrayerPushLocation) {
  if (!localStorage.getItem("token")) return "Sign in to enable closed-app prayer alerts.";
  if (!("serviceWorker" in navigator) || !("PushManager" in window))
    return "Closed-app alerts are not supported by this browser.";
  if (!("Notification" in window) || Notification.permission !== "granted")
    return "Allow notifications before enabling closed-app prayer alerts.";

  const registration = await navigator.serviceWorker.ready;
  const { data } = await axiosClient.get<{ publicKey: string }>("/prayer-push/public-key");
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toApplicationServerKey(data.publicKey),
    });
  }
  const serialized = subscription.toJSON();
  if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys.auth)
    throw new Error("The browser returned an incomplete push subscription.");

  await axiosClient.put("/prayer-push/subscription", {
    endpoint: serialized.endpoint,
    keys: serialized.keys,
    ...location,
    timeZoneId: location.timeZoneId || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  });
  return "Closed-app prayer alerts are enabled for this location.";
}

export async function disableClosedAppPrayerAlerts() {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  if (localStorage.getItem("token")) {
    await axiosClient.delete("/prayer-push/subscription", { data: { endpoint: subscription.endpoint } });
  }
  await subscription.unsubscribe();
}

export async function syncClosedAppPrayerAlertSelection(prayerNames: PrayerAlertName[]) {
  if (!localStorage.getItem("token") || !("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;
  await axiosClient.patch("/prayer-push/subscription/prayers", {
    endpoint: subscription.endpoint,
    prayerNames,
  });
}
