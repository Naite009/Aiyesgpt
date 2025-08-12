// Let TS know about the global injected by Vite (safe even if undefined)
declare const __BUILD_TAG__: string | undefined;

import { Link, NavLink, Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import AccountMenu from "@/components/AccountMenu";

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
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.body.classList.add("bg-app");
    return () => document.body.classList.remove("bg-app");
  }, []);

  // Ping the verify_step function once on mount
  useEffect(() => {
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
  }, []);

  const buildTag =
    (typeof __BUILD_TAG__ !== "undefined" && __BUILD_TAG__) ||
    (import.meta.env?.VITE_BUILD_TAG as string | undefined) ||
    "dev";

  return (
    <div className="min-h-dvh flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur bg-black/40 border-b border-white/10">
        <div className="mx-auto max-w-6xl w-full px-4 h-14 flex items-center gap-3">
          <Link to="/" className="font-semibold text-white mr-2">
            Aiyes
          </Link>

          {/* Desktop nav */}
          <nav className="hidden sm:flex items-center gap-1">
            <TopLink to="/student/browse">Student</TopLink>
            <TopLink to="/teacher/create">Teacher</TopLink>
            <TopLink to="/studio">Studio</TopLink>
            <TopLink to="/lessons">Lessons</TopLink>
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Account */}
          <div className="hidden sm:block">
            <AccountMenu />
          </div>

          {/* Mobile menu button */}
          <button
            className="sm:hidden inline-flex items-center justify-center rounded-lg px-3 py-2 bg-white/10 text-white"
            onClick={() => setMenuOpen((s) => !s)}
            aria-label="Menu"
          >
            ☰
          </button>
        </div>

        {/* Mobile menu panel */}
        {menuOpen && (
          <div className="sm:hidden border-t border-white/10 bg-black/70">
            <div className="mx-auto max-w-6xl w-full px-4 py-3 flex flex-col gap-2">
              <TopLink to="/student/browse">Student</TopLink>
              <TopLink to="/teacher/create">Teacher</TopLink>
              <TopLink to="/studio">Studio</TopLink>
              <TopLink to="/lessons">Lessons</TopLink>
              <div className="pt-2">
                <AccountMenu />
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main */}
      <main className="mx-auto max-w-6xl w-full px-4 py-6 flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl w-full px-4 py-6 text-sm text-white/50 flex flex-wrap items-center gap-3">
        <span>Aiyes – Build, watch, and verify steps with AI | build: {buildTag}</span>
        <span className="flex items-center gap-1">
          <span>Function:</span>
          {funcStatus === "unknown" && <span className="w-2 h-2 rounded-full bg-gray-400 inline-block" />}
          {funcStatus === "ok" && <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />}
          {funcStatus === "fail" && <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />}
        </span>
      </footer>
    </div>
  );
}
