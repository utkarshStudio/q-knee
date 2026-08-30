import { useEffect, useState } from "react";
import AppLayout from "../components/layout/AppLayout";
import { useAuth } from "../contexts/AuthContext";
import api from "../lib/api";
import { StatusIndicator } from "../components/ui/StatusIndicator";
import { ModeBadge } from "../components/ui/ModeBadge";

export default function SettingsPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get("/api/dashboard/status").then(r => setStatus(r.data)).catch(console.error).finally(() => setLoading(false)); }, []);

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-2xl">
        <div><h1 className="text-2xl font-bold text-slate-900">Settings and Status</h1><p className="text-slate-500 text-sm">System configuration and service health</p></div>

        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Account</h2>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Email</dt><dd className="font-medium">{user?.email}</dd></div>
            <div className="flex justify-between"><dt className="text-slate-500">Role</dt><dd className="font-medium capitalize">{user?.role}</dd></div>
          </dl>
        </div>

        <div className="card p-6">
          <h2 className="font-semibold text-slate-900 mb-4">System Status</h2>
          {loading ? <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" /> : (
            <div className="space-y-3">
              <StatusIndicator status={status?.database || "unknown"} label="Database (PostgreSQL)" />
              <StatusIndicator status={status?.mlService || "unknown"} label="ML Service (FastAPI)" />
              <StatusIndicator status={status?.datasetConfigured ? "online" : "offline"} label={"RSNA Dataset: " + (status?.datasetConfigured ? "Configured" : "Not configured")} />
            </div>
          )}
        </div>

        {status?.mlHealth && (
          <div className="card p-6">
            <h2 className="font-semibold text-slate-900 mb-4">ML Configuration</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-slate-500">Quantum Backend</dt><dd className="font-mono text-xs">{status.mlHealth.quantum_backend}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Qubits</dt><dd className="font-mono">{status.mlHealth.qubits}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">PCA Components</dt><dd className="font-mono">{status.mlHealth.pca_components}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Quantum Depth</dt><dd className="font-mono">{status.mlHealth.quantum_depth}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">ResNet18 Loaded</dt><dd>{status.mlHealth.model_loaded ? "Yes" : "No"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">PCA Fitted</dt><dd>{status.mlHealth.pca_fitted ? "Yes" : "No"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Classical SVM</dt><dd>{status.mlHealth.classifier_fitted ? "Fitted" : "Not fitted"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">VQC Trained</dt><dd>{status.mlHealth.vqc_trained ? "Yes" : "Not trained"}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Execution Mode</dt><dd><ModeBadge mode={status.mlHealth.mode} /></dd></div>
            </dl>
          </div>
        )}

        {status?.mlHealth && (
          <div className="card p-6">
            <h2 className="font-semibold text-slate-900 mb-4">VQC Circuit ({status.mlHealth.qubits} qubits, depth {status.mlHealth.quantum_depth})</h2>
            <p className="text-xs text-slate-500 mb-3">Angle encoding + entangling variational layers. PennyLane default.qubit (Simulator).</p>
            <div className="font-mono text-xs bg-slate-50 p-4 rounded-lg overflow-x-auto space-y-1">
              {Array.from({ length: status.mlHealth.qubits || 4 }, (_, i) => (
                <div key={i} className="flex items-center gap-1 text-slate-600">
                  <span className="text-blue-600 font-semibold w-4">q{i}</span>
                  <span>-- RY(x{i}) --</span>
                  {Array.from({ length: status.mlHealth.quantum_depth || 2 }, (_, d) => (
                    <span key={d} className="text-purple-600">-- RZ(t{i},{d}) -- RX(t{i},{d})</span>
                  ))}
                  <span className="text-slate-400">-- Z</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}