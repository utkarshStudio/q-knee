import { useState, useCallback, type DragEvent, type ChangeEvent } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "../components/layout/AppLayout";
import api from "../lib/api";
import { DisclaimerBanner } from "../components/ui/DisclaimerBanner";
import { UploadCloud, FileType, CheckCircle2, XCircle, Loader2, ArrowRight, X } from "lucide-react";

const ALLOWED_EXTENSIONS = [".dcm", ".dicom", ".npy", ".png", ".jpg", ".jpeg"];
const MAX_FILE_SIZE_MB = 100;

export default function UploadPage() {
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const steps = [
    { title: "UPLOAD", desc: "Transmitting study data", icon: UploadCloud },
    { title: "VALIDATE", desc: "Parsing metadata & ordering", icon: FileType },
    { title: "PREPROCESS", desc: "128x128 resizing & normalization", icon: Loader2 },
    { title: "FEATURE EXTRACTION", desc: "ResNet18 512D embeddings", icon: CheckCircle2 },
  ];

  const validateFiles = (newFiles: File[]): { valid: File[]; errorMsg?: string } => {
    const valid: File[] = [];
    for (const f of newFiles) {
      const ext = "." + f.name.split(".").pop()?.toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        return { valid: [], errorMsg: `Unsupported file type: ${f.name}. Please upload DICOM (.dcm), NPY (.npy), or PNG/JPEG.` };
      }
      if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        return { valid: [], errorMsg: `File ${f.name} exceeds max size of ${MAX_FILE_SIZE_MB}MB.` };
      }
      valid.push(f);
    }
    return { valid };
  };

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    setError("");
    const droppedFiles = Array.from(e.dataTransfer.files);
    const { valid, errorMsg } = validateFiles(droppedFiles);
    if (errorMsg) {
      setError(errorMsg);
    } else {
      setFiles((prev) => [...prev, ...valid]);
    }
  }, []);

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setError("");
      const selectedFiles = Array.from(e.target.files);
      const { valid, errorMsg } = validateFiles(selectedFiles);
      if (errorMsg) {
        setError(errorMsg);
      } else {
        setFiles((prev) => [...prev, ...valid]);
      }
    }
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleUpload = async () => {
    if (!files.length) {
      setError("Please select at least one valid MRI file (DICOM, NPY, or Image).");
      return;
    }
    setUploading(true);
    setError("");
    setSuccess("");
    setCurrentStep(0);

    try {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));

      // Simulate step progression for responsive UX
      const timer1 = setTimeout(() => setCurrentStep(1), 400);
      const timer2 = setTimeout(() => setCurrentStep(2), 900);
      const timer3 = setTimeout(() => setCurrentStep(3), 1400);

      const res = await api.post("/api/studies/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      setCurrentStep(4);

      setSuccess("Study uploaded and preprocessed successfully! Directing to analysis view...");
      setTimeout(() => navigate("/studies/" + res.data.study.id), 1200);
    } catch (err: any) {
      const userMessage =
        err?.response?.data?.error ||
        err?.response?.data?.detail ||
        "Upload failed. Please ensure the backend and ML microservice are operational.";
      setError(userMessage);
    } finally {
      setUploading(false);
    }
  };

  return (
    <AppLayout>
      <div className="p-6 md:p-8 space-y-8 max-w-[1200px] mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">New MRI Analysis</h1>
          <p className="text-graphite-400 mt-2 text-sm max-w-2xl">
            Upload knee MRI volumes for automated quantum-classical analysis. 
            The system accepts DICOM series (.dcm) or pre-processed 3D NumPy Volumes (.npy).
          </p>
        </div>

        <DisclaimerBanner />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            
            {/* Upload Dropzone */}
            <div
              onDrop={onDrop}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              className={`relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer flex flex-col items-center justify-center p-12 min-h-[400px] ${
                dragging
                  ? "border-clinical-500 bg-clinical-950/20"
                  : "border-graphite-700 hover:border-graphite-500 bg-graphite-900/50"
              }`}
            >
              <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none"></div>
              
              <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 transition-all duration-300 relative z-10 ${
                dragging ? "bg-clinical-600 shadow-[0_0_30px_rgba(45,212,191,0.4)]" : "bg-graphite-800"
              }`}>
                <UploadCloud className={`w-10 h-10 ${dragging ? "text-white" : "text-graphite-400"}`} />
              </div>
              
              <h3 className="text-xl font-bold text-white mb-2 relative z-10">Drop MRI study here</h3>
              <p className="text-graphite-400 text-sm mb-8 text-center max-w-sm relative z-10">
                DICOM / NPY / supported files up to {MAX_FILE_SIZE_MB}MB
              </p>
              
              <label className="relative z-10 btn-primary px-6 py-2.5 cursor-pointer">
                <span>Browse files</span>
                <input
                  type="file"
                  multiple
                  accept=".dcm,.dicom,.npy,.png,.jpg,.jpeg,image/*"
                  onChange={onFileChange}
                  className="sr-only"
                />
              </label>
            </div>

            {/* Messages */}
            {error && (
              <div className="p-4 bg-red-950/50 border border-red-900 rounded-xl text-sm text-red-200 flex items-start gap-3 backdrop-blur-sm">
                <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                <p>{error}</p>
              </div>
            )}
            
            {success && (
              <div className="p-4 bg-emerald-950/50 border border-emerald-900 rounded-xl text-sm text-emerald-200 flex items-start gap-3 backdrop-blur-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
                <p>{success}</p>
              </div>
            )}
          </div>

          {/* Right Panel */}
          <div className="space-y-6">
            
            {/* Selected Files List */}
            <div className="card flex flex-col h-[400px]">
              <div className="flex items-center justify-between p-4 border-b border-graphite-800 bg-graphite-900/50 rounded-t-xl">
                <h3 className="font-semibold text-white text-sm">
                  Study Files <span className="text-graphite-500 ml-1">({files.length})</span>
                </h3>
                {files.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFiles([])}
                    className="text-xs text-graphite-400 hover:text-red-400 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              
              <div className="flex-1 overflow-y-auto p-2">
                {files.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-graphite-500">
                    <FileType className="w-8 h-8 mb-2 opacity-50" />
                    <p className="text-sm">No files selected</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {files.map((f, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-lg hover:bg-graphite-800/50 group transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <FileType className="w-4 h-4 text-graphite-500 shrink-0" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-graphite-200 truncate pr-2">{f.name}</p>
                            <p className="text-[10px] text-graphite-500">{(f.size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="text-graphite-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0 p-1"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="p-4 border-t border-graphite-800 bg-graphite-900/50 rounded-b-xl">
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={uploading || !files.length}
                  className="w-full btn-primary justify-center group"
                >
                  {uploading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" /> Processing...
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Start Analysis <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </span>
                  )}
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* Processing Stepper if Uploading */}
        {uploading && (
          <div className="card p-8 border-clinical-900/50 bg-graphite-900/80 relative overflow-hidden">
            <div className="absolute inset-0 bg-clinical-900/10 animate-pulse pointer-events-none"></div>
            
            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-3 relative z-10">
              <Loader2 className="w-5 h-5 text-clinical-400 animate-spin" />
              Automated Ingestion Pipeline
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-10">
              {steps.map((step, idx) => {
                const Icon = step.icon;
                const isCompleted = idx < currentStep;
                const isActive = idx === currentStep;
                const isPending = idx > currentStep;
                
                return (
                  <div
                    key={idx}
                    className={`p-4 rounded-xl border transition-all duration-500 ${
                      isCompleted
                        ? "bg-clinical-950/30 border-clinical-800/50 text-clinical-400"
                        : isActive
                        ? "bg-deepblue-950/40 border-deepblue-500/50 text-white shadow-[0_0_20px_rgba(59,130,246,0.15)] scale-[1.02]"
                        : "bg-graphite-900/50 border-graphite-800 text-graphite-500"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono tracking-wider font-bold">
                        {isCompleted ? "DONE" : isActive ? "IN PROGRESS" : "PENDING"}
                      </span>
                      {isActive && <span className="w-2 h-2 rounded-full bg-deepblue-400 animate-ping"></span>}
                    </div>
                    
                    <div className="font-bold mb-1 flex items-center gap-2 text-sm">
                      <Icon className={`w-4 h-4 ${isCompleted ? "text-clinical-400" : isActive ? "text-deepblue-400" : "text-graphite-600"}`} />
                      {step.title}
                    </div>
                    
                    <p className={`text-xs ${isCompleted ? "text-clinical-600" : isActive ? "text-graphite-300" : "text-graphite-600"}`}>
                      {step.desc}
                    </p>
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