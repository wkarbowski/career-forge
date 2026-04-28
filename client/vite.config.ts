import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Proxy /api to the FastAPI backend in development (replaces CRA "proxy" field)
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Keep 'build' output dir to match existing Dockerfile + nginx setup
    outDir: 'build',
    emptyOutDir: true,
  },
});
