import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

/** Parse URL fragment (#access_token=...&refresh_token=...) */
function parseHashParams(hash: string): Record<string, string> {
  const out: Record<string, string> = {};
  const q = hash.startsWith("#") ? hash.slice(1) : hash;
  for (const pair of q.split("&")) {
    if (!pair) continue;
    const [k, v] = pair.split("=");
    if (!k) continue;
    out[decodeURIComponent(k)] = decodeURIComponent(v ?? "");
  }
  return out;
}

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const next = url.searchParams.get("next") || "/student/browse";

        if (code) {
          // OAuth/PKCE (?code=...)
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) console.error("[auth] exchangeCodeForSession error:", error);
        } else if (window.location.hash.includes("access_token")) {
          // Magic link (#access_token=...&refresh_token=...)
          const params = parseHashParams(window.location.hash);
          const access_token = params["access_token"];
          const refresh_token = params["refresh_token"];
          if (access_token && refresh_token) {
            const { error } = await (supabase.auth as any).setSession({
              access_token,
              refresh_token,
            });
            if (error) console.error("[auth] setSession error:", error);
          } else {
            console.warn("[auth] hash present but missing tokens");
          }
        } else {
          // Nothing to exchange — fall through
        }

        // Clean URL (remove query + hash), then navigate to next
        const clean = window.location.origin + "/auth/callback";
        window.history.replaceState({}, "", clean);
        navigate(next, { replace: true });
      } catch (e) {
        console.error("[auth] callback error:", e);
        navigate("/student/browse", { replace: true });
      }
    })();
  }, [navigate]);

  return (
    <div className="min-h-[40vh] grid place-items-center text-white/80">
      Completing sign-in…
    </div>
  );
}
