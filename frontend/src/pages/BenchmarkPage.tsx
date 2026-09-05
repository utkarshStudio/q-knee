import { useEffect, useState } from "react";
import AppLayout from "../components/layout/AppLayout";
import api from "../lib/api";
import { formatDate, formatMetric, formatPercent } from "../lib/utils";
import { ModeBadge } from "../components/ui/ModeBadge";
import { DisclaimerBanner } from "../components/ui/DisclaimerBanner";
import { BarChart3, Database, Play, CheckCircle2, AlertCircle, RefreshCw, Cpu, Layers, Activity } from "lucide-react";

export default function BenchmarkPage() {
  const [benchmarks, setBenchmarks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [msg, setMsg] = useState("");
  const [activeTab, setActiveTab] = useState<"metrics" | "charts">("metrics");
  const [chartTimestamp, setChartTimestamp] = useState(() => Date.now());

  const fetchBenchmarks = () =>
    api
      .get("/api/benchmarks")
      .then((r) => setBenchmarks(r.data))
      .catch(console.error);

  useEffect(() => {
    fetchBenchmarks().finally(() => setLoading(false));
  }, []);

  const runBenchmark = async () => {
    setRunning(true);
    setMsg("");
    try {
      const r = await api.post("/api/benchmarks/run");
      setMsg(r.data.message || "Benchmark executed successfully.");
      setChartTimestamp(Date.now());
      await fetchBenchmarks();
    } catch (err: any) {
      setMsg(err?.response?.data?.error || "Benchmark failed.");
    } finally {
      setRunning(false);
    }
  };

  const mc = (v: number | null | undefined) =>
    v === null || v === undefined ? (
      <span className="text-graphite-600">-</span>
    ) : (
      <span className="font-mono font-medium text-white">{formatMetric(v, 3)}</span>
    );

  const svmBenchmark = benchmarks.find((b) => b.model_name === "ClassicalSVM");
  const vqcBenchmark = benchmarks.find((b) => b.model_name === "HybridVQC");

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-2">
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-clinical-400" /> Research Benchmarking
            </h1>
            <p className="text-graphite-400 text-sm max-w-2xl">
              Comparative evaluation of Classical SVM Baseline vs Hybrid Quantum-Classical (4-Qubit VQC) on held-out dataset.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex bg-graphite-900 rounded-lg p-1 border border-graphite-800 text-xs font-medium w-full sm:w-auto">
              <button
                onClick={() => setActiveTab("metrics")}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-md transition-all ${
                  activeTab === "metrics" ? "bg-clinical-600 text-white shadow-sm font-semibold" : "text-graphite-400 hover:text-white"
                }`}
              >
                Metrics Table
              </button>
              <button
                onClick={() => setActiveTab("charts")}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-md transition-all ${
                  activeTab === "charts" ? "bg-clinical-600 text-white shadow-sm font-semibold" : "text-graphite-400 hover:text-white"
                }`}
              >
                Visual Charts
              </button>
            </div>
            
            <button onClick={runBenchmark} disabled={running} className="btn-primary w-full sm:w-auto">
              {running ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Running Evaluation...</>
              ) : (
                <><Play className="w-4 h-4" /> Run Benchmark</>
              )}
            </button>
          </div>
        </div>

        <DisclaimerBanner />

        {/* Scientific Methodology Note */}
        <div className="card p-5 bg-clinical-950/20 border-clinical-900/50 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="w-12 h-12 shrink-0 rounded-full bg-clinical-900/50 flex items-center justify-center">
            <Database className="w-6 h-6 text-clinical-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white mb-1">Evaluation Methodology</h3>
            <p className="text-xs text-graphite-400 max-w-4xl leading-relaxed">
              Models are evaluated on an <strong>identical untouched test split</strong> using the same ResNet18+PCA 4D latent features. 
              Metrics reflect empirical performance on clinical test data. No synthetic fabrication or data leakage.
            </p>
          </div>
        </div>

        {msg && (
          <div className={`p-4 rounded-xl text-sm flex items-start gap-3 backdrop-blur-sm ${
            msg.toLowerCase().includes("failed") || msg.toLowerCase().includes("error")
              ? "bg-red-950/50 border border-red-900 text-red-200"
              : "bg-emerald-950/50 border border-emerald-900 text-emerald-200"
          }`}>
            {msg.toLowerCase().includes("failed") || msg.toLowerCase().includes("error") ? (
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <p className="font-medium">{msg}</p>
            </div>
            <button onClick={() => setMsg("")} className="opacity-50 hover:opacity-100 transition-opacity">
              &times;
            </button>
          </div>
        )}

        {/* Summary Comparison Cards */}
        {svmBenchmark && vqcBenchmark && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* SVM Card */}
            <div className="card p-6 border-graphite-700 bg-gradient-to-br from-graphite-900 to-graphite-950 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-10">
                <Layers className="w-24 h-24 text-graphite-400" />
              </div>
              <div className="flex items-start justify-between relative z-10 mb-6 border-b border-graphite-800 pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-graphite-400 mb-1 block">Classical Baseline</span>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-graphite-400" /> Support Vector Machine
                  </h3>
                </div>
                <ModeBadge mode={svmBenchmark.mode} />
              </div>
              
              <div className="grid grid-cols-3 gap-4 relative z-10">
                <div className="bg-graphite-950/50 p-4 rounded-xl border border-graphite-800 text-center">
                  <div className="text-[10px] text-graphite-500 uppercase tracking-widest mb-1.5">Accuracy</div>
                  <div className="text-xl font-mono font-bold text-white">{formatPercent(svmBenchmark.accuracy)}</div>
                </div>
                <div className="bg-graphite-950/50 p-4 rounded-xl border border-graphite-800 text-center">
                  <div className="text-[10px] text-graphite-500 uppercase tracking-widest mb-1.5">F1-Score</div>
                  <div className="text-xl font-mono font-bold text-white">{formatMetric(svmBenchmark.f1, 3)}</div>
                </div>
                <div className="bg-graphite-950/50 p-4 rounded-xl border border-graphite-800 text-center">
                  <div className="text-[10px] text-graphite-500 uppercase tracking-widest mb-1.5">ROC-AUC</div>
                  <div className="text-xl font-mono font-bold text-white">{formatMetric(svmBenchmark.roc_auc, 3)}</div>
                </div>
              </div>
            </div>

            {/* VQC Card */}
            <div className="card p-6 border-quantum-900/50 bg-gradient-to-br from-quantum-950/20 to-graphite-950 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-10">
                <Cpu className="w-24 h-24 text-quantum-400" />
              </div>
              <div className="flex items-start justify-between relative z-10 mb-6 border-b border-graphite-800 pb-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-quantum-400 mb-1 block">Experimental Quantum Architecture</span>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Cpu className="w-5 h-5 text-quantum-400" /> Hybrid 4-Qubit VQC
                  </h3>
                </div>
                <ModeBadge mode={vqcBenchmark.mode} />
              </div>
              
              <div className="grid grid-cols-3 gap-4 relative z-10">
                <div className="bg-graphite-950/50 p-4 rounded-xl border border-graphite-800 text-center">
                  <div className="text-[10px] text-graphite-500 uppercase tracking-widest mb-1.5">Accuracy</div>
                  <div className="text-xl font-mono font-bold text-quantum-100">{formatPercent(vqcBenchmark.accuracy)}</div>
                </div>
                <div className="bg-graphite-950/50 p-4 rounded-xl border border-graphite-800 text-center">
                  <div className="text-[10px] text-graphite-500 uppercase tracking-widest mb-1.5">F1-Score</div>
                  <div className="text-xl font-mono font-bold text-quantum-100">{formatMetric(vqcBenchmark.f1, 3)}</div>
                </div>
                <div className="bg-graphite-950/50 p-4 rounded-xl border border-graphite-800 text-center">
                  <div className="text-[10px] text-graphite-500 uppercase tracking-widest mb-1.5">ROC-AUC</div>
                  <div className="text-xl font-mono font-bold text-quantum-100">{formatMetric(vqcBenchmark.roc_auc, 3)}</div>
                </div>
              </div>
            </div>

          </div>
        )}

        {loading ? (
          <div className="flex justify-center p-12">
            <RefreshCw className="w-8 h-8 text-clinical-500 animate-spin" />
          </div>
        ) : benchmarks.length === 0 ? (
          <div className="card p-12 text-center bg-graphite-900/50 border-graphite-800">
            <BarChart3 className="w-12 h-12 text-graphite-600 mx-auto mb-4" />
            <p className="text-white font-bold text-lg mb-2">No Evaluations Recorded</p>
            <p className="text-graphite-400 text-sm max-w-md mx-auto">
              Click "Run Benchmark" above to evaluate Classical SVM vs Hybrid VQC on the held-out test split.
            </p>
          </div>
        ) : activeTab === "metrics" ? (
          <div className="card overflow-hidden border-graphite-800 bg-graphite-900/50">
            <div className="p-5 border-b border-graphite-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">Evaluation History Log</h2>
              <span className="text-xs font-mono bg-graphite-950 px-2.5 py-1 rounded border border-graphite-700 text-graphite-400">
                {benchmarks.length} RECORD(S)
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-graphite-950 border-b border-graphite-800">
                  <tr>
                    {[
                      "Model",
                      "Mode",
                      "Accuracy",
                      "Precision",
                      "Recall",
                      "F1",
                      "ROC-AUC",
                      "Samples",
                      "Date",
                    ].map((h) => (
                      <th
                        key={h}
                        className="text-left px-5 py-4 text-[10px] font-bold text-graphite-500 uppercase tracking-widest whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-graphite-800/50">
                  {benchmarks.map((b) => (
                    <tr key={b.id} className="hover:bg-graphite-800/30 transition-colors group">
                      <td className="px-5 py-4 font-medium text-white whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              b.model_name === "ClassicalSVM" ? "bg-graphite-400 shadow-[0_0_8px_rgba(156,163,175,0.8)]" : "bg-quantum-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]"
                            }`}
                          ></span>
                          {b.model_name}
                        </div>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <ModeBadge mode={b.mode} />
                      </td>
                      <td className="px-5 py-4">{mc(b.accuracy)}</td>
                      <td className="px-5 py-4">{mc(b.precision_score)}</td>
                      <td className="px-5 py-4">{mc(b.recall)}</td>
                      <td className="px-5 py-4">{mc(b.f1)}</td>
                      <td className="px-5 py-4">{mc(b.roc_auc)}</td>
                      <td className="px-5 py-4 text-graphite-400 font-mono text-xs">{b.sample_count ?? "-"}</td>
                      <td className="px-5 py-4 text-graphite-500 text-xs font-mono whitespace-nowrap">{formatDate(b.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-6 bg-graphite-900/50 border-graphite-800">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-graphite-800 pb-3">
                Receiver Operating Characteristic (ROC)
              </h3>
              <div className="aspect-[5/3.5] w-full flex items-center justify-center bg-black rounded-xl overflow-hidden border border-graphite-800">
                <img
                  src={`/benchmarks/roc_curve.svg?t=${chartTimestamp}`}
                  alt="ROC Curve"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              </div>
            </div>

            <div className="card p-6 bg-graphite-900/50 border-graphite-800">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-graphite-800 pb-3">
                Confusion Matrices
              </h3>
              <div className="aspect-[5/2.5] w-full flex items-center justify-center bg-black rounded-xl overflow-hidden border border-graphite-800">
                <img
                  src={`/benchmarks/confusion_matrices.svg?t=${chartTimestamp}`}
                  alt="Confusion Matrices"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              </div>
            </div>

            <div className="card p-6 bg-graphite-900/50 border-graphite-800 lg:col-span-2">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-b border-graphite-800 pb-3">
                Metric-by-Metric Comparison
              </h3>
              <div className="aspect-[5/2.4] w-full flex items-center justify-center bg-black rounded-xl overflow-hidden border border-graphite-800">
                <img
                  src={`/benchmarks/metrics_comparison.svg?t=${chartTimestamp}`}
                  alt="Metric Comparison Bar Chart"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}