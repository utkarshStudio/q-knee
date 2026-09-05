import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import api from "../lib/api";
import { formatDate, formatMetric } from "../lib/utils";
import { ModeBadge } from "../components/ui/ModeBadge";
import { StatusIndicator } from "../components/ui/StatusIndicator";
import { Activity, Beaker, Brain, Database, Upload, ArrowRight, Microscope, FolderOpen, Scan } from "lucide-react";

interface Stats {
  totalStudies: number; 
  totalPredictions: number; 
  abnormalPredictions: number;
  totalExperiments: number; 
  totalBenchmarks: number;
  recentStudies: any[]; 
  recentPredictions: any[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [status, setStatus] = useState<any>({ 
    database: "loading", 
    mlService: "loading", 
    datasetConfigured: false, 
    currentMode: "DEMO" 
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/api/dashboard/stats"), 
      api.get("/api/dashboard/status")
    ])
      .then(([s, st]) => { 
        setStats(s.data); 
        setStatus(st.data); 
      })
      .catch((err) => {
        console.error("Dashboard data fetch failed", err);
      })
      .finally(() => setLoading(false));
  }, []);

  const metricCards = stats ? [
    { label: "Total Studies", value: stats.totalStudies, icon: Database, color: "text-blue-400", bg: "bg-blue-950/30", border: "border-blue-900/50" },
    { label: "Analyses Completed", value: stats.totalPredictions, icon: Activity, color: "text-purple-400", bg: "bg-purple-950/30", border: "border-purple-900/50" },
    { label: "Lesions Detected", value: stats.abnormalPredictions, icon: Brain, color: "text-amber-400", bg: "bg-amber-950/30", border: "border-amber-900/50" },
    { label: "Model Benchmarks", value: stats.totalBenchmarks, icon: Microscope, color: "text-emerald-400", bg: "bg-emerald-950/30", border: "border-emerald-900/50" },
  ] : [];

  return (
    <AppLayout>
      <div className="p-6 md:p-8 space-y-8 max-w-[1600px] mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Research Dashboard</h1>
            <p className="text-graphite-400 mt-2 text-sm max-w-xl">
              Monitor hybrid quantum-classical model inference, recent MRI studies, and platform health.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ModeBadge mode={(status.currentMode as any) || "DEMO"} />
            <Link to="/studies/upload" className="btn-primary gap-2">
              <Upload className="w-4 h-4" />
              New Analysis
            </Link>
          </div>
        </div>

        {/* System Health Strip */}
        <div className="glass rounded-xl p-4 flex flex-wrap items-center justify-between gap-6">
          <div className="flex flex-wrap items-center gap-6">
            <StatusIndicator 
              status={status.database} 
              label={"Database: " + (status.database === "online" ? "Connected" : status.database === "loading" ? "Connecting..." : "Offline")} 
            />
            <div className="w-px h-6 bg-graphite-800 hidden sm:block"></div>
            <StatusIndicator 
              status={status.mlService} 
              label={"ML Engine: " + (status.mlService === "online" ? "Operational" : status.mlService === "loading" ? "Connecting..." : "Degraded")} 
            />
            <div className="w-px h-6 bg-graphite-800 hidden sm:block"></div>
            <StatusIndicator 
              status={status.datasetConfigured ? "online" : "offline"} 
              label={"Dataset: " + (status.datasetConfigured ? "RSNA Configured" : "Unconfigured")} 
            />
          </div>
          
          {status.mlHealth && (
            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-graphite-400 px-2.5 py-1 rounded-md bg-graphite-900 border border-graphite-800">
                Backend: <span className="text-quantum-400">{status.mlHealth.quantum_backend || 'Qiskit Aer'}</span>
              </span>
              <span className="text-graphite-400 px-2.5 py-1 rounded-md bg-graphite-900 border border-graphite-800">
                Qubits: <span className="text-white">{status.mlHealth.qubits || 4}</span>
              </span>
              <span className="text-graphite-400 px-2.5 py-1 rounded-md bg-graphite-900 border border-graphite-800">
                PCA: <span className="text-white">{status.mlHealth.pca_components || 4}</span>
              </span>
            </div>
          )}
        </div>

        {/* Metric Cards */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="card p-6 h-32 animate-pulse bg-graphite-800/50 border-graphite-700/50" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {metricCards.map(c => {
              const Icon = c.icon;
              return (
                <div key={c.label} className="card p-6 relative overflow-hidden group">
                  {/* Background decoration */}
                  <div className={`absolute -right-6 -top-6 w-24 h-24 rounded-full blur-2xl opacity-20 group-hover:opacity-40 transition-opacity ${c.bg}`}></div>
                  
                  <div className="flex items-start justify-between relative z-10">
                    <div>
                      <div className="text-sm font-medium text-graphite-400 mb-1">{c.label}</div>
                      <div className="text-3xl font-bold text-white tracking-tight">{c.value !== undefined ? c.value : "—"}</div>
                    </div>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${c.bg} ${c.border}`}>
                      <Icon className={`w-5 h-5 ${c.color}`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tables Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Recent Studies */}
          <div className="card flex flex-col h-[500px]">
            <div className="flex items-center justify-between p-5 border-b border-graphite-800 bg-graphite-900/50 rounded-t-xl">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-graphite-400" />
                <h2 className="font-semibold text-white">Recent Studies</h2>
              </div>
              <Link to="/studies" className="text-xs text-clinical-400 hover:text-clinical-300 font-medium flex items-center gap-1 group">
                View all <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-graphite-500 text-sm">Loading studies...</div>
              ) : !stats?.recentStudies?.length ? (
                <div className="p-12 text-center flex flex-col items-center justify-center h-full">
                  <FolderOpen className="w-12 h-12 text-graphite-700 mb-4" />
                  <p className="text-graphite-400 text-sm mb-4">No MRI studies have been uploaded yet.</p>
                  <Link to="/studies/upload" className="btn-outline text-xs">Upload First Study</Link>
                </div>
              ) : (
                <div className="divide-y divide-graphite-800/50">
                  {stats.recentStudies.map(s => (
                    <Link key={s.id} to={"/studies/" + s.id} className="flex items-center justify-between p-4 hover:bg-graphite-800/50 transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-graphite-800 border border-graphite-700 flex items-center justify-center shrink-0">
                          <Scan className="w-5 h-5 text-graphite-400 group-hover:text-clinical-400 transition-colors" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-graphite-200 truncate max-w-[200px] group-hover:text-white transition-colors">
                            {s.original_filename || ("Study #" + s.id)}
                          </div>
                          <div className="text-[11px] text-graphite-500 font-mono mt-0.5">
                            {formatDate(s.created_at)}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <ModeBadge mode={s.mode || "DEMO"} />
                        <span className={`text-[10px] uppercase font-bold tracking-wider ${
                          s.status === 'completed' ? 'text-emerald-500' :
                          s.status === 'failed' ? 'text-red-500' : 'text-amber-500'
                        }`}>
                          {s.status}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recent Predictions */}
          <div className="card flex flex-col h-[500px]">
            <div className="flex items-center justify-between p-5 border-b border-graphite-800 bg-graphite-900/50 rounded-t-xl">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-graphite-400" />
                <h2 className="font-semibold text-white">Recent AI Analyses</h2>
              </div>
              <Link to="/studies" className="text-xs text-clinical-400 hover:text-clinical-300 font-medium flex items-center gap-1 group">
                View all <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-center text-graphite-500 text-sm">Loading predictions...</div>
              ) : !stats?.recentPredictions?.length ? (
                <div className="p-12 text-center flex flex-col items-center justify-center h-full">
                  <Activity className="w-12 h-12 text-graphite-700 mb-4" />
                  <p className="text-graphite-400 text-sm">No predictions have been run yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-graphite-800/50">
                  {stats.recentPredictions.map(p => (
                    <Link key={p.id} to={"/studies/" + p.study_id} className="flex items-center justify-between p-4 hover:bg-graphite-800/50 transition-colors group">
                      <div className="flex items-center gap-4">
                        <div className={`w-2 h-10 rounded-full shrink-0 ${p.predicted_class === "abnormal" ? "bg-amber-500" : "bg-emerald-500"}`}></div>
                        <div>
                          <div className={`text-sm font-semibold tracking-wide uppercase ${p.predicted_class === "abnormal" ? "text-amber-400" : "text-emerald-400"}`}>
                            {p.predicted_class === "abnormal" ? "ACL Abnormality" : "Normal"}
                          </div>
                          <div className="text-[11px] text-graphite-500 mt-1 flex items-center gap-2">
                            <span className="font-mono text-quantum-400 bg-quantum-950/30 px-1.5 rounded">{p.model_name}</span>
                            <span>{formatDate(p.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-mono text-white tracking-wider bg-graphite-900 px-2 py-0.5 rounded border border-graphite-700 inline-block">
                          {formatMetric(p.abnormal_probability, 3)}
                        </div>
                        <div className="text-[10px] text-graphite-500 uppercase tracking-widest mt-1">p(abnormal)</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
          
        </div>
      </div>
    </AppLayout>
  );
}