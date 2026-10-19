import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { couponSandboxDevelopment } from './scripts/coupon-sandbox-vite';

// https://vitejs.dev/config/
export default defineConfig(() => {
  const sandbox = process.env.VITE_SUPABASE_URL === 'http://127.0.0.1:55321'
    ? couponSandboxDevelopment() : null;
  return {
    define: sandbox ? { 'import.meta.env.VITE_SUPABASE_URL': 'window.location.origin' } : {},
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
      ...(sandbox ? { proxy: sandbox.proxy } : {}),
    },
    plugins: [react(), ...(sandbox ? [sandbox.plugin] : [])],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom"],
    },
    optimizeDeps: {
      include: ["react", "react-dom"],
    },
  };
});
