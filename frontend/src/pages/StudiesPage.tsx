import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import api from "../lib/api";
import { formatDate } from "../lib/utils";
import { ModeBadge } from "../components/ui/ModeBadge";
import { Search, FolderOpen, UploadCloud, ChevronLeft, ChevronRight, Activity, Loader2, ArrowRight } from "lucide-react";

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

  const statusColor = (s: string) => 
    s === "ready" || s === "completed" ? "bg-emerald-950/40 text-emerald-400 border border-emerald-900/50" 
    : s === "processing" ? "bg-blue-950/40 text-blue-400 border border-blue-900/50" 
    : s === "error" || s === "failed" ? "bg-red-950/40 text-red-400 border border-red-900/50" 
    : "bg-graphite-900 text-graphite-400 border border-graphite-800";

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              <FolderOpen className="w-8 h-8 text-clinical-400" /> Study Library
            </h1>
            <p className="text-graphite-400 text-sm">
              Manage and analyze knee MRI volumes ({total} total records).
            </p>
          </div>
          <Link to="/studies/upload" className="btn-primary w-full md:w-auto justify-center group">
            <UploadCloud className="w-4 h-4" /> Upload New Study
          </Link>
        </div>

        {/* Data Table Card */}
        <div className="card overflow-hidden border-graphite-800 bg-graphite-900/50 flex flex-col min-h-[600px]">
          
          {/* Toolbar */}
          <div className="p-4 border-b border-graphite-800 bg-graphite-950/50 flex items-center justify-between gap-4">
            <div className="relative w-full max-w-md group">
              <Search className="w-4 h-4 text-graphite-500 absolute left-3 top-1/2 -translate-y-1/2 group-focus-within:text-clinical-400 transition-colors" />
              <input 
                type="text" 
                placeholder="Search by UID, filename, or label..." 
                value={search} 
                onChange={e => { setSearch(e.target.value); setPage(1); }} 
                className="input w-full pl-9 bg-graphite-900 border-graphite-700 text-white placeholder-graphite-500 focus:border-clinical-500" 
              />
            </div>
          </div>
          
          {/* Content Area */}
          <div className="flex-1 overflow-x-auto relative">
            {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-graphite-900/50 backdrop-blur-sm z-10">
                <Loader2 className="w-8 h-8 text-clinical-500 animate-spin mb-4" />
                <p className="text-xs font-mono text-clinical-400 uppercase tracking-widest">Loading Records...</p>
              </div>
            ) : null}

            {studies.length === 0 && !loading ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-center p-8">
                <div className="w-16 h-16 rounded-full bg-graphite-900 border border-graphite-800 flex items-center justify-center mb-4">
                  <Search className="w-8 h-8 text-graphite-600" />
                </div>
                <p className="text-white font-bold text-lg mb-2">No Studies Found</p>
                <p className="text-graphite-400 text-sm max-w-sm mx-auto mb-6">
                  {search ? "No records matched your search criteria." : "Your library is empty. Upload a DICOM or NPY volume to begin analysis."}
                </p>
                {search ? (
                  <button onClick={() => { setSearch(""); setPage(1); }} className="btn-secondary">Clear Search</button>
                ) : (
                  <Link to="/studies/upload" className="btn-primary">Upload Study</Link>
                )}
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-graphite-950/80 border-b border-graphite-800 sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-6 py-4 text-[10px] font-bold text-graphite-500 uppercase tracking-widest whitespace-nowrap">Study Name & UID</th>
                    <th className="text-left px-6 py-4 text-[10px] font-bold text-graphite-500 uppercase tracking-widest whitespace-nowrap">Date Added</th>
                    <th className="text-left px-6 py-4 text-[10px] font-bold text-graphite-500 uppercase tracking-widest whitespace-nowrap">Environment</th>
                    <th className="text-left px-6 py-4 text-[10px] font-bold text-graphite-500 uppercase tracking-widest whitespace-nowrap">Status</th>
                    <th className="text-right px-6 py-4 text-[10px] font-bold text-graphite-500 uppercase tracking-widest whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-graphite-800/50">
                  {studies.map(s => (
                    <tr key={s.id} className="hover:bg-graphite-800/30 transition-colors group">
                      <td className="px-6 py-4 max-w-[300px]">
                        <div className="flex items-start gap-3">
                          <div className="mt-1 w-8 h-8 rounded-lg bg-graphite-900 border border-graphite-700 flex items-center justify-center shrink-0">
                            <Activity className="w-4 h-4 text-graphite-400" />
                          </div>
                          <div className="min-w-0">
                            <Link to={"/studies/" + s.id} className="font-semibold text-white hover:text-clinical-400 transition-colors truncate block">
                              {s.original_filename || ("Study #" + s.id)}
                            </Link>
                            <div className="text-[11px] text-graphite-500 font-mono truncate mt-0.5" title={s.study_instance_uid}>
                              {s.study_instance_uid}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-graphite-400 text-xs">
                        {formatDate(s.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <ModeBadge mode={s.mode || "DEMO"} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-[10px] px-2.5 py-1 rounded font-bold uppercase tracking-wider ${statusColor(s.status)}`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <Link to={"/studies/" + s.id} className="inline-flex items-center gap-1.5 text-xs font-semibold text-clinical-400 hover:text-clinical-300 opacity-0 group-hover:opacity-100 transition-all">
                          View Analysis <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="p-4 flex items-center justify-between border-t border-graphite-800 bg-graphite-950/50">
              <button 
                onClick={() => setPage(p => Math.max(1, p - 1))} 
                disabled={page === 1} 
                className="btn-secondary px-3 py-1.5 flex items-center gap-1 text-xs"
              >
                <ChevronLeft className="w-4 h-4" /> Prev
              </button>
              
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-graphite-500">Page</span>
                <span className="bg-graphite-800 text-white px-2 py-1 rounded">{page}</span>
                <span className="text-graphite-500">of {Math.ceil(total / limit)}</span>
              </div>
              
              <button 
                onClick={() => setPage(p => p + 1)} 
                disabled={page * limit >= total} 
                className="btn-secondary px-3 py-1.5 flex items-center gap-1 text-xs"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

        </div>
      </div>
    </AppLayout>
  );
}