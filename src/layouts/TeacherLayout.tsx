import { NavLink, Outlet } from "react-router-dom";

function SubLink({ to, children }: { to: string; children: React.ReactNode }) {
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

export default function TeacherLayout() {
  return (
    <div className="grid gap-4">
      <div className="card p-3">
        <nav className="flex flex-wrap items-center gap-1">
          <SubLink to="/teacher/create">Create</SubLink>
          <SubLink to="/teacher/studio">Studio</SubLink>
          <SubLink to="/teacher/lessons">Lessons</SubLink>
        </nav>
      </div>
      <Outlet />
    </div>
  );
}
