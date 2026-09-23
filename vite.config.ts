import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    // `true` listens on all interfaces (IPv4 and IPv6) and works on hosts without IPv6.
    host: true,
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  preview: {
    host: true,
    port: 4173,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "react": path.resolve(__dirname, "./node_modules/react"),
      "react-dom": path.resolve(__dirname, "./node_modules/react-dom"),
    },
  },
  build: {
    // The only chunks above the default 500 kB are the Excel, barcode and PDF libraries,
    // which load on demand when a user downloads a spreadsheet or prints a label, receipt or report.
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Keep large, rarely-changing libraries in their own cacheable chunks.
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          supabase: ["@supabase/supabase-js"],
          query: ["@tanstack/react-query"],
          motion: ["framer-motion"],
        },
      },
    },
  },
}));
