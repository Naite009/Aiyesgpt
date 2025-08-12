import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

function getSiteOrigin() {
  // Prefer explicit env in prod to avoid email clients mangling URLs
  const envUrl = import.meta.env.VITE_SITE_URL as string | undefined;
  if (envUrl) return envUrl.replace(/\/+$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export default function AccountMenu() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // email / magic link UI state
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    // initial session
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    // auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((_evt, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      listener?.subscription?.unsubscribe?.();
    };
  }, []);

  const origin = getSiteOrigin();
  const magicLinkRedirect = `${origin}/auth/callback?next=/student/browse`;

  async function sendMagicLink() {
    setMessage(null);
    setError(null);

    if (!email.trim()) {
      setError("Enter your email first.");
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: magicLinkRedirect },
      });
      if (error) {
        setError(error.message);
      } else {
        setMessage("Magic link sent! Check your email.");
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to send magic link.");
    } finally {
      setSending(false);
    }
  }

  async function signInGoogle() {
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: magicLinkRedirect },
      });
      if (error) setError(error.message);
    } catch (e: any) {
      setError(e?.message ?? "Google sign-in failed.");
    }
  }

  async function signOut() {
    setError(null);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) setError(error.message);
    } catch (e: any) {
      setError(e?.message ?? "Sign out failed.");
    }
  }

  if (loading) {
    return <div className="text-white/60 text-sm">…</div>;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="email"
          className="input input-sm w-44"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={sendMagicLink}
          disabled={sending}
          title="Send magic link to your email"
        >
          {sending ? "Sending…" : "Send Magic Link"}
        </button>
        <button className="btn btn-outline btn-sm" onClick={signInGoogle} title="Continue with Google">
          Sign in with Google
        </button>
        {(message || error) && (
          <span className={`text-xs ${error ? "text-rose-300" : "text-emerald-300"}`}>
            {error ?? message}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-white/80 text-sm truncate max-w-[14rem]" title={user.email || user.user_metadata?.full_name}>
        {user.email || user.user_metadata?.full_name || "User"}
      </span>
      <button className="btn btn-outline btn-sm" onClick={signOut}>
        Sign Out
      </button>
    </div>
  );
}
