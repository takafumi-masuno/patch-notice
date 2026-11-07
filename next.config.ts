import type { NextConfig } from "next";
import { BASE_PATH } from "./src/lib/site";

const nextConfig: NextConfig = {
  // GitHub Pages で配信するため静的 HTML として書き出す
  output: "export",
  // プロジェクトサイトは /patch-notice/ 配下で配信される
  basePath: BASE_PATH,
  // /about → out/about/index.html として出力し、GitHub Pages でそのまま配信できるようにする
  trailingSlash: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
