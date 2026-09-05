import { useEffect, useState } from "react";
import AppLayout from "../components/layout/AppLayout";
import { useAuth } from "../contexts/AuthContext";
import api from "../lib/api";
import { StatusIndicator } from "../components/ui/StatusIndicator";
import { ModeBadge } from "../components/ui/ModeBadge";
import { Settings, User, Database, Server, Cpu, Layers, Link as LinkIcon, AlertCircle, CheckCircle2 } from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => { 
    api.get("/api/dashboard/status").then(r => setStatus(r.data)).catch(console.error).finally(() => setLoading(false)); 
  }, []);

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-[1200px] mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-graphite-900 border border-graphite-700 flex items-center justify-center">
            <Settings className="w-5 h-5 text-graphite-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">System Settings</h1>
            <p className="text-graphite-400 text-sm">Configuration, service health, and ML architecture parameters.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          
          <div className="space-y-6">
            {/* Account Card */}
            <div className="card p-6 border-graphite-800 bg-graphite-900/50">
              <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-6 border-b border-graphite-800 pb-3">
                <User className="w-4 h-4 text-clinical-400" /> Account Profile
              </h2>
              <div className="space-y-4">
                <div className="bg-graphite-950/50 rounded-lg p-3 border border-graphite-800 flex justify-between items-center">
                  <span className="text-xs text-graphite-400 uppercase tracking-wider">Account State</span>
                  <span className="text-sm font-medium text-white">{user?.email || "Guest Session (Public Demo)"}</span>
                </div>
                <div className="bg-graphite-950/50 rounded-lg p-3 border border-graphite-800 flex justify-between items-center">
                  <span className="text-xs text-graphite-400 uppercase tracking-wider">Access Tier</span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-clinical-950/30 border border-clinical-900/50 text-xs font-semibold text-clinical-400 capitalize">
                    {user?.role || "Public Research Demo"}
                  </span>
                </div>
                {!user && (
                  <div className="pt-2">
                    <a href="/login" className="btn-secondary w-full text-center text-xs block py-2">
                      Sign In to Personal Account (Optional)
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Microservice Status */}
            <div className="card p-6 border-graphite-800 bg-graphite-900/50">
              <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-6 border-b border-graphite-800 pb-3">
                <Server className="w-4 h-4 text-emerald-400" /> Microservice Telemetry
              </h2>
              
              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-clinical-500" />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="bg-graphite-950/50 rounded-lg p-3 border border-graphite-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Database className="w-4 h-4 text-graphite-500" />
                      <span className="text-sm font-medium text-graphite-300">PostgreSQL Database</span>
                    </div>
                    <StatusIndicator status={status?.database || "unknown"} label="" />
                  </div>
                  
                  <div className="bg-graphite-950/50 rounded-lg p-3 border border-graphite-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Cpu className="w-4 h-4 text-graphite-500" />
                      <span className="text-sm font-medium text-graphite-300">FastAPI ML Service</span>
                    </div>
                    <StatusIndicator status={status?.mlService || "unknown"} label="" />
                  </div>
                  
                  <div className="bg-graphite-950/50 rounded-lg p-3 border border-graphite-800 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <LinkIcon className="w-4 h-4 text-graphite-500" />
                      <span className="text-sm font-medium text-graphite-300">RSNA Dataset Link</span>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                      status?.datasetConfigured ? "bg-emerald-950/30 text-emerald-400 border border-emerald-900/50" : "bg-amber-950/30 text-amber-400 border border-amber-900/50"
                    }`}>
                      {status?.datasetConfigured ? <><CheckCircle2 className="w-3 h-3" /> Linked</> : <><AlertCircle className="w-3 h-3" /> Missing</>}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ML Infrastructure Details */}
          {status?.mlHealth && (
            <div className="space-y-6">
              
              <div className="card p-6 border-clinical-900/30 bg-gradient-to-b from-graphite-900 to-graphite-950">
                <div className="flex items-center justify-between border-b border-graphite-800 pb-3 mb-6">
                  <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                    <Layers className="w-4 h-4 text-quantum-400" /> Inference Pipeline Specs
                  </h2>
                  <ModeBadge mode={status.mlHealth.mode} />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-graphite-950/80 rounded-lg p-3 border border-graphite-800">
                    <span className="text-[10px] text-graphite-500 uppercase tracking-widest block mb-1">Simulator Target</span>
                    <span className="text-sm font-mono text-quantum-300">{status.mlHealth.quantum_backend || "PennyLane CPU"}</span>
                  </div>
                  
                  <div className="bg-graphite-950/80 rounded-lg p-3 border border-graphite-800">
                    <span className="text-[10px] text-graphite-500 uppercase tracking-widest block mb-1">Circuit Topology</span>
                    <span className="text-sm font-mono text-white">
                      {status.mlHealth.qubits} Qubits / {status.mlHealth.quantum_depth} Layers
                    </span>
                  </div>
                  
                  <div className="bg-graphite-950/80 rounded-lg p-3 border border-graphite-800">
                    <span className="text-[10px] text-graphite-500 uppercase tracking-widest block mb-1">Latent Reduction</span>
                    <span className="text-sm font-mono text-white">PCA ({status.mlHealth.pca_components} dims)</span>
                  </div>

                  <div className="bg-graphite-950/80 rounded-lg p-3 border border-graphite-800">
                    <span className="text-[10px] text-graphite-500 uppercase tracking-widest block mb-1">CNN Backbone</span>
                    <span className="text-sm font-medium flex items-center gap-1.5">
                      {status.mlHealth.model_loaded ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                      <span className={status.mlHealth.model_loaded ? "text-white" : "text-graphite-500"}>ResNet18 Active</span>
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-graphite-800 grid grid-cols-3 gap-2">
                  <div className="text-center p-2 rounded bg-graphite-950 border border-graphite-800">
                    <span className="block text-[9px] text-graphite-500 uppercase tracking-wider mb-1">PCA</span>
                    <span className={`text-xs font-bold ${status.mlHealth.pca_fitted ? "text-emerald-400" : "text-graphite-600"}`}>
                      {status.mlHealth.pca_fitted ? "FITTED" : "UNFITTED"}
                    </span>
                  </div>
                  <div className="text-center p-2 rounded bg-graphite-950 border border-graphite-800">
                    <span className="block text-[9px] text-graphite-500 uppercase tracking-wider mb-1">Classical SVM</span>
                    <span className={`text-xs font-bold ${status.mlHealth.classifier_fitted ? "text-emerald-400" : "text-graphite-600"}`}>
                      {status.mlHealth.classifier_fitted ? "FITTED" : "UNFITTED"}
                    </span>
                  </div>
                  <div className="text-center p-2 rounded bg-graphite-950 border border-graphite-800">
                    <span className="block text-[9px] text-graphite-500 uppercase tracking-wider mb-1">Quantum VQC</span>
                    <span className={`text-xs font-bold ${status.mlHealth.vqc_trained ? "text-emerald-400" : "text-graphite-600"}`}>
                      {status.mlHealth.vqc_trained ? "TRAINED" : "UNTRAINED"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quantum Circuit Visualization */}
              <div className="card p-6 border-quantum-900/50 bg-graphite-900/80 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-5">
                  <Cpu className="w-48 h-48" />
                </div>
                
                <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-2 relative z-10">
                  Variational Quantum Circuit (VQC)
                </h2>
                <p className="text-xs text-graphite-400 mb-6 relative z-10">
                  Angle encoding layer followed by strongly entangling variational layers mapping PCA latent vectors to a binary expectation value.
                </p>
                
                <div className="font-mono text-xs bg-[#0F1115] p-5 rounded-xl border border-[#1E232B] overflow-x-auto shadow-inner relative z-10">
                  <div className="space-y-2.5">
                    {Array.from({ length: status.mlHealth.qubits || 4 }, (_, i) => (
                      <div key={i} className="flex items-center whitespace-nowrap">
                        <span className="text-quantum-400 font-bold w-6">q{i}</span>
                        <span className="text-graphite-600 px-2">|0⟩ ──</span>
                        <span className="bg-clinical-900/30 text-clinical-300 border border-clinical-800 px-1.5 py-0.5 rounded mx-1">
                          RY(x<sub className="text-[9px]">{i}</sub>)
                        </span>
                        <span className="text-graphite-600 px-1">──</span>
                        {Array.from({ length: status.mlHealth.quantum_depth || 2 }, (_, d) => (
                          <span key={d} className="flex items-center">
                            <span className="bg-purple-900/30 text-purple-300 border border-purple-800 px-1.5 py-0.5 rounded mx-1">
                              RZ(θ<sub className="text-[9px]">{i},{d}</sub>)
                            </span>
                            <span className="bg-purple-900/30 text-purple-300 border border-purple-800 px-1.5 py-0.5 rounded mx-1">
                              RX(φ<sub className="text-[9px]">{i},{d}</sub>)
                            </span>
                            <span className="text-graphite-600 px-1">──</span>
                          </span>
                        ))}
                        <span className="text-graphite-600 px-1">──</span>
                        <span className="bg-graphite-800 text-white border border-graphite-600 px-1.5 py-0.5 rounded mx-1 flex items-center justify-center w-6 h-6 rounded-full">
                          M
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}