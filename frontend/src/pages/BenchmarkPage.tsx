import { useEffect, useState } from "react";
import AppLayout from "../components/layout/AppLayout";
import api from "../lib/api";
import { formatDate, formatMetric, formatPercent } from "../lib/utils";
import { ModeBadge } from "../components/ui/ModeBadge";
import { DisclaimerBanner } from "../components/ui/DisclaimerBanner";

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
      <span className="text-slate-400">-</span>
    ) : (
      <span className="font-mono font-medium">{formatMetric(v, 3)}</span>
    );

  const svmBenchmark = benchmarks.find((b) => b.model_name === "ClassicalSVM");
  const vqcBenchmark = benchmarks.find((b) => b.model_name === "HybridVQC");

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Research Benchmarking</h1>
            <p className="text-slate-500 text-sm">
              Classical SVM Baseline vs Hybrid Quantum-Classical (4-Qubit VQC) Experimental Comparison
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200 text-xs font-medium">
              <button
                onClick={() => setActiveTab("metrics")}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  activeTab === "metrics" ? "bg-white text-slate-900 shadow-sm font-semibold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Metrics Table
              </button>
              <button
                onClick={() => setActiveTab("charts")}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  activeTab === "charts" ? "bg-white text-slate-900 shadow-sm font-semibold" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Visual Charts (ROC / CM)
              </button>
            </div>
            <button onClick={runBenchmark} disabled={running} className="btn-primary">
              {running ? "Running Benchmark..." : "Run Benchmark"}
            </button>
          </div>
        </div>

        <DisclaimerBanner />

        {/* Scientific Methodology Note */}
        <div className="card p-4 bg-slate-50 border-slate-200 text-sm text-slate-700 space-y-1">
          <div className="font-semibold text-slate-900 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-600"></span>
            Evaluation Methodology & Data Leakage Prevention
          </div>
          <p className="text-xs text-slate-600">
            Both Classical SVM and Hybrid Quantum VQC models are evaluated on the <strong>identical untouched test split</strong> using the same 4D PCA features. Hyperparameter tuning was conducted strictly on training/validation splits. Metrics reflect empirical performance without synthetic fabrication.
          </p>
        </div>

        {msg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 flex items-center justify-between">
            <span>{msg}</span>
            <button onClick={() => setMsg("")} className="text-emerald-600 hover:text-emerald-900 font-bold">&times;</button>
          </div>
        )}

        {/* Summary Comparison Cards */}
        {svmBenchmark && vqcBenchmark && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-5 border-l-4 border-l-blue-600 bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">Classical Baseline</span>
                  <h3 className="text-lg font-bold text-slate-900">Support Vector Machine (RBF/Linear)</h3>
                </div>
                <ModeBadge mode={svmBenchmark.mode} />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 text-center">
                <div>
                  <div className="text-xs text-slate-500">Accuracy</div>
                  <div className="text-lg font-mono font-bold text-slate-900">{formatPercent(svmBenchmark.accuracy)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">F1-Score</div>
                  <div className="text-lg font-mono font-bold text-slate-900">{formatMetric(svmBenchmark.f1, 3)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">ROC-AUC</div>
                  <div className="text-lg font-mono font-bold text-slate-900">{formatMetric(svmBenchmark.roc_auc, 3)}</div>
                </div>
              </div>
            </div>

            <div className="card p-5 border-l-4 border-l-purple-600 bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-purple-600">Hybrid Quantum-Classical</span>
                  <h3 className="text-lg font-bold text-slate-900">4-Qubit Variational Classifier (VQC)</h3>
                </div>
                <ModeBadge mode={vqcBenchmark.mode} />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 text-center">
                <div>
                  <div className="text-xs text-slate-500">Accuracy</div>
                  <div className="text-lg font-mono font-bold text-slate-900">{formatPercent(vqcBenchmark.accuracy)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">F1-Score</div>
                  <div className="text-lg font-mono font-bold text-slate-900">{formatMetric(vqcBenchmark.f1, 3)}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">ROC-AUC</div>
                  <div className="text-lg font-mono font-bold text-slate-900">{formatMetric(vqcBenchmark.roc_auc, 3)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center p-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : benchmarks.length === 0 ? (
          <div className="card p-12 text-center">
            <p className="text-slate-500 font-medium">No benchmark evaluations recorded yet.</p>
            <p className="text-slate-400 text-sm mt-1">
              Click "Run Benchmark" above to evaluate Classical SVM vs Hybrid VQC on the held-out test split.
            </p>
          </div>
        ) : activeTab === "metrics" ? (
          <div className="card overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800">Complete Experimental Evaluation History</h2>
              <span className="text-xs text-slate-500">{benchmarks.length} record(s)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
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
                        className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {benchmarks.map((b) => (
                    <tr key={b.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        <span
                          className={`inline-block w-2 h-2 rounded-full mr-2 ${
                            b.model_name === "ClassicalSVM" ? "bg-blue-600" : "bg-purple-600"
                          }`}
                        ></span>
                        {b.model_name}
                      </td>
                      <td className="px-4 py-3">
                        <ModeBadge mode={b.mode} />
                      </td>
                      <td className="px-4 py-3">{mc(b.accuracy)}</td>
                      <td className="px-4 py-3">{mc(b.precision_score)}</td>
                      <td className="px-4 py-3">{mc(b.recall)}</td>
                      <td className="px-4 py-3">{mc(b.f1)}</td>
                      <td className="px-4 py-3">{mc(b.roc_auc)}</td>
                      <td className="px-4 py-3 text-slate-500">{b.sample_count ?? "-"}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(b.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="card p-4">
              <h3 className="text-sm font-bold text-slate-800 mb-3">Receiver Operating Characteristic (ROC)</h3>
              <div className="aspect-[5/3.5] w-full flex items-center justify-center bg-slate-50 rounded-lg overflow-hidden border border-slate-100">
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

            <div className="card p-4">
              <h3 className="text-sm font-bold text-slate-800 mb-3">Confusion Matrices</h3>
              <div className="aspect-[5/2.5] w-full flex items-center justify-center bg-slate-50 rounded-lg overflow-hidden border border-slate-100">
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

            <div className="card p-4 lg:col-span-2">
              <h3 className="text-sm font-bold text-slate-800 mb-3">Metric-by-Metric Comparison</h3>
              <div className="aspect-[5/2.4] w-full flex items-center justify-center bg-slate-50 rounded-lg overflow-hidden border border-slate-100">
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