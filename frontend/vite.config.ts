import { defineConfig, loadEnv } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig(({ mode }) => {
  // Load env file based on `mode`
  const env = loadEnv(mode, process.cwd(), '');

  // Only use proxy in local development when API_URL points to localhost or is empty
  const apiUrl = env.VITE_API_URL || '';
  const useLocalProxy = !apiUrl || apiUrl.includes('localhost');

  return {
  server: {
    host: "::",
    port: 8080,
    // Only proxy /api requests when using local backend
    ...(useLocalProxy && {
      proxy: {
        '/api': {
          target: 'http://localhost:8000',
          changeOrigin: true,
          secure: false,
        },
      },
    }),
  },
  plugins: [
    dyadComponentTagger(),
    react(),
    nodePolyfills({
      // Enable polyfills for Node.js modules used by simple-peer
      include: ['buffer', 'events', 'stream', 'util', 'process'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // Let Vite handle code splitting automatically to avoid initialization order issues
    chunkSizeWarningLimit: 1000,
  },
};
});
