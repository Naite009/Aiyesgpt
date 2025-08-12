import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Prefer an explicit VITE_BUILD_TAG if you set one,
// else fall back to common CI commit SHA envs.
const BUILD_TAG =
  process.env.VITE_BUILD_TAG ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.GITHUB_SHA ||
  process.env.COMMIT_REF || // Netlify
  process.env.CF_PAGES_COMMIT_SHA || // Cloudflare Pages
  "";

// Slice to short hash if it looks like a long SHA.
const SHORT_BUILD_TAG =
  BUILD_TAG && BUILD_TAG.length >= 7 ? BUILD_TAG.slice(0, 7) : BUILD_TAG;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
    },
  },
  // Expose the build tag as a compile-time constant
  define: {
    __BUILD_TAG__: JSON.stringify(SHORT_BUILD_TAG),
  },
  server: { port: 5173 },
});