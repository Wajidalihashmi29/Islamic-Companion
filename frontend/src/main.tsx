import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { AuthProvider } from "./context/AuthContext.tsx";
import "./index.css";
import "./styles/theme.css";

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(error => {
      console.warn("Offline support could not be enabled.", error);
    });
  });
} else if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.getRegistrations().then(async registrations => {
      const offlineRegistrations = registrations.filter(registration =>
        registration.active?.scriptURL.endsWith("/sw.js") ||
        registration.waiting?.scriptURL.endsWith("/sw.js") ||
        registration.installing?.scriptURL.endsWith("/sw.js"));
      if (!offlineRegistrations.length) return;
      const wasControlled = navigator.serviceWorker.controller?.scriptURL.endsWith("/sw.js") ?? false;
      await Promise.all(offlineRegistrations.map(registration => registration.unregister()));
      if (wasControlled) window.location.reload();
    }).catch(error => {
      console.warn("Development service worker cleanup failed.", error);
    });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);