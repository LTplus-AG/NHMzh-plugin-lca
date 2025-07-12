import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import federation from "@originjs/vite-plugin-federation";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables based on the current mode.
  const env = loadEnv(mode, process.cwd(), "");

  console.log(`Running in ${mode} mode`);
  console.log(`API URL: ${env.VITE_API_URL}`);
  console.log(`QTO API URL: ${env.VITE_QTO_API_URL}`);

  return {
    plugins: [
      react(),
      federation({
        name: "lca-ui",
        filename: "remoteEntry.js",
        exposes: {
          "./App": "./src/StandaloneApp.tsx",
        },
        shared: {
          react: {},
          "react-dom": {},
          "react-router-dom": {},
        },
      }),
    ],
    define: {
      // Expose environment variables to the client
      "import.meta.env.VITE_API_URL": JSON.stringify(env.VITE_API_URL),
      "import.meta.env.VITE_QTO_API_URL": JSON.stringify(env.VITE_QTO_API_URL),
    },
    server: {
      port: parseInt(env.VITE_PORT || "5004"),
      host: env.VITE_HOST || "localhost",
      proxy: {
        "/backend": {
          target: env.VITE_API_URL || "http://localhost:8002",
          changeOrigin: true,
          secure: false,
        },
      },
    },
    resolve: {
      extensions: [".js", ".jsx", ".ts", ".tsx"],
    },
    build: {
      target: "esnext",
      minify: mode === "production",
      cssCodeSplit: false,
      rollupOptions: {
        input: {
          main: "./index.html",
        },
      },
    },
  };
});
