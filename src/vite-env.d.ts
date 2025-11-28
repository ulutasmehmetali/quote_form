/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_SUGGEST_URL: string;
  readonly VITE_VERCEL_PROTECTION_BYPASS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
