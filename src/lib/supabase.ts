// src/lib/supabase.ts
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function assertEnv(name: string, val: string | undefined) {
  if (!val || typeof val !== "string" || !val.trim()) {
    // Throw a clear error for dev/build, and also paint something obvious in DOM for prod.
    const msg = `[supabase] Missing ${name}. Set it in Vercel → Project → Settings → Environment Variables.`;
    if (typeof document !== "undefined") {
      const el = document.getElementById("build") || document.body.appendChild(document.createElement("div"));
      el.id = "build";
      el.style.cssText = "position:fixed;left:8px;bottom:8px;background:#fee;color:#900;padding:8px 10px;border-radius:8px;font:12px/1.2 system-ui;z-index:99999";
      el.textContent = msg;
    }
    throw new Error(msg);
  }
}

assertEnv("VITE_SUPABASE_URL", SUPABASE_URL);
assertEnv("VITE_SUPABASE_ANON_KEY", SUPABASE_ANON_KEY);

// You can tweak options (headers, schema, etc) here if needed
export const supabase: SupabaseClient = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
