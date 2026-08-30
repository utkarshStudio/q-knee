import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import api from "../lib/api";
import { formatDate, formatPercent } from "../lib/utils";
import { ModeBadge } from "../components/ui/ModeBadge";
import { DisclaimerBanner } from "../components/ui/DisclaimerBanner";
import { MriViewer } from "../components/ui/MriViewer";

export default function StudyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [study, setStudy] = useState<any>(null);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [predicting, setPredicting] = useState(false);
  const [predError, setPredError] = useState("");
  const [activePlane, setActivePlane] = useState<"sagittal" | "axial" | "coronal">("sagittal");
  const [currentSlice, setCurrentSlice] = useState(0);
  const [explanationData, setExplanationData] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      api.get("/api/studies/" + id),
      api.get("/api/studies/" + id + "/predictions"),
    ])
      .then(([s, p]) => {
        setStudy(s.data);
        setPredictions(p.data);
        // If predictions exist, attempt loading latest explanation for viewer
        if (p.data && p.data.length > 0) {
          const latestPred = p.data[0];
          api
            .get(`/api/explanations/${latestPred.id}/explain`)
            .then((res) => setExplanationData(res.data))
            .catch(() => {});
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const runPrediction = async (model_type: "classical" | "quantum") => {
    setPredicting(true);
    setPredError("");
    try {
      const res = await api.post("/api/studies/" + id + "/predict", { model_type });
      const newPred = res.data.prediction;
      setPredictions((prev) => [newPred, ...prev]);

      // Automatically request explanation for newly run prediction
      api
        .post(`/api/explanations/${newPred.id}/explain`)
        .then((r) => setExplanationData(r.data))
        .catch(() => {});
    } catch (err: any) {
      const userMsg =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        "Inference pipeline failed. Check ML microservice logs.";
      setPredError(userMsg);
    } finally {
      setPredicting(false);
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

  if (!study) {
    return (
      <AppLayout>
        <div className="p-12 text-center text-slate-500 card max-w-xl mx-auto mt-8">
          <h2 className="text-base font-bold text-slate-800">Study Not Found</h2>
          <p className="text-xs text-slate-500 mt-1">The requested study ID could not be loaded.</p>
          <Link to="/studies" className="btn-primary text-xs mt-4 inline-block">
            Back to Studies
          </Link>
        </div>
      </AppLayout>
    );
  }

  const statusColor = (s: string) =>
    s === "ready"
      ? "bg-emerald-100 text-emerald-700 border-emerald-300"
      : s === "processing"
      ? "bg-blue-100 text-blue-700 border-blue-300"
      : s === "error"
      ? "bg-red-100 text-red-700 border-red-300"
      : "bg-slate-100 text-slate-600 border-slate-300";

  let fileList: string[] = [];
  try {
    fileList = JSON.parse(study.storage_reference || "[]");
  } catch {
    fileList = [];
  }
  const estimatedSlices = Math.max(1, fileList.length || 8);
  const explanationId = explanationData?.explanation?.id;

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-5xl">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-bold text-slate-900">
                {study.original_filename || `Study #${study.id}`}
              </h1>
              <ModeBadge mode={study.mode || "DEMO"} />
            </div>
            <div className="text-xs text-slate-400 font-mono">
              UID: {study.study_instance_uid || `QKN-STUDY-${study.id}`}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${statusColor(study.status)}`}>
              Status: {study.status?.toUpperCase()}
            </span>
            <Link to="/studies" className="btn-secondary text-xs">
              Back
            </Link>
          </div>
        </div>

        <DisclaimerBanner />

        {/* Top Split: MRI Viewer & Study Metadata */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Interactive MRI Viewer */}
          <div className="lg:col-span-7 space-y-3">
            <MriViewer
              studyId={study.id}
              totalSlices={estimatedSlices}
              currentSlice={currentSlice}
              onSliceChange={setCurrentSlice}
              has3dVolume={false}
              activePlane={activePlane}
              onPlaneChange={setActivePlane}
              originalImageUrl={
                explanationId ? `/api/explanations/${explanationId}/image/original` : undefined
              }
              heatmapImageUrl={
                explanationId ? `/api/explanations/${explanationId}/image/heatmap` : undefined
              }
              overlayImageUrl={
                explanationId ? `/api/explanations/${explanationId}/image/overlay` : undefined
              }
            />
          </div>

          {/* Right Column: Metadata & Model Architecture Details */}
          <div className="lg:col-span-5 space-y-4">
            {/* Study Properties */}
            <div className="card p-5 bg-white space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2">
                Study Metadata
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-slate-400 text-[11px]">Ingested Date</div>
                  <div className="font-semibold text-slate-800">{formatDate(study.created_at)}</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[11px]">Preprocessing</div>
                  <div className="font-semibold text-emerald-700">128×128 Normalized</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[11px]">Series Files</div>
                  <div className="font-semibold text-slate-800">{fileList.length || 1} file(s)</div>
                </div>
                <div>
                  <div className="text-slate-400 text-[11px]">Ground Truth</div>
                  <div className="font-semibold text-slate-800">
                    {study.label !== null && study.label !== undefined
                      ? study.label
                        ? "Abnormal (Dataset)"
                        : "Normal (Dataset)"
                      : "Unlabeled Study"}
                  </div>
                </div>
              </div>
            </div>

            {/* Model Architecture Info */}
            <div className="card p-5 bg-white space-y-3">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider border-b border-slate-100 pb-2">
                Hybrid Quantum-Classical Architecture
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Backbone:</span>
                  <span className="font-mono font-semibold text-slate-800">ResNet18 (512D)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Feature Reduction:</span>
                  <span className="font-mono font-semibold text-slate-800">PCA (4 Components)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Quantum Classifier:</span>
                  <span className="font-mono font-semibold text-purple-700">4-Qubit VQC (RY + CNOT)</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Simulation Backend:</span>
                  <span className="font-mono text-slate-600">PennyLane (default.qubit)</span>
                </div>
              </div>
            </div>

            {/* Execution Trigger */}
            <div className="card p-5 bg-blue-50/50 border border-blue-200 space-y-3">
              <h3 className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                Run AI-Assisted Screening
              </h3>
              <p className="text-xs text-blue-800">
                Execute feature extraction and quantum/classical classification for this knee MRI volume.
              </p>

              {predError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {predError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => runPrediction("quantum")}
                  disabled={predicting}
                  className="btn-primary text-xs w-full justify-center"
                >
                  {predicting ? "Running..." : "Hybrid Quantum VQC"}
                </button>
                <button
                  type="button"
                  onClick={() => runPrediction("classical")}
                  disabled={predicting}
                  className="btn-secondary text-xs w-full justify-center"
                >
                  {predicting ? "Running..." : "Classical SVM"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Prediction Results History */}
        {predictions.length > 0 && (
          <div className="card bg-white overflow-hidden space-y-0">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-900 text-sm">
                  AI-Assisted Screening Results &amp; Risk Profiles
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Probabilistic evaluation of ACL integrity. Prototype research assistance only.
                </p>
              </div>
              <span className="text-xs font-mono bg-white px-2.5 py-1 rounded border border-slate-200 text-slate-600">
                {predictions.length} {predictions.length === 1 ? "Inference" : "Inferences"}
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {predictions.map((pred) => {
                const isAbnormal = pred.predicted_class === "abnormal";
                return (
                  <div key={pred.id} className="p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-3 h-3 rounded-full ${
                            isAbnormal ? "bg-red-500 animate-ping" : "bg-emerald-500"
                          }`}
                        />
                        <div>
                          <div
                            className={`text-base font-bold ${
                              isAbnormal ? "text-red-600" : "text-emerald-700"
                            }`}
                          >
                            {isAbnormal
                              ? "AI Screening: ACL Abnormality Detected"
                              : "AI Screening: Normal Knee Study"}
                          </div>
                          <div className="text-xs text-slate-400 font-mono mt-0.5">
                            Model: {pred.model_name} | Timestamp: {formatDate(pred.created_at)}
                          </div>
                        </div>
                      </div>
                      <Link
                        to={`/predictions/${pred.id}/explain`}
                        className="btn-primary text-xs"
                      >
                        Inspect Explainability (Grad-CAM &amp; Quantum Attributions) &#8594;
                      </Link>
                    </div>

                    {/* Metrics Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 text-center">
                        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          p(Abnormal)
                        </div>
                        <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                          {formatPercent(pred.abnormal_probability)}
                        </div>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 text-center">
                        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          p(Normal)
                        </div>
                        <div className="text-xl font-bold font-mono text-slate-900 mt-1">
                          {formatPercent(pred.normal_probability)}
                        </div>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-100 text-center">
                        <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                          Confidence
                        </div>
                        <div className="text-xl font-bold font-mono text-blue-600 mt-1">
                          {formatPercent(pred.confidence)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}