import { Outlet, NavLink } from "react-router-dom";
import {
  BookMarked,
  Camera,
  CircleHelp,
  FlameKindling,
  Plus,
  Search,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import AuthButton from "@/components/AuthButton";

export default function App() {
  const [dark, setDark] = useState<boolean>(true);

  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-dvh bg-background text-foreground">
        <header className="sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-black/30">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
            <div className="flex items-center gap-3">
              <Sparkles className="size-6 text-brand" />
              <NavLink to="/" className="text-lg font-semibold">
                Aiyes
              </NavLink>
            </div>

            <nav className="hidden items-center gap-2 sm:flex">
              <Tab to="/browse" label="Browse" icon={<Search className="size-4" />} />
              <Tab to="/create" label="Create" icon={<Plus className="size-4" />} />
              <Tab to="/studio" label="Studio" icon={<Camera className="size-4" />} />
              <Tab to="/favorites" label="Favorites" icon={<BookMarked className="size-4" />} />
            </nav>

            <div className="flex items-center gap-2">
              <button
                className="btn btn-outline"
                onClick={() => setDark((d: boolean) => !d)}
                title="Toggle theme"
              >
                🌓
              </button>
              <AuthButton />
              <button className="btn btn-primary" title="Help">
                <CircleHelp className="mr-2 size-4" />
                Help
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6">
          <Outlet />
        </main>

        <footer className="border-t border-white/10 py-6 text-center text-sm text-white/60">
          Built with <FlameKindling className="mx-1 inline size-4 text-brand" /> Aiyes
        </footer>
      </div>
    </div>
  );
}

function Tab({
  to,
  label,
  icon,
}: {
  to: string;
  label: string;
  icon?: React.ReactNode;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `btn btn-outline ${isActive ? "border-brand/60 bg-brand/10" : ""}`
      }
    >
      {icon}
      <span className="ml-2 hidden sm:inline">{label}</span>
    </NavLink>
  );
}
