import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [confirm, setConfirm] = useState(""); const [role, setRole] = useState("researcher");
  const [error, setError] = useState(""); const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault(); setError("");
    if (password !== confirm) { setError("Passwords do not match"); return; }
    if (password.length < 8) { setError("Password must be at least 8 characters"); return; }
    setLoading(true);
    try { await signup(email, password, role); navigate("/dashboard"); }
    catch (err: any) { setError(err?.response?.data?.error || "Signup failed"); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 to-purple-600 mb-4 shadow-lg text-white text-2xl font-bold">H</div>
          <h1 className="text-2xl font-bold text-slate-900">HQML</h1>
          <p className="text-slate-500 text-sm mt-1">Create a research account</p>
        </div>
        <div className="card p-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Create account</h2>
          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label><input type="email" required value={email} onChange={e => setEmail(e.target.value)} className="input" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label><input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="input" placeholder="Min. 8 characters" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password</label><input type="password" required value={confirm} onChange={e => setConfirm(e.target.value)} className="input" /></div>
            <div><label className="block text-sm font-medium text-slate-700 mb-1.5">Role</label><select value={role} onChange={e => setRole(e.target.value)} className="input"><option value="researcher">Researcher</option><option value="admin">Admin</option></select></div>
            <button type="submit" disabled={loading} className="btn-primary w-full mt-2">{loading ? "Creating..." : "Create account"}</button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-500">Already have an account? <Link to="/login" className="text-blue-600 hover:text-blue-700 font-medium">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
}