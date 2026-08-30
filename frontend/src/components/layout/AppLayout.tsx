import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

const navItems = [
  { path: "/dashboard", label: "Dashboard" },
  { path: "/studies", label: "Studies" },
  { path: "/studies/upload", label: "Upload Study" },
  { path: "/benchmark", label: "Benchmarking" },
  { path: "/settings", label: "Settings" },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(true);

  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <aside className={"flex flex-col border-r border-slate-200 bg-white transition-all duration-200 " + (open ? "w-56" : "w-14")}>
        <div className="flex items-center gap-2 px-3 py-4 border-b border-slate-200">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 text-white text-sm font-bold shrink-0">H</div>
          {open && <div className="flex-1 min-w-0"><div className="font-bold text-slate-900 text-sm">HQML</div><div className="text-xs text-slate-400">Quantum Knee AI</div></div>}
          <button onClick={() => setOpen(!open)} className="p-1 rounded text-slate-400 hover:text-slate-600 text-sm">{open ? "x" : ">"}</button>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map(item => {
            const active = location.pathname === item.path || location.pathname.startsWith(item.path + "/");
            return (
              <Link key={item.path} to={item.path}
                className={"flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all " + (active ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100")}>
                {open ? item.label : item.label[0]}
              </Link>
            );
          })}
        </nav>
        <div className="p-2 border-t border-slate-200">
          <div className={"flex items-center gap-2 px-2 py-2 " + (!open ? "justify-center" : "")}>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0">{(user?.email?.[0] || "U").toUpperCase()}</div>
            {open && <div className="flex-1 min-w-0"><div className="text-xs font-medium truncate">{user?.email}</div><div className="text-xs text-slate-400 capitalize">{user?.role}</div></div>}
            {open && <button onClick={handleLogout} className="text-xs text-slate-400 hover:text-slate-600 ml-1">Logout</button>}
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}