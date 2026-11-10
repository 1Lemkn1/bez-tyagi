"use client";

import { useEffect } from "react";

/**
 * Регистрирует сервис-воркер (он делает приложение устанавливаемым и офлайн).
 *
 * Раньше регистрация жила в inline-скрипте со `strategy="afterInteractive"`
 * и ждала события `load` — в статической сборке этот скрипт иногда успевал
 * выполниться уже после `load`, и установка не предлагалась вовсе.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;

    const swPath = process.env.NEXT_PUBLIC_BASE_PATH
      ? `${process.env.NEXT_PUBLIC_BASE_PATH}/sw.js`
      : "/sw.js";
    const scope = process.env.NEXT_PUBLIC_BASE_PATH
      ? `${process.env.NEXT_PUBLIC_BASE_PATH}/`
      : "/";

    const register = () => {
      navigator.serviceWorker
        .register(swPath, { scope, updateViaCache: "none" })
        .then((registration) => registration.update().catch(() => undefined))
        .catch(() => {
          // Офлайн — бонус: сбой регистрации не должен ломать приложение.
        });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
