/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    rolldownOptions: {
      moduleTypes: { ".js": "jsx" },
    },
  },
  build: {
    outDir: "build",
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  // Bridge REACT_APP_* env vars so existing source code doesn't need changes.
  // process.env is available here because vite.config runs in Node context.
  define: {
    "process.env.REACT_APP_API_URL": JSON.stringify(
      process.env.REACT_APP_API_URL ?? "",
    ),
    "process.env.REACT_APP_CLOUD_FEATURES": JSON.stringify(
      process.env.REACT_APP_CLOUD_FEATURES ?? "",
    ),
    "process.env.REACT_APP_GDPR": JSON.stringify(
      process.env.REACT_APP_GDPR ?? "",
    ),
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/setupTests.ts"],
  },
});
