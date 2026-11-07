import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // tsconfig.json の paths（@/*）をテストでも使えるようにする
    tsconfigPaths: true,
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
