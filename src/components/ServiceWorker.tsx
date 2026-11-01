"use client";

import { useEffect } from "react";

/** Registers /sw.js in production builds. Renders nothing. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // Offline support is a bonus; the app works without it.
      });
  }, []);
  return null;
}
