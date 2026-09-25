import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

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
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      // The installed app switches to a new version as soon as it is published, so an
      // old copy never asks the server for screen files that no longer exist.
      registerType: "autoUpdate",
      injectRegister: false,
      includeAssets: ["favicon.ico", "favicon.png", "icons/apple-touch-icon.png"],
      manifest: {
        id: "/",
        name: "MavingTech High School",
        short_name: "MavingTech",
        description: "MavingTech High School portal for students, parents, teachers and staff.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "any",
        background_color: "#ffffff",
        theme_color: "#6508c5",
        lang: "en",
        categories: ["education"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          { name: "Portal login", short_name: "Login", url: "/login", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
          { name: "Pay fees online", short_name: "Pay fees", url: "/pay-online", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
        ],
      },
      workbox: {
        // Download only the app shell up front (mobile data is expensive); every other
        // screen and image is saved the first time it is opened.
        // (Icons and favicons are added through includeAssets and the manifest.)
        globPatterns: ["index.html", "assets/app-*.js", "assets/*.css", "assets/{react,supabase,query,motion}-*.js"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/~/, /\/[^/?]+\.[^/]+$/],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // Built files have content hashes in their names, so they never change.
            urlPattern: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith("/assets/"),
            handler: "CacheFirst",
            options: {
              cacheName: "app-files",
              expiration: { maxEntries: 250, maxAgeSeconds: 60 * 60 * 24 * 60 },
              cacheableResponse: { statuses: [200] },
              // The host answers a missing file with the home page; never keep that as a script.
              plugins: [{ cacheWillUpdate: async ({ response }) => (response.headers.get("content-type")?.includes("text/html") ? null : response) }],
            },
          },
          {
            urlPattern: ({ sameOrigin, request }) => sameOrigin && request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "images",
              expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [200] },
              plugins: [{ cacheWillUpdate: async ({ response }) => (response.headers.get("content-type")?.includes("text/html") ? null : response) }],
            },
          },
          {
            // Public website pictures (news, gallery). Private files and all school data
            // always come from the network and are never stored on the device.
            urlPattern: ({ url }) => url.hostname.endsWith(".supabase.co") && url.pathname.startsWith("/storage/v1/object/public/"),
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "public-media",
              expiration: { maxEntries: 150, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "font-styles" },
          },
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: {
              cacheName: "fonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ].filter(Boolean),
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
        // A distinct name for the app's entry file, so the service worker can pre-download it.
        entryFileNames: "assets/app-[hash].js",
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
