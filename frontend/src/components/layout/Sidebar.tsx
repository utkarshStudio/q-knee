import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { 
  LayoutDashboard, 
  FolderOpen, 
  UploadCloud, 
  Activity, 
  Settings, 
  LogOut,
  ChevronLeft,
  ChevronRight,
  Database
} from "lucide-react";

const navItems = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { path: "/studies/upload", label: "New Analysis", icon: UploadCloud },
  { path: "/studies", label: "Studies", icon: FolderOpen },
  { path: "/benchmark", label: "Benchmarks", icon: Activity },
  { path: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ open, setOpen }: { open: boolean, setOpen: (val: boolean) => void }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => { 
    logout(); 
    navigate("/"); 
  };

  return (
    <aside className={`flex flex-col border-r border-border-subtle bg-bg-base transition-all duration-300 relative z-20 ${open ? "w-64" : "w-20"}`}>
      
      {/* Brand Header */}
      <div className="flex items-center h-16 px-4 border-b border-border-subtle">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-clinical-600 to-deepblue-600 shadow-lg shadow-clinical-900/30 shrink-0 border border-clinical-500/30">
            <Database className="w-5 h-5 text-text-primary" />
          </div>
          {open && (
            <div className="flex-1 min-w-0 transition-opacity duration-300">
              <div className="font-bold text-text-primary tracking-wide text-sm">Q-KNEE</div>
              <div className="text-[10px] text-text-muted uppercase tracking-widest font-semibold">Research Prototype</div>
            </div>
          )}
        </Link>
      </div>

      {/* Toggle Button */}
      <button 
        onClick={() => setOpen(!open)} 
        className="absolute -right-3 top-20 bg-bg-card border border-border-hover text-text-secondary rounded-full p-1 hover:text-text-primary hover:bg-bg-active hover:border-border-hover transition-all z-30 shadow-md"
      >
        {open ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
        <div className={`text-[10px] uppercase tracking-wider text-text-muted font-semibold mb-3 px-2 ${!open && "text-center"}`}>
          {open ? "Analysis Engine" : "Menu"}
        </div>
        {navItems.map(item => {
          const active = location.pathname === item.path || (item.path !== '/dashboard' && location.pathname.startsWith(item.path + "/"));
          const Icon = item.icon;
          return (
            <Link 
              key={item.path} 
              to={item.path}
              title={!open ? item.label : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group ${
                active 
                  ? "bg-clinical-900/40 text-clinical-400 border border-clinical-800/50" 
                  : "text-text-secondary hover:bg-bg-card/50 hover:text-text-primary border border-transparent"
              }`}
            >
              <Icon className={`w-5 h-5 shrink-0 ${active ? "text-clinical-400" : "text-text-muted group-hover:text-text-secondary"}`} />
              {open && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User / Guest Section */}
      <div className="p-4 border-t border-border-subtle bg-bg-panel/30">
        {user ? (
          <div className={`flex items-center gap-3 ${!open ? "justify-center" : ""}`}>
            <div className="w-9 h-9 rounded-full bg-clinical-500/20 border border-clinical-500/40 flex items-center justify-center text-clinical-300 text-sm font-bold shrink-0">
              {(user.email?.[0] || "U").toUpperCase()}
            </div>
            {open && (
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-text-primary truncate">{user.email}</div>
                <div className="text-[10px] text-clinical-500 font-medium uppercase tracking-wider mt-0.5">{user.role || "Researcher"}</div>
              </div>
            )}
            {open && (
              <button onClick={handleLogout} className="text-text-muted hover:text-red-400 p-1.5 rounded-md hover:bg-red-950/30 transition-colors" title="Logout">
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <div className={`flex items-center gap-3 ${!open ? "justify-center" : ""}`}>
            <div className="w-9 h-9 rounded-full bg-bg-card border border-border-strong flex items-center justify-center text-text-muted text-xs font-bold shrink-0">
              G
            </div>
            {open && (
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-text-secondary truncate">Guest Researcher</div>
                <div className="text-[10px] text-text-muted font-medium uppercase tracking-wider mt-0.5">Public Demo</div>
              </div>
            )}
            {open && (
              <Link 
                to="/login" 
                className="text-xs text-clinical-400 hover:text-clinical-300 font-medium px-2 py-1 rounded bg-clinical-950/40 border border-clinical-800/60 hover:bg-clinical-900/50 transition-all"
                title="Sign in (Optional)"
              >
                Sign in
              </Link>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
