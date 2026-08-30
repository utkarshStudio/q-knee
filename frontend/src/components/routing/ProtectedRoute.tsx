import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import type { ReactNode } from "react";

export function ProtectedRoute({ children, requiredRole }: { children: ReactNode; requiredRole?: string }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (requiredRole === "admin" && user.role !== "admin") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}