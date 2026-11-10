import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";
import { BASE_PATH } from "@/lib/basePath";
import "./globals.css";

export const metadata: Metadata = {
  title: "Без Тяги — трекер тяги к сигаретам",
  description:
    "Локальный трекер эпизодов никотиновой тяги и триггеров. Работает офлайн, данные хранятся только в телефоне.",
  manifest: `${BASE_PATH}/manifest.json`,
  applicationName: "Без Тяги",
  appleWebApp: {
    capable: true,
    title: "Без Тяги",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: `${BASE_PATH}/icons/icon-192.png`, sizes: "192x192", type: "image/png" },
      { url: `${BASE_PATH}/icons/icon-512.png`, sizes: "512x512", type: "image/png" },
    ],
    apple: `${BASE_PATH}/icons/apple-touch-icon.png`,
  },
};

export const viewport: Viewport = {
  themeColor: "#0ea5e9",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <body className="bg-slate-950 text-slate-50 antialiased">
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
