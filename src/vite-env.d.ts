/// <reference types="vite/client" />

interface ImportMetaEnv {
  MODE: string;
  VITE_API_URL?: string;
  VITE_LCA_BACKEND_URL?: string;
  // Add other env variables here
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
