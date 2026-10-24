import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import { cloudflare } from "@cloudflare/vite-plugin";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    wasm(),
    cloudflare({ viteEnvironment: { name: "worker" } }),
  ],
  build: {
    target: "esnext",
  },
});
