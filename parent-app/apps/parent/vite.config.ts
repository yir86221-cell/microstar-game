import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  server: {
    port: 5180,
    host: true,
  },
  resolve: {
    alias: {
      "@microstar/core-protocol": r("../../packages/core-protocol/src/index.ts"),
      "@microstar/core-domain": r("../../packages/core-domain/src/index.ts"),
    },
  },
  build: {
    target: "es2022",
    outDir: "dist",
  },
});
