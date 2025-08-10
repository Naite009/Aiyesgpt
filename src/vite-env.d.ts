/// <reference types="vite/client" />

// (optional) make your env keys strongly-typed:
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_GEMINI_API_KEY: string;
  readonly VITE_VERIFY_STEP_FUNCTION_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
