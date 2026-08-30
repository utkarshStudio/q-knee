import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import api from "../lib/api";
import { formatDate, formatMetric } from "../lib/utils";
import { ModeBadge } from "../components/ui/ModeBadge";
import { StatusIndicator } from "../components/ui/StatusIndicator";

interface Stats {
  totalStudies: number; totalPredictions: number; abnormalPredictions: number;
  totalExperiments: number; totalBenchmarks: number;
  recentStudies: any[]; recentPredictions: any[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [status, setStatus] = useState<any>({ database: "loading", mlService: "loading", datasetConfigured: false, currentMode: "DEMO" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get("/api/dashboard/stats"), api.get("/api/dashboard/status")])
      .then(([s, st]) => { setStats(s.data); setStatus(st.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const cards = stats ? [
    { label: "Total Studies", value: stats.totalStudies, color: "text-blue-600" },
    { label: "Predictions Run", value: stats.totalPredictions, color: "text-purple-600" },
    { label: "ACL Abnormality Predictions", value: stats.abnormalPredictions, color: "text-red-600" },
    { label: "Research Experiments", value: stats.totalExperiments, color: "text-emerald-600" },
    { label: "Benchmarks Available", value: stats.totalBenchmarks, color: "text-orange-600" },
  ] : [];

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Research Dashboard</h1>
            <p className="text-slate-500 text-sm mt-1">Hybrid Quantum-Classical ACL Abnormality Detection</p>
          </div>
          <div className="flex items-center gap-3">
            <ModeBadge mode={(status.currentMode as any) || "DEMO"} />
            <Link to="/studies/upload" className="btn-primary">Upload Study</Link>
          </div>
        </div>

        <div className="card p-4 flex flex-wrap items-center gap-6">
          <StatusIndicator status={status.database} label={"Database: " + (status.database === "online" ? "Connected" : status.database === "loading" ? "Connecting..." : "Offline")} />
          <StatusIndicator status={status.mlService} label={"ML Service: " + (status.mlService === "online" ? "Online" : status.mlService === "loading" ? "Connecting..." : "Offline")} />
          <StatusIndicator status={status.datasetConfigured ? "online" : "offline"} label={"Dataset: " + (status.datasetConfigured ? "RSNA Configured" : "Not configured (DEMO mode)")} />
          {status.mlHealth && <span className="text-xs text-slate-400 font-mono">{status.mlHealth.quantum_backend} | {status.mlHealth.qubits}q | PCA={status.mlHealth.pca_components}</span>}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">{[...Array(5)].map((_, i) => <div key={i} className="card p-5 animate-pulse h-24" />)}</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {cards.map(c => (
              <div key={c.label} className="card p-5">
                <div className={"text-2xl font-bold " + c.color}>{c.value}</div>
                <div className="text-xs text-slate-500 mt-1">{c.label}</div>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h2 className="font-semibold text-slate-900">Recent Studies</h2>
              <Link to="/studies" className="text-xs text-blue-600 hover:text-blue-700">View all</Link>
            </div>
            <div className="divide-y divide-slate-100">
              {!stats?.recentStudies?.length && <div className="p-8 text-center text-slate-400 text-sm">No studies yet. <Link to="/studies/upload" className="text-blue-600">Upload one</Link></div>}
              {stats?.recentStudies?.map(s => (
                <Link key={s.id} to={"/studies/" + s.id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                  <div><div className="text-sm font-medium text-slate-900 truncate">{s.original_filename || ("Study #" + s.id)}</div><div className="text-xs text-slate-400">{formatDate(s.created_at)}</div></div>
                  <ModeBadge mode={s.mode || "DEMO"} />
                </Link>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="p-5 border-b border-slate-200"><h2 className="font-semibold text-slate-900">Recent Predictions</h2></div>
            <div className="divide-y divide-slate-100">
              {!stats?.recentPredictions?.length && <div className="p-8 text-center text-slate-400 text-sm">No predictions yet.</div>}
              {stats?.recentPredictions?.map(p => (
                <Link key={p.id} to={"/studies/" + p.study_id} className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
                  <div>
                    <div className={"text-sm font-medium " + (p.predicted_class === "abnormal" ? "text-red-600" : "text-emerald-600")}>{p.predicted_class === "abnormal" ? "ACL Abnormality" : "Normal"}</div>
                    <div className="text-xs text-slate-400">{p.model_name} - {formatDate(p.created_at)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono text-slate-700">{formatMetric(p.abnormal_probability, 2)}</div>
                    <div className="text-xs text-slate-400">p(abnormal)</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}