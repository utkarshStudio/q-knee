import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { useLocation, Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Bell, Search, User as UserIcon } from "lucide-react";

export default function AppLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user } = useAuth();
  const location = useLocation();

  // Generate a simple breadcrumb from the path
  const pathParts = location.pathname.split('/').filter(Boolean);
  const pageTitle = pathParts.length > 0 
    ? pathParts[0].charAt(0).toUpperCase() + pathParts[0].slice(1) 
    : 'Dashboard';

  return (
    <div className="flex h-screen overflow-hidden bg-bg-base">
      <Sidebar open={sidebarOpen} setOpen={setSidebarOpen} />
      
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Top Header */}
        <header className="h-16 border-b border-border-subtle bg-bg-base/80 backdrop-blur-md flex items-center justify-between px-6 z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold text-text-primary tracking-tight">{pageTitle}</h1>
            
            {/* Status indicator */}
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-full bg-bg-panel border border-border-subtle text-[10px] font-mono text-text-muted tracking-wide uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
              Quantum Backend Connected
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative hidden md:block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input 
                type="text" 
                placeholder="Search studies (ID, Patient)..." 
                className="pl-9 pr-4 py-1.5 bg-bg-panel border border-border-strong rounded-lg text-sm text-text-primary placeholder-graphite-500 focus:outline-none focus:border-clinical-500 focus:ring-1 focus:ring-clinical-500 transition-all w-56"
              />
            </div>
            
            <button className="relative p-2 text-text-muted hover:text-text-primary transition-colors rounded-full hover:bg-bg-card">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-clinical-500 rounded-full border border-border-subtle"></span>
            </button>

            {/* Account / Login Icon */}
            <Link
              to={user ? "/settings" : "/login"}
              title={user ? `Account: ${user.email}` : "Sign in"}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-bg-panel border border-border-strong/60 hover:border-clinical-500/50 hover:bg-bg-card transition-all text-text-secondary hover:text-text-primary"
            >
              {user ? (
                <div className="w-5 h-5 rounded-full bg-clinical-500/20 text-clinical-400 font-bold text-[10px] flex items-center justify-center border border-clinical-500/40">
                  {(user.email?.[0] || "U").toUpperCase()}
                </div>
              ) : (
                <UserIcon className="w-4 h-4 text-text-muted" />
              )}
              <span className="text-xs font-medium hidden sm:inline text-text-secondary">
                {user ? user.email.split('@')[0] : "Sign in"}
              </span>
            </Link>
          </div>
        </header>

        {/* Main Content Area with grid background texture */}
        <main className="flex-1 overflow-y-auto bg-grid-pattern relative">
          {/* Subtle gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-b from-bg-base/50 to-transparent pointer-events-none"></div>
          
          <div className="relative z-10 w-full h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
