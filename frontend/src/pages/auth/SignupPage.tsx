import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Database, ArrowLeft, ArrowRight, Loader2, ShieldAlert } from "lucide-react";

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState("researcher");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      await signup(email, password, role);
      navigate("/dashboard");
    } catch (err: any) {
      setError(err?.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base px-4 py-12 relative overflow-hidden bg-grid-pattern">
      <div className="absolute inset-0 bg-gradient-to-b from-bg-base/40 via-bg-base/80 to-bg-base pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        {/* Top return link */}
        <div className="mb-6">
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 text-xs font-semibold text-text-muted hover:text-clinical-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Continue as Guest (Skip Account Creation)
          </Link>
        </div>

        {/* Brand */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-clinical-600 to-deepblue-600 mb-4 shadow-lg shadow-clinical-900/30 border border-clinical-500/30">
            <Database className="w-6 h-6 text-text-primary" />
          </Link>
          <h1 className="text-2xl font-bold text-text-primary tracking-tight">Q-KNEE</h1>
          <p className="text-text-muted text-xs font-mono uppercase tracking-wider mt-1">Create Research Account</p>
        </div>

        {/* Signup Card */}
        <div className="card p-8 bg-bg-panel/70 border-border-subtle backdrop-blur-md shadow-2xl">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-text-primary">Create Your Account</h2>
            <p className="text-text-muted text-xs mt-1">
              Account creation is optional. Guests can immediately upload and analyze knee MRI scans.
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Email Address</label>
              <input 
                type="email" 
                required 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                className="input text-text-primary bg-bg-base border-border-strong placeholder-graphite-500" 
                placeholder="researcher@institution.edu" 
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Password (Min. 8 characters)</label>
              <input 
                type="password" 
                required 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                className="input text-text-primary bg-bg-base border-border-strong" 
                placeholder="••••••••" 
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Confirm Password</label>
              <input 
                type="password" 
                required 
                value={confirm} 
                onChange={e => setConfirm(e.target.value)} 
                className="input text-text-primary bg-bg-base border-border-strong" 
                placeholder="••••••••" 
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1.5 uppercase tracking-wider">Role</label>
              <select 
                value={role} 
                onChange={e => setRole(e.target.value)} 
                className="input text-text-primary bg-bg-base border-border-strong"
              >
                <option value="researcher">Researcher</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            <button 
              type="submit" 
              disabled={loading} 
              className="btn-primary w-full mt-3 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Creating Account...
                </>
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-border-subtle text-center space-y-3">
            <p className="text-xs text-text-muted">
              Already registered? <Link to="/login" className="text-clinical-400 hover:text-clinical-300 font-medium">Sign in</Link>
            </p>
            <div>
              <Link 
                to="/dashboard" 
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors"
              >
                Or continue exploring as Guest <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-text-muted mt-6 font-mono">
          Research Prototype — Quantum-Classical MRI Intelligence
        </p>
      </div>
    </div>
  );
}
