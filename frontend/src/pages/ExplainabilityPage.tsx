import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import api from "../lib/api";
import { DisclaimerBanner } from "../components/ui/DisclaimerBanner";
import { ModeBadge } from "../components/ui/ModeBadge";
import { formatPercent } from "../lib/utils";
import { Brain, Cpu, ArrowLeft, RefreshCw, Eye, Target, Layers, AlignLeft, LayoutGrid, ServerCrash } from "lucide-react";

export default function ExplainabilityPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [activeView, setActiveView] = useState<"side-by-side" | "overlay-focus">("side-by-side");

  const fetchExplanation = useCallback(() => {
    api
      .get(`/api/explanations/${id}/explain`)
      .then((r) => setData(r.data))
      .catch((err) =>
        setError(
          err.response?.status === 404
            ? "No explanation recorded yet. Click below to generate."
            : "Failed to load explanation."
        )
      )
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    fetchExplanation();
  }, [fetchExplanation]);

  const generate = async () => {
    setGenerating(true);
    setError("");
    try {
      const r = await api.post(`/api/explanations/${id}/explain`);
      setData(r.data);
    } catch (err: any) {
      setError(err?.response?.data?.error || "Failed to generate explanation.");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <RefreshCw className="w-8 h-8 text-quantum-500 animate-spin" />
          <p className="text-sm font-mono text-text-muted uppercase tracking-widest">Loading Explainability Data...</p>
        </div>
      </AppLayout>
    );
  }

  const gradcam = data?.explanation?.gradcam_reference || {};
  const attributions = data?.explanation?.attribution_data || [];
  const hasGradcam = gradcam.original || gradcam.heatmap || gradcam.overlay;
  
  const isAbnormal = data?.prediction?.predicted_class === "abnormal";
  const isQuantum = data?.prediction?.model_name?.toLowerCase().includes("quantum") || data?.prediction?.model_type === "quantum";

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
        
        {/* Header Area */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-3">
            {data?.prediction?.study_id && (
              <Link to={`/studies/${data.prediction.study_id}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-clinical-400 hover:text-clinical-300 transition-colors uppercase tracking-wider">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to Study
              </Link>
            )}
            <h1 className="text-2xl md:text-3xl font-bold text-text-primary tracking-tight flex items-center gap-3">
              Explainable AI (XAI) Dashboard
            </h1>
            <p className="text-text-muted text-sm max-w-2xl">
              Multi-level interpretability combining visual Grad-CAM spatial attention with quantitative 4D latent feature attributions (Taylor gradients).
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {data && (
              <button onClick={generate} disabled={generating} className="btn-secondary whitespace-nowrap">
                {generating ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating...</> : <><RefreshCw className="w-4 h-4" /> Regenerate XAI</>}
              </button>
            )}
          </div>
        </div>

        <DisclaimerBanner />

        {/* Conceptual Distinction Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-5 bg-gradient-to-br from-clinical-950/20/40 to-bg-panel/50 border-clinical-900/50">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-clinical-400 mb-2">
              <Eye className="w-4 h-4" /> Level 1: Visual Attention
            </div>
            <h4 className="text-sm font-bold text-text-primary mb-1">ResNet18 Grad-CAM</h4>
            <p className="text-xs text-text-muted leading-relaxed">
              Highlights 2D spatial regions with highest convolutional activation in the structural MRI slice.
            </p>
          </div>
          
          <div className="card p-5 bg-gradient-to-br from-quantum-900/20/30 to-bg-panel/50 border-purple-900/40">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-purple-400 mb-2">
              <AlignLeft className="w-4 h-4" /> Level 2: Feature Attribution
            </div>
            <h4 className="text-sm font-bold text-text-primary mb-1">4D PCA Decomposition</h4>
            <p className="text-xs text-text-muted leading-relaxed">
              Signed sensitivity analysis showing how each principal component influenced the classifier boundary.
            </p>
          </div>
          
          <div className="card p-5 bg-gradient-to-br from-emerald-900/20/30 to-bg-panel/50 border-emerald-900/40">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-emerald-400 mb-2">
              <Target className="w-4 h-4" /> Level 3: Classification
            </div>
            <h4 className="text-sm font-bold text-text-primary mb-1">Risk & Probability</h4>
            <p className="text-xs text-text-muted leading-relaxed">
              Final decision from the {isQuantum ? 'quantum' : 'classical'} classifier with calibrated probabilistic confidence.
            </p>
          </div>
        </div>

        {error && !data && (
          <div className="card p-12 bg-bg-panel/50 border-border-subtle flex flex-col items-center text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-red-950/50 border border-red-900/50 flex items-center justify-center text-red-500">
              <ServerCrash className="w-8 h-8" />
            </div>
            <div>
              <p className="text-text-primary font-bold text-lg mb-2">XAI Generation Failed</p>
              <p className="text-text-muted text-sm max-w-md mx-auto">{error}</p>
            </div>
            <button onClick={generate} disabled={generating} className="btn-primary mt-2">
              {generating ? <><RefreshCw className="w-4 h-4 animate-spin" /> Computing Grad-CAM & Attributions...</> : <><RefreshCw className="w-4 h-4" /> Generate Explanation</>}
            </button>
          </div>
        )}

        {data && (
          <div className="space-y-6">
            
            {/* Prediction Summary Header */}
            {data.prediction && (
              <div className="card p-6 relative overflow-hidden bg-bg-panel/80">
                <div className={`absolute -right-20 -top-20 w-64 h-64 rounded-full blur-[80px] opacity-20 pointer-events-none ${
                  isAbnormal ? "bg-amber-500" : "bg-emerald-500"
                }`}></div>
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 relative z-10 border-b border-border-subtle pb-4">
                  <h2 className="text-sm font-bold text-text-primary uppercase tracking-wider flex items-center gap-2">
                    <Brain className="w-4 h-4 text-clinical-400" /> Reference Inference Record
                  </h2>
                  <ModeBadge mode={data.prediction.mode} />
                </div>
                
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
                  <div className="bg-bg-base/50 rounded-xl p-4 border border-border-subtle">
                    <div className="text-[10px] text-text-muted uppercase tracking-widest mb-1.5">Diagnosis</div>
                    <div className={`text-lg font-bold tracking-tight ${isAbnormal ? "text-amber-400" : "text-emerald-400"}`}>
                      {isAbnormal ? "Abnormality Detected" : "Normal Study"}
                    </div>
                  </div>
                  <div className="bg-bg-base/50 rounded-xl p-4 border border-border-subtle">
                    <div className="text-[10px] text-text-muted uppercase tracking-widest mb-1.5">p(Abnormal)</div>
                    <div className="text-xl font-bold font-mono text-text-primary">
                      {formatPercent(data.prediction.abnormal_probability)}
                    </div>
                  </div>
                  <div className="bg-bg-base/50 rounded-xl p-4 border border-border-subtle">
                    <div className="text-[10px] text-text-muted uppercase tracking-widest mb-1.5">Model Confidence</div>
                    <div className="text-xl font-bold font-mono text-clinical-400">
                      {formatPercent(data.prediction.confidence)}
                    </div>
                  </div>
                  <div className="bg-bg-base/50 rounded-xl p-4 border border-border-subtle">
                    <div className="text-[10px] text-text-muted uppercase tracking-widest mb-1.5">Architecture</div>
                    <div className="text-sm font-bold text-text-primary mt-1 flex items-center gap-2">
                      {isQuantum ? <Cpu className="w-4 h-4 text-quantum-400" /> : <Layers className="w-4 h-4 text-text-muted" />}
                      {data.prediction.model_name || "Hybrid Quantum VQC"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
              
              {/* Level 1: Visual Grad-CAM Analysis */}
              <div className="card p-6 bg-bg-panel/50 flex flex-col h-[700px]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-4 mb-6">
                  <div>
                    <h2 className="font-bold text-text-primary text-base flex items-center gap-2 mb-1">
                      <Eye className="w-5 h-5 text-clinical-400" />
                      Visual Grad-CAM Attention Map
                    </h2>
                    <p className="text-[11px] text-text-muted font-mono">
                      Target: <span className="text-clinical-300">ResNet18.layer4[1].conv2</span> (Pre-Pool)
                    </p>
                  </div>
                  
                  {hasGradcam && (
                    <div className="flex bg-bg-base rounded-lg p-1 border border-border-subtle shrink-0">
                      <button
                        onClick={() => setActiveView("side-by-side")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                          activeView === "side-by-side" ? "bg-clinical-600 text-white" : "text-text-muted hover:text-white"
                        }`}
                      >
                        <LayoutGrid className="w-3.5 h-3.5" /> Side-by-Side
                      </button>
                      <button
                        onClick={() => setActiveView("overlay-focus")}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                          activeView === "overlay-focus" ? "bg-clinical-600 text-white" : "text-text-muted hover:text-white"
                        }`}
                      >
                        <Target className="w-3.5 h-3.5" /> Focus
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex-1 flex flex-col">
                  {hasGradcam ? (
                    activeView === "side-by-side" ? (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
                        <div className="bg-bg-base/80 rounded-xl p-3 border border-border-subtle flex flex-col">
                          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3 text-center">1. Original</p>
                          <div className="flex-1 bg-black rounded-lg overflow-hidden flex items-center justify-center relative">
                            <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>
                            <img
                              src={`/api/explanations/${data.explanation.id}/image/original`}
                              alt="Original MRI"
                              className="w-full h-full object-contain relative z-10"
                            />
                          </div>
                        </div>

                        <div className="bg-bg-base/80 rounded-xl p-3 border border-border-subtle flex flex-col">
                          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mb-3 text-center">2. Heatmap</p>
                          <div className="flex-1 bg-black rounded-lg overflow-hidden flex items-center justify-center relative">
                            <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>
                            <img
                              src={`/api/explanations/${data.explanation.id}/image/heatmap`}
                              alt="Grad-CAM Heatmap"
                              className="w-full h-full object-contain relative z-10"
                            />
                          </div>
                        </div>

                        <div className="bg-clinical-950/20 rounded-xl p-3 border border-clinical-900/50 flex flex-col">
                          <p className="text-[10px] font-bold text-clinical-400 uppercase tracking-widest mb-3 text-center">3. Overlay (50%)</p>
                          <div className="flex-1 bg-black rounded-lg overflow-hidden flex items-center justify-center relative shadow-[0_0_20px_rgba(45,212,191,0.1)]">
                            <img
                              src={`/api/explanations/${data.explanation.id}/image/overlay`}
                              alt="Grad-CAM Overlay"
                              className="w-full h-full object-contain relative z-10"
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 bg-bg-base/80 rounded-xl p-4 border border-clinical-900/30 flex flex-col items-center justify-center relative overflow-hidden">
                        <div className="absolute inset-0 bg-clinical-900/5 pointer-events-none"></div>
                        <p className="text-xs font-bold text-clinical-400 uppercase tracking-widest mb-4 z-10 bg-bg-base/80 px-3 py-1 rounded-full border border-clinical-900/50">
                          Superimposed Grad-CAM Attention
                        </p>
                        <div className="w-full max-w-md aspect-square bg-black rounded-xl overflow-hidden shadow-2xl relative z-10 border border-border-subtle">
                          <img
                            src={`/api/explanations/${data.explanation.id}/image/overlay`}
                            alt="Grad-CAM Overlay Focus"
                            className="w-full h-full object-contain"
                          />
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-amber-950/20 rounded-xl border border-amber-900/30 text-amber-500/80">
                      <Eye className="w-12 h-12 mb-4 opacity-50" />
                      <p className="text-sm font-medium">Visual Grad-CAM Unavailable</p>
                      <p className="text-xs mt-2 max-w-xs opacity-70">Image data is generating or not supported for this study modality. Refer to quantitative attributions.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Level 2: 4D PCA / Quantum Feature Attributions */}
              <div className="card p-6 bg-bg-panel/50 flex flex-col h-[700px]">
                <div className="border-b border-border-subtle pb-4 mb-6">
                  <h2 className="font-bold text-text-primary text-base flex items-center gap-2 mb-1">
                    <AlignLeft className="w-5 h-5 text-purple-400" />
                    4D Latent Feature Attributions
                  </h2>
                  <p className="text-[11px] text-text-muted font-mono">
                    Taylor Gradient Sensitivity: Directional influence on boundary
                  </p>
                </div>

                {attributions && attributions.length > 0 ? (
                  <div className="flex-1 flex flex-col">
                    
                    {/* Legend */}
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-text-muted mb-4 px-2">
                      <span>Principal Component</span>
                      <span className="flex items-center gap-4">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-500"></span> Pushes Abnormal
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Pushes Normal
                        </span>
                      </span>
                    </div>

                    <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                      {attributions.map((f: any, i: number) => {
                        const score = f.attribution_score ?? f.attribution ?? 0;
                        const isPositive = score >= 0;
                        const absScore = Math.abs(score);
                        const barWidth = Math.min(100, Math.max(2, absScore * 250)); // Scaler for visualization

                        return (
                          <div key={i} className="p-4 bg-bg-base/80 rounded-xl border border-border-subtle relative overflow-hidden group hover:border-border-strong transition-colors">
                            {/* Ambient glow based on direction */}
                            <div className={`absolute -right-10 -top-10 w-24 h-24 blur-2xl opacity-10 rounded-full transition-opacity group-hover:opacity-20 ${
                              isPositive ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}></div>

                            <div className="flex items-center justify-between mb-3 relative z-10">
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-xs font-bold text-text-primary bg-bg-card px-2.5 py-1 rounded-md border border-border-strong">
                                  {f.feature_name || f.feature_label || `PC${i + 1}`}
                                </span>
                                {f.input_value !== undefined && (
                                  <span className="text-text-muted font-mono text-[10px]">
                                    val: {f.input_value.toFixed(3)}
                                  </span>
                                )}
                              </div>
                              <div className={`font-mono font-bold text-sm ${isPositive ? "text-amber-400" : "text-emerald-400"}`}>
                                {isPositive ? "+" : ""}{score.toFixed(4)}
                              </div>
                            </div>

                            <div className="w-full h-2 bg-bg-panel rounded-full overflow-hidden flex relative z-10">
                              {/* Center line */}
                              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-bg-active z-20"></div>
                              
                              {/* Left half (Negative / Normal) */}
                              <div className="w-1/2 h-full flex justify-end pr-1">
                                {!isPositive && (
                                  <div
                                    className="h-full bg-emerald-500 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                                    style={{ width: `${barWidth}%` }}
                                  />
                                )}
                              </div>
                              
                              {/* Right half (Positive / Abnormal) */}
                              <div className="w-1/2 h-full flex justify-start pl-1">
                                {isPositive && (
                                  <div
                                    className="h-full bg-amber-500 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                                    style={{ width: `${barWidth}%` }}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-bg-base/50 rounded-xl border border-border-subtle text-text-muted">
                    <AlignLeft className="w-12 h-12 mb-4 opacity-50" />
                    <p className="text-sm font-medium text-text-secondary">No Feature Attributions</p>
                    <p className="text-xs mt-2 max-w-xs">Latent space attributions are currently unavailable for this study.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
