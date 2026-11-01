import type { Metadata, Viewport } from "next";
import { preload } from "react-dom";
import { ServiceWorkerRegister } from "@/components/ServiceWorker";
import "./globals.css";

export const metadata: Metadata = {
  title: "8020jacked",
  description: "Short home workouts and simple food, planned for you.",
  applicationName: "8020jacked",
  appleWebApp: {
    capable: true,
    title: "8020jacked",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  other: {
    // Next emits the newer mobile-web-app-capable; older iOS still reads this one.
    "apple-mobile-web-app-capable": "yes",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#111111" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  preload("/fonts/PlusJakartaSans-Variable.ttf", { as: "font", type: "font/ttf", crossOrigin: "anonymous" });
  return (
    <html lang="en">
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
