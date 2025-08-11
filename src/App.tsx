import { Link, NavLink, Outlet } from "react-router-dom";
import { useEffect } from "react";
import AccountMenu from "@/components/AccountMenu";

function TopLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `px-3 py-2 rounded-xl transition ${
          isActive ? "bg-white/10 text-white" : "text-white/80 hover:text-white hover:bg-white/5"
        }`
      }
      end
    >
      {children}
    </NavLink>
  );
}

export default function App() {
  useEffect(() => {
    document.body.classList.add("bg-app");
    return () => document.body.classList.remove("bg-app");
  }, []);

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

      {/* Page content */}
      <main className="mx-auto max-w-6xl w-full px-4 py-6 flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="mx-auto max-w-6xl w-full px-4 py-6 text-sm text-white/50">
        Aiyes - Build, watch, and verify steps with AI{" "}
        {/* Show build tag if provided (optional) */}
        {" | build: "}{import.meta.env?.VITE_BUILD_TAG ?? "dev"}
      </footer>
    </div>
  );
}
