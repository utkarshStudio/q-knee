import { useEffect, useState, useCallback } from "react";
import { useParams } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import api from "../lib/api";
import { DisclaimerBanner } from "../components/ui/DisclaimerBanner";
import { ModeBadge } from "../components/ui/ModeBadge";
import { formatPercent } from "../lib/utils";

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
        <div className="p-12 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      </AppLayout>
    );
  }

  const gradcam = data?.explanation?.gradcam_reference || {};
  const attributions = data?.explanation?.attribution_data || [];
  const hasGradcam = gradcam.original || gradcam.heatmap || gradcam.overlay;

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-5xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Explainability & Interpretability (XAI)</h1>
            <p className="text-slate-500 text-sm mt-1">
              Multi-Level Explanations: Visual Grad-CAM Attention & 4D Latent Feature Attributions
            </p>
          </div>
          {data && (
            <button onClick={generate} disabled={generating} className="btn-secondary text-xs">
              {generating ? "Regenerating..." : "Regenerate XAI"}
            </button>
          )}
        </div>

        <DisclaimerBanner />

        {/* Conceptual Distinction Banner */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-4 border-l-4 border-l-blue-500 bg-white">
            <span className="text-xs font-semibold uppercase text-blue-600">Level 1: Visual Attention</span>
            <h4 className="text-sm font-bold text-slate-900 mt-1">ResNet18 Grad-CAM</h4>
            <p className="text-xs text-slate-500 mt-1">
              Highlights 2D spatial regions with highest convolutional activation in the MRI slice.
            </p>
          </div>
          <div className="card p-4 border-l-4 border-l-purple-500 bg-white">
            <span className="text-xs font-semibold uppercase text-purple-600">Level 2: Feature Attribution</span>
            <h4 className="text-sm font-bold text-slate-900 mt-1">4D PCA Decomposition</h4>
            <p className="text-xs text-slate-500 mt-1">
              Signed sensitivity showing how each principal component pushed the final score.
            </p>
          </div>
          <div className="card p-4 border-l-4 border-l-emerald-500 bg-white">
            <span className="text-xs font-semibold uppercase text-emerald-600">Level 3: Classification</span>
            <h4 className="text-sm font-bold text-slate-900 mt-1">Risk & Probability</h4>
            <p className="text-xs text-slate-500 mt-1">
              Final decision from the quantum/classical classifier with calibrated confidence.
            </p>
          </div>
        </div>

        {error && !data && (
          <div className="card p-10 text-center space-y-4">
            <div className="inline-flex p-3 rounded-full bg-blue-50 text-blue-600">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <p className="text-slate-600 font-medium">{error}</p>
            <button onClick={generate} disabled={generating} className="btn-primary">
              {generating ? "Computing Grad-CAM & Attributions..." : "Generate Explanation"}
            </button>
          </div>
        )}

        {data && (
          <div className="space-y-6">
            {/* Prediction Summary Header */}
            {data.prediction && (
              <div className="card p-5 bg-white">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Prediction Record</h2>
                  <ModeBadge mode={data.prediction.mode} />
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                    <div className="text-xs text-slate-500">Screening Result</div>
                    <div className={"text-base font-bold mt-0.5 " + (data.prediction.predicted_class === "abnormal" ? "text-red-600" : "text-emerald-600")}>
                      {data.prediction.predicted_class === "abnormal" ? "Abnormality Detected" : "Normal Study"}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                    <div className="text-xs text-slate-500">Abnormal Probability</div>
                    <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                      {formatPercent(data.prediction.abnormal_probability)}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                    <div className="text-xs text-slate-500">Confidence</div>
                    <div className="text-base font-bold font-mono text-slate-900 mt-0.5">
                      {formatPercent(data.prediction.confidence)}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-100">
                    <div className="text-xs text-slate-500">Active Model</div>
                    <div className="text-sm font-semibold text-slate-800 mt-1">
                      {data.prediction.model_name || "Hybrid Quantum VQC"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Level 1: Visual Grad-CAM Analysis */}
            <div className="card p-5 bg-white space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                    Visual Grad-CAM Attention Map
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Target Layer: <code className="text-xs bg-slate-100 px-1 py-0.5 rounded font-mono">ResNet18.layer4[1].conv2</code> (Pre-Pooling Feature Map)
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <button
                    onClick={() => setActiveView("side-by-side")}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      activeView === "side-by-side" ? "bg-blue-600 text-white font-semibold" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    Side-by-Side
                  </button>
                  <button
                    onClick={() => setActiveView("overlay-focus")}
                    className={`px-2.5 py-1 rounded transition-colors ${
                      activeView === "overlay-focus" ? "bg-blue-600 text-white font-semibold" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    Overlay Focus
                  </button>
                </div>
              </div>

              {hasGradcam ? (
                activeView === "side-by-side" ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-200">
                      <p className="text-xs font-semibold text-slate-700 mb-2">1. Original MRI Slice</p>
                      <div className="aspect-square bg-black rounded-md overflow-hidden flex items-center justify-center">
                        <img
                          src={`/api/explanations/${data.explanation.id}/image/original`}
                          alt="Original MRI"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-3 text-center border border-slate-200">
                      <p className="text-xs font-semibold text-slate-700 mb-2">2. Grad-CAM Heatmap</p>
                      <div className="aspect-square bg-black rounded-md overflow-hidden flex items-center justify-center">
                        <img
                          src={`/api/explanations/${data.explanation.id}/image/heatmap`}
                          alt="Grad-CAM Heatmap"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-3 text-center border border-blue-200 bg-blue-50/30">
                      <p className="text-xs font-semibold text-blue-900 mb-2">3. Blended Overlay (50%)</p>
                      <div className="aspect-square bg-black rounded-md overflow-hidden flex items-center justify-center">
                        <img
                          src={`/api/explanations/${data.explanation.id}/image/overlay`}
                          alt="Grad-CAM Overlay"
                          className="w-full h-full object-contain"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-md mx-auto bg-slate-50 rounded-lg p-4 text-center border border-blue-200">
                    <p className="text-xs font-bold text-slate-800 mb-2">Superimposed Grad-CAM Attention</p>
                    <div className="aspect-square bg-black rounded-lg overflow-hidden flex items-center justify-center">
                      <img
                        src={`/api/explanations/${data.explanation.id}/image/overlay`}
                        alt="Grad-CAM Overlay Focus"
                        className="w-full h-full object-contain"
                      />
                    </div>
                  </div>
                )
              ) : (
                <div className="p-6 text-center bg-amber-50 rounded-lg border border-amber-200 text-amber-800 text-xs">
                  Visual Grad-CAM image is currently generating or unavailable for this study format. Quantitative feature attributions are displayed below.
                </div>
              )}
            </div>

            {/* Level 2: 4D PCA / Quantum Feature Attributions */}
            <div className="card p-5 bg-white space-y-4">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-600"></span>
                  4D Latent Feature Attributions (Taylor Gradient Sensitivity)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Directional influence of each compressed PCA feature on the model probability score.
                </p>
              </div>

              {attributions && attributions.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-xs text-slate-500 px-1">
                    <span>Feature Component</span>
                    <span className="flex items-center gap-4">
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block"></span> Pushes Abnormal</span>
                      <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block"></span> Pushes Normal</span>
                    </span>
                  </div>

                  <div className="space-y-3">
                    {attributions.map((f: any, i: number) => {
                      const score = f.attribution_score ?? f.attribution ?? 0;
                      const isPositive = score >= 0;
                      const absScore = Math.abs(score);
                      const barWidth = Math.min(100, Math.max(8, absScore * 250));

                      return (
                        <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-100 space-y-2">
                          <div className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                                {f.feature_name || f.feature_label || `PC${i + 1}`}
                              </span>
                              {f.input_value !== undefined && (
                                <span className="text-slate-500 font-mono text-[11px]">
                                  value: {f.input_value.toFixed(3)}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 font-mono font-bold">
                              <span className={isPositive ? "text-red-600" : "text-blue-600"}>
                                {isPositive ? "+" : ""}{score.toFixed(4)}
                              </span>
                            </div>
                          </div>

                          <div className="h-2.5 bg-slate-200/70 rounded-full overflow-hidden flex">
                            {isPositive ? (
                              <div
                                className="h-full bg-red-500 rounded-full transition-all duration-500"
                                style={{ width: `${barWidth}%` }}
                              />
                            ) : (
                              <div
                                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                                style={{ width: `${barWidth}%` }}
                              />
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 p-4 text-center">
                  No feature attributions computed yet.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}