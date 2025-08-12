// Let TS know about the global injected by Vite (safe even if undefined)
declare const __BUILD_TAG__: string | undefined;

import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import AccountMenu from "@/components/AccountMenu";
import { supabase } from "@/lib/supabase";

function TopLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-3 py-2 rounded-xl transition ${
          isActive
            ? "bg-white/10 text-white"
            : "text-white/80 hover:text-white hover:bg-white/5"
        }`
      }
      end
    >
      {children}
    </NavLink>
  );
}

export default function App() {
  const [funcStatus, setFuncStatus] = useState<"unknown" | "ok" | "fail">("unknown");
  const [authReady, setAuthReady] = useState(false);
  const navigate = useNavigate();

  // Page theming
  useEffect(() => {
    document.body.classList.add("bg-app");
    return () => document.body.classList.remove("bg-app");
  }, []);

  // Handle Supabase magic-link callback: exchange ?code=... for a session
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const errorDesc = url.searchParams.get("error_description");
        const next = url.searchParams.get("next");

        if (errorDesc) console.warn("[auth] error_description:", errorDesc);

        if (code) {
          // Some versions expect a string parameter, not an object
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) console.error("[auth] exchangeCodeForSession error:", error);

          // Clean URL and optionally navigate
          url.searchParams.delete("code");
          url.searchParams.delete("error");
          url.searchParams.delete("error_description");
          if (next) {
            url.searchParams.delete("next");
            if (active) navigate(next, { replace: true });
            return;
          }
          window.history.replaceState({}, "", url.toString());
        }
      } finally {
        if (active) setAuthReady(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [navigate]);

  // Ping the verify_step function once on mount (after auth is ready)
  useEffect(() => {
    if (!authReady) return;
    const url =
      import.meta.env.VITE_VERIFY_STEP_FUNCTION_URL ||
      import.meta.env.VITE_SUPABASE_EDGE_VERIFY_URL ||
      "";
    if (!url) {
      setFuncStatus("fail");
      return;
    }
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ping: true }),
    })
      .then((r) => setFuncStatus(r.ok ? "ok" : "fail"))
      .catch(() => setFuncStatus("fail"));
  }, [authReady]);

  // Prefer injected build tag; fallback to env; else "dev"
  const buildTag =
    (typeof __BUILD_TAG__ !== "undefined" && __BUILD_TAG__) ||
    (import.meta.env?.VITE_BUILD_TAG as string | undefined) ||
    "dev";

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur bg-black/40 border-b border-white/10">
        <div className="mx-auto max-w-6xl w-full px-4 h-14 flex items-center gap-3">
          <Link to="/" className="font-semibold text-white mr-2">Aiyes</Link>
          <nav className="flex items-center gap-1">
            <TopLink to="/student/browse">Student</TopLink>
            <TopLink to="/teacher/create">Teacher</TopLink>
          </nav>
          <div className="ml-auto">
            <AccountMenu />
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-6xl w-full px-4 py-6 flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl w-full px-4 py-6 text-sm text-white/50 flex flex-wrap items-center gap-3">
        <span>
          Aiyes – Build, watch, and verify steps with AI | build: {buildTag}
        </span>
        <span className="flex items-center gap-1">
          <span>Function:</span>
          {funcStatus === "unknown" && (
            <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />
          )}
          {funcStatus === "ok" && (
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
          )}
          {funcStatus === "fail" && (
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
          )}
        </span>
      </footer>
    </div>
  );
}
