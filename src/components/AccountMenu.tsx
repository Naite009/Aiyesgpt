import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AccountMenu() {
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setEmail(data.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => { sub.subscription.unsubscribe(); mounted = false; };
  }, []);

  async function signOut() {
    try {
      setBusy(true);
      await supabase.auth.signOut();
    } finally {
      setBusy(false);
    }
  }

  if (!email) {
    return <span className="text-white/60 text-sm">Not signed in</span>;
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-white/70 text-sm truncate max-w-[160px]" title={email}>{email}</span>
      <button className="btn btn-outline btn-xs" onClick={signOut} disabled={busy}>
        {busy ? "…" : "Sign out"}
      </button>
    </div>
  );
}
