import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import api from "../lib/api";
import { formatDate } from "../lib/utils";
import { ModeBadge } from "../components/ui/ModeBadge";

export default function StudiesPage() {
  const [studies, setStudies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const fetchStudies = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/api/studies?page=" + page + "&limit=" + limit + "&search=" + encodeURIComponent(search));
      setStudies(res.data.studies);
      setTotal(res.data.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchStudies();
  }, [fetchStudies]);

  const statusColor = (s: string) => s === "ready" ? "bg-emerald-100 text-emerald-700" : s === "processing" ? "bg-blue-100 text-blue-700" : s === "error" ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-600";

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold text-slate-900">Studies</h1><p className="text-slate-500 text-sm">{total} total studies</p></div>
          <Link to="/studies/upload" className="btn-primary">Upload Study</Link>
        </div>
        <div className="card">
          <div className="p-4 border-b border-slate-200">
            <input type="text" placeholder="Search studies..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="input" />
          </div>
          {loading ? (
            <div className="p-8 text-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" /></div>
          ) : studies.length === 0 ? (
            <div className="p-16 text-center">
              <p className="text-slate-500 font-medium">No studies found</p>
              <Link to="/studies/upload" className="btn-primary mt-4 inline-block">Upload Study</Link>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {studies.map(s => (
                <Link key={s.id} to={"/studies/" + s.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 truncate">{s.original_filename || ("Study #" + s.id)}</div>
                    <div className="text-xs text-slate-400 font-mono truncate">{s.study_instance_uid}</div>
                    <div className="text-xs text-slate-400">{formatDate(s.created_at)}</div>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <ModeBadge mode={s.mode || "DEMO"} />
                    <span className={"text-xs px-2.5 py-0.5 rounded-full font-medium " + statusColor(s.status)}>{s.status}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {total > limit && (
            <div className="p-4 flex items-center justify-between border-t border-slate-200">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary">Previous</button>
              <span className="text-sm text-slate-500">Page {page} of {Math.ceil(total / limit)}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page * limit >= total} className="btn-secondary">Next</button>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}