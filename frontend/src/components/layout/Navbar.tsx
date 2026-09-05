import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { Database, Menu, X, User as UserIcon, ArrowRight, Sun, Moon } from "lucide-react";

export function Navbar() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${
      scrolled 
        ? "bg-bg-base/80 backdrop-blur-md border-b border-border-subtle shadow-lg" 
        : "bg-transparent"
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-clinical-600 to-deepblue-600 shadow-lg shadow-clinical-900/30 shrink-0 border border-clinical-500/30 group-hover:scale-105 transition-transform">
              <Database className="w-5 h-5 text-text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-text-primary tracking-wide text-lg leading-tight">Q-KNEE</span>
              <span className="text-[10px] text-clinical-400 uppercase tracking-widest font-semibold leading-tight">Hybrid MRI Intelligence</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            <div className="flex items-center gap-6 text-sm font-medium text-text-secondary">
              <Link to="/dashboard" className="hover:text-text-primary transition-colors">Dashboard</Link>
              <Link to="/upload" className="hover:text-text-primary transition-colors">Analyze MRI</Link>
              <Link to="/studies" className="hover:text-text-primary transition-colors">Studies</Link>
              <a href="/#technology" className="hover:text-text-primary transition-colors">Technology</a>
              <a href="/#research" className="hover:text-text-primary transition-colors">Research</a>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl bg-bg-panel hover:bg-bg-hover border border-border-strong text-text-secondary hover:text-text-primary transition-all flex items-center justify-center"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {/* Optional Analyze MRI CTA */}
              <Link 
                to="/upload" 
                className="bg-clinical-600 hover:bg-clinical-500 text-white px-4 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all shadow-lg shadow-clinical-900/40 border border-clinical-500/50 flex items-center gap-1.5"
              >
                Analyze MRI
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>

              {/* Login / Account Icon (Non-blocking, Optional) */}
              <Link
                to={user ? "/settings" : "/login"}
                title={user ? `Account: ${user.email}` : "Sign in"}
                className="relative p-2 rounded-xl bg-bg-panel hover:bg-bg-hover border border-border-strong text-text-secondary hover:text-text-primary transition-all shadow-sm flex items-center gap-2 group"
              >
                {user ? (
                  <div className="w-5 h-5 rounded-full bg-clinical-500/20 text-clinical-400 font-bold text-xs flex items-center justify-center border border-clinical-500/40">
                    {(user.email?.[0] || "U").toUpperCase()}
                  </div>
                ) : (
                  <UserIcon className="w-4 h-4" />
                )}
                <span className="text-xs font-medium hidden lg:inline">
                  {user ? "Account" : "Sign in"}
                </span>
              </Link>
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-bg-panel border border-border-strong text-text-secondary"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <Link
              to={user ? "/settings" : "/login"}
              className="p-2 rounded-lg bg-bg-panel border border-border-strong text-text-secondary"
              title={user ? "Account" : "Sign in"}
            >
              <UserIcon className="w-5 h-5" />
            </Link>
            <button 
              onClick={() => setMobileOpen(!mobileOpen)}
              className="text-text-secondary hover:text-text-primary p-2"
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="md:hidden bg-bg-base border-b border-border-subtle pb-5 px-4 animate-in slide-in-from-top-2">
          <div className="flex flex-col space-y-3 pt-3">
            <Link to="/dashboard" className="text-text-secondary text-sm font-medium py-1" onClick={() => setMobileOpen(false)}>Dashboard</Link>
            <Link to="/upload" className="text-clinical-400 text-sm font-medium py-1" onClick={() => setMobileOpen(false)}>Analyze MRI</Link>
            <Link to="/studies" className="text-text-secondary text-sm font-medium py-1" onClick={() => setMobileOpen(false)}>Studies</Link>
            <a href="/#technology" className="text-text-secondary text-sm font-medium py-1" onClick={() => setMobileOpen(false)}>Technology</a>
            <a href="/#research" className="text-text-secondary text-sm font-medium py-1" onClick={() => setMobileOpen(false)}>Research</a>
            <div className="h-px bg-bg-card w-full my-2"></div>
            <Link to={user ? "/settings" : "/login"} className="text-text-secondary text-sm font-medium flex items-center gap-2 py-1" onClick={() => setMobileOpen(false)}>
              <UserIcon className="w-4 h-4 text-clinical-400" />
              {user ? `Account (${user.email})` : "Sign in (Optional)"}
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
