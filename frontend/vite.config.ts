import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8000",
    },
  },
  build: {
    outDir: "../src/skillscope/static",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const modulePath = id.replaceAll("\\", "/");
          if (modulePath.includes("/node_modules/recharts/") || modulePath.includes("/node_modules/d3-")) {
            return "charts";
          }
          if (modulePath.includes("/node_modules/react")) return "react-vendor";
        },
      },
    },
  },
});
