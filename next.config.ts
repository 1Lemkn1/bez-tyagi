import type { NextConfig } from "next";

/**
 * Приложение статическое (все данные в localStorage), поэтому собирается
 * в статику и раздаётся с GitHub Pages.
 *
 * basePath нужен, потому что сайт живёт в подпапке: /bez-tyagi/.
 * При локальной разработке переменная не задана и приложение работает от корня.
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath || undefined,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
