import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Lock, ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

export function ProtectedRoute({ children, requiredRole }: { children: ReactNode; requiredRole?: string }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-bg-base">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-clinical-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full p-8 rounded-2xl bg-bg-panel/70 border border-border-subtle shadow-2xl backdrop-blur-md">
          <div className="w-12 h-12 rounded-xl bg-clinical-950/50 border border-clinical-500/30 flex items-center justify-center mx-auto mb-4 text-clinical-400">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-2">Sign in required for this feature</h2>
          <p className="text-text-muted text-sm mb-6 leading-relaxed">
            This specific section requires an authenticated research account. The main Q-Knee dashboard, MRI viewer, and analysis remain completely open and usable.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
            <Link to="/login" className="btn-primary w-full sm:w-auto">
              Sign In
            </Link>
            <Link to="/dashboard" className="btn-secondary w-full sm:w-auto flex items-center justify-center gap-2">
              <ArrowLeft className="w-4 h-4" /> Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (requiredRole === "admin" && user.role !== "admin") {
    return (
      <div className="min-h-screen bg-bg-base flex items-center justify-center p-6 text-center">
        <div className="max-w-md w-full p-8 rounded-2xl bg-bg-panel/70 border border-border-subtle shadow-2xl backdrop-blur-md">
          <h2 className="text-xl font-bold text-text-primary mb-2">Administrator Access Required</h2>
          <p className="text-text-muted text-sm mb-6">
            Your account does not have administrative privileges.
          </p>
          <Link to="/dashboard" className="btn-primary">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
