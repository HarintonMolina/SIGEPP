/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_DOMINIOS_INSTITUCIONALES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
