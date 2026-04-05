import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = {
    ...loadEnv(mode, "..", ""),
    ...loadEnv(mode, ".", ""),
  };
  const frontendPort = Number(env.FRONTEND_PORT || "5173");
  const backendPort = Number(env.BACKEND_PORT || "8000");
  const resolvedFrontendPort = frontendPort > 0 ? frontendPort : 5173;
  const resolvedBackendPort = backendPort > 0 ? backendPort : 8000;

  return {
    plugins: [react()],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.indexOf("node_modules") === -1) {
              return undefined;
            }
            return "vendor";
          },
        },
      },
    },
    server: {
      host: "0.0.0.0",
      port: resolvedFrontendPort,
      proxy: {
        "/api": {
          target: env.VITE_BACKEND_PROXY_TARGET || `http://127.0.0.1:${resolvedBackendPort}`,
          changeOrigin: true,
        },
      },
    },
  };
});
