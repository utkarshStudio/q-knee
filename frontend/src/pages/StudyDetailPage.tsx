import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import api from "../lib/api";
import { formatDate } from "../lib/utils";
import { ModeBadge } from "../components/ui/ModeBadge";
import { DisclaimerBanner } from "../components/ui/DisclaimerBanner";
import { MriViewer } from "../components/ui/MriViewer";
import { PredictionPanel } from "../components/ui/PredictionPanel";
import { ArrowLeft, Cpu, ShieldAlert, Network, Loader2, CheckCircle2 } from "lucide-react";

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
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <Loader2 className="w-8 h-8 text-clinical-500 animate-spin" />
          <p className="text-sm font-mono text-graphite-400 uppercase tracking-widest">Loading Study Context...</p>
        </div>
      </AppLayout>
    );
  }

  if (!study) {
    return (
      <AppLayout>
        <div className="p-12 text-center text-graphite-400 card max-w-xl mx-auto mt-8 bg-graphite-900 border-graphite-800">
          <ShieldAlert className="w-12 h-12 text-red-500/50 mx-auto mb-4" />
          <h2 className="text-lg font-bold text-white mb-2">Study Not Found</h2>
          <p className="text-sm">The requested study ID could not be loaded or you lack permission.</p>
          <Link to="/studies" className="btn-secondary mt-6">Return to Studies</Link>
        </div>
      </AppLayout>
    );
  }

  const statusColor = (s: string) =>
    s === "ready" || s === "completed"
      ? "bg-emerald-950/50 text-emerald-400 border-emerald-900"
      : s === "processing"
      ? "bg-blue-950/50 text-blue-400 border-blue-900"
      : s === "error" || s === "failed"
      ? "bg-red-950/50 text-red-400 border-red-900"
      : "bg-graphite-900 text-graphite-400 border-graphite-800";

  let fileList: string[] = [];
  try {
    fileList = typeof study.storage_reference === "string" ? JSON.parse(study.storage_reference || "[]") : (study.storage_reference || []);
  } catch {
    fileList = [];
  }
  const baseSliceCount = Math.max(1, Number(study.slice_count ?? study.metadata?.slice_count ?? (fileList.length > 0 ? fileList.length : 1)));
  const imageSize = study.metadata?.image_size || [128, 128]; // [H, W]
  let totalSlices = baseSliceCount;
  if (activePlane === 'coronal') {
    totalSlices = imageSize[0];
  } else if (activePlane === 'sagittal') {
    totalSlices = imageSize[1];
  }

  const has3dVolume = Boolean(study.has_3d_volume ?? (study.metadata?.has_3d_volume || baseSliceCount > 3));
  const explanationId = explanationData?.explanation?.id;
  const originalSliceUrl = `/api/studies/${study.id}/slice/${currentSlice}?plane=${activePlane}`;

  return (
    <AppLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-[1600px] mx-auto">
        
        {/* Header Area */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="space-y-3">
            <Link to="/studies" className="inline-flex items-center gap-1.5 text-xs font-semibold text-clinical-400 hover:text-clinical-300 transition-colors uppercase tracking-wider">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to Library
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {study.original_filename || `Study #${study.id}`}
              </h1>
              <ModeBadge mode={study.mode || "DEMO"} />
              <span className={`px-2.5 py-1 rounded border text-[10px] font-bold uppercase tracking-wider ${statusColor(study.status)}`}>
                {study.status || 'UNKNOWN'}
              </span>
            </div>
            <div className="text-xs text-graphite-400 font-mono flex items-center gap-3">
              <span>UID: {study.study_instance_uid || `QKN-STUDY-${study.id}`}</span>
              <span className="w-1 h-1 rounded-full bg-graphite-600"></span>
              <span>Ingested: {formatDate(study.created_at)}</span>
            </div>
          </div>
        </div>

        <DisclaimerBanner />

        {/* Main Workspace */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Interactive MRI Viewer */}
          <div className="xl:col-span-8 space-y-6">
            <MriViewer
              studyId={study.id}
              totalSlices={totalSlices}
              currentSlice={currentSlice}
              onSliceChange={setCurrentSlice}
              has3dVolume={has3dVolume}
              activePlane={activePlane}
              onPlaneChange={(plane) => {
                setActivePlane(plane);
                setCurrentSlice(0);
              }}
              originalImageUrl={originalSliceUrl}
              heatmapImageUrl={
                explanationId && activePlane === 'axial' ? `/api/explanations/${explanationId}/image/heatmap` : undefined
              }
              overlayImageUrl={
                explanationId && activePlane === 'axial' ? `/api/explanations/${explanationId}/image/overlay` : undefined
              }
            />

            {/* Prediction Results History */}
            {predictions.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white uppercase tracking-widest border-b border-graphite-800 pb-2">Analysis History</h3>
                <div className="space-y-4">
                  {predictions.map((pred) => (
                    <PredictionPanel key={pred.id} prediction={pred} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Metadata & Actions */}
          <div className="xl:col-span-4 space-y-6">
            
            {/* Run Analysis Card */}
            <div className="card p-6 border-clinical-900/50 bg-gradient-to-b from-clinical-950/30 to-graphite-900/50 relative overflow-hidden">
              <div className="absolute -right-10 -top-10 text-clinical-900/20">
                <Cpu className="w-32 h-32" />
              </div>
              <h3 className="text-sm font-bold text-white mb-2 relative z-10 flex items-center gap-2">
                <Network className="w-4 h-4 text-clinical-400" /> AI Inference Engine
              </h3>
              <p className="text-xs text-graphite-400 mb-6 max-w-[90%] relative z-10">
                Execute automated feature extraction and classification. The quantum pipeline utilizes a 4-qubit VQC for advanced topology analysis.
              </p>

              {predError && (
                <div className="p-3 bg-red-950/50 border border-red-900 rounded-lg text-xs text-red-200 mb-4 relative z-10">
                  {predError}
                </div>
              )}

              <div className="space-y-3 relative z-10">
                <button
                  type="button"
                  onClick={() => runPrediction("quantum")}
                  disabled={predicting}
                  className="w-full btn-primary py-3 flex items-center justify-center gap-2 group"
                >
                  {predicting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                  ) : (
                    <><Cpu className="w-4 h-4 text-clinical-200 group-hover:scale-110 transition-transform" /> Run Hybrid Quantum VQC</>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => runPrediction("classical")}
                  disabled={predicting}
                  className="w-full btn-outline py-3 flex items-center justify-center gap-2"
                >
                  {predicting ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                  ) : (
                    <>Run Classical Baseline (SVM)</>
                  )}
                </button>
              </div>
            </div>

            {/* Study Properties */}
            <div className="card p-6 bg-graphite-900/30">
              <h3 className="text-xs font-bold text-graphite-400 uppercase tracking-widest border-b border-graphite-800 pb-3 mb-4">
                Volume Metadata
              </h3>
              <div className="grid grid-cols-2 gap-y-5 gap-x-4 text-sm">
                <div>
                  <div className="text-[10px] text-graphite-500 uppercase tracking-wider mb-1">Preprocessing</div>
                  <div className="font-semibold text-clinical-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> 128×128 Normalized
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-graphite-500 uppercase tracking-wider mb-1">Series Files</div>
                  <div className="font-semibold text-white font-mono">{fileList.length || 1} file(s)</div>
                </div>
                <div>
                  <div className="text-[10px] text-graphite-500 uppercase tracking-wider mb-1">Total Slices</div>
                  <div className="font-semibold text-white font-mono">{totalSlices}</div>
                </div>
                <div>
                  <div className="text-[10px] text-graphite-500 uppercase tracking-wider mb-1">Geometry</div>
                  <div className="font-semibold text-white">{has3dVolume ? "3D Volumetric" : "Single 2D"}</div>
                </div>
                <div className="col-span-2">
                  <div className="text-[10px] text-graphite-500 uppercase tracking-wider mb-1">Dataset Ground Truth</div>
                  <div className="inline-block px-2.5 py-1 rounded bg-graphite-800 border border-graphite-700 text-xs font-semibold text-graphite-300">
                    {study.label !== null && study.label !== undefined
                      ? study.label ? "Abnormal (Positive)" : "Normal (Negative)"
                      : "Unlabeled (Inference Only)"}
                  </div>
                </div>
              </div>
            </div>

            {/* Architecture Architecture Info */}
            <div className="card p-6 bg-graphite-900/30">
              <h3 className="text-xs font-bold text-graphite-400 uppercase tracking-widest border-b border-graphite-800 pb-3 mb-4">
                Pipeline Architecture
              </h3>
              <div className="space-y-4 text-xs">
                <div className="flex justify-between items-center border-b border-graphite-800/50 pb-2">
                  <span className="text-graphite-500">Backbone</span>
                  <span className="font-mono text-white">ResNet18 (512D)</span>
                </div>
                <div className="flex justify-between items-center border-b border-graphite-800/50 pb-2">
                  <span className="text-graphite-500">Bottleneck</span>
                  <span className="font-mono text-white">PCA (4 Components)</span>
                </div>
                <div className="flex justify-between items-center border-b border-graphite-800/50 pb-2">
                  <span className="text-graphite-500">Quantum Node</span>
                  <span className="font-mono text-quantum-400">4-Qubit VQC (RY+CNOT)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-graphite-500">Simulation Target</span>
                  <span className="font-mono text-graphite-400">PennyLane (default.qubit)</span>
                </div>
              </div>
            </div>
            
          </div>
        </div>

      </div>
    </AppLayout>
  );
}