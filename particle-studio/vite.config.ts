import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Enable specific polyfills
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
  ],
  server: { 
    port: 5173, 
    strictPort: true,
    headers: {
      // Enable SharedArrayBuffer for FFmpeg WASM while allowing Beacon SDK cross-origin requests
      // Using "credentialless" instead of "require-corp" to avoid blocking wallet connect
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "credentialless"
    }
  },
  // Optimize dependencies with WASM
  optimizeDeps: {
    exclude: ["@ffmpeg/ffmpeg", "@ffmpeg/util"]
  },
  // Build configuration for better chunking
  build: {
    target: "esnext",
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "ffmpeg-vendor": ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
          "ui-vendor": [
            "@radix-ui/react-select",
            "@radix-ui/react-slider", 
            "@radix-ui/react-switch",
            "@radix-ui/react-tabs"
          ]
        }
      }
    }
  }
});
