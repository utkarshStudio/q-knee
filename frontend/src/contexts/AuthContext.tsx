import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import api from "../lib/api";

interface User {
  id: number; email: string; role: "researcher" | "admin"; created_at: string;
}
interface AuthContextType {
  user: User | null; loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, role?: string) => Promise<void>;
  logout: () => void;
}
const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const stored = localStorage.getItem("hqml_user");
    const token = localStorage.getItem("hqml_token");
    if (stored && token) setUser(JSON.parse(stored));
    setLoading(false);
  }, []);
  const login = async (email: string, password: string) => {
    const res = await api.post("/api/auth/login", { email, password });
    localStorage.setItem("hqml_token", res.data.token);
    localStorage.setItem("hqml_user", JSON.stringify(res.data.user));
    setUser(res.data.user);
  };
  const signup = async (email: string, password: string, role = "researcher") => {
    const res = await api.post("/api/auth/signup", { email, password, role });
    localStorage.setItem("hqml_token", res.data.token);
    localStorage.setItem("hqml_user", JSON.stringify(res.data.user));
    setUser(res.data.user);
  };
  const logout = () => {
    localStorage.removeItem("hqml_token"); localStorage.removeItem("hqml_user"); setUser(null);
  };
  return <AuthContext.Provider value={{ user, loading, login, signup, logout }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}