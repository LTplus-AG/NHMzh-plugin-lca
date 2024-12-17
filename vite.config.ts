import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/api/kbob": {
          target: "https://www.lcadata.ch",
          changeOrigin: true,
          secure: false,
          rewrite: (path) =>
            path.replace(/^\/api\/kbob/, "/api/kbob/materials"),
          headers: {
            "x-api-key": env.IFC_API_KEY,
          },
        },
      },
    },
    resolve: {
      extensions: [".js", ".jsx", ".ts", ".tsx"],
    },
  };
});
