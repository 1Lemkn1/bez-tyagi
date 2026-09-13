import type { Metadata, Viewport } from "next";
import Script from "next/script";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Без Тяги — трекер тяги к сигаретам",
  description:
    "Локальный трекер эпизодов никотиновой тяги и триггеров. Работает офлайн, данные хранятся только в телефоне.",
  manifest: "/manifest.json",
  applicationName: "Без Тяги",
  appleWebApp: {
    capable: true,
    title: "Без Тяги",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icons/icon-512.png",
    apple: "/icons/icon-512.png",
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
        <Script
          id="sw-register"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker
      .register("/sw.js")
      .catch(function (err) {
        console.error("SW registration failed", err);
      });
  });
}`,
          }}
        />
      </body>
    </html>
  );
}
